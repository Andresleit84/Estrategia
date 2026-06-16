import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InitiativesService } from './initiatives.service';
import { DbService } from '../../database/db.service';

const mockDb = {
  query: jest.fn(),
  queryOne: jest.fn(),
  execute: jest.fn(),
};

const ORG_ID  = 'org-uuid';
const INIT_ID = 'init-uuid';
const KR_ID   = 'kr-uuid';
const USER_ID = 'user-uuid';
const MS_ID   = 'milestone-uuid';

const fakeInit = { id: INIT_ID, organization_id: ORG_ID, status: 'TODO', title: 'Launch feature' };
const fakeMilestone = { id: MS_ID, initiative_id: INIT_ID, title: 'Phase 1', status: 'TODO' };

describe('InitiativesService', () => {
  let svc: InitiativesService;

  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        InitiativesService,
        { provide: DbService, useValue: mockDb },
      ],
    }).compile();
    svc = module.get(InitiativesService);
  });

  // ── list ──────────────────────────────────────────────────────────────────

  describe('list', () => {
    it('returns all initiatives for an org', async () => {
      mockDb.query.mockResolvedValueOnce([fakeInit]);
      const result = await svc.list(ORG_ID, {});
      expect(result).toEqual([fakeInit]);
    });

    it('filters by cycle and team', async () => {
      mockDb.query.mockResolvedValueOnce([fakeInit]);
      await svc.list(ORG_ID, { cycle_id: 'c1', team_id: 't1' });
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('cycle_id'),
        [ORG_ID, 'c1', 't1'],
      );
    });
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates an initiative', async () => {
      mockDb.query.mockResolvedValueOnce([{ p_initiative_id: INIT_ID }]);
      mockDb.queryOne.mockResolvedValueOnce(fakeInit);
      const result = await svc.create(ORG_ID, USER_ID, { title: 'Launch feature', kr_ids: [] });
      expect(result).not.toBeNull();
      expect(result).toEqual(fakeInit);
    });

    it('throws BadRequestException on FK violation (23503)', async () => {
      const err = new Error('FK not exists');
      (err as any).code = '23503';
      mockDb.query.mockRejectedValueOnce(err);
      await expect(svc.create(ORG_ID, USER_ID, { title: 'X' })).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException on duplicate (23505)', async () => {
      const err = new Error('unique constraint');
      (err as any).code = '23505';
      mockDb.query.mockRejectedValueOnce(err);
      await expect(svc.create(ORG_ID, USER_ID, { title: 'X' })).rejects.toThrow(BadRequestException);
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates initiative title', async () => {
      mockDb.queryOne.mockResolvedValueOnce(fakeInit);       // verifyInitiativeAccess
      mockDb.execute.mockResolvedValueOnce(undefined);
      mockDb.queryOne.mockResolvedValueOnce(fakeInit);       // verifyInitiativeAccess in getOne
      mockDb.queryOne.mockResolvedValueOnce({ ...fakeInit, title: 'Updated' });
      const result = await svc.update(ORG_ID, INIT_ID, { title: 'Updated' });
      expect(result).not.toBeNull();
      expect((result as any).title).toBe('Updated');
    });

    it('throws BadRequestException when updating DONE initiative', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ ...fakeInit, status: 'DONE' });
      await expect(svc.update(ORG_ID, INIT_ID, { title: 'X' })).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when updating CANCELLED initiative', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ ...fakeInit, status: 'CANCELLED' });
      await expect(svc.update(ORG_ID, INIT_ID, { title: 'X' })).rejects.toThrow(BadRequestException);
    });

    it('returns current initiative when no fields to update', async () => {
      mockDb.queryOne.mockResolvedValueOnce(fakeInit);
      mockDb.queryOne.mockResolvedValueOnce(fakeInit);
      mockDb.queryOne.mockResolvedValueOnce(fakeInit);
      const result = await svc.update(ORG_ID, INIT_ID, {});
      expect(result).toEqual(fakeInit);
    });
  });

  // ── delete ────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('soft-deletes an initiative', async () => {
      mockDb.queryOne.mockResolvedValueOnce(fakeInit);
      mockDb.execute.mockResolvedValueOnce(undefined);
      const result = await svc.delete(ORG_ID, INIT_ID);
      expect(result).toEqual({ success: true });
    });

    it('throws NotFoundException when initiative not found', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);
      await expect(svc.delete(ORG_ID, 'bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ── linkKr / unlinkKr ────────────────────────────────────────────────────

  describe('linkKr', () => {
    it('links a KR to an initiative', async () => {
      mockDb.queryOne.mockResolvedValueOnce(fakeInit);   // verifyInitiativeAccess
      mockDb.queryOne.mockResolvedValueOnce({ id: KR_ID }); // KR belongs to org
      mockDb.execute.mockResolvedValueOnce(undefined);   // INSERT
      mockDb.queryOne.mockResolvedValueOnce(fakeInit);   // verifyInitiativeAccess in getOne
      mockDb.queryOne.mockResolvedValueOnce(fakeInit);   // getOne result
      await svc.linkKr(ORG_ID, INIT_ID, KR_ID);
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('initiative_key_results'),
        [INIT_ID, KR_ID],
      );
    });

    it('throws NotFoundException when KR not found', async () => {
      mockDb.queryOne.mockResolvedValueOnce(fakeInit);
      mockDb.queryOne.mockResolvedValueOnce(null);
      await expect(svc.linkKr(ORG_ID, INIT_ID, KR_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('unlinkKr', () => {
    it('unlinks a KR from an initiative', async () => {
      mockDb.queryOne.mockResolvedValueOnce(fakeInit);
      mockDb.execute.mockResolvedValueOnce(undefined);
      mockDb.queryOne.mockResolvedValueOnce(fakeInit);
      mockDb.queryOne.mockResolvedValueOnce(fakeInit);
      await svc.unlinkKr(ORG_ID, INIT_ID, KR_ID);
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM initiative_key_results'),
        [INIT_ID, KR_ID],
      );
    });
  });

  // ── Milestones ────────────────────────────────────────────────────────────

  describe('createMilestone', () => {
    it('creates a milestone', async () => {
      mockDb.queryOne.mockResolvedValueOnce(fakeInit);                 // verifyInitiativeAccess
      mockDb.query.mockResolvedValueOnce([{ id: MS_ID }]);             // INSERT RETURNING
      mockDb.query.mockResolvedValueOnce([fakeMilestone]);             // SELECT milestone
      const result = await svc.createMilestone(ORG_ID, INIT_ID, USER_ID, { title: 'Phase 1' });
      expect(result).toEqual(fakeMilestone);
    });

    it('throws NotFoundException when initiative not found', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);
      await expect(svc.createMilestone(ORG_ID, INIT_ID, USER_ID, { title: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('completeMilestone', () => {
    it('completes a milestone', async () => {
      mockDb.queryOne.mockResolvedValueOnce(fakeInit);                        // verifyInitiativeAccess
      mockDb.queryOne.mockResolvedValueOnce({ id: MS_ID, status: 'TODO' });  // milestone exists
      mockDb.execute.mockResolvedValueOnce(undefined);                         // sp_complete_milestone
      mockDb.query.mockResolvedValueOnce([{ ...fakeMilestone, status: 'DONE' }]);
      const result = await svc.completeMilestone(ORG_ID, INIT_ID, MS_ID, USER_ID);
      expect(result.status).toBe('DONE');
    });

    it('throws NotFoundException when milestone not found', async () => {
      mockDb.queryOne.mockResolvedValueOnce(fakeInit);
      mockDb.queryOne.mockResolvedValueOnce(null);
      await expect(svc.completeMilestone(ORG_ID, INIT_ID, 'bad-ms', USER_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException on P0030 (already completed)', async () => {
      mockDb.queryOne.mockResolvedValueOnce(fakeInit);
      mockDb.queryOne.mockResolvedValueOnce({ id: MS_ID, status: 'DONE' });
      const err = new Error('Hito ya completado');
      (err as any).code = 'P0030';
      mockDb.execute.mockRejectedValueOnce(err);
      await expect(svc.completeMilestone(ORG_ID, INIT_ID, MS_ID, USER_ID)).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteMilestone', () => {
    it('deletes a milestone', async () => {
      mockDb.queryOne.mockResolvedValueOnce(fakeInit);
      mockDb.queryOne.mockResolvedValueOnce({ id: MS_ID });
      mockDb.execute.mockResolvedValueOnce(undefined);
      const result = await svc.deleteMilestone(ORG_ID, INIT_ID, MS_ID);
      expect(result).toEqual({ success: true });
    });

    it('throws NotFoundException when milestone not found', async () => {
      mockDb.queryOne.mockResolvedValueOnce(fakeInit);
      mockDb.queryOne.mockResolvedValueOnce(null);
      await expect(svc.deleteMilestone(ORG_ID, INIT_ID, 'bad-id')).rejects.toThrow(NotFoundException);
    });
  });
});
