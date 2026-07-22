import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const aggregateExecMock = jest.fn<() => Promise<unknown>>();

jest.mock('../../models/FeedHistory', () => ({
  FeedHistory: {
    aggregate: jest.fn((..._args: unknown[]) => ({
      exec: () => aggregateExecMock(),
    })),
    find: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findOneAndUpdate: jest.fn(),
    countDocuments: jest.fn(),
  },
}));

import { FeedHistory } from '../../models/FeedHistory';
import feedHistoryService from '../FeedHistoryService';

describe('FeedHistoryService.getTopRecipients', () => {
  beforeEach(() => {
    aggregateExecMock.mockReset();
    (FeedHistory.aggregate as jest.Mock).mockClear();
  });

  it('aggregates only successful statuses for the given userId', async () => {
    aggregateExecMock.mockResolvedValue([
      { _id: '5511999000001', sendCount: 3, lastDeliveryAt: new Date('2026-07-01') },
    ]);

    const rows = await feedHistoryService.getTopRecipients(42, 5);
    expect(rows).toHaveLength(1);
    expect(rows[0].phoneNumber).toBe('5511999000001');
    expect(rows[0].sendCount).toBe(3);

    const pipeline = (FeedHistory.aggregate as jest.Mock).mock.calls[0][0] as Array<Record<string, unknown>>;
    const match = pipeline[0].$match as { userId: number; status: { $in: string[] } };
    expect(match.userId).toBe(42);
    expect(match.status.$in).toEqual(['sent', 'delivered', 'read']);
  });

  it('returns empty list when user has no sends', async () => {
    aggregateExecMock.mockResolvedValue([]);
    const rows = await feedHistoryService.getTopRecipients(99, 5);
    expect(rows).toEqual([]);
  });

  it('scopes aggregation to the requested userId (isolation)', async () => {
    aggregateExecMock.mockResolvedValue([]);
    await feedHistoryService.getTopRecipients(99, 5);

    aggregateExecMock.mockResolvedValue([
      { _id: '5511888000001', sendCount: 24, lastDeliveryAt: new Date('2026-07-01') },
    ]);
    await feedHistoryService.getTopRecipients(1, 5);

    const lastPipeline = (FeedHistory.aggregate as jest.Mock).mock.calls.at(-1)?.[0] as Array<Record<string, unknown>>;
    const match = lastPipeline[0].$match as { userId: number };
    expect(match.userId).toBe(1);
  });
});
