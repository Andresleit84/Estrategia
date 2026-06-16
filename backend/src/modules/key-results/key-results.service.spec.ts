import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { KeyResultsService } from './key-results.service';
import { DbService } from '../../database/db.service';
import { KrType } from './dto/create-key-result.dto';

const mockDb = {
  query: jest.fn(),
  queryOne: jest.fn(),
  execute: jest.fn(),
};

const ORG_ID  = 'org-uuid';
const OBJ_ID  = 'obj-uuid';
const KR_ID   = 'kr-uuid';
const USER_ID = 'user-uuid';

const fakeKr = {
  id: KR_ID,
  objective_id: OBJ_ID,
  title: 'Increase revenue',
  type: KrType.INCREASE,
  start_value: 0,
  target_value: 100,
  current_value: 50,
  progress: 50,
  status: 'ACTIVE',
};

describe('KeyResultsService', () => {
  let svc: KeyResultsService;

  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        KeyResultsService,
        { provide: DbService, useValue: mockDb },
      ],
    }).compile();
    svc = module.get(KeyResultsService);
  });

  // ── findOne ───────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns a KR when it exists', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ id: KR_ID }); // verifyOrgOwnership
      mockDb.queryOne.mockResolvedValueOnce(fakeKr);        // view query
      const result = await svc.findOne(ORG_ID, KR_ID);
      expect(result).toEqual(fakeKr);
    });

    it('throws NotFoundException when KR does not belong to org', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);
      await expect(svc.findOne(ORG_ID, KR_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when KR not found in view', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ id: KR_ID });
      mockDb.queryOne.mockResolvedValueOnce(null);
      await expect(svc.findOne(ORG_ID, KR_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates an INCREASE KR successfully', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ id: OBJ_ID });  // objective exists
      mockDb.query.mockResolvedValueOnce([{ p_kr_id: KR_ID }]); // sp_create_key_result
      mockDb.queryOne.mockResolvedValueOnce({ id: KR_ID });   // verifyOrgOwnership in findOne
      mockDb.queryOne.mockResolvedValueOnce(fakeKr);          // view query
      const result = await svc.create(ORG_ID, OBJ_ID, USER_ID, {
        title: 'Increase revenue',
        type: KrType.INCREASE,
        start_value: 0,
        target_value: 100,
      });
      expect(result).toEqual(fakeKr);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('sp_create_key_result'),
        expect.any(Array),
      );
    });

    it('throws BadRequestException when INCREASE KR target <= start', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ id: OBJ_ID });
      await expect(
        svc.create(ORG_ID, OBJ_ID, USER_ID, {
          title: 'Bad', type: KrType.INCREASE, start_value: 100, target_value: 50,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when INCREASE KR target equals start', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ id: OBJ_ID });
      await expect(
        svc.create(ORG_ID, OBJ_ID, USER_ID, {
          title: 'Bad', type: KrType.INCREASE, start_value: 50, target_value: 50,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when DECREASE KR target >= start', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ id: OBJ_ID });
      await expect(
        svc.create(ORG_ID, OBJ_ID, USER_ID, {
          title: 'Bad', type: KrType.DECREASE, start_value: 50, target_value: 100,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when objective does not exist', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null); // objective not found
      await expect(
        svc.create(ORG_ID, OBJ_ID, USER_ID, {
          title: 'X', type: KrType.INCREASE, start_value: 0, target_value: 10,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when KR limit is reached (P0007)', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ id: OBJ_ID });
      mockDb.query.mockRejectedValueOnce(new Error('P0007: límite de 5 resultados'));
      await expect(
        svc.create(ORG_ID, OBJ_ID, USER_ID, {
          title: 'X', type: KrType.INCREASE, start_value: 0, target_value: 10,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates a DECREASE KR when target is less than start', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ id: OBJ_ID });
      mockDb.query.mockResolvedValueOnce([{ p_kr_id: KR_ID }]);
      mockDb.queryOne.mockResolvedValueOnce({ id: KR_ID });
      mockDb.queryOne.mockResolvedValueOnce({ ...fakeKr, type: KrType.DECREASE });
      const result = await svc.create(ORG_ID, OBJ_ID, USER_ID, {
        title: 'Decrease churn',
        type: KrType.DECREASE,
        start_value: 20,
        target_value: 5,
      });
      expect(result).not.toBeNull();
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates a KR and returns updated version', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ id: KR_ID }); // verifyOrgOwnership
      mockDb.query.mockResolvedValueOnce([]);               // fn_update_key_result
      mockDb.queryOne.mockResolvedValueOnce({ id: KR_ID }); // verifyOrgOwnership in findOne
      mockDb.queryOne.mockResolvedValueOnce({ ...fakeKr, title: 'Updated' });
      const result = await svc.update(ORG_ID, KR_ID, { title: 'Updated' });
      expect(result.title).toBe('Updated');
    });

    it('throws NotFoundException when KR not found on update', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null); // verifyOrgOwnership returns null
      await expect(svc.update(ORG_ID, KR_ID, { title: 'X' })).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when editing completed KR (P0003)', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ id: KR_ID }); // verifyOrgOwnership succeeds
      mockDb.query.mockRejectedValueOnce(new Error('P0003: No se puede editar un KR completado'));
      await expect(svc.update(ORG_ID, KR_ID, { title: 'X' })).rejects.toThrow(BadRequestException);
    });
  });

  // ── cancel ────────────────────────────────────────────────────────────────

  describe('cancel', () => {
    it('cancels a KR', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ id: KR_ID }); // verifyOrgOwnership
      mockDb.query.mockResolvedValueOnce([]);               // sp_cancel_key_result
      mockDb.queryOne.mockResolvedValueOnce({ id: KR_ID }); // verifyOrgOwnership in findOne
      mockDb.queryOne.mockResolvedValueOnce({ ...fakeKr, status: 'CANCELLED' });
      const result = await svc.cancel(ORG_ID, KR_ID, USER_ID);
      expect(result.status).toBe('CANCELLED');
    });

    it('throws NotFoundException when KR not found for cancel', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);
      await expect(svc.cancel(ORG_ID, 'bad-id', USER_ID)).rejects.toThrow(NotFoundException);
    });
  });
});
