import { Test } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { DbService } from '../../database/db.service';
import { EmailService } from '../../common/email/email.service';

const mockDb = {
  queryOne: jest.fn(),
  execute: jest.fn(),
  query: jest.fn(),
};

const mockJwt = {
  sign: jest.fn().mockReturnValue('mock-access-token'),
};

const mockConfig = {
  get: jest.fn().mockReturnValue('http://localhost:3001'),
};

const mockEmail = {
  sendInvitation: jest.fn().mockResolvedValue(undefined),
  sendPasswordReset: jest.fn().mockResolvedValue(undefined),
};

const UNLOCKED = { is_locked: false, locked_until: null };

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.resetAllMocks();
    mockJwt.sign.mockReturnValue('mock-access-token');
    mockConfig.get.mockReturnValue('http://localhost:3001');

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: DbService,    useValue: mockDb },
        { provide: JwtService,   useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
        { provide: EmailService, useValue: mockEmail },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  // ── validateUser ──────────────────────────────────────────────────────────

  describe('validateUser', () => {
    it('returns session when credentials are valid', async () => {
      const session = { user_id: 'u1', organization_id: 'o1', role: 'ADMIN' };
      mockDb.queryOne
        .mockResolvedValueOnce(UNLOCKED)
        .mockResolvedValueOnce(session);
      mockDb.query.mockResolvedValueOnce(undefined);
      const result = await service.validateUser('test@test.com', 'pass', '127.0.0.1');
      expect(result).toEqual(session);
    });

    it('returns null when credentials are invalid', async () => {
      mockDb.queryOne
        .mockResolvedValueOnce(UNLOCKED)
        .mockResolvedValueOnce(null);
      mockDb.query.mockResolvedValueOnce(undefined);
      const result = await service.validateUser('bad@test.com', 'wrong', '127.0.0.1');
      expect(result).toBeNull();
    });

    it('throws UnauthorizedException when account is locked', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ is_locked: true, locked_until: '2026-01-01T00:15:00Z' });
      await expect(
        service.validateUser('locked@test.com', 'pass', '1.2.3.4'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('records login attempt in login_attempts even on failure', async () => {
      mockDb.queryOne
        .mockResolvedValueOnce(UNLOCKED)
        .mockResolvedValueOnce(null);
      mockDb.query.mockResolvedValueOnce(undefined);
      await service.validateUser('test@test.com', 'wrong', '10.0.0.1');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('login_attempts'),
        expect.arrayContaining(['test@test.com']),
      );
    });

    it('uses 127.0.0.1 as fallback when ip is empty string', async () => {
      mockDb.queryOne
        .mockResolvedValueOnce(UNLOCKED)
        .mockResolvedValueOnce(null);
      mockDb.query.mockResolvedValueOnce(undefined);
      await service.validateUser('test@test.com', 'pass', '');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('login_attempts'),
        expect.arrayContaining(['127.0.0.1']),
      );
    });
  });

  // ── register ──────────────────────────────────────────────────────────────

  describe('register', () => {
    it('throws ConflictException on SLUG_ALREADY_EXISTS', async () => {
      mockDb.queryOne.mockRejectedValueOnce(new Error('SLUG_ALREADY_EXISTS'));
      await expect(service.register({
        orgName: 'Test', orgSlug: 'test', email: 'a@b.com', password: 'pass', name: 'A',
      })).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException on duplicate email in org', async () => {
      mockDb.queryOne.mockRejectedValueOnce(new Error('users_organization_id_email_key'));
      await expect(service.register({
        orgName: 'T', orgSlug: 'ts', email: 'dup@b.com', password: 'p', name: 'B',
      })).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException on INVITATION_INVALID_OR_EXPIRED', async () => {
      mockDb.queryOne.mockRejectedValueOnce(new Error('INVITATION_INVALID_OR_EXPIRED'));
      await expect(service.register({
        orgName: 'T', orgSlug: 'ts', email: 'a@b.com', password: 'p', name: 'C',
      })).rejects.toThrow(ConflictException);
    });

    it('re-throws unknown DB errors', async () => {
      mockDb.queryOne.mockRejectedValueOnce(new Error('Connection refused'));
      await expect(service.register({
        orgName: 'T', orgSlug: 'ts', email: 'a@b.com', password: 'p', name: 'C',
      })).rejects.toThrow('Connection refused');
    });
  });

  // ── logout ────────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('revokes the hashed refresh token', async () => {
      mockDb.query.mockResolvedValueOnce(undefined);
      await service.logout('raw-token');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('revoked_at'),
        expect.any(Array),
      );
    });
  });

  // ── logoutAll ─────────────────────────────────────────────────────────────

  describe('logoutAll', () => {
    it('revokes all refresh tokens for the user', async () => {
      mockDb.query.mockResolvedValueOnce(undefined);
      await service.logoutAll('user-uuid');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('revoked_at'),
        ['user-uuid'],
      );
    });
  });

  // ── refresh ───────────────────────────────────────────────────────────────

  describe('refresh', () => {
    it('returns null when token not found in DB', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);
      const result = await service.refresh('token', '1.2.3.4', 'ua');
      expect(result).toBeNull();
    });

    it('returns new access and refresh tokens on success', async () => {
      mockDb.queryOne.mockResolvedValueOnce({
        user_id: 'u1', organization_id: 'o1', role: 'ADMIN',
      });
      // revoke old + insert new token use query (not queryOne)
      mockDb.query.mockResolvedValue(undefined);
      const result = await service.refresh('token', '1.2.3.4', 'ua');
      expect(result).not.toBeNull();
      expect(result!.accessToken).toBe('mock-access-token');
      expect(typeof result!.refreshToken).toBe('string');
      expect(result!.refreshToken.length).toBeGreaterThan(0);
    });

    it('signs new access token with correct claims', async () => {
      mockDb.queryOne.mockResolvedValueOnce({
        user_id: 'u1', organization_id: 'o1', role: 'MEMBER',
      });
      mockDb.query.mockResolvedValue(undefined);
      await service.refresh('token', '1.2.3.4', 'ua');
      expect(mockJwt.sign).toHaveBeenCalledWith({
        sub: 'u1', orgId: 'o1', role: 'MEMBER',
      });
    });
  });

  // ── getMyOrgs ─────────────────────────────────────────────────────────────

  describe('getMyOrgs', () => {
    it('returns orgs list for a user email', async () => {
      const orgs = [{ id: 'o1', name: 'Acme' }, { id: 'o2', name: 'Beta' }];
      mockDb.query.mockResolvedValueOnce(orgs);
      const result = await service.getMyOrgs('user@test.com');
      expect(result).toEqual(orgs);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('organizations'),
        ['user@test.com'],
      );
    });

    it('returns empty array when user has no orgs', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      const result = await service.getMyOrgs('new@test.com');
      expect(result).toEqual([]);
    });
  });

  // ── forgotPassword ────────────────────────────────────────────────────────

  describe('forgotPassword', () => {
    it('does nothing when user not found — prevents email enumeration', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);
      await service.forgotPassword('unknown@test.com');
      expect(mockEmail.sendPasswordReset).not.toHaveBeenCalled();
    });

    it('sends password reset email when user exists', async () => {
      mockDb.queryOne
        .mockResolvedValueOnce({ id: 'u1', name: 'Alice', locale: 'es' })
        .mockResolvedValueOnce({ sp_create_reset_token: 'reset-abc' });
      await service.forgotPassword('alice@test.com');
      expect(mockEmail.sendPasswordReset).toHaveBeenCalledWith(
        'alice@test.com',
        'Alice',
        expect.stringContaining('reset-abc'),
        undefined,
        'es',
      );
    });

    it('passes English locale from user_profiles to email', async () => {
      mockDb.queryOne
        .mockResolvedValueOnce({ id: 'u2', name: 'Bob', locale: 'en' })
        .mockResolvedValueOnce({ sp_create_reset_token: 'reset-xyz' });
      await service.forgotPassword('bob@test.com');
      expect(mockEmail.sendPasswordReset).toHaveBeenCalledWith(
        'bob@test.com', 'Bob', expect.any(String), undefined, 'en',
      );
    });
  });

  // ── getResetTokenInfo ──────────────────────────────────────────────────────

  describe('getResetTokenInfo', () => {
    it('returns email and name when token is valid', async () => {
      mockDb.queryOne.mockResolvedValueOnce({
        user_id: 'u1', email: 'a@b.com', name: 'Alice', expires_at: '2026-12-31',
      });
      const result = await service.getResetTokenInfo('valid-token');
      expect(result).toEqual({ email: 'a@b.com', name: 'Alice', expires_at: '2026-12-31' });
    });

    it('throws UnauthorizedException when token is invalid or expired', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);
      await expect(service.getResetTokenInfo('bad-token')).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── getInvitationInfo ──────────────────────────────────────────────────────

  describe('getInvitationInfo', () => {
    it('returns invitation info for a valid token', async () => {
      const inv = { email: 'a@b.com', org_name: 'Acme', role: 'MEMBER', expires_at: '2026-12-31' };
      mockDb.queryOne.mockResolvedValueOnce(inv);
      const result = await service.getInvitationInfo('valid-token');
      expect(result).toEqual(inv);
    });

    it('throws UnauthorizedException for invalid or expired invitation', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);
      await expect(service.getInvitationInfo('bad-token')).rejects.toThrow(UnauthorizedException);
    });
  });
});
