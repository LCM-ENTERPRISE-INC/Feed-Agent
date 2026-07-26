"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WarmupBounceService = exports.HardBounceError = void 0;
const client_1 = require("@prisma/client");
const warmupLogger_1 = require("../utils/warmupLogger");
const prisma = new client_1.PrismaClient();
class HardBounceError extends Error {
    constructor(message) {
        super(message);
        this.name = 'HardBounceError';
    }
}
exports.HardBounceError = HardBounceError;
class WarmupBounceService {
    /**
     * Checks if a JID exists on WhatsApp. If it doesn't, removes it from the database
     * to avoid future attempts and throws HardBounceError.
     */
    static async validateOrRemoveContact(client, jid) {
        try {
            const isRegistered = await client.isRegisteredUser(jid);
            if (!isRegistered) {
                warmupLogger_1.warmupLogger.warn(`[WarmupBounceService] Hard Bounce detected for ${jid}. Removing from database...`);
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
                    if (prisma.contact) {
                        await prisma.contact.updateMany({
                            where: { number: phone },
                            data: { active: false }
                        });
                    }
                }
                catch (e) {
                    // Ignore if Contact table doesn't exist or doesn't have active
                    warmupLogger_1.warmupLogger.debug(`[WarmupBounceService] Could not deactivate from global Contact table: ${e}`);
                }
                throw new HardBounceError(`Contact ${jid} is not registered on WhatsApp.`);
            }
            warmupLogger_1.warmupLogger.info(`[WarmupBounceService] Contact ${jid} is valid.`);
        }
        catch (err) {
            if (err instanceof HardBounceError) {
                throw err;
            }
            warmupLogger_1.warmupLogger.error(`[WarmupBounceService] Error validating contact ${jid}:`, err);
            // We do NOT throw HardBounceError on generic network failures (like 429), we just let it pass
            // so it can be handled by standard backoff/retry.
        }
    }
}
exports.WarmupBounceService = WarmupBounceService;
