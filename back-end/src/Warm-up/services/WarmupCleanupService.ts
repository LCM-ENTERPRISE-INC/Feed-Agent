import fs from 'fs';
import path from 'path';
import { warmupLogger } from '../utils/warmupLogger';
import { WarmupHistoryLog } from '../../models/WarmupHistoryLog';
import prisma from '../../models/prismaClient';
import redisClient from '../../utils/redisClient';
import { WarmupProfileService } from './WarmupProfileService';

export class WarmupCleanupService {
  private static readonly RETENTION_DAYS = 30;

  /**
   * Executes all daily cleanup routines to save disk space and RAM.
   */
  static async runDailyCleanup(): Promise<void> {
    warmupLogger.info(`[WarmupCleanupService] Starting daily cache and history cleanup...`);

    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - this.RETENTION_DAYS);

    try {
      await this.cleanMongoHistory(dateThreshold);
      await this.cleanPrismaHistory(dateThreshold);
      await this.cleanRedisOrphans();
      await this.cleanBaileysSessions();
      warmupLogger.info(`[WarmupCleanupService] Daily cleanup completed successfully.`);
    } catch (error) {
      warmupLogger.error(`[WarmupCleanupService] Error during daily cleanup:`, error);
    }
  }

  /**
   * Deletes MongoDB interaction logs older than 30 days.
   */
  private static async cleanMongoHistory(threshold: Date): Promise<void> {
    try {
      const result = await WarmupHistoryLog.deleteMany({
        createdAt: { $lt: threshold }
      });
      warmupLogger.info(`[WarmupCleanupService] Mongo cleanup: Deleted ${result.deletedCount} old interaction logs.`);
    } catch (error) {
      warmupLogger.error(`[WarmupCleanupService] Failed to clean Mongo history:`, error);
    }
  }

  /**
   * Deletes Prisma WarmupStatusHistory records older than 30 days.
   */
  private static async cleanPrismaHistory(threshold: Date): Promise<void> {
    try {
      const result = await prisma.warmupStatusHistory.deleteMany({
        where: {
          createdAt: {
            lt: threshold
          }
        }
      });
      warmupLogger.info(`[WarmupCleanupService] Prisma cleanup: Deleted ${result.count} old status history records.`);
    } catch (error) {
      warmupLogger.error(`[WarmupCleanupService] Failed to clean Prisma history:`, error);
    }
  }

  /**
   * Scans Redis for warmup:state:* and warmup:history:* keys, checks if the profile exists,
   * and deletes keys for profiles that have been removed from the database.
   */
  private static async cleanRedisOrphans(): Promise<void> {
    try {
      // Get all profiles from PostgreSQL
      const profiles = await prisma.warmupProfile.findMany({
        select: { instanceId: true }
      });
      const validInstanceIds = new Set(profiles.map(p => p.instanceId.toString()));

      let cursor = '0';
      let deletedCount = 0;

      do {
        const [nextCursor, keys] = await redisClient.scan(cursor, 'MATCH', 'warmup:*', 'COUNT', 100);
        cursor = nextCursor;

        for (const key of keys) {
          // Key formats: warmup:state:instanceId, warmup:history:instanceId:jid
          const parts = key.split(':');
          
          if (parts.length >= 3 && (parts[1] === 'state' || parts[1] === 'history')) {
            const instanceId = parts[2];
            
            if (!validInstanceIds.has(instanceId)) {
              await redisClient.del(key);
              deletedCount++;
            }
          }
        }
      } while (cursor !== '0');

      warmupLogger.info(`[WarmupCleanupService] Redis cleanup: Deleted ${deletedCount} orphaned keys.`);
    } catch (error) {
      warmupLogger.error(`[WarmupCleanupService] Failed to clean Redis orphans:`, error);
    }
  }

  /**
   * Cleans Baileys session folders by deleting temporary files and old app-state-sync files.
   */
  private static async cleanBaileysSessions(): Promise<void> {
    try {
      const sessionsPath = path.resolve(process.cwd(), 'sessions');
      
      if (!fs.existsSync(sessionsPath)) {
        warmupLogger.debug(`[WarmupCleanupService] Sessions directory not found. Skipping.`);
        return;
      }

      const instanceDirs = fs.readdirSync(sessionsPath);
      let deletedFilesCount = 0;

      for (const instanceDir of instanceDirs) {
        const fullDirPath = path.join(sessionsPath, instanceDir);
        
        if (fs.statSync(fullDirPath).isDirectory()) {
          const files = fs.readdirSync(fullDirPath);
          
          for (const file of files) {
            // Target specific bloated files: app-state-sync-version or temp files
            if (file.startsWith('app-state-sync-version-') || file.endsWith('.tmp')) {
              const filePath = path.join(fullDirPath, file);
              const stats = fs.statSync(filePath);
              
              // Only delete files older than 7 days to avoid messing with current syncing
              const ageDays = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24);
              
              if (ageDays > 7) {
                fs.unlinkSync(filePath);
                deletedFilesCount++;
              }
            }
          }
        }
      }

      warmupLogger.info(`[WarmupCleanupService] Disk cleanup: Deleted ${deletedFilesCount} old Baileys session temp files.`);
    } catch (error) {
      warmupLogger.error(`[WarmupCleanupService] Failed to clean Baileys session files:`, error);
    }
  }
}
