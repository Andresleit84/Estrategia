import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';
import { DbService } from '../../database/db.service';

const VALID_KEY = 'sk-ant-api-test-key-long-enough-for-validation';

function makeConfigMock(apiKey: string) {
  return {
    get: jest.fn((key: string, fallback?: unknown) => {
      const map: Record<string, unknown> = {
        ANTHROPIC_API_KEY: apiKey,
        AI_DEFAULT_MODEL: 'claude-sonnet-4-6',
        AI_FAST_MODEL: 'claude-haiku-4-5-20251001',
        AI_HEAVY_MODEL: 'claude-sonnet-4-6',
        AI_MAX_TOKENS: '4096',
      };
      return key in map ? map[key] : fallback;
    }),
  };
}

const mockDb = {
  query: jest.fn(),
  queryOne: jest.fn(),
};

describe('AiService', () => {
  describe('isReady — valid API key', () => {
    let service: AiService;

    beforeEach(async () => {
      jest.clearAllMocks();
      const module = await Test.createTestingModule({
        providers: [
          AiService,
          { provide: ConfigService, useValue: makeConfigMock(VALID_KEY) },
          { provide: DbService, useValue: mockDb },
        ],
      }).compile();
      service = module.get(AiService);
    });

    it('returns true when API key starts with sk-ant- and length > 20', () => {
      expect(service.isReady).toBe(true);
    });

    it('generateText returns null and does not throw on API error', async () => {
      const mockCreate = jest.fn().mockRejectedValueOnce(new Error('Network error'));
      (service as unknown as Record<string, unknown>)['anthropic'] = { messages: { create: mockCreate } };
      const result = await service.generateText('test prompt');
      expect(result).toBeNull();
    });

    it('generateText returns text content on success', async () => {
      const mockCreate = jest.fn().mockResolvedValueOnce({
        content: [{ type: 'text', text: '  response text  ' }],
      });
      (service as unknown as Record<string, unknown>)['anthropic'] = { messages: { create: mockCreate } };
      const result = await service.generateText('test prompt');
      expect(result).toBe('response text');
    });
  });

  describe('isReady — missing API key', () => {
    let service: AiService;

    beforeEach(async () => {
      jest.clearAllMocks();
      const module = await Test.createTestingModule({
        providers: [
          AiService,
          { provide: ConfigService, useValue: makeConfigMock('') },
          { provide: DbService, useValue: mockDb },
        ],
      }).compile();
      service = module.get(AiService);
    });

    it('returns false when API key is empty', () => {
      expect(service.isReady).toBe(false);
    });

    it('generateText returns null without calling API', async () => {
      const result = await service.generateText('test');
      expect(result).toBeNull();
    });
  });

  // ── generateCheckinSummary ─────────────────────────────────────────────────

  describe('generateCheckinSummary', () => {
    let service: AiService;
    const checkinData = [{
      kr_id: 'kr-1',
      current_value: 50,
      confidence: 0.7,
      notes: 'Going well',
      mood: 'GOOD',
      objective_title: 'Grow revenue',
      kr_title: 'Increase ARR',
    }];
    const forecastData = [{ fn_kr_forecast: { projected_completion_pct: 85, action_type: 'ON_TRACK' } }];

    beforeEach(async () => {
      jest.clearAllMocks();
      const module = await Test.createTestingModule({
        providers: [
          AiService,
          { provide: ConfigService, useValue: makeConfigMock(VALID_KEY) },
          { provide: DbService, useValue: mockDb },
        ],
      }).compile();
      service = module.get(AiService);
    });

    it('returns { summary: null } when service is not ready', async () => {
      jest.clearAllMocks();
      const mod = await Test.createTestingModule({
        providers: [
          AiService,
          { provide: ConfigService, useValue: makeConfigMock('') },
          { provide: DbService, useValue: mockDb },
        ],
      }).compile();
      const notReadySvc = mod.get(AiService);
      const result = await notReadySvc.generateCheckinSummary('org-uuid', 'checkin-uuid');
      expect(result).toEqual({ summary: null });
    });

    it('calls db.queryOne to get check-in data by checkInId', async () => {
      mockDb.queryOne.mockResolvedValueOnce(checkinData[0]);
      mockDb.query.mockResolvedValueOnce(forecastData);
      const mockCreate = jest.fn().mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Great progress on ARR.' }],
      });
      (service as unknown as Record<string, unknown>)['anthropic'] = { messages: { create: mockCreate } };
      await service.generateCheckinSummary('org-uuid', 'checkin-uuid');
      expect(mockDb.queryOne).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['checkin-uuid']),
      );
    });

    it('returns { summary } object with text from generateText', async () => {
      mockDb.queryOne.mockResolvedValueOnce(checkinData[0]);
      mockDb.query.mockResolvedValueOnce(forecastData);
      const mockCreate = jest.fn().mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Great progress on ARR.' }],
      });
      (service as unknown as Record<string, unknown>)['anthropic'] = { messages: { create: mockCreate } };
      const result = await service.generateCheckinSummary('org-uuid', 'checkin-uuid');
      expect(result).toHaveProperty('summary');
      expect(result.summary).toBe('Great progress on ARR.');
    });

    it('returns { summary: null } when generateText throws', async () => {
      mockDb.queryOne.mockResolvedValueOnce(checkinData[0]);
      mockDb.query.mockResolvedValueOnce(forecastData);
      const mockCreate = jest.fn().mockRejectedValueOnce(new Error('API error'));
      (service as unknown as Record<string, unknown>)['anthropic'] = { messages: { create: mockCreate } };
      const result = await service.generateCheckinSummary('org-uuid', 'checkin-uuid');
      expect(result).toEqual({ summary: null });
    });

    it('fetches check-in via queryOne and forecast via query', async () => {
      mockDb.queryOne.mockResolvedValueOnce(checkinData[0]);
      mockDb.query.mockResolvedValueOnce(forecastData);
      const mockCreate = jest.fn().mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Summary with forecast.' }],
      });
      (service as unknown as Record<string, unknown>)['anthropic'] = { messages: { create: mockCreate } };
      await service.generateCheckinSummary('org-uuid', 'checkin-uuid');
      expect(mockDb.queryOne).toHaveBeenCalledTimes(1);
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });
  });

  // ── generateFirstDayNarrative ──────────────────────────────────────────────

  describe('generateFirstDayNarrative', () => {
    let service: AiService;
    const ctxData = [{
      fn_first_day_context: {
        org: { name: 'Acme Corp', vision: 'To be the best' },
        active_cycle: { name: 'Q2 2026' },
        my_krs: [{ title: 'Increase revenue', progress: 45 }],
      },
    }];

    beforeEach(async () => {
      jest.clearAllMocks();
      const module = await Test.createTestingModule({
        providers: [
          AiService,
          { provide: ConfigService, useValue: makeConfigMock(VALID_KEY) },
          { provide: DbService, useValue: mockDb },
        ],
      }).compile();
      service = module.get(AiService);
    });

    it('calls fn_first_day_context with orgId and userId', async () => {
      mockDb.query.mockResolvedValueOnce(ctxData);
      const mockCreate = jest.fn().mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Welcome to Acme Corp!' }],
      });
      (service as unknown as Record<string, unknown>)['anthropic'] = { messages: { create: mockCreate } };
      await service.generateFirstDayNarrative('org-uuid', 'user-uuid');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('fn_first_day_context'),
        expect.arrayContaining(['org-uuid', 'user-uuid']),
      );
    });

    it('calls generateText with narrative prompt', async () => {
      mockDb.query.mockResolvedValueOnce(ctxData);
      const mockCreate = jest.fn().mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Welcome to Acme Corp!' }],
      });
      (service as unknown as Record<string, unknown>)['anthropic'] = { messages: { create: mockCreate } };
      await service.generateFirstDayNarrative('org-uuid', 'user-uuid');
      expect(mockCreate).toHaveBeenCalled();
    });

    it('returns { narrative: string } on success', async () => {
      mockDb.query.mockResolvedValueOnce(ctxData);
      const mockCreate = jest.fn().mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Welcome to Acme Corp!' }],
      });
      (service as unknown as Record<string, unknown>)['anthropic'] = { messages: { create: mockCreate } };
      const result = await service.generateFirstDayNarrative('org-uuid', 'user-uuid');
      expect(result).toHaveProperty('narrative');
      expect(result.narrative).toBe('Welcome to Acme Corp!');
    });

    it('returns fallback string when generateText returns null (not null narrative)', async () => {
      mockDb.query.mockResolvedValueOnce(ctxData);
      const mockCreate = jest.fn().mockRejectedValueOnce(new Error('API error'));
      (service as unknown as Record<string, unknown>)['anthropic'] = { messages: { create: mockCreate } };
      const result = await service.generateFirstDayNarrative('org-uuid', 'user-uuid');
      expect(result).toHaveProperty('narrative');
      expect(result.narrative).not.toBeNull();
      expect(typeof result.narrative).toBe('string');
    });

    it('prompt includes org context section (EMPRESA label)', async () => {
      mockDb.query.mockResolvedValueOnce(ctxData);
      const mockCreate = jest.fn().mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Welcome to Acme Corp!' }],
      });
      (service as unknown as Record<string, unknown>)['anthropic'] = { messages: { create: mockCreate } };
      await service.generateFirstDayNarrative('org-uuid', 'user-uuid');
      expect(mockCreate).toHaveBeenCalled();
      const callArgs = mockCreate.mock.calls[0][0];
      const content = callArgs.messages[0].content as string;
      expect(content).toContain('EMPRESA:');
      expect(content).toContain('VISIÓN:');
    });
  });
});
