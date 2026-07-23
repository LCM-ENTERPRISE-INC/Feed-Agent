import prisma from '../../models/prismaClient';
import whatsAppInstanceManager from '../../services/WhatsAppInstanceManager';
import { WhatsAppService } from '../../services/WhatsAppService';
import { WarmupStatus } from '@prisma/client';
import { warmupLogger } from '../utils/warmupLogger';

export class WarmupBroadcastIntegrationService {
  /**
   * Retorna apenas as instâncias conectadas de um usuário que estão elegíveis para
   * realizar disparos de broadcast (não estão em processo de aquecimento pendente).
   */
  static async getEligibleInstancesForBroadcast(userId: number): Promise<WhatsAppService[]> {
    try {
      // 1. Busca todas as instâncias ativas da memória
      const allUserInstances = whatsAppInstanceManager.getInstancesForUser(userId).filter(
        inst => inst.getStatus().state === 'open'
      );

      if (allUserInstances.length === 0) {
        return [];
      }

      // 2. Busca o estado de Warmup dessas instâncias no banco
      const instanceIds = allUserInstances.map(inst => inst.getInstanceId());
      
      const dbInstances = await prisma.whatsAppInstance.findMany({
        where: { id: { in: instanceIds } },
        include: { warmupProfile: true }
      });

      // 3. Filtra: só permite instâncias SEM perfil de warmup (virgens) 
      // ou com perfil COMPLETED
      const eligibleIds = new Set<number>();
      for (const dbInst of dbInstances) {
        if (!dbInst.warmupProfile) {
          eligibleIds.add(dbInst.id);
        } else if (dbInst.warmupProfile.status === WarmupStatus.COMPLETED) {
          eligibleIds.add(dbInst.id);
        } else {
          warmupLogger.info(`[WarmupBroadcastIntegration] Instance ${dbInst.id} is blocked from broadcast because it is in status ${dbInst.warmupProfile.status}`);
        }
      }

      return allUserInstances.filter(inst => eligibleIds.has(inst.getInstanceId()));

    } catch (error) {
      warmupLogger.error(`[WarmupBroadcastIntegration] Failed to get eligible instances for user ${userId}:`, error);
      return [];
    }
  }
}
