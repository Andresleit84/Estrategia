import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

// jest.mock is hoisted — the factory must not reference variables declared below it.
// Expose the sendMail mock via a module-scoped object that the factory captures.
const transporterMocks = {
  sendMail: jest.fn().mockResolvedValue({ messageId: 'msg-id' }),
};

jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: (...args: unknown[]) => transporterMocks.sendMail(...args),
  }),
}));

function makeConfigMock(withSmtp: boolean) {
  return {
    get: jest.fn().mockImplementation((key: string, fallback?: string) => {
      if (key === 'SMTP_HOST')  return withSmtp ? 'smtp.example.com' : undefined;
      if (key === 'SMTP_PORT')  return '587';
      if (key === 'SMTP_USER')  return 'user@example.com';
      if (key === 'SMTP_PASS')  return 'secret';
      if (key === 'SMTP_FROM')  return fallback ?? 'noreply@example.com';
      return fallback;
    }),
  };
}

describe('EmailService', () => {
  // ── Without SMTP ──────────────────────────────────────────────────────────

  describe('SMTP not configured', () => {
    let svc: EmailService;

    beforeEach(async () => {
      jest.clearAllMocks();
      const module = await Test.createTestingModule({
        providers: [
          EmailService,
          { provide: ConfigService, useValue: makeConfigMock(false) },
        ],
      }).compile();
      svc = module.get(EmailService);
    });

    it('sendInvitation does not throw when transporter is null', async () => {
      await expect(
        svc.sendInvitation('to@x.com', 'Acme', 'Alice', 'MEMBER', 'tok1', 'http://localhost:3001'),
      ).resolves.toBeUndefined();
    });

    it('sendPasswordReset does not throw when transporter is null', async () => {
      await expect(
        svc.sendPasswordReset('to@x.com', 'Bob', 'http://localhost:3001/reset/tok'),
      ).resolves.toBeUndefined();
    });
  });

  // ── With SMTP — locale selection ──────────────────────────────────────────

  describe('SMTP configured — locale selection', () => {
    let svc: EmailService;

    beforeEach(async () => {
      jest.clearAllMocks();
      transporterMocks.sendMail.mockResolvedValue({ messageId: 'msg-id' });
      const module = await Test.createTestingModule({
        providers: [
          EmailService,
          { provide: ConfigService, useValue: makeConfigMock(true) },
        ],
      }).compile();
      svc = module.get(EmailService);
    });

    // sendInvitation — subject locale

    it('sendInvitation uses Spanish subject by default (no locale)', async () => {
      await svc.sendInvitation('to@x.com', 'Acme', 'Alice', 'MEMBER', 'tok', 'http://app');
      expect(transporterMocks.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ subject: expect.stringContaining('unirte') }),
      );
    });

    it('sendInvitation uses Spanish subject when locale=es', async () => {
      await svc.sendInvitation('to@x.com', 'Acme', 'Alice', 'MEMBER', 'tok', 'http://app', undefined, 'es');
      expect(transporterMocks.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ subject: expect.stringContaining('unirte') }),
      );
    });

    it('sendInvitation uses English subject when locale=en', async () => {
      await svc.sendInvitation('to@x.com', 'Acme', 'Alice', 'MEMBER', 'tok', 'http://app', undefined, 'en');
      expect(transporterMocks.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ subject: expect.stringContaining('invited') }),
      );
    });

    // sendInvitation — role label

    it('sendInvitation renders ADMIN role in Spanish', async () => {
      await svc.sendInvitation('to@x.com', 'Acme', 'Alice', 'ADMIN', 'tok', 'http://app', undefined, 'es');
      const call = transporterMocks.sendMail.mock.calls[0][0] as { html: string };
      expect(call.html).toContain('Administrador');
    });

    it('sendInvitation renders ADMIN role in English', async () => {
      await svc.sendInvitation('to@x.com', 'Acme', 'Alice', 'ADMIN', 'tok', 'http://app', undefined, 'en');
      const call = transporterMocks.sendMail.mock.calls[0][0] as { html: string };
      expect(call.html).toContain('Administrator');
    });

    it('sendInvitation renders MEMBER role in Spanish', async () => {
      await svc.sendInvitation('to@x.com', 'Acme', 'Alice', 'MEMBER', 'tok', 'http://app', undefined, 'es');
      const call = transporterMocks.sendMail.mock.calls[0][0] as { html: string };
      expect(call.html).toContain('Miembro');
    });

    // sendInvitation — HTML lang attribute

    it('sendInvitation sets lang=es in HTML', async () => {
      await svc.sendInvitation('to@x.com', 'Acme', 'Alice', 'MEMBER', 'tok', 'http://app', undefined, 'es');
      const call = transporterMocks.sendMail.mock.calls[0][0] as { html: string };
      expect(call.html).toContain('lang="es"');
    });

    it('sendInvitation sets lang=en in HTML', async () => {
      await svc.sendInvitation('to@x.com', 'Acme', 'Alice', 'MEMBER', 'tok', 'http://app', undefined, 'en');
      const call = transporterMocks.sendMail.mock.calls[0][0] as { html: string };
      expect(call.html).toContain('lang="en"');
    });

    // sendInvitation — invitation link

    it('sendInvitation includes the accept-invitation link in the HTML', async () => {
      await svc.sendInvitation('to@x.com', 'Acme', 'Alice', 'MEMBER', 'my-token', 'http://app');
      const call = transporterMocks.sendMail.mock.calls[0][0] as { html: string };
      expect(call.html).toContain('accept-invitation?token=my-token');
    });

    // sendPasswordReset — subject locale

    it('sendPasswordReset uses Spanish subject by default', async () => {
      await svc.sendPasswordReset('to@x.com', 'Alice', 'http://app/reset/tok');
      expect(transporterMocks.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ subject: expect.stringContaining('Restablecer') }),
      );
    });

    it('sendPasswordReset uses English subject when locale=en', async () => {
      await svc.sendPasswordReset('to@x.com', 'Alice', 'http://app/reset/tok', undefined, 'en');
      expect(transporterMocks.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ subject: expect.stringContaining('Reset your password') }),
      );
    });

    // sendPasswordReset — HTML content

    it('sendPasswordReset includes the reset link in the HTML', async () => {
      await svc.sendPasswordReset('to@x.com', 'Alice', 'http://app/reset/abc123');
      const call = transporterMocks.sendMail.mock.calls[0][0] as { html: string };
      expect(call.html).toContain('http://app/reset/abc123');
    });

    it('sendPasswordReset uses lang=en in HTML when locale=en', async () => {
      await svc.sendPasswordReset('to@x.com', 'Alice', 'http://app/reset/tok', undefined, 'en');
      const call = transporterMocks.sendMail.mock.calls[0][0] as { html: string };
      expect(call.html).toContain('lang="en"');
    });

    // Error resilience

    it('sendPasswordReset does not throw when sendMail fails', async () => {
      transporterMocks.sendMail.mockRejectedValueOnce(new Error('SMTP connection refused'));
      await expect(
        svc.sendPasswordReset('to@x.com', 'Alice', 'http://app/reset/tok'),
      ).resolves.toBeUndefined();
    });

    it('sendInvitation does not throw when sendMail fails', async () => {
      transporterMocks.sendMail.mockRejectedValueOnce(new Error('SMTP connection refused'));
      await expect(
        svc.sendInvitation('to@x.com', 'Acme', 'Alice', 'MEMBER', 'tok', 'http://app'),
      ).resolves.toBeUndefined();
    });
  });
});
