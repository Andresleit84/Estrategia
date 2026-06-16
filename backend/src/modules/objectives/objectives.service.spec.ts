import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ObjectivesService } from './objectives.service';
import { DbService } from '../../database/db.service';
import { AiService } from '../ai/ai.service';
import { RedisService } from '../../common/redis/redis.service';
import { ObjectiveLevel } from './dto/create-objective.dto';

const mockDb = {
  query: jest.fn(),
  queryOne: jest.fn(),
  execute: jest.fn(),
};

const mockAi = {
  runAlignmentAudit: jest.fn().mockResolvedValue(undefined),
};

const mockRedis = {
  delPattern: jest.fn().mockResolvedValue(undefined),
};

const ORG_ID    = 'org-uuid';
const CYCLE_ID  = 'cycle-uuid';
const OBJ_ID    = 'obj-uuid';
const USER_ID   = 'user-uuid';
const INTENT_ID = 'intent-uuid';

const fakeObj = {
  id: OBJ_ID,
  organization_id: ORG_ID,
  cycle_id: CYCLE_ID,
  level: 'COMPANY',
  title: 'Grow revenue',
  status: 'ACTIVE',
  progress: 60,
};

describe('ObjectivesService', () => {
  let svc: ObjectivesService;

  beforeEach(async () => {
    jest.resetAllMocks();
    mockAi.runAlignmentAudit.mockResolvedValue(undefined);
    mockRedis.delPattern.mockResolvedValue(undefined);
    const module = await Test.createTestingModule({
      providers: [
        ObjectivesService,
        { provide: DbService,     useValue: mockDb },
        { provide: AiService,     useValue: mockAi },
        { provide: RedisService,  useValue: mockRedis },
      ],
    }).compile();
    svc = module.get(ObjectivesService);
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns objectives for an org', async () => {
      mockDb.query.mockResolvedValueOnce([fakeObj]);
      const result = await svc.findAll(ORG_ID);
      expect(result).toEqual([fakeObj]);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('v_objectives_with_progress'),
        [ORG_ID],
      );
    });

    it('applies cycleId filter when provided', async () => {
      mockDb.query.mockResolvedValueOnce([fakeObj]);
      await svc.findAll(ORG_ID, CYCLE_ID);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('cycle_id'),
        [ORG_ID, CYCLE_ID],
      );
    });

    it('applies level filter when provided', async () => {
      mockDb.query.mockResolvedValueOnce([fakeObj]);
      await svc.findAll(ORG_ID, undefined, 'COMPANY');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('level'),
        [ORG_ID, 'COMPANY'],
      );
    });

    it('applies multiple filters', async () => {
      mockDb.query.mockResolvedValueOnce([fakeObj]);
      await svc.findAll(ORG_ID, CYCLE_ID, 'AREA', 'ACTIVE');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('cycle_id'),
        [ORG_ID, CYCLE_ID, 'AREA', 'ACTIVE'],
      );
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns an objective by id', async () => {
      mockDb.queryOne.mockResolvedValueOnce(fakeObj);
      const result = await svc.findOne(ORG_ID, OBJ_ID);
      expect(result).toEqual(fakeObj);
    });

    it('throws NotFoundException when objective does not exist', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);
      await expect(svc.findOne(ORG_ID, 'bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ── findKeyResults ────────────────────────────────────────────────────────

  describe('findKeyResults', () => {
    it('returns KRs for an objective', async () => {
      const fakeKrs = [{ id: 'kr-1', title: 'KR 1' }];
      mockDb.queryOne.mockResolvedValueOnce({ id: OBJ_ID });
      mockDb.query.mockResolvedValueOnce(fakeKrs);
      const result = await svc.findKeyResults(ORG_ID, OBJ_ID);
      expect(result).toEqual(fakeKrs);
    });

    it('throws NotFoundException when objective does not exist', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);
      await expect(svc.findKeyResults(ORG_ID, 'bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    const validDto = {
      cycle_id: CYCLE_ID,
      title: 'Grow revenue',
      level: ObjectiveLevel.COMPANY,
    };

    it('creates a COMPANY objective successfully', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ id: CYCLE_ID }); // cycle exists
      mockDb.query.mockResolvedValueOnce([{ p_objective_id: OBJ_ID }]); // sp_create_objective
      mockDb.queryOne.mockResolvedValueOnce(fakeObj); // findOne
      const result = await svc.create(ORG_ID, USER_ID, validDto);
      expect(result).toEqual(fakeObj);
      expect(mockAi.runAlignmentAudit).not.toHaveBeenCalled(); // only for TEAM
    });

    it('triggers alignment audit when creating TEAM objective', async () => {
      const teamObjDto = { ...validDto, level: ObjectiveLevel.TEAM, parent_objective_id: 'parent-obj' };
      mockDb.queryOne.mockResolvedValueOnce({ id: CYCLE_ID });
      mockDb.query.mockResolvedValueOnce([{ p_objective_id: OBJ_ID }]);
      mockDb.queryOne.mockResolvedValueOnce({ ...fakeObj, level: 'TEAM' });
      await svc.create(ORG_ID, USER_ID, teamObjDto);
      expect(mockAi.runAlignmentAudit).toHaveBeenCalledWith(ORG_ID, CYCLE_ID);
    });

    it('throws NotFoundException when cycle not found', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);
      await expect(svc.create(ORG_ID, USER_ID, validDto)).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when objective limit is reached (P0006)', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ id: CYCLE_ID });
      mockDb.query.mockRejectedValueOnce(new Error('P0006: límite de 5 objetivos'));
      await expect(svc.create(ORG_ID, USER_ID, validDto)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when TEAM objective has no parent (P0010)', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ id: CYCLE_ID });
      mockDb.query.mockRejectedValueOnce(new Error('P0010: TEAM objective requires a parent'));
      await expect(
        svc.create(ORG_ID, USER_ID, { ...validDto, level: ObjectiveLevel.TEAM }),
      ).rejects.toThrow(BadRequestException);
    });

    it('invalidates reports cache after creating an objective', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ id: CYCLE_ID });
      mockDb.query.mockResolvedValueOnce([{ p_objective_id: OBJ_ID }]);
      mockDb.queryOne.mockResolvedValueOnce(fakeObj);
      await svc.create(ORG_ID, USER_ID, validDto);
      expect(mockRedis.delPattern).toHaveBeenCalledWith(`reports:*:${ORG_ID}:*`);
    });

    it('links strategic intent when provided', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ id: CYCLE_ID });       // cycle
      mockDb.query.mockResolvedValueOnce([{ p_objective_id: OBJ_ID }]); // sp_create_objective
      mockDb.queryOne.mockResolvedValueOnce({ id: INTENT_ID });       // intent exists
      mockDb.execute.mockResolvedValueOnce(undefined);                 // UPDATE objectives
      mockDb.queryOne.mockResolvedValueOnce(fakeObj);                 // findOne
      await svc.create(ORG_ID, USER_ID, { ...validDto, strategic_intent_id: INTENT_ID });
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('strategic_intent_id'),
        [INTENT_ID, OBJ_ID],
      );
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates an objective', async () => {
      const updated = { ...fakeObj, title: 'Updated' };
      mockDb.queryOne.mockResolvedValueOnce(fakeObj);  // findOne
      mockDb.query.mockResolvedValueOnce([]);          // fn_update_objective
      mockDb.queryOne.mockResolvedValueOnce(updated);  // findOne after update
      const result = await svc.update(ORG_ID, OBJ_ID, { title: 'Updated' });
      expect(result.title).toBe('Updated');
    });

    it('throws BadRequestException when editing completed objective (P0003)', async () => {
      mockDb.queryOne.mockResolvedValueOnce(fakeObj);
      mockDb.query.mockRejectedValueOnce(new Error('P0003: No se puede editar'));
      await expect(svc.update(ORG_ID, OBJ_ID, { title: 'X' })).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when strategic intent not found', async () => {
      mockDb.queryOne.mockResolvedValueOnce(fakeObj);  // findOne (initial guard)
      mockDb.query.mockResolvedValueOnce([]);          // fn_update_objective
      mockDb.queryOne.mockResolvedValueOnce(null);     // intent not found → throws
      await expect(
        svc.update(ORG_ID, OBJ_ID, { strategic_intent_id: 'bad-intent' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('invalidates reports cache after update', async () => {
      mockDb.queryOne.mockResolvedValueOnce(fakeObj);
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.queryOne.mockResolvedValueOnce(fakeObj);
      await svc.update(ORG_ID, OBJ_ID, { title: 'New title' });
      expect(mockRedis.delPattern).toHaveBeenCalledWith(`reports:*:${ORG_ID}:*`);
    });
  });

  // ── cancel ────────────────────────────────────────────────────────────────

  describe('cancel', () => {
    it('cancels an objective', async () => {
      mockDb.queryOne.mockResolvedValueOnce(fakeObj);               // findOne
      mockDb.query.mockResolvedValueOnce([]);                       // sp_cancel_objective
      mockDb.queryOne.mockResolvedValueOnce({ ...fakeObj, status: 'CANCELLED' }); // findOne after
      const result = await svc.cancel(ORG_ID, OBJ_ID, USER_ID);
      expect(result.status).toBe('CANCELLED');
    });

    it('throws NotFoundException if objective not found', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);
      await expect(svc.cancel(ORG_ID, 'bad-id', USER_ID)).rejects.toThrow(NotFoundException);
    });

    it('invalidates reports cache after cancel', async () => {
      mockDb.queryOne.mockResolvedValueOnce(fakeObj);
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.queryOne.mockResolvedValueOnce({ ...fakeObj, status: 'CANCELLED' });
      await svc.cancel(ORG_ID, OBJ_ID, USER_ID);
      expect(mockRedis.delPattern).toHaveBeenCalledWith(`reports:*:${ORG_ID}:*`);
    });
  });

  // ── getAlignmentMap ───────────────────────────────────────────────────────

  describe('getAlignmentMap', () => {
    it('returns the alignment map', async () => {
      const mapData = [{ company_title: 'Grow', area_titles: ['Area 1'] }];
      mockDb.query.mockResolvedValueOnce(mapData);
      const result = await svc.getAlignmentMap(ORG_ID, CYCLE_ID);
      expect(result).toEqual(mapData);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('v_alignment_map'),
        [ORG_ID, CYCLE_ID],
      );
    });
  });
});
