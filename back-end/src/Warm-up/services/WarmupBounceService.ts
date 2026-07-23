import { WASocket } from '@whiskeysockets/baileys';
import { PrismaClient } from '@prisma/client';
import { warmupLogger } from '../utils/warmupLogger';

const prisma = new PrismaClient();

export class HardBounceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HardBounceError';
  }
}

export class WarmupBounceService {
  /**
   * Checks if a JID exists on WhatsApp. If it doesn't, removes it from the database
   * to avoid future attempts and throws HardBounceError.
   */
  static async validateOrRemoveContact(socket: WASocket, jid: string): Promise<void> {
    try {
      const response = await socket.onWhatsApp(jid);
      const result = response ? response[0] : null;
      
      if (!result || !result.exists) {
        warmupLogger.warn(`[WarmupBounceService] Hard Bounce detected for ${jid}. Removing from database...`);
        
        const phone = jid.split('@')[0];

        // 1. Tentar deletar de WarmupSeedContact
        await prisma.warmupSeedContact.deleteMany({
          where: { phoneNumber: phone }
        });

        // 2. Desativar da tabela Contact principal (se existir e pertencer a esse ecossistema)
        // Isso evita erros caso o número esteja em listas de transmissão.
        // Assuming a model Contact exists with a boolean 'active'
        try {
          // If the Contact model exists, we deactivate it. Since prisma is strongly typed, we must check if Contact exists.
          if ((prisma as any).contact) {
            await (prisma as any).contact.updateMany({
              where: { number: phone },
              data: { active: false }
            });
          }
        } catch (e) {
           // Ignore if Contact table doesn't exist or doesn't have active
           warmupLogger.debug(`[WarmupBounceService] Could not deactivate from global Contact table: ${e}`);
        }

        throw new HardBounceError(`Contact ${jid} is not registered on WhatsApp.`);
      }
      
      warmupLogger.info(`[WarmupBounceService] Contact ${jid} is valid.`);
    } catch (err: any) {
      if (err instanceof HardBounceError) {
        throw err;
      }
      warmupLogger.error(`[WarmupBounceService] Error validating contact ${jid}:`, err);
      // We do NOT throw HardBounceError on generic network failures (like 429), we just let it pass
      // so it can be handled by standard backoff/retry.
    }
  }
}
