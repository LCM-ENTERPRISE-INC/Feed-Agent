import { WarmupBroadcastIntegrationService } from '../services/WarmupBroadcastIntegrationService';
import whatsAppInstanceManager from '../../services/WhatsAppInstanceManager';
import prisma from '../../models/prismaClient';
import { WarmupStatus } from '@prisma/client';

jest.mock('../../services/WhatsAppInstanceManager', () => ({
  __esModule: true,
  default: {
    getInstancesForUser: jest.fn()
  }
}));

jest.mock('../../models/prismaClient', () => ({
  __esModule: true,
  default: {
    whatsAppInstance: {
      findMany: jest.fn()
    }
  }
}));

describe('WarmupBroadcastIntegrationService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return empty array if no instances are connected', async () => {
    (whatsAppInstanceManager.getInstancesForUser as jest.Mock).mockReturnValue([]);
    const eligible = await WarmupBroadcastIntegrationService.getEligibleInstancesForBroadcast(1);
    expect(eligible).toEqual([]);
  });

  it('should filter out instances that are warming up', async () => {
    // Mock memory instances
    const mockInstances = [
      { getInstanceId: () => 1, getStatus: () => ({ state: 'open' }) }, // Virgin
      { getInstanceId: () => 2, getStatus: () => ({ state: 'open' }) }, // Completed
      { getInstanceId: () => 3, getStatus: () => ({ state: 'open' }) }, // Warming
      { getInstanceId: () => 4, getStatus: () => ({ state: 'close' }) } // Closed (should be ignored by memory filter)
    ];

    (whatsAppInstanceManager.getInstancesForUser as jest.Mock).mockReturnValue(mockInstances);

    // Mock DB response
    (prisma.whatsAppInstance.findMany as jest.Mock).mockResolvedValue([
      { id: 1, warmupProfile: null }, // Virgin
      { id: 2, warmupProfile: { status: WarmupStatus.COMPLETED } },
      { id: 3, warmupProfile: { status: WarmupStatus.WARMING } }
    ]);

    const eligible = await WarmupBroadcastIntegrationService.getEligibleInstancesForBroadcast(1);

    expect(eligible.length).toBe(2);
    expect(eligible[0].getInstanceId()).toBe(1);
    expect(eligible[1].getInstanceId()).toBe(2);
  });
});
