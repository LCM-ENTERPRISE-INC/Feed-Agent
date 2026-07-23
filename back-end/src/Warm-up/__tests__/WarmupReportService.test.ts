import { WarmupReportService } from '../services/WarmupReportService';
import { WarmupHistoryLog } from '../../models/WarmupHistoryLog';
import { WarmupMetricsService } from '../services/WarmupMetricsService';
import { WarmupProfileService } from '../services/WarmupProfileService';

jest.mock('../../models/WarmupHistoryLog', () => ({
  WarmupHistoryLog: {
    countDocuments: jest.fn()
  }
}));

jest.mock('../services/WarmupMetricsService', () => ({
  WarmupMetricsService: {
    getInstanceMetrics: jest.fn()
  }
}));

jest.mock('../services/WarmupProfileService', () => ({
  WarmupProfileService: {
    getProfile: jest.fn()
  }
}));

describe('WarmupReportService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should generate JSON report correctly', async () => {
    (WarmupProfileService.getProfile as jest.Mock).mockResolvedValue({
      name: 'Test Device',
      currentPhase: 'PHASE_2',
      status: 'WARMING',
      dailyLimit: 20
    });

    (WarmupMetricsService.getInstanceMetrics as jest.Mock).mockResolvedValue({
      trustScore: 85,
      riskLevel: 'LOW'
    });

    const mockCountDocuments = WarmupHistoryLog.countDocuments as jest.Mock;
    
    mockCountDocuments.mockImplementation((query) => {
      if (query.direction === 'SENT' && query.isAiGenerated === true) return Promise.resolve(40);
      if (query.direction === 'SENT') return Promise.resolve(50); // Total sent
      if (query.direction === 'RECEIVED') return Promise.resolve(45); // Total received
      return Promise.resolve(0);
    });

    const report = await WarmupReportService.generateWeeklyReport('1', 7);

    expect(report.instanceId).toBe('1');
    expect(report.profile.name).toBe('Test Device');
    expect(report.metrics.trustScore).toBe(85);
    expect(report.metrics.totalMessagesSent).toBe(50);
    expect(report.metrics.aiGeneratedCount).toBe(40);
    expect(report.metrics.humanFallbackCount).toBe(10);
    expect(report.metrics.bouncesOrFailures).toBe(0);
  });

  it('should generate valid HTML string from report', () => {
    const mockReport = {
      instanceId: '1',
      reportDate: '2023-10-10T00:00:00Z',
      periodDays: 7,
      profile: {
        name: 'Test Device',
        phase: 'PHASE_1',
        status: 'WARMING',
        dailyLimit: 10
      },
      metrics: {
        trustScore: 40,
        riskLevel: 'HIGH',
        totalMessagesSent: 100,
        totalMessagesReceived: 90,
        aiGeneratedCount: 80,
        humanFallbackCount: 20,
        bouncesOrFailures: 5
      }
    };

    const html = WarmupReportService.generateHtmlReport(mockReport);
    expect(html).toContain('Test Device');
    expect(html).toContain('40/100 (HIGH)');
    expect(html).toContain('color: orange'); // Because risk is HIGH
    expect(html).toContain('100');
    expect(html).toContain('90');
  });
});
