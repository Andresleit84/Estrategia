import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CyclesService } from './cycles.service';
import { DbService } from '../../database/db.service';
import { AiService } from '../ai/ai.service';

const mockDb = {
  query: jest.fn(),
  queryOne: jest.fn(),
  execute: jest.fn(),
};

const mockAi = {
  runAlignmentAudit: jest.fn().mockResolvedValue(undefined),
  generateCycleCloseBriefing: jest.fn().mockResolvedValue(undefined),
};

const ORG_ID  = 'org-uuid-1234';
const CYCLE_ID = 'cycle-uuid-5678';
const USER_ID  = 'user-uuid-9012';

const fakeCycle = {
  id: CYCLE_ID,
  organization_id: ORG_ID,
  name: 'Q1 2026',
  status: 'DRAFT',
  start_date: '2026-01-01',
  end_date: '2026-03-31',
};

describe('CyclesService', () => {
  let svc: CyclesService;

  beforeEach(async () => {
    jest.resetAllMocks();
    mockAi.runAlignmentAudit.mockResolvedValue(undefined);
    mockAi.generateCycleCloseBriefing.mockResolvedValue(undefined);
    const module = await Test.createTestingModule({
      providers: [
        CyclesService,
        { provide: DbService,  useValue: mockDb },
        { provide: AiService,  useValue: mockAi },
      ],
    }).compile();
    svc = module.get(CyclesService);
  });

  // ── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns all cycles for the org', async () => {
      mockDb.query.mockResolvedValueOnce([fakeCycle]);
      const result = await svc.findAll(ORG_ID);
      expect(result).toEqual([fakeCycle]);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('v_cycles_with_stats'),
        [ORG_ID],
      );
    });

    it('returns empty array when no cycles', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      const result = await svc.findAll(ORG_ID);
      expect(result).toEqual([]);
    });
  });

  // ── findActive ────────────────────────────────────────────────────────────

  describe('findActive', () => {
    it('returns the active cycle when one exists', async () => {
      const active = { ...fakeCycle, status: 'ACTIVE' };
      mockDb.queryOne.mockResolvedValueOnce(active);
      const result = await svc.findActive(ORG_ID);
      expect(result).toEqual(active);
    });

    it('returns null when no active cycle', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);
      const result = await svc.findActive(ORG_ID);
      expect(result).toBeNull();
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns a cycle by id', async () => {
      mockDb.queryOne.mockResolvedValueOnce(fakeCycle);
      const result = await svc.findOne(ORG_ID, CYCLE_ID);
      expect(result).toEqual(fakeCycle);
    });

    it('throws NotFoundException when cycle does not exist', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);
      await expect(svc.findOne(ORG_ID, 'no-such-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates a cycle and returns it', async () => {
      mockDb.query.mockResolvedValueOnce([{ p_cycle_id: CYCLE_ID }]);
      mockDb.queryOne.mockResolvedValueOnce(fakeCycle);
      const result = await svc.create(ORG_ID, USER_ID, {
        name: 'Q1 2026',
        start_date: '2026-01-01',
        end_date: '2026-03-31',
      });
      expect(result).toEqual(fakeCycle);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('sp_create_cycle'),
        expect.arrayContaining([ORG_ID, 'Q1 2026']),
      );
    });

    it('throws BadRequestException when end date is before start date', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('La fecha de fin debe ser posterior'));
      await expect(
        svc.create(ORG_ID, USER_ID, {
          name: 'Bad',
          start_date: '2026-06-01',
          end_date: '2026-01-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException on cycles_dates_check constraint', async () => {
      const err = new Error('cycles_dates_check constraint violation');
      mockDb.query.mockRejectedValueOnce(err);
      await expect(
        svc.create(ORG_ID, USER_ID, { name: 'Bad', start_date: '2026-06-01', end_date: '2026-01-01' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('re-throws unknown errors from DB', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('Connection refused'));
      await expect(
        svc.create(ORG_ID, USER_ID, { name: 'X', start_date: '2026-01-01', end_date: '2026-12-31' }),
      ).rejects.toThrow('Connection refused');
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates a cycle and returns updated version', async () => {
      const updated = { ...fakeCycle, name: 'Q1 Updated' };
      mockDb.queryOne.mockResolvedValueOnce(fakeCycle); // findOne in update
      mockDb.execute.mockResolvedValueOnce(undefined);
      mockDb.queryOne.mockResolvedValueOnce(updated);   // findOne after update
      const result = await svc.update(ORG_ID, CYCLE_ID, { name: 'Q1 Updated' });
      expect(result).toEqual(updated);
    });

    it('throws NotFoundException if cycle does not exist', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);
      await expect(svc.update(ORG_ID, 'bad-id', { name: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  // ── activate ──────────────────────────────────────────────────────────────

  describe('activate', () => {
    it('activates a cycle and triggers alignment audit', async () => {
      const active = { ...fakeCycle, status: 'ACTIVE' };
      mockDb.queryOne.mockResolvedValueOnce(fakeCycle); // findOne check
      mockDb.execute.mockResolvedValueOnce(undefined);  // sp_activate_cycle
      mockDb.queryOne.mockResolvedValueOnce(active);    // findOne after
      const result = await svc.activate(ORG_ID, CYCLE_ID, USER_ID);
      expect(result.status).toBe('ACTIVE');
      // AI audit is fire-and-forget, verify it was called
      expect(mockAi.runAlignmentAudit).toHaveBeenCalledWith(ORG_ID, CYCLE_ID);
    });

    it('throws BadRequestException when a cycle is already active', async () => {
      mockDb.queryOne.mockResolvedValueOnce(fakeCycle);
      mockDb.execute.mockRejectedValueOnce(new Error('Ya existe un ciclo activo para esta organización'));
      await expect(svc.activate(ORG_ID, CYCLE_ID, USER_ID)).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException if cycle not found before activating', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);
      await expect(svc.activate(ORG_ID, 'bad', USER_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ── close ─────────────────────────────────────────────────────────────────

  describe('close', () => {
    it('closes a cycle', async () => {
      const closed = { ...fakeCycle, status: 'COMPLETED' };
      mockDb.queryOne.mockResolvedValueOnce(fakeCycle);
      mockDb.execute.mockResolvedValueOnce(undefined);
      mockDb.queryOne.mockResolvedValueOnce(closed);
      const result = await svc.close(ORG_ID, CYCLE_ID, USER_ID);
      expect(result.status).toBe('COMPLETED');
    });

    it('throws BadRequestException on close failure', async () => {
      mockDb.queryOne.mockResolvedValueOnce(fakeCycle);
      mockDb.execute.mockRejectedValueOnce(new Error('El ciclo no está activo'));
      await expect(svc.close(ORG_ID, CYCLE_ID, USER_ID)).rejects.toThrow(BadRequestException);
    });
  });

  // ── getScore ──────────────────────────────────────────────────────────────

  describe('getScore', () => {
    it('returns the cycle score', async () => {
      mockDb.queryOne.mockResolvedValueOnce(fakeCycle);  // findOne
      mockDb.queryOne.mockResolvedValueOnce({ score: 7.5 });
      const result = await svc.getScore(ORG_ID, CYCLE_ID);
      expect(result).toEqual({ score: 7.5 });
    });

    it('returns score 0 when function returns null', async () => {
      mockDb.queryOne.mockResolvedValueOnce(fakeCycle);
      mockDb.queryOne.mockResolvedValueOnce(null);
      const result = await svc.getScore(ORG_ID, CYCLE_ID);
      expect(result).toEqual({ score: 0 });
    });
  });
});
