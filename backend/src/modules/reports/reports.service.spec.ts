import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { DbService } from '../../database/db.service';
import { RedisService } from '../../common/redis/redis.service';
import { PdfService } from './pdf.service';

const mockDb = {
  query: jest.fn(),
  queryOne: jest.fn(),
  execute: jest.fn(),
};

const mockRedis = {
  getOrSet: jest.fn(),
  delPattern: jest.fn(),
};

const mockPdf = {
  buildExecutiveReportHtml: jest.fn().mockReturnValue('<html>report</html>'),
  htmlToPdf: jest.fn().mockResolvedValue(Buffer.from('pdf')),
  buildExecutivePptx: jest.fn().mockResolvedValue(Buffer.from('pptx')),
  buildGovernancePdfHtml: jest.fn().mockReturnValue('<html>governance</html>'),
};

describe('ReportsService', () => {
  let service: ReportsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: DbService,    useValue: mockDb },
        { provide: RedisService, useValue: mockRedis },
        { provide: PdfService,   useValue: mockPdf },
      ],
    }).compile();
    service = module.get(ReportsService);
  });

  describe('getExecutiveDashboard', () => {
    it('calls getOrSet with correct cache key', async () => {
      const expected = { org_id: 'o1', cycle_id: 'c1' };
      mockRedis.getOrSet.mockResolvedValueOnce(expected);
      const result = await service.getExecutiveDashboard('o1', 'c1');
      expect(result).toEqual(expected);
      expect(mockRedis.getOrSet).toHaveBeenCalledWith(
        'reports:executive-dashboard:o1:c1',
        300,
        expect.any(Function),
      );
    });

    it('uses active key when cycleId is undefined', async () => {
      mockRedis.getOrSet.mockResolvedValueOnce(null);
      await service.getExecutiveDashboard('o1');
      expect(mockRedis.getOrSet).toHaveBeenCalledWith(
        'reports:executive-dashboard:o1:active',
        300,
        expect.any(Function),
      );
    });
  });

  describe('getCycleHealth', () => {
    it('calls getOrSet with correct cache key', async () => {
      mockRedis.getOrSet.mockResolvedValueOnce({ health: 'good' });
      await service.getCycleHealth('o1', 'c2');
      expect(mockRedis.getOrSet).toHaveBeenCalledWith(
        'reports:cycle-health:o1:c2',
        300,
        expect.any(Function),
      );
    });
  });

  describe('generateCloseReport', () => {
    it('throws NotFoundException when cycle does not belong to org', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);
      await expect(service.generateCloseReport('o1', 'c-unknown', 'u1')).rejects.toThrow(NotFoundException);
    });

    it('invalidates cache after generating report', async () => {
      mockDb.queryOne
        .mockResolvedValueOnce({ id: 'c1' })
        .mockResolvedValueOnce({ fn_generate_cycle_close_report: 'content' });
      mockDb.execute.mockResolvedValueOnce(1);
      mockRedis.delPattern.mockResolvedValueOnce(undefined);
      await service.generateCloseReport('o1', 'c1', 'u1');
      expect(mockRedis.delPattern).toHaveBeenCalledWith('reports:*:o1:*');
    });
  });

  describe('getRiskDashboard', () => {
    it('returns risk data with summary counts', async () => {
      mockDb.queryOne
        .mockResolvedValueOnce({ id: 'c1', name: 'Q1' }) // cycle lookup
        .mockResolvedValueOnce(null);                     // lastSentinel
      const atRiskRows = [
        { objective_level: 'COMPANY', days_since_checkin: 20 },
        { objective_level: 'AREA',    days_since_checkin: 5  },
      ];
      const cadenceRows = [{ days_since_checkin: 16 }, { days_since_checkin: 3 }];
      mockDb.query
        .mockResolvedValueOnce(atRiskRows)
        .mockResolvedValueOnce(cadenceRows);
      const result = await service.getRiskDashboard('o1', 'c1') as Record<string, unknown>;
      expect(result['summary']).toEqual({ total_at_risk: 2, company_level: 1, stale_14d: 1 });
    });

    it('returns empty at_risk and stale_14d=0 when no risks', async () => {
      mockDb.queryOne
        .mockResolvedValueOnce({ id: 'c1', name: 'Q1' })
        .mockResolvedValueOnce(null);
      mockDb.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      const result = await service.getRiskDashboard('o1', 'c1') as Record<string, unknown>;
      const summary = result['summary'] as Record<string, unknown>;
      expect(summary['total_at_risk']).toBe(0);
      expect(summary['stale_14d']).toBe(0);
    });
  });
});
