import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

const EMAIL_STRINGS = {
  es: {
    invitation: {
      subject:   (org: string) => `Te invitaron a unirte a ${org}`,
      title:     (org: string) => `Te invitaron a unirte a <strong>${org}</strong>`,
      body:      (inviter: string, org: string, role: string) =>
        `<strong>${inviter}</strong> te invitó a participar en <strong>${org}</strong> como <strong>${role}</strong>. Hacé clic en el botón para crear tu cuenta y empezar.`,
      roleAdmin: 'Administrador',
      roleMember:'Miembro',
      cta:       'Aceptar invitación',
      expiry:    'Este enlace expira en 7 días. Si no esperabas esta invitación, ignorá este email.',
      copyLink:  'O copiá este link:',
    },
    passwordReset: {
      subject:   'Restablecer tu contraseña — OKR System',
      greeting:  (name: string) => `Hola, ${name}`,
      body:      'Recibimos una solicitud para restablecer tu contraseña. Hacé clic en el botón para elegir una nueva contraseña.',
      validity:  'Este enlace es válido por <strong>2 horas</strong>.',
      cta:       'Restablecer contraseña',
      noRequest: 'Si no solicitaste este cambio, ignorá este email. Tu contraseña no cambiará.',
      copyLink:  'O copiá este link:',
    },
  },
  en: {
    invitation: {
      subject:   (org: string) => `You've been invited to join ${org}`,
      title:     (org: string) => `You've been invited to join <strong>${org}</strong>`,
      body:      (inviter: string, org: string, role: string) =>
        `<strong>${inviter}</strong> invited you to join <strong>${org}</strong> as <strong>${role}</strong>. Click the button to create your account and get started.`,
      roleAdmin: 'Administrator',
      roleMember:'Member',
      cta:       'Accept invitation',
      expiry:    "This link expires in 7 days. If you weren't expecting this invitation, ignore this email.",
      copyLink:  'Or copy this link:',
    },
    passwordReset: {
      subject:   'Reset your password — OKR System',
      greeting:  (name: string) => `Hello, ${name}`,
      body:      'We received a request to reset your password. Click the button to choose a new password.',
      validity:  'This link is valid for <strong>2 hours</strong>.',
      cta:       'Reset password',
      noRequest: "If you didn't request this change, ignore this email. Your password won't change.",
      copyLink:  'Or copy this link:',
    },
  },
};

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private defaultTransporter: Transporter | null;
  private defaultFrom: string;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    this.defaultFrom = this.config.get<string>('SMTP_FROM', '');
    if (host) {
      const port = parseInt(this.config.get('SMTP_PORT', '587'));
      this.defaultTransporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
          user: this.config.get('SMTP_USER'),
          pass: this.config.get('SMTP_PASS'),
        },
      });
    } else {
      this.defaultTransporter = null;
      this.logger.warn('SMTP not configured via env — will use org-level SMTP config if available.');
    }
  }

  private t(locale: string | undefined) {
    const lang = locale === 'en' ? 'en' : 'es';
    return EMAIL_STRINGS[lang];
  }

  private resolveTransporter(smtp?: SmtpConfig): { transporter: Transporter | null; from: string } {
    if (smtp?.host) {
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port || 587,
        secure: (smtp.port || 587) === 465,
        auth: { user: smtp.user, pass: smtp.pass },
      });
      return { transporter, from: smtp.from };
    }
    return { transporter: this.defaultTransporter, from: this.defaultFrom };
  }

  async sendInvitation(to: string, orgName: string, inviterName: string, role: string, token: string, frontendUrl: string, smtp?: SmtpConfig, locale?: string): Promise<void> {
    const s = this.t(locale).invitation;
    const link = `${frontendUrl}/auth/accept-invitation?token=${token}`;
    const roleLabel = role === 'ADMIN' ? s.roleAdmin : s.roleMember;
    const lang = locale === 'en' ? 'en' : 'es';
    const { transporter, from } = this.resolveTransporter(smtp);
    if (!transporter) {
      this.logger.log(`[DEV] Invitation link for ${to}: ${link}`);
      return;
    }
    try {
      await transporter.sendMail({
        from,
        to,
        subject: s.subject(orgName),
        html: `<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="UTF-8"><title>${s.subject(orgName)}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
    <div style="background:#111827;padding:24px 32px;">
      <h1 style="color:#fff;margin:0;font-size:20px;">OKR System</h1>
    </div>
    <div style="padding:32px;">
      <h2 style="font-size:18px;font-weight:600;margin:0 0 12px;">${s.title(orgName)}</h2>
      <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 24px;">
        ${s.body(inviterName, orgName, roleLabel)}
      </p>
      <a href="${link}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;">
        ${s.cta}
      </a>
      <p style="font-size:12px;color:#9ca3af;margin:24px 0 0;">${s.expiry}</p>
      <p style="font-size:11px;color:#d1d5db;margin:8px 0 0;word-break:break-all;">${s.copyLink} ${link}</p>
    </div>
  </div>
</body>
</html>`,
      });
    } catch (err) {
      this.logger.warn(`Failed to send invitation to ${to}`, err);
      this.logger.log(`[DEV] Invitation link for ${to}: ${link}`);
    }
  }

  async sendAssessmentInvite(
    to: string,
    recipientName: string,
    inviterName: string,
    orgName: string,
    sessionName: string,
    periodLabel: string,
    frontendUrl: string,
    smtp?: SmtpConfig,
  ): Promise<void> {
    const { transporter, from } = this.resolveTransporter(smtp);
    const link = `${frontendUrl}/sector-assessment`;
    if (!transporter) {
      this.logger.log(`[DEV] Assessment invite for ${to} — session: "${sessionName}" (${periodLabel}) — ${link}`);
      return;
    }
    try {
      await transporter.sendMail({
        from,
        to,
        subject: `Has sido invitado/a a completar un diagnóstico sectorial — ${orgName}`,
        html: `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Diagnóstico Sectorial — ${orgName}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
    <div style="background:#111827;padding:24px 32px;">
      <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700;">OKR System</h1>
      <p style="color:#9ca3af;margin:4px 0 0;font-size:13px;">Diagnóstico Sectorial</p>
    </div>
    <div style="padding:32px;">
      <h2 style="font-size:18px;font-weight:600;margin:0 0 8px;color:#111827;">Hola, ${recipientName}</h2>
      <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 20px;">
        <strong>${inviterName}</strong> te ha invitado a completar el <strong>Diagnóstico Sectorial</strong> de <strong>${orgName}</strong>.
      </p>
      <div style="background:#f3f4f6;border-radius:8px;padding:16px;margin:0 0 24px;">
        <p style="margin:0 0 6px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;font-weight:600;">Sesión</p>
        <p style="margin:0;font-size:15px;font-weight:600;color:#111827;">${sessionName}</p>
        <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">Período: ${periodLabel}</p>
      </div>
      <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 24px;">
        Tu valoración individual será consolidada junto a la de los demás participantes para generar el diagnóstico conjunto.
      </p>
      <a href="${link}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;">
        Ir al diagnóstico
      </a>
      <p style="font-size:11px;color:#d1d5db;margin:20px 0 0;word-break:break-all;">
        O abre este enlace: ${link}
      </p>
    </div>
  </div>
</body>
</html>`,
      });
    } catch (err) {
      this.logger.warn(`Failed to send assessment invite to ${to}`, err);
    }
  }

  async sendRiskDigest(to: string, orgName: string, report: Record<string, unknown>, smtp?: SmtpConfig): Promise<void> {
    const { transporter, from } = this.resolveTransporter(smtp);
    if (!transporter) return;
    try {
      await transporter.sendMail({
        from,
        to,
        subject: `[Risk Sentinel] Resumen de KRs en riesgo — ${orgName}`,
        html: this.buildRiskDigestHtml(orgName, report),
      });
    } catch (err) {
      this.logger.warn(`Failed to send risk digest to ${to}`, err);
    }
  }

  async sendPasswordReset(to: string, name: string, resetLink: string, smtp?: SmtpConfig, locale?: string): Promise<void> {
    const s = this.t(locale).passwordReset;
    const lang = locale === 'en' ? 'en' : 'es';
    const { transporter, from } = this.resolveTransporter(smtp);
    if (!transporter) {
      this.logger.log(`[DEV] Password reset link for ${to}: ${resetLink}`);
      return;
    }
    try {
      await transporter.sendMail({
        from,
        to,
        subject: s.subject,
        html: `<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="UTF-8"><title>${s.subject}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
    <div style="background:#111827;padding:24px 32px;">
      <h1 style="color:#fff;margin:0;font-size:20px;">OKR System</h1>
    </div>
    <div style="padding:32px;">
      <h2 style="font-size:18px;font-weight:600;margin:0 0 12px;">${s.greeting(name)}</h2>
      <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 8px;">${s.body}</p>
      <p style="font-size:13px;color:#6b7280;margin:0 0 24px;">${s.validity}</p>
      <a href="${resetLink}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;">
        ${s.cta}
      </a>
      <p style="font-size:12px;color:#9ca3af;margin:24px 0 0;">${s.noRequest}</p>
      <p style="font-size:11px;color:#d1d5db;margin:8px 0 0;word-break:break-all;">${s.copyLink} ${resetLink}</p>
    </div>
  </div>
</body>
</html>`,
      });
    } catch (err) {
      this.logger.warn(`Failed to send password reset to ${to}`, err);
      this.logger.log(`[DEV] Password reset link for ${to}: ${resetLink}`);
    }
  }

  async sendExecutiveBriefing(to: string, orgName: string, report: Record<string, unknown>, smtp?: SmtpConfig): Promise<void> {
    const { transporter, from } = this.resolveTransporter(smtp);
    if (!transporter) return;
    try {
      await transporter.sendMail({
        from,
        to,
        subject: `[Briefing Semanal] ${report['cycle_name'] ?? orgName} — ${new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}`,
        html: this.buildExecutiveBriefingHtml(orgName, report),
      });
    } catch (err) {
      this.logger.warn(`Failed to send executive briefing to ${to}`, err);
    }
  }

  async sendAgreementStatusEmail(
    to: string,
    orgName: string,
    items: Record<string, unknown>[],
    stat: Record<string, unknown>,
    dueSoonDays: number,
    smtp?: SmtpConfig,
  ): Promise<void> {
    const { transporter, from } = this.resolveTransporter(smtp);
    if (!transporter) return;
    try {
      await transporter.sendMail({
        from,
        to,
        subject: `[Acuerdos] Estado de compromisos — ${orgName}`,
        html: this.buildAgreementStatusHtml(orgName, items, stat, dueSoonDays),
      });
    } catch (err) {
      this.logger.warn(`Failed to send agreement status to ${to}`, err);
    }
  }

  private buildAgreementStatusHtml(
    orgName: string,
    items: Record<string, unknown>[],
    stat: Record<string, unknown>,
    dueSoonDays: number,
  ): string {
    const overdue  = Number(stat['overdue']     ?? 0);
    const pending  = Number(stat['pending']     ?? 0);
    const inProg   = Number(stat['in_progress'] ?? 0);
    const date     = new Date().toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });

    const PRIORITY_COLOR: Record<string, string> = {
      CRITICAL: '#ef4444',
      HIGH:     '#f97316',
      MEDIUM:   '#f59e0b',
      LOW:      '#9ca3af',
    };
    const STATUS_LABEL: Record<string, string> = {
      PENDING:     'Pendiente',
      IN_PROGRESS: 'En curso',
    };

    const rows = items.map(a => {
      const isOver   = a['is_overdue'] === true;
      const daysRem  = a['days_remaining'] != null ? Number(a['days_remaining']) : null;
      const priColor = PRIORITY_COLOR[String(a['priority'] ?? 'MEDIUM')] ?? '#9ca3af';

      let timingHtml: string;
      if (isOver) {
        const late = daysRem != null ? Math.abs(daysRem) : '?';
        timingHtml = `<span style="color:#ef4444;font-weight:600;">⚠️ Vencido hace ${late} día${late !== 1 ? 's' : ''}</span>`;
      } else if (daysRem === 0) {
        timingHtml = `<span style="color:#f97316;font-weight:600;">⏰ Vence hoy</span>`;
      } else if (daysRem != null) {
        timingHtml = `<span style="color:#f59e0b;">⏳ Faltan <strong>${daysRem}</strong> día${daysRem !== 1 ? 's' : ''}</span>`;
      } else {
        timingHtml = `<span style="color:#9ca3af;">Sin fecha</span>`;
      }

      return `
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:10px 12px;font-size:12px;">
          <span style="color:${priColor};font-weight:700;">●</span>
          ${a['code'] ? `<span style="font-family:monospace;color:#6b7280;font-size:11px;">${a['code']} </span>` : ''}
          <span style="font-size:13px;font-weight:500;">${a['title'] ?? ''}</span>
        </td>
        <td style="padding:10px 12px;font-size:12px;color:#6b7280;">${STATUS_LABEL[String(a['status'] ?? '')] ?? ''}</td>
        <td style="padding:10px 12px;font-size:12px;color:#6b7280;">${a['owner_name'] ? String(a['owner_name']) : '—'}</td>
        <td style="padding:10px 12px;font-size:12px;">${timingHtml}</td>
      </tr>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Estado de Acuerdos</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px;">
  <div style="max-width:660px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
    <div style="background:#7c3aed;padding:24px 32px;">
      <h1 style="color:#fff;margin:0;font-size:20px;">📋 Estado de Acuerdos</h1>
      <p style="color:#ede9fe;margin:4px 0 0;font-size:14px;">${orgName} · ${date}</p>
    </div>
    <div style="padding:24px 32px;">
      <div style="display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap;">
        <div style="background:#fef2f2;border-radius:8px;padding:14px 20px;text-align:center;flex:1;min-width:80px;">
          <p style="font-size:26px;font-weight:700;color:#ef4444;margin:0;">${overdue}</p>
          <p style="font-size:11px;color:#6b7280;margin:2px 0 0;">Vencidos</p>
        </div>
        <div style="background:#fffbeb;border-radius:8px;padding:14px 20px;text-align:center;flex:1;min-width:80px;">
          <p style="font-size:26px;font-weight:700;color:#f59e0b;margin:0;">${pending}</p>
          <p style="font-size:11px;color:#6b7280;margin:2px 0 0;">Pendientes</p>
        </div>
        <div style="background:#f0f9ff;border-radius:8px;padding:14px 20px;text-align:center;flex:1;min-width:80px;">
          <p style="font-size:26px;font-weight:700;color:#0ea5e9;margin:0;">${inProg}</p>
          <p style="font-size:11px;color:#6b7280;margin:2px 0 0;">En curso</p>
        </div>
      </div>

      ${items.length > 0 ? `
      <h3 style="font-size:14px;font-weight:600;color:#111827;margin:0 0 10px;">Acuerdos que requieren atención</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;">Acuerdo</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;">Estado</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;">Responsable</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;">Vencimiento</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="font-size:12px;color:#9ca3af;margin:0;">Mostrando acuerdos vencidos o que vencen en los próximos ${dueSoonDays} días.</p>
      ` : `<p style="font-size:14px;color:#6b7280;text-align:center;padding:24px 0;">✅ No hay acuerdos vencidos ni próximos a vencer.</p>`}
    </div>
    <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
      <p style="font-size:11px;color:#9ca3af;margin:0;text-align:center;">Generado automáticamente · OKR System</p>
    </div>
  </div>
</body>
</html>`;
  }

  async sendCheckinReminderEmail(
    to: string,
    orgName: string,
    items: Record<string, unknown>[],
    staleDays: number,
    smtp?: SmtpConfig,
  ): Promise<void> {
    const { transporter, from } = this.resolveTransporter(smtp);
    if (!transporter) return;
    try {
      await transporter.sendMail({
        from,
        to,
        subject: `[Check-in] KRs sin actualizar — ${orgName}`,
        html: this.buildCheckinReminderHtml(orgName, items, staleDays),
      });
    } catch (err) {
      this.logger.warn(`Failed to send checkin reminder to ${to}`, err);
    }
  }

  private buildCheckinReminderHtml(
    orgName: string,
    items: Record<string, unknown>[],
    staleDays: number,
  ): string {
    const date = new Date().toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });

    const rows = items.map(kr => {
      const days = Number(kr['days_since_checkin'] ?? 0);
      const prog = Math.round(Number(kr['progress'] ?? 0));
      const conf = Math.round(Number(kr['confidence'] ?? 0) * 100);
      const urgency = days >= staleDays * 2
        ? `<span style="color:#ef4444;font-weight:700;">🔴 ${days} días</span>`
        : `<span style="color:#f97316;font-weight:600;">⚠️ ${days} días</span>`;
      return `
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:10px 12px;">
          <p style="margin:0;font-size:13px;font-weight:500;">${kr['kr_title'] ?? ''}</p>
          <p style="margin:2px 0 0;font-size:11px;color:#6b7280;">${kr['objective_title'] ?? ''}${kr['team_name'] ? ` · ${kr['team_name']}` : ''}</p>
        </td>
        <td style="padding:10px 12px;font-size:12px;color:#6b7280;">${kr['owner_name'] ? String(kr['owner_name']) : '—'}</td>
        <td style="padding:10px 12px;font-size:12px;text-align:center;">
          <span style="font-weight:600;">${prog}%</span><br>
          <span style="font-size:10px;color:#9ca3af;">conf. ${conf}%</span>
        </td>
        <td style="padding:10px 12px;font-size:12px;">${urgency}</td>
      </tr>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Recordatorio Check-in</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px;">
  <div style="max-width:660px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
    <div style="background:#f59e0b;padding:24px 32px;">
      <h1 style="color:#fff;margin:0;font-size:20px;">⏰ KRs sin check-in</h1>
      <p style="color:#fef3c7;margin:4px 0 0;font-size:14px;">${orgName} · ${date}</p>
    </div>
    <div style="padding:24px 32px;">
      <p style="font-size:14px;color:#374151;margin:0 0 16px;">
        Los siguientes KRs llevan más de <strong>${staleDays} días</strong> sin actualización y requieren un check-in.
      </p>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;">Key Result</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;">Responsable</th>
            <th style="padding:8px 12px;text-align:center;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;">Progreso</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;">Sin check-in</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
      <p style="font-size:11px;color:#9ca3af;margin:0;text-align:center;">Generado automáticamente · OKR System</p>
    </div>
  </div>
</body>
</html>`;
  }

  async sendConsultantDigest(
    to: string,
    orgs: Array<{
      org_name: string;
      cycle_name: string | null;
      cycle_score: number | null;
      active_objectives: number;
      on_track: number;
      at_risk: number;
      krs_at_risk: number;
    }>,
  ): Promise<void> {
    const { transporter, from } = this.resolveTransporter();
    if (!transporter) return;
    const date = new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
    try {
      await transporter.sendMail({
        from,
        to,
        subject: `[Digest Consultor] ${orgs.length} empresa${orgs.length !== 1 ? 's' : ''} — ${date}`,
        html: this.buildConsultantDigestHtml(to, orgs),
      });
    } catch (err) {
      this.logger.warn(`Failed to send consultant digest to ${to}`, err);
    }
  }

  private buildConsultantDigestHtml(
    consultantEmail: string,
    orgs: Array<{
      org_name: string;
      cycle_name: string | null;
      cycle_score: number | null;
      active_objectives: number;
      on_track: number;
      at_risk: number;
      krs_at_risk: number;
    }>,
  ): string {
    const avgScore = orgs.length > 0
      ? (orgs.reduce((s, o) => s + (o.cycle_score ?? 0), 0) / orgs.length).toFixed(1)
      : '—';
    const totalAtRisk = orgs.reduce((s, o) => s + o.at_risk, 0);
    const totalKrs   = orgs.reduce((s, o) => s + o.krs_at_risk, 0);
    const date       = new Date().toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });

    const orgRows = orgs.map(o => {
      const pct   = o.active_objectives > 0 ? Math.round((o.on_track / o.active_objectives) * 100) : 0;
      const color = o.cycle_score !== null
        ? (o.cycle_score >= 7 ? '#22c55e' : o.cycle_score >= 4 ? '#f59e0b' : '#ef4444')
        : '#9ca3af';
      return `
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:12px 16px;font-size:14px;font-weight:600;">${o.org_name}</td>
        <td style="padding:12px 16px;font-size:13px;color:#6b7280;">${o.cycle_name ?? '—'}</td>
        <td style="padding:12px 16px;font-size:14px;font-weight:700;color:${color};text-align:center;">${o.cycle_score !== null ? o.cycle_score + '/10' : '—'}</td>
        <td style="padding:12px 16px;font-size:13px;text-align:center;">${pct}%</td>
        <td style="padding:12px 16px;font-size:13px;text-align:center;color:${o.at_risk > 0 ? '#f59e0b' : '#22c55e'};">${o.at_risk}</td>
        <td style="padding:12px 16px;font-size:13px;text-align:center;color:${o.krs_at_risk > 0 ? '#ef4444' : '#22c55e'};">${o.krs_at_risk}</td>
      </tr>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Digest Consultor</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px;">
  <div style="max-width:680px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
    <div style="background:#4f46e5;padding:24px 32px;">
      <h1 style="color:#fff;margin:0;font-size:20px;">📊 Digest Semanal de Consultor</h1>
      <p style="color:#c7d2fe;margin:6px 0 0;font-size:14px;">${date}</p>
    </div>
    <div style="padding:24px 32px;">
      <div style="display:flex;gap:24px;margin-bottom:24px;">
        <div style="flex:1;background:#f9fafb;border-radius:8px;padding:16px;text-align:center;">
          <div style="font-size:28px;font-weight:700;">${orgs.length}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:4px;">EMPRESAS CLIENTE</div>
        </div>
        <div style="flex:1;background:#f9fafb;border-radius:8px;padding:16px;text-align:center;">
          <div style="font-size:28px;font-weight:700;color:#4f46e5;">${avgScore}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:4px;">SCORE PROMEDIO</div>
        </div>
        <div style="flex:1;background:#f9fafb;border-radius:8px;padding:16px;text-align:center;">
          <div style="font-size:28px;font-weight:700;color:${totalAtRisk > 0 ? '#f59e0b' : '#22c55e'};">${totalAtRisk}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:4px;">OBJ. REZAGADOS</div>
        </div>
        <div style="flex:1;background:#f9fafb;border-radius:8px;padding:16px;text-align:center;">
          <div style="font-size:28px;font-weight:700;color:${totalKrs > 0 ? '#ef4444' : '#22c55e'};">${totalKrs}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:4px;">KRs EN RIESGO</div>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:10px 16px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;">Empresa</th>
            <th style="padding:10px 16px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;">Ciclo</th>
            <th style="padding:10px 16px;text-align:center;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;">Score</th>
            <th style="padding:10px 16px;text-align:center;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;">En Camino</th>
            <th style="padding:10px 16px;text-align:center;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;">Rezag.</th>
            <th style="padding:10px 16px;text-align:center;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;">KRs Riesgo</th>
          </tr>
        </thead>
        <tbody>${orgRows}</tbody>
      </table>
    </div>
    <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
      <p style="font-size:12px;color:#9ca3af;margin:0;">Digest enviado a ${consultantEmail} · OKR System</p>
    </div>
  </div>
</body>
</html>`;
  }

  isConfigured(smtp?: SmtpConfig): boolean {
    return !!(smtp?.host || this.defaultTransporter);
  }

  async sendTrialRequestNotification(
    adminEmail: string,
    data: { name: string; email: string; company: string; employees?: string; message?: string },
    frontendUrl: string,
  ): Promise<void> {
    const { transporter, from } = this.resolveTransporter();
    if (!transporter) {
      this.logger.log(`[TRIAL REQUEST] ${data.name} <${data.email}> — ${data.company}`);
      return;
    }
    try {
      await transporter.sendMail({
        from,
        to: adminEmail,
        subject: `[Trial OKR System] Nueva solicitud — ${data.company}`,
        html: `<p>Nueva solicitud de acceso trial:</p>
<table cellpadding="6" style="font-family:sans-serif;font-size:14px">
  <tr><td><b>Nombre</b></td><td>${data.name}</td></tr>
  <tr><td><b>Email</b></td><td>${data.email}</td></tr>
  <tr><td><b>Empresa</b></td><td>${data.company}</td></tr>
  <tr><td><b>Tamaño</b></td><td>${data.employees ?? '—'}</td></tr>
  <tr><td><b>Mensaje</b></td><td>${data.message ?? '—'}</td></tr>
</table>
<p><a href="${frontendUrl}/auth/register">Crear organización y enviar invitación</a></p>`,
      });
    } catch (err) {
      this.logger.warn('Failed to send trial request notification', err);
    }
  }

  async sendTrialRequestConfirmation(to: string, name: string): Promise<void> {
    const { transporter, from } = this.resolveTransporter();
    if (!transporter) return;
    try {
      await transporter.sendMail({
        from,
        to,
        subject: 'Tu solicitud de acceso al OKR System fue recibida',
        html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px">
  <h2 style="margin-bottom:8px">Hola ${name} 👋</h2>
  <p style="color:#555;line-height:1.6">Recibimos tu solicitud de acceso trial. Nuestro equipo revisará tu información y te enviará las credenciales de acceso en un plazo de <b>24 horas hábiles</b>.</p>
  <p style="color:#555;line-height:1.6">El trial incluye acceso completo al sistema por <b>15 días</b>.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
  <p style="color:#999;font-size:13px">Si tienes alguna pregunta, responde a este correo.</p>
</div>`,
      });
    } catch (err) {
      this.logger.warn(`Failed to send trial confirmation to ${to}`, err);
    }
  }

  private buildRiskDigestHtml(orgName: string, report: Record<string, unknown>): string {
    const atRisk = (report['at_risk_krs'] as Array<Record<string, unknown>>) ?? [];
    const priorities = (report['priorities'] as string[]) ?? [];
    const recommendations = (report['recommendations'] as string[]) ?? [];

    const krRows = atRisk.slice(0, 8).map((kr) => `
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:10px 12px;font-size:13px;">${kr['kr_title'] ?? ''}</td>
        <td style="padding:10px 12px;font-size:13px;color:#6b7280;">${kr['objective_title'] ?? ''}</td>
        <td style="padding:10px 12px;font-size:13px;text-align:center;font-weight:600;color:${Number(kr['progress'] ?? 0) < 30 ? '#ef4444' : '#f59e0b'};">${Math.round(Number(kr['progress'] ?? 0))}%</td>
        <td style="padding:10px 12px;font-size:13px;text-align:center;color:#6b7280;">${kr['days_since_checkin'] === 999 ? 'Nunca' : `${kr['days_since_checkin']}d`}</td>
      </tr>`).join('');

    return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Risk Sentinel</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px;">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
    <div style="background:#ef4444;padding:24px 32px;">
      <h1 style="color:#fff;margin:0;font-size:20px;">⚠️ Risk Sentinel</h1>
      <p style="color:#fee2e2;margin:4px 0 0;font-size:14px;">${orgName} · ${new Date().toLocaleDateString('es', { day:'numeric',month:'long',year:'numeric' })}</p>
    </div>
    <div style="padding:24px 32px;">
      <div style="display:flex;gap:16px;margin-bottom:24px;">
        <div style="flex:1;background:#fef2f2;border-radius:8px;padding:16px;text-align:center;">
          <p style="font-size:28px;font-weight:700;color:#ef4444;margin:0;">${report['total_at_risk'] ?? 0}</p>
          <p style="font-size:12px;color:#6b7280;margin:4px 0 0;">KRs en riesgo</p>
        </div>
        <div style="flex:1;background:#fff7ed;border-radius:8px;padding:16px;text-align:center;">
          <p style="font-size:28px;font-weight:700;color:#f59e0b;margin:0;">${report['stale_krs'] ?? 0}</p>
          <p style="font-size:12px;color:#6b7280;margin:4px 0 0;">Sin check-in +14d</p>
        </div>
      </div>

      ${report['analysis'] ? `<p style="font-size:14px;color:#374151;line-height:1.6;background:#f3f4f6;border-left:3px solid #ef4444;padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:24px;">${report['analysis']}</p>` : ''}

      ${priorities.length > 0 ? `
      <h3 style="font-size:14px;font-weight:600;color:#111827;margin:0 0 10px;">Prioridades críticas</h3>
      <ul style="margin:0 0 24px;padding-left:20px;">
        ${priorities.map((p) => `<li style="font-size:13px;color:#374151;margin-bottom:6px;">${p}</li>`).join('')}
      </ul>` : ''}

      ${atRisk.length > 0 ? `
      <h3 style="font-size:14px;font-weight:600;color:#111827;margin:0 0 10px;">KRs en riesgo</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;">KR</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;">Objetivo</th>
            <th style="padding:8px 12px;text-align:center;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;">Progreso</th>
            <th style="padding:8px 12px;text-align:center;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;">Sin check-in</th>
          </tr>
        </thead>
        <tbody>${krRows}</tbody>
      </table>` : ''}

      ${recommendations.length > 0 ? `
      <h3 style="font-size:14px;font-weight:600;color:#111827;margin:0 0 10px;">Recomendaciones</h3>
      <ul style="margin:0;padding-left:20px;">
        ${recommendations.map((r) => `<li style="font-size:13px;color:#374151;margin-bottom:6px;">✓ ${r}</li>`).join('')}
      </ul>` : ''}
    </div>
    <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
      <p style="font-size:11px;color:#9ca3af;margin:0;text-align:center;">Generado automáticamente por Risk Sentinel · OKR System</p>
    </div>
  </div>
</body>
</html>`;
  }

  private buildExecutiveBriefingHtml(orgName: string, report: Record<string, unknown>): string {
    const highlights = (report['highlights'] as string[]) ?? [];
    const risks = (report['risks'] as string[]) ?? [];
    const nextSteps = (report['next_steps'] as string[]) ?? [];
    const score = Number(report['cycle_score'] ?? 0);

    const scoreColor = score >= 7 ? '#10b981' : score >= 4 ? '#f59e0b' : '#ef4444';

    return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Briefing Ejecutivo</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px;">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
    <div style="background:#111827;padding:24px 32px;">
      <h1 style="color:#fff;margin:0;font-size:20px;">📊 Briefing Ejecutivo Semanal</h1>
      <p style="color:#9ca3af;margin:4px 0 0;font-size:14px;">${orgName} · Ciclo: ${report['cycle_name'] ?? 'Activo'}</p>
    </div>
    <div style="padding:24px 32px;">
      <div style="display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap;">
        <div style="background:#f9fafb;border-radius:8px;padding:14px 20px;text-align:center;flex:1;min-width:100px;">
          <p style="font-size:26px;font-weight:700;color:${scoreColor};margin:0;">${score.toFixed(1)}</p>
          <p style="font-size:11px;color:#6b7280;margin:2px 0 0;">Score /10</p>
        </div>
        <div style="background:#f9fafb;border-radius:8px;padding:14px 20px;text-align:center;flex:1;min-width:100px;">
          <p style="font-size:26px;font-weight:700;color:#10b981;margin:0;">${report['on_track'] ?? 0}</p>
          <p style="font-size:11px;color:#6b7280;margin:2px 0 0;">En camino</p>
        </div>
        <div style="background:#f9fafb;border-radius:8px;padding:14px 20px;text-align:center;flex:1;min-width:100px;">
          <p style="font-size:26px;font-weight:700;color:#f59e0b;margin:0;">${report['behind'] ?? 0}</p>
          <p style="font-size:11px;color:#6b7280;margin:2px 0 0;">Rezagados</p>
        </div>
        <div style="background:#f9fafb;border-radius:8px;padding:14px 20px;text-align:center;flex:1;min-width:100px;">
          <p style="font-size:26px;font-weight:700;color:#ef4444;margin:0;">${report['at_risk_count'] ?? 0}</p>
          <p style="font-size:11px;color:#6b7280;margin:2px 0 0;">KRs en riesgo</p>
        </div>
      </div>

      ${report['narrative'] ? `<p style="font-size:14px;color:#374151;line-height:1.6;background:#f3f4f6;border-left:3px solid #111827;padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:24px;">${report['narrative']}</p>` : ''}

      ${highlights.length > 0 ? `
      <div style="background:#ecfdf5;border-radius:8px;padding:16px;margin-bottom:16px;">
        <h3 style="font-size:13px;font-weight:600;color:#065f46;margin:0 0 10px;">✅ Destacados</h3>
        <ul style="margin:0;padding-left:16px;">
          ${highlights.map((h) => `<li style="font-size:13px;color:#374151;margin-bottom:5px;">${h}</li>`).join('')}
        </ul>
      </div>` : ''}

      ${risks.length > 0 ? `
      <div style="background:#fef2f2;border-radius:8px;padding:16px;margin-bottom:16px;">
        <h3 style="font-size:13px;font-weight:600;color:#991b1b;margin:0 0 10px;">⚠️ Riesgos</h3>
        <ul style="margin:0;padding-left:16px;">
          ${risks.map((r) => `<li style="font-size:13px;color:#374151;margin-bottom:5px;">${r}</li>`).join('')}
        </ul>
      </div>` : ''}

      ${nextSteps.length > 0 ? `
      <div style="background:#eff6ff;border-radius:8px;padding:16px;">
        <h3 style="font-size:13px;font-weight:600;color:#1e40af;margin:0 0 10px;">→ Próximos pasos</h3>
        <ol style="margin:0;padding-left:16px;">
          ${nextSteps.map((s) => `<li style="font-size:13px;color:#374151;margin-bottom:5px;">${s}</li>`).join('')}
        </ol>
      </div>` : ''}
    </div>
    <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
      <p style="font-size:11px;color:#9ca3af;margin:0;text-align:center;">Generado automáticamente por Executive Briefer · OKR System</p>
    </div>
  </div>
</body>
</html>`;
  }

  // ── Personal Briefing ────────────────────────────────────────────────────

  async sendPersonalBriefing(to: string, userName: string, report: Record<string, unknown>, smtp?: SmtpConfig): Promise<void> {
    const { transporter, from } = this.resolveTransporter(smtp);
    if (!transporter) return;
    try {
      const day = new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
      await transporter.sendMail({
        from,
        to,
        subject: `📋 Tu briefing del lunes — ${day}`,
        html: this.buildPersonalBriefingHtml(userName, report),
      });
    } catch (err) {
      this.logger.warn(`Failed to send personal briefing to ${to}`, err);
    }
  }

  private buildPersonalBriefingHtml(userName: string, report: Record<string, unknown>): string {
    const bullets     = (report['bullets']       as string[]                    | undefined) ?? [];
    const atRisk      = (report['at_risk_krs']   as Record<string, unknown>[]   | undefined) ?? [];
    const agreements  = (report['agreements_due'] as Record<string, unknown>[]   | undefined) ?? [];
    const sprintItems = (report['sprint_items']   as Record<string, unknown>[]   | undefined) ?? [];
    const firstName   = userName.split(' ')[0];
    const date        = new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const appUrl      = this.config.get<string>('APP_URL', 'http://localhost:3000');

    const bulletsHtml = bullets.map((b, i) => `
      <tr>
        <td style="padding:6px 10px 6px 0;vertical-align:top;width:28px;">
          <span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;background:rgba(255,255,255,.15);color:#fff;border-radius:50%;font-size:11px;font-weight:700;">${i + 1}</span>
        </td>
        <td style="padding:6px 0;font-size:14px;color:#fff;line-height:1.5;">${b}</td>
      </tr>`).join('');

    const krRows = atRisk.slice(0, 4).map(k => {
      const conf = Math.round(Number(k['confidence'] ?? 0) * 100);
      const color = conf < 30 ? '#ef4444' : '#f59e0b';
      return `<tr style="border-bottom:1px solid #f3f4f6;">
        <td style="padding:8px 12px;font-size:12px;font-weight:500;color:#111827;">${k['kr_title'] ?? ''}</td>
        <td style="padding:8px 12px;font-size:11px;color:#6b7280;">${k['objective_title'] ?? ''}</td>
        <td style="padding:8px 12px;font-size:12px;text-align:right;font-weight:600;color:${color};">${conf}%</td>
      </tr>`;
    }).join('');

    const PRIORITY_COLOR: Record<string, string> = { CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#f59e0b', LOW: '#9ca3af' };
    const agrRows = agreements.slice(0, 4).map(a => {
      const days = a['days_remaining'] != null ? Number(a['days_remaining']) : null;
      const color = a['is_overdue'] ? '#ef4444' : days === 0 ? '#f97316' : '#f59e0b';
      const label = a['is_overdue'] ? `Vencido ${Math.abs(days ?? 0)}d` : days === 0 ? 'Hoy' : `${days}d`;
      const dot   = PRIORITY_COLOR[String(a['priority'] ?? 'MEDIUM')] ?? '#9ca3af';
      return `<tr style="border-bottom:1px solid #f3f4f6;">
        <td style="padding:8px 12px;font-size:12px;font-weight:500;color:#111827;">
          <span style="color:${dot};margin-right:4px;">●</span>${a['title'] ?? ''}
        </td>
        <td style="padding:8px 12px;font-size:12px;text-align:right;font-weight:600;color:${color};">${label}</td>
      </tr>`;
    }).join('');

    const storyRows = sprintItems.slice(0, 4).map(s => {
      const color = s['status'] === 'IN_PROGRESS' ? '#2563eb' : '#9ca3af';
      const label = s['status'] === 'IN_PROGRESS' ? 'En progreso' : 'Pendiente';
      return `<tr style="border-bottom:1px solid #f3f4f6;">
        <td style="padding:8px 12px;font-size:12px;color:#111827;">${s['title'] ?? ''}</td>
        <td style="padding:8px 12px;font-size:11px;text-align:right;font-weight:500;color:${color};">${label}</td>
      </tr>`;
    }).join('');

    const pillsHtml = [
      atRisk.length     > 0 ? `<span style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:20px;padding:4px 12px;font-size:12px;font-weight:600;">🔴 ${atRisk.length} KR${atRisk.length > 1 ? 's' : ''} en riesgo</span>` : '',
      agreements.length > 0 ? `<span style="background:#fffbeb;color:#d97706;border:1px solid #fde68a;border-radius:20px;padding:4px 12px;font-size:12px;font-weight:600;">⚠️ ${agreements.length} acuerdo${agreements.length > 1 ? 's' : ''} urgente${agreements.length > 1 ? 's' : ''}</span>` : '',
      sprintItems.length > 0 ? `<span style="background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;border-radius:20px;padding:4px 12px;font-size:12px;font-weight:600;">⚙️ ${sprintItems.length} historia${sprintItems.length > 1 ? 's' : ''} activa${sprintItems.length > 1 ? 's' : ''}</span>` : '',
    ].filter(Boolean).join('&nbsp;&nbsp;');

    const allClear = atRisk.length + agreements.length + sprintItems.length === 0;

    return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Briefing del lunes</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#f3f4f6;margin:0;padding:0;">
<div style="max-width:600px;margin:0 auto;padding:24px 16px;">

  <div style="background:#0f172a;border-radius:16px 16px 0 0;padding:28px 32px;">
    <p style="color:rgba(255,255,255,.4);font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;margin:0 0 8px;">Briefing pre-reunión</p>
    <h1 style="color:#fff;margin:0 0 4px;font-size:22px;font-weight:800;">Buenos días, ${firstName}</h1>
    <p style="color:rgba(255,255,255,.5);margin:0;font-size:13px;text-transform:capitalize;">${date}</p>
  </div>

  ${allClear
    ? `<div style="background:#fff;padding:32px;border:1px solid #e5e7eb;border-top:none;text-align:center;">
         <div style="font-size:36px;margin-bottom:12px;">✅</div>
         <p style="font-size:16px;font-weight:700;color:#065f46;margin:0 0 4px;">Todo en orden esta semana</p>
         <p style="font-size:13px;color:#6b7280;margin:0;">No tenés alertas pendientes. Llegás alineado a la reunión.</p>
       </div>`
    : `<div style="background:#fff;padding:16px 32px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
         <div style="display:flex;gap:8px;flex-wrap:wrap;">${pillsHtml}</div>
       </div>`}

  ${bullets.length > 0 ? `
  <div style="background:#1e293b;padding:24px 32px;border-left:1px solid #1e293b;border-right:1px solid #1e293b;">
    <p style="color:rgba(255,255,255,.4);font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin:0 0 16px;">✨ Resumen IA — para la reunión</p>
    <table cellpadding="0" cellspacing="0" style="width:100%;">
      ${bulletsHtml}
    </table>
  </div>` : ''}

  ${atRisk.length > 0 ? `
  <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;">
    <div style="padding:12px 32px;background:#fef2f2;border-bottom:1px solid #fee2e2;">
      <p style="font-size:11px;font-weight:700;color:#dc2626;letter-spacing:.08em;text-transform:uppercase;margin:0;">🔴 KRs en riesgo</p>
    </div>
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
      <thead><tr>
        <th style="padding:6px 12px;font-size:10px;color:#9ca3af;font-weight:600;text-align:left;text-transform:uppercase;">Key Result</th>
        <th style="padding:6px 12px;font-size:10px;color:#9ca3af;font-weight:600;text-align:left;">Objetivo</th>
        <th style="padding:6px 12px;font-size:10px;color:#9ca3af;font-weight:600;text-align:right;">Confianza</th>
      </tr></thead>
      <tbody>${krRows}</tbody>
    </table>
  </div>` : ''}

  ${agreements.length > 0 ? `
  <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;">
    <div style="padding:12px 32px;background:#fffbeb;border-bottom:1px solid #fef3c7;">
      <p style="font-size:11px;font-weight:700;color:#d97706;letter-spacing:.08em;text-transform:uppercase;margin:0;">⚠️ Acuerdos urgentes</p>
    </div>
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
      <tbody>${agrRows}</tbody>
    </table>
  </div>` : ''}

  ${sprintItems.length > 0 ? `
  <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;">
    <div style="padding:12px 32px;background:#eff6ff;border-bottom:1px solid #dbeafe;">
      <p style="font-size:11px;font-weight:700;color:#2563eb;letter-spacing:.08em;text-transform:uppercase;margin:0;">⚙️ Historias activas en sprint</p>
    </div>
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
      <tbody>${storyRows}</tbody>
    </table>
  </div>` : ''}

  <div style="background:#fff;padding:24px 32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 16px 16px;text-align:center;">
    <a href="${appUrl}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;">
      Ir a mis OKRs →
    </a>
    <p style="font-size:11px;color:#9ca3af;margin:12px 0 0;">Enviado automáticamente por OKR System · Lunes 7am</p>
  </div>

</div>
</body>
</html>`;
  }
}
