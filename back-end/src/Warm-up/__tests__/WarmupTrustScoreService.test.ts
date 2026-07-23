import { PrismaClient, WarmupStatus, WarmupPhase } from '@prisma/client';
import { WarmupTrustScoreService } from '../services/WarmupTrustScoreService';

jest.mock('@prisma/client', () => {
  const mPrisma = {
    warmupStatusHistory: {
      findMany: jest.fn()
    }
  };
  return {
    PrismaClient: jest.fn(() => mPrisma),
    WarmupStatus: {
      IDLE: 'IDLE',
      WARMING: 'WARMING',
      COMPLETED: 'COMPLETED',
      PAUSED: 'PAUSED',
      COOLING_DOWN: 'COOLING_DOWN'
    },
    WarmupPhase: {
      PHASE_1: 'PHASE_1',
      PHASE_2: 'PHASE_2',
      PHASE_3: 'PHASE_3'
    }
  };
});

jest.mock('../utils/warmupLogger', () => ({
  warmupLogger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

const prisma = new PrismaClient() as any;

describe('WarmupTrustScoreService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return exactly 50 for a perfect PHASE_1 account', async () => {
    prisma.warmupStatusHistory.findMany.mockResolvedValue([]);

    const result = await WarmupTrustScoreService.calculateScore(1, 'PHASE_1', 0, 0);

    expect(result.score).toBe(50);
    expect(result.riskLevel).toBe('HIGH'); // 50 is HIGH risk (<= 60)
  });

  it('should return 90 for a perfect PHASE_3 account', async () => {
    prisma.warmupStatusHistory.findMany.mockResolvedValue([]);

    const result = await WarmupTrustScoreService.calculateScore(1, 'PHASE_3', 0, 0);

    expect(result.score).toBe(90);
    expect(result.riskLevel).toBe('LOW'); // 90 is LOW risk (86-100)
  });

  it('should penalize account by 15 points per PAUSED/COOLING_DOWN event', async () => {
    prisma.warmupStatusHistory.findMany.mockResolvedValue([
      { newStatus: 'PAUSED' },
      { newStatus: 'COOLING_DOWN' }
    ]); // Penalty: 30

    // PHASE_2 base score: 50 + 20 = 70. 70 - 30 = 40.
    const result = await WarmupTrustScoreService.calculateScore(1, 'PHASE_2', 0, 0);

    expect(result.score).toBe(40);
    expect(result.riskLevel).toBe('HIGH');
  });

  it('should subtract points for high asymmetry', async () => {
    prisma.warmupStatusHistory.findMany.mockResolvedValue([]);

    // PHASE_2 base score: 50 + 20 = 70.
    // Sent: 10, Received: 2. Diff: 8.
    // Asymmetry penalty: (8 - 5) * 2 = 6.
    // Score: 70 - 6 = 64.
    const result = await WarmupTrustScoreService.calculateScore(1, 'PHASE_2', 10, 2);

    expect(result.score).toBe(64);
    expect(result.riskLevel).toBe('MEDIUM');
  });

  it('should cap the score at 0 for extremely problematic accounts', async () => {
    prisma.warmupStatusHistory.findMany.mockResolvedValue([
      { newStatus: 'PAUSED' },
      { newStatus: 'PAUSED' },
      { newStatus: 'PAUSED' },
      { newStatus: 'PAUSED' }
    ]); // Penalty: 60

    // PHASE_1 base score: 50
    // Sent: 30, Received: 0. Diff: 30. Penalty: (30 - 5) * 2 = 50.
    // Total: 50 - 60 - 50 = -60 => Capped to 0.
    const result = await WarmupTrustScoreService.calculateScore(1, 'PHASE_1', 30, 0);

    expect(result.score).toBe(0);
    expect(result.riskLevel).toBe('CRITICAL');
  });
});
