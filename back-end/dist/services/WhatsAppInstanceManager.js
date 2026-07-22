"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppInstanceManager = void 0;
const WhatsAppService_1 = require("./WhatsAppService");
const prismaClient_1 = __importDefault(require("../models/prismaClient"));
const logger_1 = __importDefault(require("../utils/logger"));
const FeedHistoryService_1 = __importDefault(require("./FeedHistoryService"));
class WhatsAppInstanceManager {
    // Map of instanceId -> WhatsAppService
    instances = new Map();
    /**
     * Loads all active WhatsApp instances from the database and initializes their sockets.
     * This is typically called once on server startup.
     */
    async loadAllInstances() {
        try {
            const dbInstances = await prismaClient_1.default.whatsAppInstance.findMany();
            logger_1.default.info(`[whatsapp-manager]: Found ${dbInstances.length} instances in database.`);
            for (const inst of dbInstances) {
                this.addInstance(inst.id, inst.userId);
            }
        }
        catch (err) {
            logger_1.default.error(`[whatsapp-manager]: Failed to load instances: ${err}`);
        }
    }
    /**
     * Adds and initializes a new WhatsAppService instance for a given DB instance ID.
     */
    addInstance(instanceId, userId) {
        if (this.instances.has(instanceId)) {
            return this.instances.get(instanceId);
        }
        const service = new WhatsAppService_1.WhatsAppService(instanceId, userId);
        // Automatically initialize it to load sessions or wait for QR
        service.initialize().catch(err => {
            logger_1.default.error(`[whatsapp-manager]: Failed to initialize instance ${instanceId}: ${err}`);
        });
        // Listen for state changes to update the database
        service.on('wa:open', async () => {
            try {
                await prismaClient_1.default.whatsAppInstance.update({
                    where: { id: instanceId },
                    data: { status: 'OPEN' }
                });
            }
            catch (e) {
                logger_1.default.error(`[whatsapp-manager]: Failed to update instance ${instanceId} status to OPEN: ${e}`);
            }
        });
        service.on('wa:close', async () => {
            try {
                await prismaClient_1.default.whatsAppInstance.update({
                    where: { id: instanceId },
                    data: { status: 'DISCONNECTED' }
                });
            }
            catch (e) {
                logger_1.default.error(`[whatsapp-manager]: Failed to update instance ${instanceId} status to DISCONNECTED: ${e}`);
            }
        });
        service.on('message:status', async ({ messageId, status }) => {
            await FeedHistoryService_1.default.updateStatusByMessageId(messageId, status);
            logger_1.default.info(`[whatsapp-webhook]: Message ${messageId} status updated to ${status} by instance ${instanceId}`);
        });
        this.instances.set(instanceId, service);
        return service;
    }
    /**
     * Retrieves an active WhatsAppService instance.
     */
    getInstance(instanceId) {
        return this.instances.get(instanceId);
    }
    /**
     * Removes an instance from memory and calls logout on it to clear its session.
     * Does NOT delete the DB record.
     */
    async removeInstance(instanceId) {
        const service = this.instances.get(instanceId);
        if (service) {
            await service.logout();
            this.instances.delete(instanceId);
        }
    }
    /**
     * Retrieves all active instances for a given user.
     */
    getInstancesForUser(userId) {
        const userInstances = [];
        for (const service of this.instances.values()) {
            if (service.getUserId() === userId) {
                userInstances.push(service);
            }
        }
        return userInstances;
    }
}
exports.WhatsAppInstanceManager = WhatsAppInstanceManager;
exports.default = new WhatsAppInstanceManager();
