import { Test } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { DbService } from '../../database/db.service';

const otpMockTotp = {
  secret: { base32: 'JBSWY3DPEHPK3PXP' },
  toString: () => 'otpauth://totp/OKR%20System:test@test.com?secret=JBSWY3DPEHPK3PXP',
  validate: jest.fn().mockReturnValue(0),
};

jest.mock('otpauth', () => ({
  TOTP: jest.fn().mockImplementation(() => otpMockTotp),
  Secret: { fromBase32: jest.fn().mockReturnValue({ base32: 'JBSWY3DPEHPK3PXP' }) },
}));

jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,FAKE'),
}));

const mockDb = {
  query: jest.fn(),
  queryOne: jest.fn(),
  execute: jest.fn(),
};

const USER_ID = 'user-uuid';

describe('UsersService', () => {
  let svc: UsersService;

  beforeEach(async () => {
    jest.clearAllMocks();
    otpMockTotp.validate.mockReturnValue(0);
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: DbService, useValue: mockDb },
      ],
    }).compile();
    svc = module.get(UsersService);
  });

  // ── Profile ────────────────────────────────────────────────────────────────

  describe('getProfile', () => {
    const fakeProfile = {
      user_id: USER_ID,
      timezone: 'America/Bogota',
      locale: 'es',
      notify_at_risk: true,
      notify_checkin_reminder: true,
      notify_weekly_briefing: false,
      updated_at: '2026-01-01T00:00:00Z',
    };

    it('returns profile when it exists', async () => {
      mockDb.queryOne.mockResolvedValueOnce(fakeProfile);
      const result = await svc.getProfile(USER_ID);
      expect(result).toEqual(fakeProfile);
    });

    it('auto-creates profile when missing and retries', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);
      mockDb.execute.mockResolvedValueOnce(undefined);
      mockDb.queryOne.mockResolvedValueOnce(fakeProfile);
      const result = await svc.getProfile(USER_ID);
      expect(result).toEqual(fakeProfile);
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('user_profiles'),
        [USER_ID],
      );
    });
  });

  describe('updateProfile', () => {
    const fakeProfile = {
      user_id: USER_ID,
      timezone: 'America/Bogota',
      locale: 'es',
      notify_at_risk: true,
      notify_checkin_reminder: true,
      notify_weekly_briefing: false,
      updated_at: '2026-01-01T00:00:00Z',
    };

    it('calls sp_update_user_profile with merged values', async () => {
      mockDb.queryOne.mockResolvedValueOnce(fakeProfile);
      mockDb.execute.mockResolvedValueOnce(undefined);
      const updated = { ...fakeProfile, locale: 'en' };
      mockDb.queryOne.mockResolvedValueOnce(updated);
      const result = await svc.updateProfile(USER_ID, { locale: 'en' });
      expect(result.locale).toBe('en');
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('sp_update_user_profile'),
        expect.arrayContaining([USER_ID, 'America/Bogota', 'en']),
      );
    });
  });

  // ── MFA ───────────────────────────────────────────────────────────────────

  describe('setupMfa', () => {
    it('returns secret, otpauth URL and QR code', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ email: 'test@test.com', name: 'Test' });
      mockDb.execute.mockResolvedValueOnce(undefined);
      mockDb.execute.mockResolvedValueOnce(undefined);
      const result = await svc.setupMfa(USER_ID);
      expect(result).toHaveProperty('secret');
      expect(result).toHaveProperty('otpauthUrl');
      expect(result).toHaveProperty('qrCodeDataUrl');
      expect(result.qrCodeDataUrl).toContain('data:image/png');
    });

    it('throws NotFoundException when user does not exist', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);
      await expect(svc.setupMfa(USER_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('enableMfa', () => {
    it('enables MFA when code is valid', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ secret_base32: 'JBSWY3DPEHPK3PXP', is_active: false });
      mockDb.execute.mockResolvedValueOnce(undefined);
      await expect(svc.enableMfa(USER_ID, '123456')).resolves.toBeUndefined();
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('is_active = true'),
        [USER_ID],
      );
    });

    it('throws NotFoundException when MFA not configured', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);
      await expect(svc.enableMfa(USER_ID, '123456')).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when MFA already enabled', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ secret_base32: 'ABC', is_active: true });
      await expect(svc.enableMfa(USER_ID, '123456')).rejects.toThrow(ConflictException);
    });

    it('throws ForbiddenException when code is invalid', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ secret_base32: 'ABC', is_active: false });
      jest.spyOn(svc, 'verifyTotpCode').mockReturnValueOnce(false);
      await expect(svc.enableMfa(USER_ID, '000000')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('disableMfa', () => {
    it('disables MFA when code is valid', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ secret_base32: 'ABC', is_active: true });
      mockDb.execute.mockResolvedValueOnce(undefined);
      await expect(svc.disableMfa(USER_ID, '123456')).resolves.toBeUndefined();
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM user_mfa_secrets'),
        [USER_ID],
      );
    });

    it('throws NotFoundException when MFA not enabled', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);
      await expect(svc.disableMfa(USER_ID, '123456')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when is_active is false', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ secret_base32: 'ABC', is_active: false });
      await expect(svc.disableMfa(USER_ID, '123456')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when code is invalid', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ secret_base32: 'ABC', is_active: true });
      jest.spyOn(svc, 'verifyTotpCode').mockReturnValueOnce(false);
      await expect(svc.disableMfa(USER_ID, '000000')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getMfaStatus', () => {
    it('returns enabled=true when MFA is active', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ is_active: true, verified_at: '2026-01-01' });
      const result = await svc.getMfaStatus(USER_ID);
      expect(result).toEqual({ enabled: true, verified_at: '2026-01-01' });
    });

    it('returns enabled=false when MFA is not configured', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);
      const result = await svc.getMfaStatus(USER_ID);
      expect(result).toEqual({ enabled: false, verified_at: null });
    });
  });

  describe('verifyTotpCode', () => {
    it('returns true for a valid TOTP code (mocked as returning 0)', () => {
      const result = svc.verifyTotpCode('JBSWY3DPEHPK3PXP', '123456');
      expect(result).toBe(true);
    });

    it('returns false when TOTP validate returns null', () => {
      otpMockTotp.validate.mockReturnValueOnce(null);
      const result = svc.verifyTotpCode('JBSWY3DPEHPK3PXP', '000000');
      expect(result).toBe(false);
    });
  });

  // ── GDPR ──────────────────────────────────────────────────────────────────

  describe('exportData', () => {
    it('returns exported data from stored procedure', async () => {
      const exportedData = { user: { email: 'test@test.com' }, checkins: [] };
      mockDb.queryOne.mockResolvedValueOnce({ sp_export_user_data: exportedData });
      const result = await svc.exportData(USER_ID);
      expect(result).toEqual(exportedData);
    });

    it('returns empty object when procedure returns null', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);
      const result = await svc.exportData(USER_ID);
      expect(result).toEqual({});
    });
  });

  describe('deleteAccount', () => {
    it('calls sp_anonymize_user', async () => {
      mockDb.execute.mockResolvedValueOnce(undefined);
      await svc.deleteAccount(USER_ID);
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('sp_anonymize_user'),
        [USER_ID],
      );
    });
  });

  // ── First Day ─────────────────────────────────────────────────────────────

  describe('getFirstDayContext', () => {
    const ORG_ID = 'org-uuid';

    it('calls fn_first_day_context with orgId and userId', async () => {
      const ctx = { org: { name: 'Acme' }, active_cycle: null, company_objectives: [], my_krs: [], my_backlog_items: [] };
      mockDb.query.mockResolvedValueOnce([{ fn_first_day_context: ctx }]);
      const result = await svc.getFirstDayContext(USER_ID, ORG_ID);
      expect(result).toEqual(ctx);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('fn_first_day_context'),
        [ORG_ID, USER_ID],
      );
    });

    it('returns the JSONB payload from fn_first_day_context', async () => {
      const ctx = { org: { name: 'Beta Corp' }, active_cycle: { name: 'Q3 2026' }, company_objectives: [], my_krs: [], my_backlog_items: [] };
      mockDb.query.mockResolvedValueOnce([{ fn_first_day_context: ctx }]);
      const result = await svc.getFirstDayContext(USER_ID, ORG_ID);
      expect(result).toHaveProperty('org');
      expect((result as any).org.name).toBe('Beta Corp');
    });
  });

  describe('completeFirstDay', () => {
    it('executes UPDATE users SET first_day_completed_at = NOW() WHERE id = $1 AND first_day_completed_at IS NULL', async () => {
      mockDb.execute.mockResolvedValueOnce(undefined);
      await svc.completeFirstDay(USER_ID);
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('first_day_completed_at'),
        [USER_ID],
      );
    });

    it('UPDATE includes IS NULL guard for idempotency', async () => {
      mockDb.execute.mockResolvedValueOnce(undefined);
      await svc.completeFirstDay(USER_ID);
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('IS NULL'),
        expect.any(Array),
      );
    });
  });

  describe('resetFirstDay', () => {
    const TARGET_ID = 'target-uuid';
    const ORG_ID    = 'org-uuid';

    it('sets first_day_completed_at to NULL for target user', async () => {
      mockDb.execute.mockResolvedValueOnce(undefined);
      await svc.resetFirstDay(ORG_ID, TARGET_ID);
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('first_day_completed_at = NULL'),
        expect.arrayContaining([TARGET_ID]),
      );
    });

    it('scopes reset to the organization to prevent cross-org modification', async () => {
      mockDb.execute.mockResolvedValueOnce(undefined);
      await svc.resetFirstDay(ORG_ID, TARGET_ID);
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([ORG_ID, TARGET_ID]),
      );
    });
  });
});
