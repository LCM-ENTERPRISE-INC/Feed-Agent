"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WarmupProfileService = void 0;
const client_1 = require("@prisma/client");
const boom_1 = require("@hapi/boom");
const warmupLogger_1 = require("../utils/warmupLogger");
const WarmupCacheService_1 = require("./WarmupCacheService");
const prisma = new client_1.PrismaClient();
class WarmupProfileService {
    /**
     * Starts a warmup process for a specific WhatsApp Instance.
     */
    static async startWarmup(data) {
        const instanceId = parseInt(data.instanceId, 10);
        // Verifies if the WhatsAppInstance exists
        const instance = await prisma.whatsAppInstance.findUnique({
            where: { id: instanceId }
        });
        if (!instance) {
            throw new boom_1.Boom('WhatsApp Instance not found', { statusCode: 404 });
        }
        const existingProfile = await prisma.warmupProfile.findUnique({
            where: { instanceId }
        });
        if (existingProfile) {
            throw new boom_1.Boom('Warmup profile already exists for this instance', { statusCode: 400 });
        }
        const initialPhase = data.initialPhase || client_1.WarmupPhase.PHASE_1;
        // Execute in a transaction to ensure both Profile and History are created
        const profile = await prisma.$transaction(async (tx) => {
            const newProfile = await tx.warmupProfile.create({
                data: {
                    instanceId,
                    name: data.name,
                    currentPhase: initialPhase,
                    status: client_1.WarmupStatus.IDLE, // Starts as IDLE, cron/queue will change to WARMING
                    dailyLimit: 10, // Safe default for Phase 1
                }
            });
            await tx.warmupStatusHistory.create({
                data: {
                    profileId: newProfile.id,
                    previousStatus: client_1.WarmupStatus.IDLE,
                    newStatus: client_1.WarmupStatus.IDLE,
                    reason: 'Warmup initialized'
                }
            });
            return newProfile;
        });
        // Initialize the ephemeral state in Redis
        await WarmupCacheService_1.WarmupCacheService.setState(data.instanceId, {
            isPaused: false,
            messagesSentInCurrentBatch: 0,
            messagesReceivedInCurrentBatch: 0,
            consecutiveFailures: 0,
            lastActionTimestamp: Date.now()
        });
        warmupLogger_1.warmupLogger.info(`Warmup started for instance ${instanceId}`, { instanceId });
        return profile;
    }
    /**
     * Retrieves a warmup profile by instance ID.
     */
    static async getProfile(instanceIdStr) {
        const instanceId = parseInt(instanceIdStr, 10);
        const profile = await prisma.warmupProfile.findUnique({
            where: { instanceId },
            include: {
                statusHistory: {
                    orderBy: { createdAt: 'desc' },
                    take: 10 // Return only the 10 most recent logs
                }
            }
        });
        if (!profile) {
            throw new boom_1.Boom('Warmup profile not found', { statusCode: 404 });
        }
        const ephemeralState = await WarmupCacheService_1.WarmupCacheService.getState(instanceIdStr);
        return {
            ...profile,
            ephemeralState
        };
    }
    /**
     * Retrieves all active warmup profiles (status === WARMING).
     */
    static async getActiveProfiles() {
        return prisma.warmupProfile.findMany({
            where: { status: client_1.WarmupStatus.WARMING }
        });
    }
    /**
     * Updates the status of a warmup profile (e.g. Pause, Ban, Cool down)
     */
    static async updateStatus(instanceIdStr, newStatus, reason) {
        const instanceId = parseInt(instanceIdStr, 10);
        const profile = await prisma.warmupProfile.findUnique({
            where: { instanceId }
        });
        if (!profile) {
            throw new boom_1.Boom('Warmup profile not found', { statusCode: 404 });
        }
        if (profile.status === newStatus) {
            return profile; // No change needed
        }
        const updatedProfile = await prisma.$transaction(async (tx) => {
            const updated = await tx.warmupProfile.update({
                where: { instanceId },
                data: { status: newStatus }
            });
            await tx.warmupStatusHistory.create({
                data: {
                    profileId: updated.id,
                    previousStatus: profile.status,
                    newStatus: newStatus,
                    reason: reason || 'Status updated via API/Rule Engine'
                }
            });
            return updated;
        });
        // If paused/banned/completed, update Redis state to prevent queues from processing it
        if ([client_1.WarmupStatus.PAUSED, client_1.WarmupStatus.BANNED, client_1.WarmupStatus.COMPLETED].includes(newStatus)) {
            let state = await WarmupCacheService_1.WarmupCacheService.getState(instanceIdStr);
            if (!state) {
                state = { isPaused: true, messagesSentInCurrentBatch: 0, messagesReceivedInCurrentBatch: 0, consecutiveFailures: 0, lastActionTimestamp: Date.now() };
            }
            else {
                state.isPaused = true;
            }
            await WarmupCacheService_1.WarmupCacheService.setState(instanceIdStr, state);
        }
        warmupLogger_1.warmupLogger.info(`Status changed from ${profile.status} to ${newStatus}`, { instanceId, reason });
        return updatedProfile;
    }
    /**
     * Hard stop a warmup process, cleaning up DB and Redis.
     */
    static async stopWarmup(instanceIdStr) {
        const instanceId = parseInt(instanceIdStr, 10);
        const profile = await prisma.warmupProfile.findUnique({
            where: { instanceId }
        });
        if (!profile) {
            throw new boom_1.Boom('Warmup profile not found', { statusCode: 404 });
        }
        await prisma.$transaction(async (tx) => {
            await tx.warmupProfile.update({
                where: { instanceId },
                data: { status: client_1.WarmupStatus.COMPLETED }
            });
            await tx.warmupStatusHistory.create({
                data: {
                    profileId: profile.id,
                    previousStatus: profile.status,
                    newStatus: client_1.WarmupStatus.COMPLETED,
                    reason: 'Warmup hard stopped via API'
                }
            });
        });
        await WarmupCacheService_1.WarmupCacheService.deleteState(instanceIdStr);
        warmupLogger_1.warmupLogger.info(`Warmup hard stopped and cleaned from cache for instance ${instanceId}`, { instanceId });
        return { success: true, message: 'Warmup completed and stopped' };
    }
}
exports.WarmupProfileService = WarmupProfileService;
