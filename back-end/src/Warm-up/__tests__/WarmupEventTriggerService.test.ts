import { WarmupEventTriggerService } from '../services/WarmupEventTriggerService';
import { WarmupQueue } from '../queues/WarmupQueue';
import LlamaService from '../../services/LlamaService';
import { WarmupCacheService } from '../services/WarmupCacheService';

jest.mock('@whiskeysockets/baileys', () => ({}));
jest.mock('../queues/WarmupQueue');
jest.mock('../../services/LlamaService');
jest.mock('../services/WarmupCacheService');
jest.mock('../utils/warmupLogger', () => ({
  warmupLogger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

describe('WarmupEventTriggerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (WarmupCacheService.getConversationHistory as jest.Mock).mockResolvedValue([]);
    (WarmupCacheService.appendConversationHistory as jest.Mock).mockResolvedValue(undefined);
  });

  const mockSocket = {} as any;
  const instanceId = 'inst-1';

  const createMsg = (text: string, fromMe = false, remoteJid = '5511999999999@s.whatsapp.net'): any => ({
    key: { remoteJid, fromMe },
    message: { conversation: text }
  });

  it('should ignore messages from the bot itself', async () => {
    const msg = createMsg('sim', true);
    await WarmupEventTriggerService.evaluateIncomingMessage(instanceId, msg, mockSocket);
    expect(WarmupQueue.addEventReplyJob).not.toHaveBeenCalled();
  });

  it('should ignore messages without text', async () => {
    const msg: any = { key: { remoteJid: '5511999999999@s.whatsapp.net', fromMe: false } };
    await WarmupEventTriggerService.evaluateIncomingMessage(instanceId, msg, mockSocket);
    expect(WarmupQueue.addEventReplyJob).not.toHaveBeenCalled();
  });

  it('should not trigger event for a message containing random text if AI fails and no keywords match', async () => {
    const msg = createMsg('Olá, boa tarde! Gostaria de mais informações sobre o produto.', false);
    (LlamaService.generateCompletion as jest.Mock).mockRejectedValue(new Error('AI failed'));

    await WarmupEventTriggerService.evaluateIncomingMessage(instanceId, msg, mockSocket);
    expect(WarmupQueue.addEventReplyJob).not.toHaveBeenCalled();
  });

  it('should trigger AI event for a short positive message "Sim"', async () => {
    const msg = createMsg('Sim', false);
    jest.spyOn(Math, 'random').mockReturnValue(0.5); // 6 minutes delay
    (LlamaService.generateCompletion as jest.Mock).mockResolvedValue('"Claro, me avise qualquer coisa."');

    await WarmupEventTriggerService.evaluateIncomingMessage(instanceId, msg, mockSocket);

    expect(WarmupQueue.addEventReplyJob).toHaveBeenCalledTimes(1);
    expect(WarmupQueue.addEventReplyJob).toHaveBeenCalledWith({
      instanceId,
      targetJid: '5511999999999@s.whatsapp.net',
      content: 'Claro, me avise qualquer coisa.'
    }, 360000);
  });

  it('should trigger AI event for any message and use AI response', async () => {
    const msg = createMsg('Tudo ótimo por aqui e com vc?', false);
    (LlamaService.generateCompletion as jest.Mock).mockResolvedValue('Tudo bem também!');
    
    await WarmupEventTriggerService.evaluateIncomingMessage(instanceId, msg, mockSocket);
    
    expect(WarmupQueue.addEventReplyJob).toHaveBeenCalledTimes(1);
    expect(WarmupQueue.addEventReplyJob).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'Tudo bem também!' }),
      expect.any(Number)
    );
  });

  it('should fallback to thumbs up if AI fails and message has positive keywords', async () => {
    const msg = createMsg('sim, claro', false);
    (LlamaService.generateCompletion as jest.Mock).mockRejectedValue(new Error('Timeout'));
    
    await WarmupEventTriggerService.evaluateIncomingMessage(instanceId, msg, mockSocket);
    
    expect(WarmupQueue.addEventReplyJob).toHaveBeenCalledTimes(1);
    expect(WarmupQueue.addEventReplyJob).toHaveBeenCalledWith(
      expect.objectContaining({ content: '👍' }),
      expect.any(Number)
    );
  });

  it('should not trigger event for a group message even if it contains "sim"', async () => {
    const msg = createMsg('sim', false, '123456@g.us');
    await WarmupEventTriggerService.evaluateIncomingMessage(instanceId, msg, mockSocket);
    expect(WarmupQueue.addEventReplyJob).not.toHaveBeenCalled();
  });
});
