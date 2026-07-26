"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WarmupSeedContactService = void 0;
const client_1 = require("@prisma/client");
const boom_1 = require("@hapi/boom");
const warmupLogger_1 = require("../utils/warmupLogger");
const prisma = new client_1.PrismaClient();
class WarmupSeedContactService {
    /**
     * Adds a new seed contact to the warmup profile.
     */
    static async addSeedContact(data) {
        const instanceId = parseInt(data.instanceId, 10);
        // Normalize phone number (remove +, spaces, dashes, etc.)
        const normalizedPhone = data.phoneNumber.replace(/\D/g, '');
        if (!normalizedPhone) {
            throw new boom_1.Boom('Invalid phone number', { statusCode: 400 });
        }
        const profile = await prisma.warmupProfile.findUnique({
            where: { instanceId }
        });
        if (!profile) {
            throw new boom_1.Boom('Warmup profile not found', { statusCode: 404 });
        }
        try {
            const contact = await prisma.warmupSeedContact.create({
                data: {
                    profileId: profile.id,
                    phoneNumber: normalizedPhone,
                    name: data.name
                }
            });
            warmupLogger_1.warmupLogger.info(`[WarmupSeedContact] Added seed contact ${normalizedPhone} to instance ${instanceId}`);
            return contact;
        }
        catch (err) {
            if (err.code === 'P2002') {
                throw new boom_1.Boom('This seed contact is already registered for this profile', { statusCode: 409 });
            }
            throw err;
        }
    }
    /**
     * Lists all seed contacts for a given profile.
     */
    static async listSeedContacts(instanceIdStr) {
        const instanceId = parseInt(instanceIdStr, 10);
        const profile = await prisma.warmupProfile.findUnique({
            where: { instanceId }
        });
        if (!profile) {
            throw new boom_1.Boom('Warmup profile not found', { statusCode: 404 });
        }
        const contacts = await prisma.warmupSeedContact.findMany({
            where: { profileId: profile.id },
            orderBy: { createdAt: 'desc' }
        });
        return contacts;
    }
    /**
     * Removes a seed contact by its ID.
     */
    static async removeSeedContact(contactIdStr) {
        const contactId = parseInt(contactIdStr, 10);
        try {
            await prisma.warmupSeedContact.delete({
                where: { id: contactId }
            });
            warmupLogger_1.warmupLogger.info(`[WarmupSeedContact] Removed seed contact ${contactId}`);
            return { success: true };
        }
        catch (err) {
            if (err.code === 'P2025') {
                throw new boom_1.Boom('Seed contact not found', { statusCode: 404 });
            }
            throw err;
        }
    }
}
exports.WarmupSeedContactService = WarmupSeedContactService;
