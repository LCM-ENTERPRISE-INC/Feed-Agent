import { PrismaClient, WarmupStatus, WarmupPhase } from '@prisma/client';
import { Boom } from '@hapi/boom';
import { warmupLogger } from '../utils/warmupLogger';
import { CreateWarmupProfileDto, UpdateWarmupProfileDto } from '../dtos/warmup.dto';
import { WarmupCacheService } from './WarmupCacheService';

const prisma = new PrismaClient();

export class WarmupProfileService {
  /**
   * Starts a warmup process for a specific WhatsApp Instance.
   */
  static async startWarmup(data: CreateWarmupProfileDto) {
    const instanceId = parseInt(data.instanceId, 10);
    
    // Verifies if the WhatsAppInstance exists
    const instance = await prisma.whatsAppInstance.findUnique({
      where: { id: instanceId }
    });

    if (!instance) {
      throw new Boom('WhatsApp Instance not found', { statusCode: 404 });
    }

    const existingProfile = await prisma.warmupProfile.findUnique({
      where: { instanceId }
    });

    if (existingProfile) {
      throw new Boom('Warmup profile already exists for this instance', { statusCode: 400 });
    }

    const initialPhase = data.initialPhase || WarmupPhase.PHASE_1;

    // Execute in a transaction to ensure both Profile and History are created
    const profile = await prisma.$transaction(async (tx) => {
      const newProfile = await tx.warmupProfile.create({
        data: {
          instanceId,
          name: data.name,
          currentPhase: initialPhase,
          status: WarmupStatus.IDLE, // Starts as IDLE, cron/queue will change to WARMING
          dailyLimit: 10, // Safe default for Phase 1
        }
      });

      await tx.warmupStatusHistory.create({
        data: {
          profileId: newProfile.id,
          previousStatus: WarmupStatus.IDLE,
          newStatus: WarmupStatus.IDLE,
          reason: 'Warmup initialized'
        }
      });

      return newProfile;
    });

    // Initialize the ephemeral state in Redis
    await WarmupCacheService.setState(data.instanceId, {
      isPaused: false,
      messagesSentInCurrentBatch: 0,
      messagesReceivedInCurrentBatch: 0,
      consecutiveFailures: 0,
      lastActionTimestamp: Date.now()
    });

    warmupLogger.info(`Warmup started for instance ${instanceId}`, { instanceId });
    return profile;
  }

  /**
   * Retrieves a warmup profile by instance ID.
   */
  static async getProfile(instanceIdStr: string) {
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
      throw new Boom('Warmup profile not found', { statusCode: 404 });
    }

    const ephemeralState = await WarmupCacheService.getState(instanceIdStr);

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
      where: { status: WarmupStatus.WARMING }
    });
  }

  /**
   * Updates the status of a warmup profile (e.g. Pause, Ban, Cool down)
   */
  static async updateStatus(instanceIdStr: string, newStatus: WarmupStatus, reason?: string) {
    const instanceId = parseInt(instanceIdStr, 10);
    
    const profile = await prisma.warmupProfile.findUnique({
      where: { instanceId }
    });

    if (!profile) {
      throw new Boom('Warmup profile not found', { statusCode: 404 });
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
    if (([WarmupStatus.PAUSED, WarmupStatus.BANNED, WarmupStatus.COMPLETED] as WarmupStatus[]).includes(newStatus)) {
      let state = await WarmupCacheService.getState(instanceIdStr);
      if (!state) {
        state = { isPaused: true, messagesSentInCurrentBatch: 0, messagesReceivedInCurrentBatch: 0, consecutiveFailures: 0, lastActionTimestamp: Date.now() };
      } else {
        state.isPaused = true;
      }
      await WarmupCacheService.setState(instanceIdStr, state);
    }

    warmupLogger.info(`Status changed from ${profile.status} to ${newStatus}`, { instanceId, reason });
    return updatedProfile;
  }

  /**
   * Hard stop a warmup process, cleaning up DB and Redis.
   */
  static async stopWarmup(instanceIdStr: string) {
    const instanceId = parseInt(instanceIdStr, 10);
    
    const profile = await prisma.warmupProfile.findUnique({
      where: { instanceId }
    });

    if (!profile) {
      throw new Boom('Warmup profile not found', { statusCode: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.warmupProfile.update({
        where: { instanceId },
        data: { status: WarmupStatus.COMPLETED }
      });

      await tx.warmupStatusHistory.create({
        data: {
          profileId: profile.id,
          previousStatus: profile.status,
          newStatus: WarmupStatus.COMPLETED,
          reason: 'Warmup hard stopped via API'
        }
      });
    });

    await WarmupCacheService.deleteState(instanceIdStr);
    warmupLogger.info(`Warmup hard stopped and cleaned from cache for instance ${instanceId}`, { instanceId });
    
    return { success: true, message: 'Warmup completed and stopped' };
  }
}
