import whatsAppController from '../../../src/controllers/WhatsAppController';
import whatsAppInstanceManager from '../../../src/services/WhatsAppInstanceManager';
import prisma from '../../../src/models/prismaClient';
import { Request, Response } from 'express';
import { ApiResponse } from '../../../src/utils/ApiResponse';

// Mocks
jest.mock('../../../src/models/prismaClient', () => ({
  whatsAppInstance: {
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  }
}));

jest.mock('../../../src/services/WhatsAppInstanceManager', () => ({
  getInstance: jest.fn(),
  addInstance: jest.fn(),
}));

jest.mock('../../../src/utils/ApiResponse', () => ({
  ApiResponse: {
    success: jest.fn(),
  }
}));

describe('WhatsAppController (Integração API para Emulação)', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockNext = jest.fn();
  });

  describe('createInstance', () => {
    it('deve criar uma instância salvando userAgent e proxyUrl quando fornecidos', async () => {
      mockReq = {
        user: { userId: 1, email: 'test@test.com' },
        body: {
          name: 'Nova Instancia',
          userAgent: 'Chrome Test',
          proxyUrl: 'http://proxy'
        }
      };

      (prisma.whatsAppInstance.count as jest.Mock).mockResolvedValue(0);
      (prisma.whatsAppInstance.create as jest.Mock).mockResolvedValue({ id: 10, userId: 1 });

      await whatsAppController.createInstance(mockReq as Request, mockRes as Response, mockNext);

      expect(prisma.whatsAppInstance.create).toHaveBeenCalledWith({
        data: {
          userId: 1,
          name: 'Nova Instancia',
          status: 'DISCONNECTED',
          userAgent: 'Chrome Test',
          proxyUrl: 'http://proxy'
        }
      });
      expect(ApiResponse.success).toHaveBeenCalled();
    });

    it('deve criar uma instância ignorando userAgent e proxyUrl quando não fornecidos', async () => {
      mockReq = {
        user: { userId: 1, email: 'test@test.com' },
        body: { name: 'Sem Proxy' }
      };

      (prisma.whatsAppInstance.count as jest.Mock).mockResolvedValue(0);
      (prisma.whatsAppInstance.create as jest.Mock).mockResolvedValue({ id: 11, userId: 1 });

      await whatsAppController.createInstance(mockReq as Request, mockRes as Response, mockNext);

      expect(prisma.whatsAppInstance.create).toHaveBeenCalledWith({
        data: {
          userId: 1,
          name: 'Sem Proxy',
          status: 'DISCONNECTED',
          userAgent: undefined,
          proxyUrl: undefined
        }
      });
    });
  });

  describe('restart', () => {
    it('deve atualizar userAgent e proxyUrl antes de reiniciar se forem passados no body', async () => {
      mockReq = {
        user: { userId: 1, email: 'test@test.com' },
        params: { id: '10' },
        body: { userAgent: 'Safari Test' } // Apenas userAgent
      };

      const mockLiveInstance = {
        getUserId: () => 1,
        restart: jest.fn().mockResolvedValue(undefined)
      };

      (whatsAppInstanceManager.getInstance as jest.Mock).mockReturnValue(mockLiveInstance);

      await whatsAppController.restart(mockReq as Request, mockRes as Response, mockNext);

      expect(prisma.whatsAppInstance.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { userAgent: 'Safari Test' } // proxyUrl omitido porque não veio no body
      });
      expect(mockLiveInstance.restart).toHaveBeenCalled();
    });
  });

  describe('connect', () => {
    it('deve atualizar proxyUrl antes de conectar se for passado no body', async () => {
      mockReq = {
        user: { userId: 1, email: 'test@test.com' },
        params: { id: '10' },
        body: { proxyUrl: 'http://newproxy' } 
      };

      const mockLiveInstance = {
        getUserId: () => 1,
        initialize: jest.fn().mockResolvedValue(undefined)
      };

      (whatsAppInstanceManager.getInstance as jest.Mock).mockReturnValue(mockLiveInstance);

      await whatsAppController.connect(mockReq as Request, mockRes as Response, mockNext);

      expect(prisma.whatsAppInstance.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { proxyUrl: 'http://newproxy' }
      });
      expect(mockLiveInstance.initialize).toHaveBeenCalled();
    });
  });
});
