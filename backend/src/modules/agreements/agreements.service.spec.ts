import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AgreementsService } from './agreements.service';
import { DbService } from '../../database/db.service';
import { TelegramService } from '../../common/telegram/telegram.service';

const mockDb = {
  query: jest.fn(),
  queryOne: jest.fn(),
  execute: jest.fn(),
};

const mockTelegram = {
  send: jest.fn().mockResolvedValue(undefined),
  isConfigured: false,
};

const ORG_ID  = 'org-uuid';
const USER_ID = 'user-uuid';
const AGR_ID  = 'agr-uuid';

const fakeAgreement = {
  id: AGR_ID,
  organization_id: ORG_ID,
  title: 'Entregar informe Q2',
  status: 'PENDING',
  priority: 'HIGH',
  due_date: '2026-06-30',
};

describe('AgreementsService', () => {
  let svc: AgreementsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockTelegram.send.mockResolvedValue(undefined);
    mockTelegram.isConfigured = false;
    const module = await Test.createTestingModule({
      providers: [
        AgreementsService,
        { provide: DbService,       useValue: mockDb },
        { provide: TelegramService, useValue: mockTelegram },
      ],
    }).compile();
    svc = module.get(AgreementsService);
  });

  // ── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns all agreements for an org', async () => {
      mockDb.query.mockResolvedValueOnce([fakeAgreement]);
      const result = await svc.findAll(ORG_ID);
      expect(result).toEqual([fakeAgreement]);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('v_agreements'),
        expect.arrayContaining([ORG_ID]),
      );
    });

    it('filters by status when provided', async () => {
      mockDb.query.mockResolvedValueOnce([fakeAgreement]);
      await svc.findAll(ORG_ID, 'PENDING');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('status'),
        expect.arrayContaining([ORG_ID, 'PENDING']),
      );
    });

    it('returns empty array when no agreements exist', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      const result = await svc.findAll(ORG_ID);
      expect(result).toEqual([]);
    });
  });

  // ── findOne ────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns the agreement when found', async () => {
      mockDb.queryOne.mockResolvedValueOnce(fakeAgreement);
      const result = await svc.findOne(ORG_ID, AGR_ID);
      expect(result).toEqual(fakeAgreement);
      expect(mockDb.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('v_agreements'),
        [AGR_ID, ORG_ID],
      );
    });

    it('throws NotFoundException when agreement not found', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);
      await expect(svc.findOne(ORG_ID, AGR_ID)).rejects.toThrow(NotFoundException);
    });

    it('NotFoundException message includes "Acuerdo no encontrado"', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);
      await expect(svc.findOne(ORG_ID, AGR_ID)).rejects.toThrow('Acuerdo no encontrado');
    });
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto = { title: 'Entregar informe Q2', priority: 'HIGH', due_date: '2026-06-30' } as any;

    it('creates an agreement and returns it via findOne', async () => {
      mockDb.query.mockResolvedValueOnce([{ p_id: AGR_ID }]);
      mockDb.queryOne.mockResolvedValueOnce(fakeAgreement);
      const result = await svc.create(ORG_ID, USER_ID, dto);
      expect(result).toEqual(fakeAgreement);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('sp_create_agreement'),
        expect.any(Array),
      );
    });

    it('passes 10 params to sp_create_agreement', async () => {
      mockDb.query.mockResolvedValueOnce([{ p_id: AGR_ID }]);
      mockDb.queryOne.mockResolvedValueOnce(fakeAgreement);
      await svc.create(ORG_ID, USER_ID, dto);
      const callArgs = mockDb.query.mock.calls[0][1] as unknown[];
      expect(callArgs).toHaveLength(10);
    });

    it('throws BadRequestException on P0012 error', async () => {
      const err = new Error('P0012: validation failed');
      mockDb.query.mockRejectedValueOnce(err);
      await expect(svc.create(ORG_ID, USER_ID, dto)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException on "3 caracteres" validation error', async () => {
      const err = new Error('El título debe tener al menos 3 caracteres');
      mockDb.query.mockRejectedValueOnce(err);
      await expect(svc.create(ORG_ID, USER_ID, dto)).rejects.toThrow(BadRequestException);
    });

    it('re-throws unknown errors from sp_create_agreement', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('Connection lost'));
      await expect(svc.create(ORG_ID, USER_ID, dto)).rejects.toThrow('Connection lost');
    });
  });

  // ── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    const dto = { title: 'Nuevo título' } as any;

    it('updates an agreement and returns updated data', async () => {
      const updated = { ...fakeAgreement, title: 'Nuevo título' };
      mockDb.queryOne.mockResolvedValueOnce(fakeAgreement);       // findOne (before)
      mockDb.query.mockResolvedValueOnce([{ fn_update_agreement: true }]);
      mockDb.queryOne.mockResolvedValueOnce(updated);             // findOne (after)
      const result = await svc.update(ORG_ID, AGR_ID, dto);
      expect(result.title).toBe('Nuevo título');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('fn_update_agreement'),
        expect.any(Array),
      );
    });

    it('throws NotFoundException when agreement does not exist', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);
      await expect(svc.update(ORG_ID, AGR_ID, dto)).rejects.toThrow(NotFoundException);
    });

    it('re-throws P0012 errors from fn_update_agreement as-is', async () => {
      mockDb.queryOne.mockResolvedValueOnce(fakeAgreement);
      const err = new Error('P0012: invalid transition');
      mockDb.query.mockRejectedValueOnce(err);
      await expect(svc.update(ORG_ID, AGR_ID, dto)).rejects.toThrow('P0012: invalid transition');
    });

    it('sends Telegram notification when status changes and telegram is configured', async () => {
      const dtoWithStatus = { status: 'FULFILLED' } as any;
      const updatedAgreement = { ...fakeAgreement, status: 'FULFILLED' };
      mockTelegram.isConfigured = true;
      mockDb.queryOne.mockResolvedValueOnce(fakeAgreement);
      mockDb.query.mockResolvedValueOnce([{ fn_update_agreement: true }]);
      mockDb.queryOne.mockResolvedValueOnce(updatedAgreement);
      mockDb.query.mockResolvedValueOnce([{ name: 'Acme Corp' }]);  // org name for telegram
      await svc.update(ORG_ID, AGR_ID, dtoWithStatus);
      expect(mockTelegram.send).toHaveBeenCalled();
    });

    it('does NOT send Telegram when status does not change', async () => {
      const dtoSameStatus = { title: 'Same status update' } as any;
      mockDb.queryOne.mockResolvedValueOnce(fakeAgreement);
      mockDb.query.mockResolvedValueOnce([{ fn_update_agreement: true }]);
      mockDb.queryOne.mockResolvedValueOnce(fakeAgreement);
      await svc.update(ORG_ID, AGR_ID, dtoSameStatus);
      expect(mockTelegram.send).not.toHaveBeenCalled();
    });
  });

  // ── delete ─────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('soft-deletes an agreement via deleted_at', async () => {
      mockDb.queryOne.mockResolvedValueOnce(fakeAgreement);
      mockDb.query.mockResolvedValueOnce([]);
      const result = await svc.delete(ORG_ID, AGR_ID);
      expect(result).toEqual({ deleted: true, id: AGR_ID });
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('deleted_at'),
        expect.arrayContaining([AGR_ID]),
      );
    });

    it('throws NotFoundException when agreement not found', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);
      await expect(svc.delete(ORG_ID, AGR_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ── getStats ───────────────────────────────────────────────────────────────

  describe('getStats', () => {
    it('returns stats for the org', async () => {
      const stats = { total: '10', pending: '4', fulfilled: '3', in_progress: '2', cancelled: '1', overdue: '0' };
      mockDb.query.mockResolvedValueOnce([stats]);
      const result = await svc.getStats(ORG_ID);
      expect(result).toEqual(stats);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('v_agreements'),
        [ORG_ID],
      );
    });

    it('returns undefined when no stats row found', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      const result = await svc.getStats(ORG_ID);
      expect(result).toBeUndefined();
    });
  });
});
