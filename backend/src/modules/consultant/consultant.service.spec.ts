import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConsultantService } from './consultant.service';
import { DbService } from '../../database/db.service';

const mockDb = {
  query: jest.fn(),
  queryOne: jest.fn(),
  execute: jest.fn(),
};

const CONSULTANT_EMAIL = 'consultor@sendoagil.com';
const ORG_ID           = 'org-uuid';
const CLIENT_ID        = 'client-uuid';

const fakeClientHealth = {
  org_id: ORG_ID,
  org_name: 'Acme Corp',
  cycle_id: 'cycle-1',
  cycle_name: 'Q2 2026',
  cycle_score: 72.5,
  active_objectives: 5,
  on_track: 3,
  at_risk: 1,
  completed: 1,
  krs_at_risk: 2,
  digest_enabled: true,
  client_alerts_enabled: false,
  linked_at: '2026-05-01T00:00:00Z',
};

describe('ConsultantService', () => {
  let svc: ConsultantService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ConsultantService,
        { provide: DbService, useValue: mockDb },
      ],
    }).compile();
    svc = module.get(ConsultantService);
  });

  // ── listClients ────────────────────────────────────────────────────────────

  describe('listClients', () => {
    it('returns array of client org health records', async () => {
      mockDb.query.mockResolvedValueOnce([fakeClientHealth]);
      const result = await svc.listClients(CONSULTANT_EMAIL);
      expect(result).toEqual([fakeClientHealth]);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.any(String),
        [CONSULTANT_EMAIL],
      );
    });

    it('returns empty array when consultant has no clients', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      const result = await svc.listClients(CONSULTANT_EMAIL);
      expect(result).toEqual([]);
    });

    it('queries by consultant_email via consultant_clients table', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      await svc.listClients(CONSULTANT_EMAIL);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('consultant_clients'),
        expect.any(Array),
      );
    });
  });

  // ── addClient ──────────────────────────────────────────────────────────────

  describe('addClient', () => {
    it('throws ForbiddenException when consultant user not found in org', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);
      await expect(svc.addClient(CONSULTANT_EMAIL, ORG_ID)).rejects.toThrow(ForbiddenException);
    });

    it('ForbiddenException message includes "No tienes acceso a esa organización"', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);
      await expect(svc.addClient(CONSULTANT_EMAIL, ORG_ID)).rejects.toThrow(
        'No tienes acceso a esa organización',
      );
    });

    it('throws NotFoundException when organization does not exist or is deleted', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ id: 'user-1' });
      mockDb.queryOne.mockResolvedValueOnce(null);
      await expect(svc.addClient(CONSULTANT_EMAIL, ORG_ID)).rejects.toThrow(NotFoundException);
    });

    it('NotFoundException message includes "Organización no encontrada"', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ id: 'user-1' });
      mockDb.queryOne.mockResolvedValueOnce(null);
      await expect(svc.addClient(CONSULTANT_EMAIL, ORG_ID)).rejects.toThrow(
        'Organización no encontrada',
      );
    });

    it('reactivates and returns existing row when relationship was previously deactivated', async () => {
      const existingRow = { id: CLIENT_ID, client_org_id: ORG_ID, digest_enabled: true, created_at: '2026-05-01' };
      mockDb.queryOne.mockResolvedValueOnce({ id: 'user-1' });
      mockDb.queryOne.mockResolvedValueOnce({ id: ORG_ID });
      mockDb.queryOne.mockResolvedValueOnce(existingRow);
      mockDb.execute.mockResolvedValueOnce(undefined);
      const result = await svc.addClient(CONSULTANT_EMAIL, ORG_ID);
      expect(result).toEqual(existingRow);
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('is_active = TRUE'),
        expect.any(Array),
      );
    });

    it('inserts new row when not yet linked', async () => {
      const newRow = { id: CLIENT_ID, client_org_id: ORG_ID, digest_enabled: false, created_at: '2026-05-30' };
      mockDb.queryOne.mockResolvedValueOnce({ id: 'user-1' });
      mockDb.queryOne.mockResolvedValueOnce({ id: ORG_ID });
      mockDb.queryOne.mockResolvedValueOnce(null);
      mockDb.query.mockResolvedValueOnce([newRow]);
      const result = await svc.addClient(CONSULTANT_EMAIL, ORG_ID);
      expect(result).toEqual(newRow);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('consultant_clients'),
        expect.any(Array),
      );
    });

    it('passes consultantEmail and orgId to the INSERT', async () => {
      const newRow = { id: CLIENT_ID, client_org_id: ORG_ID, digest_enabled: false, created_at: '2026-05-30' };
      mockDb.queryOne.mockResolvedValueOnce({ id: 'user-1' });
      mockDb.queryOne.mockResolvedValueOnce({ id: ORG_ID });
      mockDb.queryOne.mockResolvedValueOnce(null);
      mockDb.query.mockResolvedValueOnce([newRow]);
      await svc.addClient(CONSULTANT_EMAIL, ORG_ID);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([CONSULTANT_EMAIL, ORG_ID]),
      );
    });
  });

  // ── removeClient ───────────────────────────────────────────────────────────

  describe('removeClient', () => {
    it('soft-deletes by setting is_active=FALSE', async () => {
      mockDb.execute.mockResolvedValueOnce(undefined);
      await svc.removeClient(CONSULTANT_EMAIL, ORG_ID);
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('is_active'),
        expect.arrayContaining([CONSULTANT_EMAIL, ORG_ID]),
      );
    });

    it('passes consultant_email and org_id to the UPDATE', async () => {
      mockDb.execute.mockResolvedValueOnce(undefined);
      await svc.removeClient(CONSULTANT_EMAIL, ORG_ID);
      const [, params] = mockDb.execute.mock.calls[0] as [string, unknown[]];
      expect(params).toContain(CONSULTANT_EMAIL);
      expect(params).toContain(ORG_ID);
    });
  });

  // ── toggleDigest ───────────────────────────────────────────────────────────

  describe('toggleDigest', () => {
    it('enables digest without throwing', async () => {
      mockDb.execute.mockResolvedValueOnce(undefined);
      await expect(svc.toggleDigest(CONSULTANT_EMAIL, ORG_ID, true)).resolves.toBeUndefined();
    });

    it('disables digest without throwing', async () => {
      mockDb.execute.mockResolvedValueOnce(undefined);
      await expect(svc.toggleDigest(CONSULTANT_EMAIL, ORG_ID, false)).resolves.toBeUndefined();
    });

    it('passes enabled flag to the UPDATE query', async () => {
      mockDb.execute.mockResolvedValueOnce(undefined);
      await svc.toggleDigest(CONSULTANT_EMAIL, ORG_ID, true);
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('digest_enabled'),
        expect.arrayContaining([CONSULTANT_EMAIL, ORG_ID, true]),
      );
    });
  });

  // ── toggleClientAlerts ─────────────────────────────────────────────────────

  describe('toggleClientAlerts', () => {
    it('throws when consultant link not found', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);
      await expect(svc.toggleClientAlerts(CONSULTANT_EMAIL, ORG_ID, true)).rejects.toThrow();
    });

    it('updates client_alerts_enabled flag', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ id: CLIENT_ID });
      mockDb.execute.mockResolvedValueOnce(undefined);
      mockDb.execute.mockResolvedValueOnce(undefined);
      await expect(svc.toggleClientAlerts(CONSULTANT_EMAIL, ORG_ID, true)).resolves.toBeUndefined();
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('client_alerts_enabled'),
        expect.arrayContaining([CONSULTANT_EMAIL, ORG_ID]),
      );
    });

    it('also writes feature flag to org parameters', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ id: CLIENT_ID });
      mockDb.execute.mockResolvedValueOnce(undefined);
      mockDb.execute.mockResolvedValueOnce(undefined);
      await svc.toggleClientAlerts(CONSULTANT_EMAIL, ORG_ID, false);
      expect(mockDb.execute).toHaveBeenCalledTimes(2);
    });
  });

  // ── getClientAlertsState ───────────────────────────────────────────────────

  describe('getClientAlertsState', () => {
    it('returns true when notifications feature is enabled', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ enabled: true });
      const result = await svc.getClientAlertsState(ORG_ID);
      expect(result).toBe(true);
    });

    it('returns false when row not found', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);
      const result = await svc.getClientAlertsState(ORG_ID);
      expect(result).toBe(false);
    });
  });
});
