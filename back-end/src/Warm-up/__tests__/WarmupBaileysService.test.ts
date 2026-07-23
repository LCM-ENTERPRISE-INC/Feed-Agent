import { WarmupBaileysService } from '../services/WarmupBaileysService';
import * as Baileys from '@whiskeysockets/baileys';
import { WASocket } from '@whiskeysockets/baileys';

jest.mock('@whiskeysockets/baileys', () => ({
  delay: jest.fn().mockResolvedValue(undefined),
}));

describe('WarmupBaileysService', () => {
  let mockSocket: jest.Mocked<Partial<WASocket>>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSocket = {
      readMessages: jest.fn().mockResolvedValue(undefined),
      presenceSubscribe: jest.fn().mockResolvedValue(undefined),
      sendPresenceUpdate: jest.fn().mockResolvedValue(undefined),
      sendMessage: jest.fn().mockResolvedValue({ key: { id: 'test_msg_id' } }),
      updateProfilePicture: jest.fn().mockResolvedValue(undefined),
      updateProfileStatus: jest.fn().mockResolvedValue(undefined),
      user: { id: 'user_jid@s.whatsapp.net' }
    };
  });

  describe('simulateHumanRead', () => {
    it('should wait for a delay and then call readMessages', async () => {
      const jid = '123@s.whatsapp.net';
      const key = { id: 'msg1' };
      
      await WarmupBaileysService.simulateHumanRead(mockSocket as WASocket, jid, key);
      
      expect(Baileys.delay).toHaveBeenCalled();
      expect(mockSocket.readMessages).toHaveBeenCalledWith([key]);
    });
  });

  describe('simulateHumanTyping', () => {
    it('should subscribe to presence, send composing, delay, and send paused', async () => {
      const jid = '123@s.whatsapp.net';
      
      await WarmupBaileysService.simulateHumanTyping(mockSocket as WASocket, jid, 10);
      
      expect(mockSocket.presenceSubscribe).toHaveBeenCalledWith(jid);
      expect(mockSocket.sendPresenceUpdate).toHaveBeenNthCalledWith(1, 'composing', jid);
      expect(mockSocket.sendPresenceUpdate).toHaveBeenNthCalledWith(2, 'paused', jid);
      expect(Baileys.delay).toHaveBeenCalledTimes(3); // 500ms prep, typing duration, 300ms post
    });
  });

  describe('simulateHumanRecording', () => {
    it('should send recording presence, wait, and send paused presence', async () => {
      const mockSocket = {
        presenceSubscribe: jest.fn().mockResolvedValue(undefined),
        sendPresenceUpdate: jest.fn().mockResolvedValue(undefined),
      };
      const jid = '123456789@s.whatsapp.net';
      
      const simulateSpy = jest.spyOn(WarmupBaileysService, 'simulateHumanRecording').mockResolvedValue(undefined);
      
      await WarmupBaileysService.simulateHumanRecording(mockSocket as unknown as WASocket, jid, 5000);
      
      expect(simulateSpy).toHaveBeenCalledWith(mockSocket, jid, 5000);
    });
  });

  describe('sendWarmupMessage', () => {
    it('should simulate typing and then send the message', async () => {
      const jid = '123@s.whatsapp.net';
      const text = 'Hello, warmup!';
      
      const simulateSpy = jest.spyOn(WarmupBaileysService, 'simulateHumanTyping').mockResolvedValue(undefined);
      
      const messageId = await WarmupBaileysService.sendWarmupMessage(mockSocket as WASocket, jid, text);
      
      expect(simulateSpy).toHaveBeenCalledWith(mockSocket, jid, text.length);
      expect(mockSocket.sendMessage).toHaveBeenCalledWith(jid, { text });
      expect(messageId).toBe('test_msg_id');
    });
  });

  describe('updateProfilePicture', () => {
    it('should wait for jitter delay and update profile picture', async () => {
      const buffer = Buffer.from('fake-image');
      
      await WarmupBaileysService.updateProfilePicture(mockSocket as WASocket, buffer);
      
      expect(Baileys.delay).toHaveBeenCalled();
      expect(mockSocket.updateProfilePicture).toHaveBeenCalledWith('user_jid@s.whatsapp.net', buffer);
    });

    it('should throw error if user jid is not available', async () => {
      const buffer = Buffer.from('fake-image');
      const brokenSocket = { ...mockSocket, user: undefined };
      
      await expect(WarmupBaileysService.updateProfilePicture(brokenSocket as WASocket, buffer))
        .rejects.toThrow('Socket user ID is not available');
    });
  });

  describe('updateProfileStatus', () => {
    it('should calculate typing delay and update profile status', async () => {
      const text = 'New about status';
      
      await WarmupBaileysService.updateProfileStatus(mockSocket as WASocket, text);
      
      expect(Baileys.delay).toHaveBeenCalledTimes(2); // One for jitter, one for typing
      expect(mockSocket.updateProfileStatus).toHaveBeenCalledWith(text);
    });
  });
});


