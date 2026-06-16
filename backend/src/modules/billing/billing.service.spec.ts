import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BillingService, PLAN_PRICES } from './billing.service';
import { DbService } from '../../database/db.service';

const mockDb = {
  query: jest.fn(),
  queryOne: jest.fn(),
  execute: jest.fn(),
};

const mockConfig = {
  get: jest.fn(),
};

// Stripe mock injected directly into the service after instantiation
const mockStripe = {
  subscriptions: { retrieve: jest.fn() },
  webhooks:      { constructEvent: jest.fn() },
  checkout:      { sessions: { create: jest.fn() } },
  customers:     { create: jest.fn() },
  billingPortal: { sessions: { create: jest.fn() } },
};

const ORG_ID  = 'org-uuid-1234';
const USER_ID = 'user-uuid';

describe('BillingService', () => {
  let svc: BillingService;

  beforeEach(async () => {
    jest.resetAllMocks();
    // No STRIPE_SECRET_KEY → stripe stays null in constructor
    mockConfig.get.mockReturnValue(null);

    const module = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: DbService,     useValue: mockDb },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    svc = module.get(BillingService);
  });

  // ── getPlans ──────────────────────────────────────────────────────────────

  describe('getPlans', () => {
    it('returns all plan definitions', () => {
      const plans = svc.getPlans();
      expect(plans).toBe(PLAN_PRICES);
      expect(Object.keys(plans)).toEqual(expect.arrayContaining(['FREE', 'PRO', 'ENTERPRISE']));
    });

    it('PRO plan has correct USD price', () => {
      expect(PLAN_PRICES.PRO.usd).toBe(49);
    });

    it('FREE plan has 0 price', () => {
      expect(PLAN_PRICES.FREE.usd).toBe(0);
      expect(PLAN_PRICES.FREE.ars).toBe(0);
    });
  });

  // ── createStripeCheckout — Stripe not configured ──────────────────────────

  describe('createStripeCheckout — Stripe not configured', () => {
    it('throws BadRequestException when Stripe is not configured', async () => {
      await expect(
        svc.createStripeCheckout(ORG_ID, USER_ID, 'test@org.com'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── createStripePortal — Stripe not configured ────────────────────────────

  describe('createStripePortal — Stripe not configured', () => {
    it('throws BadRequestException when Stripe is not configured', async () => {
      await expect(svc.createStripePortal(ORG_ID)).rejects.toThrow(BadRequestException);
    });
  });

  // ── handleStripeWebhook — Stripe not configured ───────────────────────────

  describe('handleStripeWebhook — Stripe not configured', () => {
    it('returns without throwing when Stripe is not configured', async () => {
      await expect(
        svc.handleStripeWebhook(Buffer.from('raw'), 'sig'),
      ).resolves.toBeUndefined();
    });
  });

  // ── getOrgBillingStatus ───────────────────────────────────────────────────

  describe('getOrgBillingStatus', () => {
    it('returns billing status with trial active', async () => {
      const futureDate = new Date(Date.now() + 86400000 * 10).toISOString();
      mockDb.queryOne.mockResolvedValueOnce({
        plan: 'FREE',
        trial_expires_at: futureDate,
        stripe_subscription_id: null,
        mp_subscription_id: null,
        plan_current_period_end: null,
        billing_interval: 'monthly',
      });
      const result = await svc.getOrgBillingStatus(ORG_ID);
      expect(result.plan).toBe('FREE');
      expect(result.trial_active).toBe(true);
      expect(result.trial_expired).toBe(false);
      expect(result.has_subscription).toBe(false);
    });

    it('returns billing status with trial expired', async () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString();
      mockDb.queryOne.mockResolvedValueOnce({
        plan: 'FREE',
        trial_expires_at: pastDate,
        stripe_subscription_id: null,
        mp_subscription_id: null,
        plan_current_period_end: null,
        billing_interval: 'monthly',
      });
      const result = await svc.getOrgBillingStatus(ORG_ID);
      expect(result.trial_active).toBe(false);
      expect(result.trial_expired).toBe(true);
    });

    it('returns has_subscription true when stripe sub exists', async () => {
      mockDb.queryOne.mockResolvedValueOnce({
        plan: 'PRO',
        trial_expires_at: null,
        stripe_subscription_id: 'sub_123',
        mp_subscription_id: null,
        plan_current_period_end: '2026-12-31',
        billing_interval: 'monthly',
      });
      const result = await svc.getOrgBillingStatus(ORG_ID);
      expect(result.has_subscription).toBe(true);
      expect(result.plan).toBe('PRO');
    });

    it('throws NotFoundException when org not found', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);
      await expect(svc.getOrgBillingStatus('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ── Webhook handlers with Stripe configured ───────────────────────────────

  describe('handleStripeWebhook — with Stripe mock', () => {
    beforeEach(() => {
      // Inject Stripe mock after service instantiation
      (svc as any).stripe = mockStripe;
      mockConfig.get.mockImplementation((key: string) => {
        if (key === 'STRIPE_WEBHOOK_SECRET') return 'whsec_test';
        return null;
      });
    });

    function makeEvent(type: string, data: Record<string, unknown>): object {
      return { id: `evt_${Date.now()}`, type, data: { object: data } };
    }

    it('returns early for duplicate event (idempotency)', async () => {
      const event = makeEvent('checkout.session.completed', {});
      mockStripe.webhooks.constructEvent.mockReturnValueOnce(event);
      mockDb.queryOne.mockResolvedValueOnce({ id: 'existing-event-id' }); // duplicate found
      await svc.handleStripeWebhook(Buffer.from('raw'), 'sig');
      expect(mockDb.execute).not.toHaveBeenCalled();
    });

    it('throws BadRequestException on invalid webhook signature', async () => {
      mockStripe.webhooks.constructEvent.mockImplementationOnce(() => {
        throw new Error('No signatures found matching the expected signature');
      });
      await expect(
        svc.handleStripeWebhook(Buffer.from('raw'), 'bad-sig'),
      ).rejects.toThrow(BadRequestException);
    });

    it('processes checkout.session.completed — upgrades org to PRO', async () => {
      const event = makeEvent('checkout.session.completed', {
        metadata: { org_id: ORG_ID, interval: 'monthly' },
        subscription: 'sub_123',
        customer: 'cus_123',
      });
      mockStripe.webhooks.constructEvent.mockReturnValueOnce(event);
      mockDb.queryOne.mockResolvedValueOnce(null); // no duplicate
      mockStripe.subscriptions.retrieve.mockResolvedValueOnce({
        current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
        metadata: { org_id: ORG_ID },
      });
      mockDb.execute.mockResolvedValue(undefined);

      await svc.handleStripeWebhook(Buffer.from('raw'), 'sig');

      // 'PRO' and 'stripe' are embedded in the SQL literal, not in params
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('sp_apply_billing_upgrade'),
        expect.arrayContaining([ORG_ID]),
      );
    });

    it('processes invoice.payment_succeeded — updates period end', async () => {
      const event = makeEvent('invoice.payment_succeeded', {
        subscription: 'sub_123',
      });
      mockStripe.webhooks.constructEvent.mockReturnValueOnce(event);
      mockDb.queryOne.mockResolvedValueOnce(null); // no duplicate
      mockStripe.subscriptions.retrieve.mockResolvedValueOnce({
        metadata: { org_id: ORG_ID },
        current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
      });
      mockDb.execute.mockResolvedValue(undefined);

      await svc.handleStripeWebhook(Buffer.from('raw'), 'sig');

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('plan_current_period_end'),
        expect.arrayContaining([ORG_ID]),
      );
    });

    it('processes invoice.payment_succeeded — skips when sub has no org_id', async () => {
      const event = makeEvent('invoice.payment_succeeded', { subscription: 'sub_456' });
      mockStripe.webhooks.constructEvent.mockReturnValueOnce(event);
      mockDb.queryOne.mockResolvedValueOnce(null);
      mockStripe.subscriptions.retrieve.mockResolvedValueOnce({
        metadata: {},
        current_period_end: Math.floor(Date.now() / 1000),
      });
      mockDb.execute.mockResolvedValue(undefined);

      await svc.handleStripeWebhook(Buffer.from('raw'), 'sig');

      // Only the billing_events INSERT should be called (not the UPDATE organizations)
      const updateCalls = mockDb.execute.mock.calls.filter(
        ([sql]: [string]) => sql.includes('plan_current_period_end'),
      );
      expect(updateCalls).toHaveLength(0);
    });

    it('processes customer.subscription.updated — updates period_end and interval', async () => {
      const periodEndEpoch = Math.floor(Date.now() / 1000) + 86400 * 365;
      const event = makeEvent('customer.subscription.updated', {
        metadata: { org_id: ORG_ID },
        current_period_end: periodEndEpoch,
        items: { data: [{ plan: { interval: 'year' } }] },
      });
      mockStripe.webhooks.constructEvent.mockReturnValueOnce(event);
      mockDb.queryOne.mockResolvedValueOnce(null);
      mockDb.execute.mockResolvedValue(undefined);

      await svc.handleStripeWebhook(Buffer.from('raw'), 'sig');

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('billing_interval'),
        expect.arrayContaining(['annual', ORG_ID]),
      );
    });

    it('customer.subscription.updated — monthly interval when plan.interval is month', async () => {
      const event = makeEvent('customer.subscription.updated', {
        metadata: { org_id: ORG_ID },
        current_period_end: Math.floor(Date.now() / 1000),
        items: { data: [{ plan: { interval: 'month' } }] },
      });
      mockStripe.webhooks.constructEvent.mockReturnValueOnce(event);
      mockDb.queryOne.mockResolvedValueOnce(null);
      mockDb.execute.mockResolvedValue(undefined);

      await svc.handleStripeWebhook(Buffer.from('raw'), 'sig');

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('billing_interval'),
        expect.arrayContaining(['monthly', ORG_ID]),
      );
    });

    it('customer.subscription.updated — skips when no org_id in metadata', async () => {
      const event = makeEvent('customer.subscription.updated', {
        metadata: {},
        current_period_end: Math.floor(Date.now() / 1000),
        items: { data: [] },
      });
      mockStripe.webhooks.constructEvent.mockReturnValueOnce(event);
      mockDb.queryOne.mockResolvedValueOnce(null);
      mockDb.execute.mockResolvedValue(undefined);

      await svc.handleStripeWebhook(Buffer.from('raw'), 'sig');

      const updateCalls = mockDb.execute.mock.calls.filter(
        ([sql]: [string]) => sql.includes('billing_interval'),
      );
      expect(updateCalls).toHaveLength(0);
    });

    it('processes invoice.payment_failed — only logs, no downgrade', async () => {
      const event = makeEvent('invoice.payment_failed', { subscription: 'sub_123' });
      mockStripe.webhooks.constructEvent.mockReturnValueOnce(event);
      mockDb.queryOne.mockResolvedValueOnce(null);
      mockStripe.subscriptions.retrieve.mockResolvedValueOnce({
        metadata: { org_id: ORG_ID },
      });
      mockDb.execute.mockResolvedValue(undefined);

      await svc.handleStripeWebhook(Buffer.from('raw'), 'sig');

      // No downgrade stored procedure should be called
      const downgradeCalls = mockDb.execute.mock.calls.filter(
        ([sql]: [string]) => sql.includes('sp_downgrade_to_free'),
      );
      expect(downgradeCalls).toHaveLength(0);
    });

    it('processes customer.subscription.deleted — downgrades org to FREE', async () => {
      const event = makeEvent('customer.subscription.deleted', {
        metadata: { org_id: ORG_ID },
      });
      mockStripe.webhooks.constructEvent.mockReturnValueOnce(event);
      mockDb.queryOne.mockResolvedValueOnce(null);
      mockDb.execute.mockResolvedValue(undefined);

      await svc.handleStripeWebhook(Buffer.from('raw'), 'sig');

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('sp_downgrade_to_free'),
        [ORG_ID],
      );
    });

    it('customer.subscription.deleted — skips when no org_id in metadata', async () => {
      const event = makeEvent('customer.subscription.deleted', { metadata: {} });
      mockStripe.webhooks.constructEvent.mockReturnValueOnce(event);
      mockDb.queryOne.mockResolvedValueOnce(null);
      mockDb.execute.mockResolvedValue(undefined);

      await svc.handleStripeWebhook(Buffer.from('raw'), 'sig');

      const downgradeCalls = mockDb.execute.mock.calls.filter(
        ([sql]: [string]) => sql.includes('sp_downgrade_to_free'),
      );
      expect(downgradeCalls).toHaveLength(0);
    });

    it('records every processed event in billing_events (idempotency log)', async () => {
      const event = makeEvent('customer.subscription.deleted', {
        metadata: { org_id: ORG_ID },
      });
      mockStripe.webhooks.constructEvent.mockReturnValueOnce(event);
      mockDb.queryOne.mockResolvedValueOnce(null);
      mockDb.execute.mockResolvedValue(undefined);

      await svc.handleStripeWebhook(Buffer.from('raw'), 'sig');

      // 'stripe' is a literal in the SQL; params are [event_type, event_id, payload]
      const logCall = mockDb.execute.mock.calls.find(
        ([sql]: [string]) => sql.includes('billing_events'),
      );
      expect(logCall).toBeDefined();
      expect(logCall[1]).toEqual(
        expect.arrayContaining(['customer.subscription.deleted']),
      );
    });
  });

  // ── createStripeCheckout — with Stripe configured ─────────────────────────

  describe('createStripeCheckout — with Stripe mock', () => {
    beforeEach(() => {
      (svc as any).stripe = mockStripe;
      mockConfig.get.mockImplementation((key: string) => {
        if (key === 'STRIPE_PRICE_PRO_MONTHLY') return 'price_monthly';
        if (key === 'STRIPE_PRICE_PRO_ANNUAL')  return 'price_annual';
        if (key === 'FRONTEND_URL') return 'http://localhost:3001';
        return null;
      });
    });

    it('throws BadRequestException when price ID not configured', async () => {
      mockConfig.get.mockReturnValue(null); // no price IDs
      (svc as any).stripe = mockStripe;
      await expect(
        svc.createStripeCheckout(ORG_ID, USER_ID, 'test@org.com'),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates a new Stripe customer when org has none', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ name: 'Acme', stripe_customer_id: null });
      mockStripe.customers.create.mockResolvedValueOnce({ id: 'cus_new' });
      mockDb.execute.mockResolvedValueOnce(undefined);
      mockStripe.checkout.sessions.create.mockResolvedValueOnce({ url: 'https://checkout.stripe.com/x' });

      const result = await svc.createStripeCheckout(ORG_ID, USER_ID, 'cfo@org.com');
      expect(result.url).toBe('https://checkout.stripe.com/x');
      expect(mockStripe.customers.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'cfo@org.com' }),
      );
    });

    it('reuses existing Stripe customer', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ name: 'Acme', stripe_customer_id: 'cus_existing' });
      mockStripe.checkout.sessions.create.mockResolvedValueOnce({ url: 'https://checkout.stripe.com/y' });

      await svc.createStripeCheckout(ORG_ID, USER_ID, 'cfo@org.com');
      expect(mockStripe.customers.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when org not found', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);
      await expect(
        svc.createStripeCheckout(ORG_ID, USER_ID, 'test@org.com'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── createStripePortal — with Stripe configured ───────────────────────────

  describe('createStripePortal — with Stripe mock', () => {
    beforeEach(() => {
      (svc as any).stripe = mockStripe;
      mockConfig.get.mockImplementation((key: string) =>
        key === 'FRONTEND_URL' ? 'http://localhost:3001' : null,
      );
    });

    it('throws BadRequestException when org has no Stripe customer', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ stripe_customer_id: null });
      await expect(svc.createStripePortal(ORG_ID)).rejects.toThrow(BadRequestException);
    });

    it('returns portal URL for org with Stripe customer', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ stripe_customer_id: 'cus_123' });
      mockStripe.billingPortal.sessions.create.mockResolvedValueOnce({
        url: 'https://billing.stripe.com/p/session_test',
      });
      const result = await svc.createStripePortal(ORG_ID);
      expect(result.url).toBe('https://billing.stripe.com/p/session_test');
    });
  });
});
