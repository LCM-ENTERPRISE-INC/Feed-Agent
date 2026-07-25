import { WASocket, delay } from '@whiskeysockets/baileys';
import { WarmupBaileysService } from '../../Warm-up/services/WarmupBaileysService';
import logger from '../../utils/logger';

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('WarmupBaileysService (Heurísticas Humanas)', () => {
  let mockSocket: Partial<WASocket>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSocket = {
      presenceSubscribe: jest.fn().mockResolvedValue(undefined),
      sendPresenceUpdate: jest.fn().mockResolvedValue(undefined),
      readMessages: jest.fn().mockResolvedValue(undefined),
    };
    
    // Fix global Math.random to a predictable value (0.5) to test logic
    jest.spyOn(global.Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    jest.spyOn(global.Math, 'random').mockRestore();
  });

  describe('simulateHumanRead', () => {
    it('deve simular uma leitura com delay humano proporcional', async () => {
      await WarmupBaileysService.simulateHumanRead(mockSocket as WASocket, '123@s.whatsapp.net', { id: 'msg1' });
      
      // Math.random() = 0.5 -> 2500 * 0.5 + 1500 = 1250 + 1500 = 2750ms
      expect(delay).toHaveBeenCalledWith(2750);
      expect(mockSocket.readMessages).toHaveBeenCalledWith([{ id: 'msg1' }]);
    });
  });

  describe('simulateHumanTyping', () => {
    it('deve simular digitação direta sem pausas para textos curtos (<= 3000ms)', async () => {
      // msPerChar = 200 + 150 * 0.5 = 275ms
      // Para totalTypingTime <= 3000, precisamos textLength <= 10 (2750ms)
      
      await WarmupBaileysService.simulateHumanTyping(mockSocket as WASocket, '123@s.whatsapp.net', 10);
      
      expect(mockSocket.presenceSubscribe).toHaveBeenCalledWith('123@s.whatsapp.net');
      expect(mockSocket.sendPresenceUpdate).toHaveBeenCalledWith('composing', '123@s.whatsapp.net');
      expect(delay).toHaveBeenCalledWith(2750); // Total typing time
      expect(mockSocket.sendPresenceUpdate).toHaveBeenCalledWith('paused', '123@s.whatsapp.net');
    });

    it('deve fragmentar digitação com pausas de raciocínio (chunking) para textos longos', async () => {
      // 50 chars = 50 * 275 = 13750ms (requer chunking)
      await WarmupBaileysService.simulateHumanTyping(mockSocket as WASocket, '123@s.whatsapp.net', 50);

      // Com random=0.5:
      // Prep delay: 500 + 500 = 1000ms
      // Chunk time: 4000*0.5 + 2000 = 4000ms
      // Pause time: 2000*0.5 + 500 = 1500ms
      // Backspace chance: 0.5 < 0.25 (false, sem backspace neste teste fixo)
      
      expect(mockSocket.sendPresenceUpdate).toHaveBeenCalledWith('composing', '123@s.whatsapp.net');
      expect(mockSocket.sendPresenceUpdate).toHaveBeenCalledWith('paused', '123@s.whatsapp.net');
      
      // Verifica se houve fragmentação (múltiplas chamadas)
      const composingCalls = (mockSocket.sendPresenceUpdate as jest.Mock).mock.calls.filter(call => call[0] === 'composing');
      expect(composingCalls.length).toBeGreaterThan(1);
    });

    it('deve simular backspacing (correção de erro) quando probabilidade for acionada', async () => {
      // Forçar o random para acionar o erro (< 0.25) durante a pausa
      jest.spyOn(global.Math, 'random').mockReturnValue(0.1);
      
      // msPerChar = 200 + 150 * 0.1 = 215ms
      // 50 chars = 10750ms
      // Prep delay: 500 + 100 = 600ms
      // Chunk: 400*0.1 + 2000 = 2400ms (sobra 8350ms)
      // Vai entrar no bloco de remainingTime > 0
      // Math.random < 0.25 (sim, 0.1 < 0.25), então adiciona erro
      // Error delay: 1500 * 0.1 + 1000 = 1150ms
      
      await WarmupBaileysService.simulateHumanTyping(mockSocket as WASocket, '123@s.whatsapp.net', 50);
      
      // Verifica se o delay de erro (1150ms) foi chamado pelo menos uma vez
      const delayCalls = (delay as jest.Mock).mock.calls.map(call => call[0]);
      expect(delayCalls).toContain(1150);
    });

    it('deve respeitar os limites mínimo (1500ms) e máximo (25000ms)', async () => {
      // Teste do limite inferior
      await WarmupBaileysService.simulateHumanTyping(mockSocket as WASocket, '123@s.whatsapp.net', 1);
      const delayCallsMin = (delay as jest.Mock).mock.calls.map(call => call[0]);
      expect(delayCallsMin).toContain(1500); // Forçado a 1500ms

      jest.clearAllMocks();

      // Teste do limite superior (300 chars * 275ms = 82500ms -> deve ser capado em 25000)
      await WarmupBaileysService.simulateHumanTyping(mockSocket as WASocket, '123@s.whatsapp.net', 300);
      // O remainingTime total vai começar em 25000, o que significa que o while vai rodar várias vezes até zerar.
      // E não causará travamento porque foi truncado.
      expect(mockSocket.sendPresenceUpdate).toHaveBeenCalledWith('composing', '123@s.whatsapp.net');
    });
  });
});
