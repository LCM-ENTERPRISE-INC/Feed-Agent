import { WarmupGroupReaderService } from '../../../src/Warm-up/services/WarmupGroupReaderService';
import { WarmupStatusViewerService } from '../../../src/Warm-up/services/WarmupStatusViewerService';
import { WASocket } from '@whiskeysockets/baileys';
import { WarmupProfile, WarmupStatus } from '@prisma/client';
import prisma from '../../../src/models/prismaClient';

jest.mock('../../../src/models/prismaClient', () => ({
  warmupProfile: {
    findUnique: jest.fn(),
  }
}));

jest.mock('../../../src/Warm-up/services/WarmupBaileysService', () => ({
  WarmupBaileysService: {
    simulateHumanRead: jest.fn().mockResolvedValue(undefined),
  }
}));

jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

describe('Warmup Socket Fixes (Group & Status Reader)', () => {
  let mockSocket: Partial<WASocket>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSocket = {
      readMessages: jest.fn().mockResolvedValue(undefined),
    };
  });

  describe('WarmupGroupReaderService', () => {
    it('deve utilizar _socket.readMessages() e não socket ao ler mensagens de grupo', async () => {
      const msg = { id: 'msg1' };

      await WarmupGroupReaderService.readGroupMessage(mockSocket as WASocket, msg as any);

      // _socket local no método foi corrigido para usar o parâmetro recebido
      expect(mockSocket.readMessages).toHaveBeenCalledWith([{ id: 'msg1' }]);
    });
  });

  describe('WarmupStatusViewerService', () => {
    it('deve utilizar _socket.readMessages() e não socket ao visualizar status', async () => {
      const msg = { id: 'status1' };

      await WarmupStatusViewerService.viewStatus(mockSocket as WASocket, msg as any);

      expect(mockSocket.readMessages).toHaveBeenCalledWith([{ id: 'status1' }]);
    });
  });
});
