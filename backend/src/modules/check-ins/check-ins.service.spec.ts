import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CheckInsService } from './check-ins.service';
import { DbService } from '../../database/db.service';
import { RedisService } from '../../common/redis/redis.service';
import { TelegramService } from '../../common/telegram/telegram.service';
import { CheckInMood } from './dto/create-check-in.dto';

const mockDb = {
  query: jest.fn(),
  queryOne: jest.fn(),
  execute: jest.fn(),
};

const mockRedis = {
  delPattern: jest.fn().mockResolvedValue(undefined),
};

const mockTelegram = {
  sendMessage: jest.fn().mockResolvedValue(undefined),
  isConfigured: false,
};

const mockNotifications = {
  emitToOrg: jest.fn(),
};

const ORG_ID     = 'org-uuid';
const KR_ID      = 'kr-uuid';
const USER_ID    = 'user-uuid';
const CHECKIN_ID = 'checkin-uuid';
const CYCLE_ID   = 'cycle-uuid';

const fakeKr = { id: KR_ID, status: 'ACTIVE' };
const fakeCheckIn = {
  id: CHECKIN_ID,
  kr_id: KR_ID,
  user_id: USER_ID,
  current_value: 50,
  confidence: 0.7,
  notes: 'Good progress',
  mood: CheckInMood.GOOD,
};

describe('CheckInsService', () => {
  let svc: CheckInsService;

  beforeEach(async () => {
    jest.resetAllMocks();
    mockRedis.delPattern.mockResolvedValue(undefined);
    mockTelegram.sendMessage.mockResolvedValue(undefined);
    const module = await Test.createTestingModule({
      providers: [
        CheckInsService,
        { provide: DbService,         useValue: mockDb },
        { provide: RedisService,      useValue: mockRedis },
        { provide: TelegramService,   useValue: mockTelegram },
        { provide: 'NotificationsGateway', useValue: mockNotifications },
      ],
    }).compile();
    svc = module.get(CheckInsService);
    (svc as any).notifications = mockNotifications;
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    const validDto = { current_value: 50, confidence: 0.7, notes: 'Good', mood: CheckInMood.GOOD };

    it('creates a check-in and emits WebSocket event', async () => {
      mockDb.queryOne.mockResolvedValueOnce(fakeKr);
      mockDb.query.mockResolvedValueOnce([{ p_checkin_id: CHECKIN_ID }]);
      mockDb.query.mockResolvedValueOnce([fakeCheckIn]);
      mockDb.queryOne.mockResolvedValueOnce({ organization_id: ORG_ID });
      const result = await svc.create(ORG_ID, KR_ID, USER_ID, validDto);
      expect(result).toEqual(fakeCheckIn);
      expect(mockNotifications.emitToOrg).toHaveBeenCalledWith(
        ORG_ID,
        'checkin:created',
        expect.objectContaining({ kr_id: KR_ID, user_id: USER_ID }),
      );
    });

    it('throws NotFoundException when KR not found', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);
      await expect(svc.create(ORG_ID, KR_ID, USER_ID, validDto)).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when KR is COMPLETED', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ id: KR_ID, status: 'COMPLETED' });
      await expect(svc.create(ORG_ID, KR_ID, USER_ID, validDto)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when KR is CANCELLED', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ id: KR_ID, status: 'CANCELLED' });
      await expect(svc.create(ORG_ID, KR_ID, USER_ID, validDto)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException on past-date check-in (P0020)', async () => {
      mockDb.queryOne.mockResolvedValueOnce(fakeKr);
      const err = new Error('anterior al último check-in');
      (err as any).code = 'P0020';
      mockDb.query.mockRejectedValueOnce(err);
      await expect(svc.create(ORG_ID, KR_ID, USER_ID, validDto)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException on constraint violation (23514)', async () => {
      mockDb.queryOne.mockResolvedValueOnce(fakeKr);
      const err = new Error('confidence out of range');
      (err as any).code = '23514';
      mockDb.query.mockRejectedValueOnce(err);
      await expect(svc.create(ORG_ID, KR_ID, USER_ID, validDto)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException on missing field (23502)', async () => {
      mockDb.queryOne.mockResolvedValueOnce(fakeKr);
      const err = new Error('null value violates not-null constraint');
      (err as any).code = '23502';
      mockDb.query.mockRejectedValueOnce(err);
      await expect(svc.create(ORG_ID, KR_ID, USER_ID, validDto)).rejects.toThrow(BadRequestException);
    });

    it('re-throws unknown errors', async () => {
      mockDb.queryOne.mockResolvedValueOnce(fakeKr);
      mockDb.query.mockRejectedValueOnce(new Error('Connection lost'));
      await expect(svc.create(ORG_ID, KR_ID, USER_ID, validDto)).rejects.toThrow('Connection lost');
    });

    it('invalidates reports cache after creating a check-in', async () => {
      mockDb.queryOne.mockResolvedValueOnce(fakeKr);
      mockDb.query.mockResolvedValueOnce([{ p_checkin_id: CHECKIN_ID }]);
      mockDb.query.mockResolvedValueOnce([fakeCheckIn]);
      mockDb.queryOne.mockResolvedValueOnce({ organization_id: ORG_ID });
      await svc.create(ORG_ID, KR_ID, USER_ID, validDto);
      expect(mockRedis.delPattern).toHaveBeenCalledWith(`reports:*:${ORG_ID}:*`);
    });

    it('emits WebSocket event to the correct org', async () => {
      mockDb.queryOne.mockResolvedValueOnce(fakeKr);
      mockDb.query.mockResolvedValueOnce([{ p_checkin_id: CHECKIN_ID }]);
      mockDb.query.mockResolvedValueOnce([fakeCheckIn]);
      mockDb.queryOne.mockResolvedValueOnce({ organization_id: ORG_ID });
      await svc.create(ORG_ID, KR_ID, USER_ID, validDto);
      expect(mockNotifications.emitToOrg).toHaveBeenCalledWith(
        ORG_ID, 'checkin:created', expect.objectContaining({ kr_id: KR_ID }),
      );
    });
  });

  // ── getHistory ────────────────────────────────────────────────────────────

  describe('getHistory', () => {
    it('returns check-in history for a KR', async () => {
      mockDb.queryOne.mockResolvedValueOnce(fakeKr);
      mockDb.query.mockResolvedValueOnce([fakeCheckIn]);
      const result = await svc.getHistory(ORG_ID, KR_ID);
      expect(result).toEqual([fakeCheckIn]);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('v_check_in_history'),
        [KR_ID],
      );
    });

    it('throws NotFoundException when KR not found', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);
      await expect(svc.getHistory(ORG_ID, KR_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ── getAtRiskKrs ──────────────────────────────────────────────────────────

  describe('getAtRiskKrs', () => {
    it('returns at-risk KRs for org', async () => {
      mockDb.query.mockResolvedValueOnce([fakeKr]);
      const result = await svc.getAtRiskKrs(ORG_ID);
      expect(result).toEqual([fakeKr]);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('v_at_risk_krs'),
        [ORG_ID],
      );
    });

    it('filters by cycleId when provided', async () => {
      mockDb.query.mockResolvedValueOnce([fakeKr]);
      await svc.getAtRiskKrs(ORG_ID, 'cycle-1');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('cycle_id'),
        [ORG_ID, 'cycle-1'],
      );
    });
  });

  // ── getNotifications ──────────────────────────────────────────────────────

  describe('getNotifications', () => {
    it('returns notifications for org and user', async () => {
      const notifs = [{ id: 'n1', type: 'KR_AT_RISK', title: 'KR en riesgo' }];
      mockDb.query.mockResolvedValueOnce(notifs);
      const result = await svc.getNotifications(ORG_ID, USER_ID);
      expect(result).toEqual(notifs);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('notifications'),
        [ORG_ID, USER_ID],
      );
    });
  });

  // ── markNotificationRead ──────────────────────────────────────────────────

  describe('markNotificationRead', () => {
    it('marks a notification as read', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ id: 'n1' });
      mockDb.execute.mockResolvedValueOnce(undefined);
      const result = await svc.markNotificationRead(ORG_ID, USER_ID, 'n1');
      expect(result).toEqual({ success: true });
    });

    it('throws NotFoundException when notification not found', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);
      await expect(svc.markNotificationRead(ORG_ID, USER_ID, 'bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ── markAllNotificationsRead ──────────────────────────────────────────────

  describe('markAllNotificationsRead', () => {
    it('marks all notifications as read', async () => {
      mockDb.execute.mockResolvedValueOnce(undefined);
      const result = await svc.markAllNotificationsRead(ORG_ID, USER_ID);
      expect(result).toEqual({ success: true });
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('read_at = NOW()'),
        [ORG_ID, USER_ID],
      );
    });
  });

  // ── getPrediction (fn_kr_forecast) ────────────────────────────────────────

  describe('getPrediction', () => {
    const forecastResult = {
      projected_completion_pct: 85,
      velocity: 2.5,
      action_type: 'ON_TRACK',
      insufficient_data: false,
    };

    it('calls fn_kr_forecast for a valid KR', async () => {
      mockDb.queryOne.mockResolvedValueOnce(fakeKr);
      mockDb.query.mockResolvedValueOnce([{ fn_kr_forecast: forecastResult }]);
      await svc.getPrediction(ORG_ID, KR_ID);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('fn_kr_forecast'),
        expect.arrayContaining([KR_ID]),
      );
    });

    it('returns the forecast JSONB result', async () => {
      mockDb.queryOne.mockResolvedValueOnce(fakeKr);
      mockDb.query.mockResolvedValueOnce([{ fn_kr_forecast: forecastResult }]);
      const result = await svc.getPrediction(ORG_ID, KR_ID);
      expect(result).toEqual(forecastResult);
    });

    it('throws NotFoundException when KR not found', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);
      await expect(svc.getPrediction(ORG_ID, KR_ID)).rejects.toThrow(NotFoundException);
    });

    it('result includes action_type field for ForecastPanel rendering', async () => {
      mockDb.queryOne.mockResolvedValueOnce(fakeKr);
      mockDb.query.mockResolvedValueOnce([{ fn_kr_forecast: forecastResult }]);
      const result = await svc.getPrediction(ORG_ID, KR_ID) as any;
      expect(result).toHaveProperty('action_type');
      expect(result).toHaveProperty('projected_completion_pct');
    });
  });

  // ── getCadenceDashboard ───────────────────────────────────────────────────

  describe('getCadenceDashboard', () => {
    const cadenceItems = [
      { kr_id: 'kr-1', kr_code: 'KR-297', obj_code: 'OBJ-70', days_since_checkin: 5,  organization_id: ORG_ID },
      { kr_id: 'kr-2', kr_code: 'KR-298', obj_code: 'OBJ-70', days_since_checkin: 16, organization_id: ORG_ID },
    ];

    it('queries v_cadence_dashboard with orgId and cycleId', async () => {
      mockDb.query.mockResolvedValueOnce(cadenceItems);
      await svc.getCadenceDashboard(ORG_ID, CYCLE_ID);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('v_cadence_dashboard'),
        expect.arrayContaining([ORG_ID, CYCLE_ID]),
      );
    });

    it('returns items with kr_code field', async () => {
      mockDb.query.mockResolvedValueOnce(cadenceItems);
      const result = await svc.getCadenceDashboard(ORG_ID, CYCLE_ID);
      expect(result[0]).toHaveProperty('kr_code');
      expect(result[0].kr_code).toBe('KR-297');
    });

    it('returns items with obj_code field', async () => {
      mockDb.query.mockResolvedValueOnce(cadenceItems);
      const result = await svc.getCadenceDashboard(ORG_ID, CYCLE_ID);
      expect(result[0]).toHaveProperty('obj_code');
    });

    it('returns empty array when no cadence data exists', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      const result = await svc.getCadenceDashboard(ORG_ID, CYCLE_ID);
      expect(result).toEqual([]);
    });
  });
});
