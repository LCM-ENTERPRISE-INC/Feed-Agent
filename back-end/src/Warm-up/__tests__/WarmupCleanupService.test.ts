import { WarmupCleanupService } from '../services/WarmupCleanupService';
import { WarmupHistoryLog } from '../../models/WarmupHistoryLog';
import prisma from '../../models/prismaClient';
import redisClient from '../../utils/redisClient';
import fs from 'fs';

jest.mock('../utils/warmupLogger', () => ({
  warmupLogger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

jest.mock('../../models/WarmupHistoryLog', () => ({
  WarmupHistoryLog: {
    deleteMany: jest.fn().mockResolvedValue({ deletedCount: 5 })
  }
}));

jest.mock('../../models/prismaClient', () => ({
  __esModule: true,
  default: {
    warmupStatusHistory: {
      deleteMany: jest.fn().mockResolvedValue({ count: 10 })
    },
    warmupProfile: {
      findMany: jest.fn().mockResolvedValue([{ instanceId: 1 }])
    }
  }
}));

jest.mock('../../utils/redisClient', () => ({
  __esModule: true,
  default: {
    scan: (() => {
      let callCount = 0;
      return jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount % 2 === 1) return Promise.resolve(['10', ['warmup:state:1', 'warmup:state:2']]);
        return Promise.resolve(['0', ['warmup:history:1:55119999', 'warmup:history:3:55118888']]);
      });
    })(),
    del: jest.fn().mockResolvedValue(1)
  }
}));

describe('WarmupCleanupService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Spying on fs so we don't break other requires
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    
    jest.spyOn(fs, 'readdirSync').mockImplementation((dirPath: any) => {
      if (dirPath.toString().endsWith('sessions')) return ['instance_1', 'instance_2'] as any;
      if (dirPath.toString().includes('instance_1')) return ['app-state-sync-version-old.json', 'app-state-sync-version-new.json'] as any;
      return [] as any;
    });

    jest.spyOn(fs, 'statSync').mockImplementation((pathStr: any) => {
      if (pathStr.includes('old.json')) {
        return { isDirectory: () => false, mtimeMs: Date.now() - (10 * 24 * 60 * 60 * 1000) } as any;
      }
      if (pathStr.includes('new.json')) {
        return { isDirectory: () => false, mtimeMs: Date.now() - (2 * 24 * 60 * 60 * 1000) } as any;
      }
      return { isDirectory: () => true } as any;
    });

    jest.spyOn(fs, 'unlinkSync').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should clean up MongoDB and Prisma', async () => {
    await WarmupCleanupService.runDailyCleanup();

    expect(WarmupHistoryLog.deleteMany).toHaveBeenCalled();
    expect(prisma.warmupStatusHistory.deleteMany).toHaveBeenCalled();
  });

  it('should clean up orphaned Redis keys', async () => {
    await WarmupCleanupService.runDailyCleanup();

    expect(redisClient.del).toHaveBeenCalledWith('warmup:state:2');
    expect(redisClient.del).toHaveBeenCalledWith('warmup:history:3:55118888');
    expect(redisClient.del).not.toHaveBeenCalledWith('warmup:state:1');
    expect(redisClient.del).not.toHaveBeenCalledWith('warmup:history:1:55119999');
  });

  it('should clean up old Baileys session temp files', async () => {
    await WarmupCleanupService.runDailyCleanup();
    
    expect(fs.unlinkSync).toHaveBeenCalledTimes(1);
    expect(fs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('old.json'));
  });
});
