import { PrismaClient } from '@prisma/client';
import { Boom } from '@hapi/boom';
import { warmupLogger } from '../utils/warmupLogger';

const prisma = new PrismaClient();

export interface AddSeedContactDto {
  instanceId: string;
  phoneNumber: string;
  name?: string;
}

export class WarmupSeedContactService {
  /**
   * Adds a new seed contact to the warmup profile.
   */
  static async addSeedContact(data: AddSeedContactDto) {
    const instanceId = parseInt(data.instanceId, 10);
    
    // Normalize phone number (remove +, spaces, dashes, etc.)
    const normalizedPhone = data.phoneNumber.replace(/\D/g, '');

    if (!normalizedPhone) {
      throw new Boom('Invalid phone number', { statusCode: 400 });
    }

    const profile = await prisma.warmupProfile.findUnique({
      where: { instanceId }
    });

    if (!profile) {
      throw new Boom('Warmup profile not found', { statusCode: 404 });
    }

    try {
      const contact = await prisma.warmupSeedContact.create({
        data: {
          profileId: profile.id,
          phoneNumber: normalizedPhone,
          name: data.name
        }
      });
      warmupLogger.info(`[WarmupSeedContact] Added seed contact ${normalizedPhone} to instance ${instanceId}`);
      return contact;
    } catch (err: any) {
      if (err.code === 'P2002') {
        throw new Boom('This seed contact is already registered for this profile', { statusCode: 409 });
      }
      throw err;
    }
  }

  /**
   * Lists all seed contacts for a given profile.
   */
  static async listSeedContacts(instanceIdStr: string) {
    const instanceId = parseInt(instanceIdStr, 10);
    
    const profile = await prisma.warmupProfile.findUnique({
      where: { instanceId }
    });

    if (!profile) {
      throw new Boom('Warmup profile not found', { statusCode: 404 });
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
  static async removeSeedContact(contactIdStr: string) {
    const contactId = parseInt(contactIdStr, 10);
    
    try {
      await prisma.warmupSeedContact.delete({
        where: { id: contactId }
      });
      warmupLogger.info(`[WarmupSeedContact] Removed seed contact ${contactId}`);
      return { success: true };
    } catch (err: any) {
      if (err.code === 'P2025') {
        throw new Boom('Seed contact not found', { statusCode: 404 });
      }
      throw err;
    }
  }
}
