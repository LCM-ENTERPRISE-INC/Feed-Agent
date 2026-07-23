import { PrismaClient, WarmupStatus, WarmupPhase } from '@prisma/client';
import { warmupLogger } from '../utils/warmupLogger';

const prisma = new PrismaClient();

export interface TrustScoreResult {
  score: number;
  riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

export class WarmupTrustScoreService {
  /**
   * Calculates the Trust Score (0-100) based on age/phase, blockage history, and asymmetry.
   */
  static async calculateScore(
    profileId: number,
    phase: string,
    messagesSentInCurrentBatch: number,
    messagesReceivedInCurrentBatch: number
  ): Promise<TrustScoreResult> {
    try {
      let score = 50; // Base Score

      // 1. Age/Phase Bonus
      if (phase === WarmupPhase.PHASE_2) {
        score += 20;
      } else if (phase === WarmupPhase.PHASE_3) {
        score += 40;
      } else if (phase === 'COMPLETED') { // Assuming some profiles might have this as status, but phase is enum
        score += 50;
      }

      // 2. Blockage History Penalty
      const history = await prisma.warmupStatusHistory.findMany({
        where: { profileId }
      });

      let penaltyEvents = 0;
      for (const event of history) {
        if (event.newStatus === WarmupStatus.PAUSED || event.newStatus === WarmupStatus.COOLING_DOWN) {
          penaltyEvents++;
          score -= 15;
        }
      }

      // 3. Asymmetry Penalty (Sent vs Received)
      // If we sent way more than we received, it's a spammy behavior.
      const diff = messagesSentInCurrentBatch - messagesReceivedInCurrentBatch;
      if (diff > 5) {
        // e.g. Sent 10, Received 2 => diff 8 => penalty 8 * 2 = 16
        const asymmetryPenalty = (diff - 5) * 2;
        score -= asymmetryPenalty;
      }

      // Clamp score between 0 and 100
      score = Math.max(0, Math.min(100, score));

      // Determine Risk Level
      let riskLevel: TrustScoreResult['riskLevel'] = 'LOW';
      if (score <= 30) {
        riskLevel = 'CRITICAL';
      } else if (score <= 60) {
        riskLevel = 'HIGH';
      } else if (score <= 85) {
        riskLevel = 'MEDIUM';
      }

      return { score, riskLevel };
    } catch (error) {
      warmupLogger.error(`[WarmupTrustScore] Error calculating score for profile ${profileId}`, error);
      // Fallback safe score
      return { score: 50, riskLevel: 'HIGH' };
    }
  }
}
