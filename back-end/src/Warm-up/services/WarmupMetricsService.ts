import { WarmupProfileService } from './WarmupProfileService';
import { WarmupCacheService } from './WarmupCacheService';
import { WarmupTrustScoreService } from './WarmupTrustScoreService';
import whatsAppInstanceManager from '../../services/WhatsAppInstanceManager';
import { Boom } from '@hapi/boom';

export interface WarmupDashboardMetrics {
  instanceId: number;
  isSocketConnected: boolean;
  status: string;
  currentPhase: string;
  dailyLimit: number;
  messagesSentInCurrentBatch: number;
  isVolatilePaused: boolean;
  lastActionTimestamp: number | null;
  uptimeHours: number;
  trustScore: number;
  riskLevel: string;
}

export class WarmupMetricsService {
  /**
   * Consolidates data from PostgreSQL, Redis, and the Baileys socket
   * to provide a unified dashboard state for a specific instance.
   */
  static async getInstanceMetrics(instanceIdStr: string): Promise<WarmupDashboardMetrics> {
    const instanceId = parseInt(instanceIdStr, 10);
    
    // 1. PostgreSQL (Persistent data)
    let profile;
    try {
      profile = await WarmupProfileService.getProfile(instanceIdStr);
    } catch (err: any) {
      if (err instanceof Boom && err.output.statusCode === 404) {
        throw new Boom(`Cannot fetch metrics. Warmup profile for instance ${instanceId} does not exist.`, { statusCode: 404 });
      }
      throw err;
    }

    // 2. Redis (Volatile data)
    const ephemeralState = await WarmupCacheService.getState(instanceIdStr);

    // 3. Socket (Connection data)
    const whatsappInstance = whatsAppInstanceManager.getInstance(instanceId);
    const isConnected = whatsappInstance && whatsappInstance.getSocket() ? true : false;
    
    // Calculate naive uptime hours based on when the profile was created
    const createdMs = new Date(profile.createdAt).getTime();
    const nowMs = Date.now();
    const uptimeHours = parseFloat(((nowMs - createdMs) / (1000 * 60 * 60)).toFixed(2));

    const sent = ephemeralState?.messagesSentInCurrentBatch || 0;
    const received = ephemeralState?.messagesReceivedInCurrentBatch || 0;

    const trustData = await WarmupTrustScoreService.calculateScore(
      profile.id,
      profile.currentPhase,
      sent,
      received
    );

    return {
      instanceId,
      isSocketConnected: isConnected,
      status: profile.status,
      currentPhase: profile.currentPhase,
      dailyLimit: profile.dailyLimit,
      messagesSentInCurrentBatch: sent,
      isVolatilePaused: ephemeralState?.isPaused || false,
      lastActionTimestamp: ephemeralState?.lastActionTimestamp || null,
      uptimeHours,
      trustScore: trustData.score,
      riskLevel: trustData.riskLevel
    };
  }
}
