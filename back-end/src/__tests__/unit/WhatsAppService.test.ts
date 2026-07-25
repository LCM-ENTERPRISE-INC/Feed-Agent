import { WhatsAppService } from '../../../src/services/WhatsAppService';
import { HttpsProxyAgent } from 'https-proxy-agent';
import makeWASocket from '@whiskeysockets/baileys';
import { Browsers } from '@whiskeysockets/baileys';
import prisma from '../../../src/models/prismaClient';

jest.mock('../../../src/models/prismaClient', () => ({
  whatsAppInstance: {
    findUnique: jest.fn()
  }
}));

jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

describe('WhatsAppService (Emulação de Região/Navegador)', () => {
  let service: WhatsAppService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WhatsAppService(1, 100); // instanceId = 1, userId = 100
  });

  describe('initialize()', () => {
    it('deve utilizar as configurações default (Mac OS) quando não há userAgent nem proxyUrl', async () => {
      (prisma.whatsAppInstance.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        userAgent: null,
        proxyUrl: null
      });

      await service.initialize();

      expect(prisma.whatsAppInstance.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
      
      // makeWASocket deve ter sido chamado com o browser default do Baileys
      expect(makeWASocket).toHaveBeenCalledWith(expect.objectContaining({
        browser: ['Mac OS', 'Desktop', ''],
        agent: undefined,
        fetchAgent: undefined
      }));
    });

    it('deve injetar a emulação correta do navegador baseado no userAgent (Ex: Windows Firefox)', async () => {
      (prisma.whatsAppInstance.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/110.0',
        proxyUrl: null
      });

      await service.initialize();

      expect(makeWASocket).toHaveBeenCalledWith(expect.objectContaining({
        browser: ['Windows', 'Firefox', '1.0.0']
      }));
    });

    it('deve injetar a emulação correta do navegador baseado no userAgent (Ex: Mac OS Safari)', async () => {
      (prisma.whatsAppInstance.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Safari/605.1.15',
        proxyUrl: null
      });

      await service.initialize();

      expect(makeWASocket).toHaveBeenCalledWith(expect.objectContaining({
        browser: ['Mac OS', 'Safari', '1.0.0']
      }));
    });

    it('deve instanciar HttpsProxyAgent quando proxyUrl for providenciado', async () => {
      const proxyUrl = 'http://br.proxy.network:8080';
      (prisma.whatsAppInstance.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        userAgent: null,
        proxyUrl
      });

      const proxyInstance = { _isProxyAgent: true };
      (HttpsProxyAgent as unknown as jest.Mock).mockImplementation(() => proxyInstance);

      await service.initialize();

      expect(HttpsProxyAgent).toHaveBeenCalledWith(proxyUrl);
      expect(makeWASocket).toHaveBeenCalledWith(expect.objectContaining({
        agent: proxyInstance,
        fetchAgent: proxyInstance
      }));
    });

    it('deve lidar com proxyUrl malformada sem crashar, logando o erro e ignorando', async () => {
      const proxyUrl = 'url-invalida-sem-protocolo';
      (prisma.whatsAppInstance.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        userAgent: null,
        proxyUrl
      });

      // Lançar erro no construtor
      (HttpsProxyAgent as unknown as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid URL');
      });

      await service.initialize();

      expect(makeWASocket).toHaveBeenCalledWith(expect.objectContaining({
        agent: undefined,
        fetchAgent: undefined
      }));
    });
  });
});
