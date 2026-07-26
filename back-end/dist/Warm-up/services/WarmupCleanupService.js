"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WarmupCleanupService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const warmupLogger_1 = require("../utils/warmupLogger");
const WarmupHistoryLog_1 = require("../../models/WarmupHistoryLog");
const prismaClient_1 = __importDefault(require("../../models/prismaClient"));
const redisClient_1 = __importDefault(require("../../utils/redisClient"));
class WarmupCleanupService {
    static RETENTION_DAYS = 30;
    /**
     * Executes all daily cleanup routines to save disk space and RAM.
     */
    static async runDailyCleanup() {
        warmupLogger_1.warmupLogger.info(`[WarmupCleanupService] Starting daily cache and history cleanup...`);
        const dateThreshold = new Date();
        dateThreshold.setDate(dateThreshold.getDate() - this.RETENTION_DAYS);
        try {
            await this.cleanMongoHistory(dateThreshold);
            await this.cleanPrismaHistory(dateThreshold);
            await this.cleanRedisOrphans();
            await this.cleanBaileysSessions();
            warmupLogger_1.warmupLogger.info(`[WarmupCleanupService] Daily cleanup completed successfully.`);
        }
        catch (error) {
            warmupLogger_1.warmupLogger.error(`[WarmupCleanupService] Error during daily cleanup:`, error);
        }
    }
    /**
     * Deletes MongoDB interaction logs older than 30 days.
     */
    static async cleanMongoHistory(threshold) {
        try {
            const result = await WarmupHistoryLog_1.WarmupHistoryLog.deleteMany({
                createdAt: { $lt: threshold }
            });
            warmupLogger_1.warmupLogger.info(`[WarmupCleanupService] Mongo cleanup: Deleted ${result.deletedCount} old interaction logs.`);
        }
        catch (error) {
            warmupLogger_1.warmupLogger.error(`[WarmupCleanupService] Failed to clean Mongo history:`, error);
        }
    }
    /**
     * Deletes Prisma WarmupStatusHistory records older than 30 days.
     */
    static async cleanPrismaHistory(threshold) {
        try {
            const result = await prismaClient_1.default.warmupStatusHistory.deleteMany({
                where: {
                    createdAt: {
                        lt: threshold
                    }
                }
            });
            warmupLogger_1.warmupLogger.info(`[WarmupCleanupService] Prisma cleanup: Deleted ${result.count} old status history records.`);
        }
        catch (error) {
            warmupLogger_1.warmupLogger.error(`[WarmupCleanupService] Failed to clean Prisma history:`, error);
        }
    }
    /**
     * Scans Redis for warmup:state:* and warmup:history:* keys, checks if the profile exists,
     * and deletes keys for profiles that have been removed from the database.
     */
    static async cleanRedisOrphans() {
        try {
            // Get all profiles from PostgreSQL
            const profiles = await prismaClient_1.default.warmupProfile.findMany({
                select: { instanceId: true }
            });
            const validInstanceIds = new Set(profiles.map(p => p.instanceId.toString()));
            let cursor = '0';
            let deletedCount = 0;
            do {
                const [nextCursor, keys] = await redisClient_1.default.scan(cursor, 'MATCH', 'warmup:*', 'COUNT', 100);
                cursor = nextCursor;
                for (const key of keys) {
                    // Key formats: warmup:state:instanceId, warmup:history:instanceId:jid
                    const parts = key.split(':');
                    if (parts.length >= 3 && (parts[1] === 'state' || parts[1] === 'history')) {
                        const instanceId = parts[2];
                        if (!validInstanceIds.has(instanceId)) {
                            await redisClient_1.default.del(key);
                            deletedCount++;
                        }
                    }
                }
            } while (cursor !== '0');
            warmupLogger_1.warmupLogger.info(`[WarmupCleanupService] Redis cleanup: Deleted ${deletedCount} orphaned keys.`);
        }
        catch (error) {
            warmupLogger_1.warmupLogger.error(`[WarmupCleanupService] Failed to clean Redis orphans:`, error);
        }
    }
    /**
     * Cleans Baileys session folders by deleting temporary files and old app-state-sync files.
     */
    static async cleanBaileysSessions() {
        try {
            const sessionsPath = path_1.default.resolve(process.cwd(), 'sessions');
            if (!fs_1.default.existsSync(sessionsPath)) {
                warmupLogger_1.warmupLogger.debug(`[WarmupCleanupService] Sessions directory not found. Skipping.`);
                return;
            }
            const instanceDirs = fs_1.default.readdirSync(sessionsPath);
            let deletedFilesCount = 0;
            for (const instanceDir of instanceDirs) {
                const fullDirPath = path_1.default.join(sessionsPath, instanceDir);
                if (fs_1.default.statSync(fullDirPath).isDirectory()) {
                    const files = fs_1.default.readdirSync(fullDirPath);
                    for (const file of files) {
                        // Target specific bloated files: app-state-sync-version or temp files
                        if (file.startsWith('app-state-sync-version-') || file.endsWith('.tmp')) {
                            const filePath = path_1.default.join(fullDirPath, file);
                            const stats = fs_1.default.statSync(filePath);
                            // Only delete files older than 7 days to avoid messing with current syncing
                            const ageDays = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24);
                            if (ageDays > 7) {
                                fs_1.default.unlinkSync(filePath);
                                deletedFilesCount++;
                            }
                        }
                    }
                }
            }
            warmupLogger_1.warmupLogger.info(`[WarmupCleanupService] Disk cleanup: Deleted ${deletedFilesCount} old Baileys session temp files.`);
        }
        catch (error) {
            warmupLogger_1.warmupLogger.error(`[WarmupCleanupService] Failed to clean Baileys session files:`, error);
        }
    }
}
exports.WarmupCleanupService = WarmupCleanupService;
