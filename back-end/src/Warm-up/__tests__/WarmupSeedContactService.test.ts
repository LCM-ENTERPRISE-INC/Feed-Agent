import { WarmupSeedContactService } from '../services/WarmupSeedContactService';
import { PrismaClient } from '@prisma/client';

jest.mock('@prisma/client', () => {
  const mPrismaClient = {
    warmupProfile: {
      findUnique: jest.fn(),
    },
    warmupSeedContact: {
      create: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
    }
  };
  return { PrismaClient: jest.fn(() => mPrismaClient) };
});

const prisma = new PrismaClient();

describe('WarmupSeedContactService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('addSeedContact', () => {
    it('should normalize the phone number and save', async () => {
      (prisma.warmupProfile.findUnique as jest.Mock).mockResolvedValue({ id: 10 });
      (prisma.warmupSeedContact.create as jest.Mock).mockResolvedValue({
        id: 1,
        profileId: 10,
        phoneNumber: '5511999999999'
      });

      const result = await WarmupSeedContactService.addSeedContact({
        instanceId: '1',
        phoneNumber: '+55 (11) 99999-9999',
        name: 'John Doe'
      });

      expect(result.phoneNumber).toBe('5511999999999');
      expect(prisma.warmupSeedContact.create).toHaveBeenCalledWith({
        data: {
          profileId: 10,
          phoneNumber: '5511999999999',
          name: 'John Doe'
        }
      });
    });

    it('should throw an error if profile does not exist', async () => {
      (prisma.warmupProfile.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        WarmupSeedContactService.addSeedContact({ instanceId: '99', phoneNumber: '123' })
      ).rejects.toThrow('Warmup profile not found');
    });

    it('should throw a 409 error if unique constraint fails', async () => {
      (prisma.warmupProfile.findUnique as jest.Mock).mockResolvedValue({ id: 10 });
      
      const p2002Error = new Error('Unique constraint');
      (p2002Error as any).code = 'P2002';
      
      (prisma.warmupSeedContact.create as jest.Mock).mockRejectedValue(p2002Error);

      await expect(
        WarmupSeedContactService.addSeedContact({ instanceId: '1', phoneNumber: '123' })
      ).rejects.toThrow('This seed contact is already registered for this profile');
    });
  });

  describe('listSeedContacts', () => {
    it('should list contacts for a valid profile', async () => {
      (prisma.warmupProfile.findUnique as jest.Mock).mockResolvedValue({ id: 10 });
      (prisma.warmupSeedContact.findMany as jest.Mock).mockResolvedValue([
        { phoneNumber: '123' }, { phoneNumber: '456' }
      ]);

      const result = await WarmupSeedContactService.listSeedContacts('1');
      expect(result.length).toBe(2);
      expect(prisma.warmupSeedContact.findMany).toHaveBeenCalledWith({
        where: { profileId: 10 },
        orderBy: { createdAt: 'desc' }
      });
    });
  });

  describe('removeSeedContact', () => {
    it('should delete contact successfully', async () => {
      (prisma.warmupSeedContact.delete as jest.Mock).mockResolvedValue({});

      const result = await WarmupSeedContactService.removeSeedContact('1');
      expect(result.success).toBe(true);
      expect(prisma.warmupSeedContact.delete).toHaveBeenCalledWith({
        where: { id: 1 }
      });
    });

    it('should throw 404 if contact does not exist', async () => {
      const p2025Error = new Error('Not found');
      (p2025Error as any).code = 'P2025';
      
      (prisma.warmupSeedContact.delete as jest.Mock).mockRejectedValue(p2025Error);

      await expect(
        WarmupSeedContactService.removeSeedContact('99')
      ).rejects.toThrow('Seed contact not found');
    });
  });
});
