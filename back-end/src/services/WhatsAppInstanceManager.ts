import { WhatsAppService } from './WhatsAppService';
import prisma from '../models/prismaClient';
import logger from '../utils/logger';
import feedHistoryService from './FeedHistoryService';
import ChatMessage from '../models/ChatMessage';

export class WhatsAppInstanceManager {
  // Map of instanceId -> WhatsAppService
  private instances = new Map<number, WhatsAppService>();

  /**
   * Loads all active WhatsApp instances from the database and initializes their sockets.
   * This is typically called once on server startup.
   */
  async loadAllInstances() {
    try {
      const dbInstances = await prisma.whatsAppInstance.findMany();
      logger.info(`[whatsapp-manager]: Found ${dbInstances.length} instances in database.`);
      
      for (const inst of dbInstances) {
        this.addInstance(inst.id, inst.userId);
      }
    } catch (err) {
      logger.error(`[whatsapp-manager]: Failed to load instances: ${err}`);
    }
  }

  /**
   * Adds and initializes a new WhatsAppService instance for a given DB instance ID.
   */
  addInstance(instanceId: number, userId: number): WhatsAppService {
    if (this.instances.has(instanceId)) {
      return this.instances.get(instanceId)!;
    }

    const service = new WhatsAppService(instanceId, userId);
    
    // Automatically initialize it to load sessions or wait for QR
    service.initialize().catch(err => {
      logger.error(`[whatsapp-manager]: Failed to initialize instance ${instanceId}: ${err}`);
    });

    // Listen for state changes to update the database
    service.on('wa:open', async () => {
      try {
         await prisma.whatsAppInstance.update({
           where: { id: instanceId },
           data: { status: 'OPEN' }
         });
      } catch (e) {
         logger.error(`[whatsapp-manager]: Failed to update instance ${instanceId} status to OPEN: ${e}`);
      }
    });

    service.on('wa:close', async () => {
      try {
         await prisma.whatsAppInstance.update({
           where: { id: instanceId },
           data: { status: 'DISCONNECTED' }
         });
      } catch (e) {
         logger.error(`[whatsapp-manager]: Failed to update instance ${instanceId} status to DISCONNECTED: ${e}`);
      }
    });

    service.on('message:status', async ({ messageId, status }) => {
      await feedHistoryService.updateStatusByMessageId(messageId, status);
      logger.info(`[whatsapp-webhook]: Message ${messageId} status updated to ${status} by instance ${instanceId}`);
    });

    service.on('wa:message', async (payload) => {
      try {
        await ChatMessage.create({
          instanceId: payload.instanceId,
          fromNumber: payload.fromNumber,
          text: payload.text,
          fromMe: false, // Incoming message
          timestamp: payload.timestamp,
          messageId: payload.messageId,
          mediaUrl: payload.mediaUrl,
          mediaType: payload.mediaType
        });
        logger.info(`[whatsapp-manager]: Saved incoming message ${payload.messageId} to MongoDB.`);
      } catch (err: any) {
        // Ignore duplicate key errors if message already exists
        if (err.code !== 11000) {
          logger.error(`[whatsapp-manager]: Failed to save incoming message to MongoDB: ${err.message}`);
        }
      }
    });

    this.instances.set(instanceId, service);
    return service;
  }

  /**
   * Retrieves an active WhatsAppService instance.
   */
  getInstance(instanceId: number): WhatsAppService | undefined {
    return this.instances.get(instanceId);
  }

  /**
   * Removes an instance from memory and calls logout on it to clear its session.
   * Does NOT delete the DB record.
   */
  async removeInstance(instanceId: number) {
    const service = this.instances.get(instanceId);
    if (service) {
      await service.logout();
      this.instances.delete(instanceId);
    }
  }

  /**
   * Retrieves all active instances for a given user.
   */
  getInstancesForUser(userId: number): WhatsAppService[] {
    const userInstances: WhatsAppService[] = [];
    for (const service of this.instances.values()) {
      if (service.getUserId() === userId) {
        userInstances.push(service);
      }
    }
    return userInstances;
  }
}

export default new WhatsAppInstanceManager();
