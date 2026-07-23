import { PrismaClient } from '@prisma/client';
import { WarmupBounceService, HardBounceError } from '../services/WarmupBounceService';
import { WASocket } from '@whiskeysockets/baileys';

jest.mock('@prisma/client', () => {
  const mPrisma = {
    warmupSeedContact: {
      deleteMany: jest.fn()
    },
    contact: {
      updateMany: jest.fn()
    }
  };
  return {
    PrismaClient: jest.fn(() => mPrisma)
  };
});

jest.mock('../utils/warmupLogger', () => ({
  warmupLogger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

const prisma = new PrismaClient() as any;

describe('WarmupBounceService', () => {
  let mockSocket: Partial<WASocket>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSocket = {
      onWhatsApp: jest.fn()
    };
  });

  it('should resolve and do nothing if number exists', async () => {
    (mockSocket.onWhatsApp as jest.Mock).mockResolvedValue([{ exists: true }]);

    await expect(WarmupBounceService.validateOrRemoveContact(mockSocket as WASocket, '5511999999999@s.whatsapp.net')).resolves.toBeUndefined();

    expect(prisma.warmupSeedContact.deleteMany).not.toHaveBeenCalled();
  });

  it('should throw HardBounceError and delete from database if number does not exist', async () => {
    (mockSocket.onWhatsApp as jest.Mock).mockResolvedValue([{ exists: false }]);

    await expect(WarmupBounceService.validateOrRemoveContact(mockSocket as WASocket, '5511999999999@s.whatsapp.net')).rejects.toThrow(HardBounceError);

    expect(prisma.warmupSeedContact.deleteMany).toHaveBeenCalledWith({
      where: { phoneNumber: '5511999999999' }
    });

    expect(prisma.contact.updateMany).toHaveBeenCalledWith({
      where: { number: '5511999999999' },
      data: { active: false }
    });
  });

  it('should throw HardBounceError and delete from database even if result array is empty', async () => {
    (mockSocket.onWhatsApp as jest.Mock).mockResolvedValue([]);

    await expect(WarmupBounceService.validateOrRemoveContact(mockSocket as WASocket, '5511999999999@s.whatsapp.net')).rejects.toThrow(HardBounceError);

    expect(prisma.warmupSeedContact.deleteMany).toHaveBeenCalled();
  });

  it('should bubble up HardBounceError if thrown from inner methods', async () => {
    (mockSocket.onWhatsApp as jest.Mock).mockRejectedValue(new HardBounceError('Mocked Error'));

    await expect(WarmupBounceService.validateOrRemoveContact(mockSocket as WASocket, '5511999999999@s.whatsapp.net')).rejects.toThrow(HardBounceError);
  });

  it('should suppress other network errors (like timeouts/429) and not throw HardBounceError', async () => {
    (mockSocket.onWhatsApp as jest.Mock).mockRejectedValue(new Error('Network timeout'));

    // It should not throw because generic errors are caught and suppressed inside the service
    await expect(WarmupBounceService.validateOrRemoveContact(mockSocket as WASocket, '5511999999999@s.whatsapp.net')).resolves.toBeUndefined();

    expect(prisma.warmupSeedContact.deleteMany).not.toHaveBeenCalled();
  });
});
