import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DbService } from '../../database/db.service';

/* eslint-disable @typescript-eslint/no-explicit-any */

export const PLAN_PRICES: Record<string, { usd: number; ars: number; label: string; features: string[] }> = {
  FREE: {
    usd: 0, ars: 0,
    label: 'Free',
    features: ['Hasta 5 miembros', '1 ciclo activo', '10 objetivos', 'Sin agentes IA', 'Sin reportes avanzados'],
  },
  PRO: {
    usd: 49, ars: 49000,
    label: 'Pro',
    features: ['Hasta 50 miembros', 'Ciclos ilimitados', 'Objetivos ilimitados', 'Agentes de IA', 'Todos los reportes', 'Export PDF/CSV', 'Soporte prioritario'],
  },
  ENTERPRISE: {
    usd: 0, ars: 0,
    label: 'Enterprise',
    features: ['Miembros ilimitados', 'Todo lo de Pro', 'SLA garantizado', 'Onboarding dedicado', 'Integraciones personalizadas', 'Precio a medida'],
  },
};

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private stripe: any = null;

  constructor(
    private readonly db: DbService,
    private readonly config: ConfigService,
  ) {
    const key = this.config.get<string>('STRIPE_SECRET_KEY');
    if (key) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Stripe = require('stripe');
      this.stripe = new Stripe(key);
    }
  }

  getPlans() {
    return PLAN_PRICES;
  }

  // ── Stripe ──────────────────────────────────────────────────────────────────

  async createStripeCheckout(orgId: string, userId: string, userEmail: string, interval: 'monthly' | 'annual' = 'monthly') {
    if (!this.stripe) throw new BadRequestException('Stripe no está configurado');

    const priceId = interval === 'annual'
      ? this.config.get<string>('STRIPE_PRICE_PRO_ANNUAL')
      : this.config.get<string>('STRIPE_PRICE_PRO_MONTHLY');

    if (!priceId) throw new BadRequestException('Precio de Stripe no configurado — agrega STRIPE_PRICE_PRO_MONTHLY al .env');

    const org = await this.db.queryOne<{ name: string; stripe_customer_id: string | null }>(
      `SELECT name, stripe_customer_id FROM organizations WHERE id = $1 AND deleted_at IS NULL`,
      [orgId],
    );
    if (!org) throw new NotFoundException('Organización no encontrada');

    let customerId = org.stripe_customer_id;
    if (!customerId) {
      const customer = await this.stripe.customers.create({
        email: userEmail,
        name: org.name,
        metadata: { org_id: orgId, user_id: userId },
      });
      customerId = customer.id;
      await this.db.execute(
        `UPDATE organizations SET stripe_customer_id = $1 WHERE id = $2`,
        [customerId, orgId],
      );
    }

    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3001');
    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${frontendUrl}/upgrade/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/upgrade?cancelled=1`,
      metadata: { org_id: orgId, user_id: userId, interval },
      subscription_data: { metadata: { org_id: orgId } },
      allow_promotion_codes: true,
    });

    return { url: session.url };
  }

  async handleStripeWebhook(rawBody: Buffer, signature: string) {
    if (!this.stripe) return;
    const webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) { this.logger.warn('STRIPE_WEBHOOK_SECRET not set'); return; }

    let event: any;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      this.logger.error('Stripe webhook signature failed', err);
      throw new BadRequestException('Invalid Stripe signature');
    }

    const existing = await this.db.queryOne(
      `SELECT id FROM billing_events WHERE provider = 'stripe' AND event_id = $1`,
      [event.id],
    );
    if (existing) return;

    await this.processStripeEvent(event);

    await this.db.execute(
      `INSERT INTO billing_events (provider, event_type, event_id, payload) VALUES ('stripe', $1, $2, $3)`,
      [event.type, event.id, JSON.stringify(event.data.object)],
    );
  }

  private async processStripeEvent(event: any) {
    const { type } = event;
    const obj = event.data.object;

    if (type === 'checkout.session.completed') {
      const orgId: string = obj.metadata?.org_id;
      const interval: string = obj.metadata?.interval ?? 'monthly';
      if (!orgId || !obj.subscription) return;

      const sub = await this.stripe.subscriptions.retrieve(obj.subscription);
      const periodEnd = new Date(sub.current_period_end * 1000);
      await this.db.execute(
        `CALL sp_apply_billing_upgrade($1, 'PRO', 'stripe', $2, $3, NULL, $4, $5)`,
        [orgId, obj.customer, obj.subscription, periodEnd.toISOString(), interval],
      );
      this.logger.log(`Org ${orgId} upgraded to PRO via Stripe`);
    }

    else if (type === 'invoice.payment_succeeded') {
      const subId: string = obj.subscription;
      if (!subId) return;
      const sub = await this.stripe.subscriptions.retrieve(subId);
      const orgId: string = sub.metadata?.org_id;
      if (!orgId) return;
      const periodEnd = new Date(sub.current_period_end * 1000);
      await this.db.execute(
        `UPDATE organizations SET plan_current_period_end = $1 WHERE id = $2`,
        [periodEnd.toISOString(), orgId],
      );
    }

    else if (type === 'customer.subscription.updated') {
      const orgId: string = obj.metadata?.org_id;
      if (!orgId) return;
      const periodEnd = new Date(obj.current_period_end * 1000);
      const interval = obj.items?.data?.[0]?.plan?.interval === 'year' ? 'annual' : 'monthly';
      await this.db.execute(
        `UPDATE organizations SET plan_current_period_end = $1, billing_interval = $2 WHERE id = $3`,
        [periodEnd.toISOString(), interval, orgId],
      );
    }

    else if (type === 'invoice.payment_failed') {
      const subId: string = obj.subscription;
      if (!subId) return;
      const sub = await this.stripe.subscriptions.retrieve(subId);
      const orgId: string = sub.metadata?.org_id;
      if (!orgId) return;
      // No hacer downgrade aquí — Stripe reintenta automáticamente y envía
      // customer.subscription.deleted si todos los reintentos fallan.
      this.logger.warn(`Payment failed for org ${orgId} — Stripe will retry automatically`);
    }

    else if (type === 'customer.subscription.deleted') {
      const orgId: string = obj.metadata?.org_id;
      if (!orgId) return;
      await this.db.execute(`CALL sp_downgrade_to_free($1)`, [orgId]);
      this.logger.log(`Org ${orgId} downgraded to FREE`);
    }
  }

  async createStripePortal(orgId: string) {
    if (!this.stripe) throw new BadRequestException('Stripe no está configurado');
    const org = await this.db.queryOne<{ stripe_customer_id: string | null }>(
      `SELECT stripe_customer_id FROM organizations WHERE id = $1`,
      [orgId],
    );
    if (!org?.stripe_customer_id) throw new BadRequestException('No hay suscripción activa de Stripe');
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3001');
    const session = await this.stripe.billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: `${frontendUrl}/settings`,
    });
    return { url: session.url };
  }

  // ── MercadoPago ──────────────────────────────────────────────────────────────

  async createMercadoPagoCheckout(orgId: string, _userId: string, userEmail: string, interval: 'monthly' | 'annual' = 'monthly') {
    const accessToken = this.config.get<string>('MP_ACCESS_TOKEN');
    if (!accessToken) throw new BadRequestException('MercadoPago no está configurado');

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { MercadoPagoConfig, PreApproval } = require('mercadopago');
    const mp = new MercadoPagoConfig({ accessToken });
    const preApproval = new PreApproval(mp);

    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3001');
    const priceArs = interval === 'annual' ? 490000 : 49000;

    const org = await this.db.queryOne<{ name: string }>(
      `SELECT name FROM organizations WHERE id = $1`,
      [orgId],
    );

    const result = await preApproval.create({
      body: {
        reason: `OKR System PRO — ${org?.name}`,
        payer_email: userEmail,
        auto_recurring: {
          frequency: 1,
          frequency_type: interval === 'annual' ? 'years' : 'months',
          transaction_amount: priceArs,
          currency_id: 'ARS',
        },
        back_url: `${frontendUrl}/upgrade/success`,
        external_reference: orgId,
      },
    });

    return { url: result.init_point };
  }

  async handleMercadoPagoWebhook(body: Record<string, any>) {
    const accessToken = this.config.get<string>('MP_ACCESS_TOKEN');
    if (!accessToken) return;

    const topic = body.type as string;
    const resourceId = (body.data as any)?.id as string;
    if (!resourceId) return;

    const idempotencyKey = `${topic}:${resourceId}`;
    const existing = await this.db.queryOne(
      `SELECT id FROM billing_events WHERE provider = 'mercadopago' AND event_id = $1`,
      [idempotencyKey],
    );
    if (existing) return;

    try {
      if (topic === 'subscription_preapproval') {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { MercadoPagoConfig, PreApproval } = require('mercadopago');
        const mp = new MercadoPagoConfig({ accessToken });
        const preApproval = new PreApproval(mp);
        const sub = await preApproval.get({ id: resourceId });

        const orgId = sub.external_reference as string;
        if (orgId) {
          if (sub.status === 'authorized') {
            await this.db.execute(
              `CALL sp_apply_billing_upgrade($1, 'PRO', 'mercadopago', NULL, NULL, $2, NULL, 'monthly')`,
              [orgId, resourceId],
            );
            this.logger.log(`Org ${orgId} upgraded to PRO via MercadoPago`);
          } else if (sub.status === 'cancelled') {
            await this.db.execute(`CALL sp_downgrade_to_free($1)`, [orgId]);
          }
        }
      }
    } catch (err) {
      this.logger.error('MercadoPago webhook processing failed', err);
    }

    await this.db.execute(
      `INSERT INTO billing_events (provider, event_type, event_id, payload) VALUES ('mercadopago', $1, $2, $3)`,
      [topic, idempotencyKey, JSON.stringify(body)],
    );
  }

  async getOrgBillingStatus(orgId: string) {
    const row = await this.db.queryOne<{
      plan: string;
      trial_expires_at: string | null;
      stripe_subscription_id: string | null;
      mp_subscription_id: string | null;
      plan_current_period_end: string | null;
      billing_interval: string;
    }>(
      `SELECT plan, trial_expires_at, stripe_subscription_id, mp_subscription_id,
              plan_current_period_end, billing_interval
         FROM organizations WHERE id = $1`,
      [orgId],
    );
    if (!row) throw new NotFoundException('Organización no encontrada');

    const now = new Date();
    const trialActive = row.trial_expires_at ? new Date(row.trial_expires_at) > now : false;
    const trialExpired = row.trial_expires_at ? new Date(row.trial_expires_at) <= now : false;

    return {
      plan: row.plan,
      trial_active: trialActive,
      trial_expired: trialExpired,
      trial_expires_at: row.trial_expires_at,
      has_subscription: !!(row.stripe_subscription_id || row.mp_subscription_id),
      period_end: row.plan_current_period_end,
      billing_interval: row.billing_interval,
      stripe_enabled: !!this.config.get('STRIPE_SECRET_KEY'),
      mp_enabled: !!this.config.get('MP_ACCESS_TOKEN'),
    };
  }
}
