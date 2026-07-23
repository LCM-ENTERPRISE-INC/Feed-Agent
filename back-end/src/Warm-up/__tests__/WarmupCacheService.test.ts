import { WarmupCacheService, WarmupEphemeralState } from '../services/WarmupCacheService';
import redisClient from '../../utils/redisClient';

// Mocar o redisClient para evitar conexões reais no TDD unitário
jest.mock('../../utils/redisClient', () => ({
  set: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
  rpush: jest.fn(),
  ltrim: jest.fn(),
  expire: jest.fn(),
  lrange: jest.fn(),
}));

describe('WarmupCacheService', () => {
  const mockInstanceId = 'instance_123';
  const mockState: WarmupEphemeralState = {
    isPaused: false,
    messagesSentInCurrentBatch: 5,
    messagesReceivedInCurrentBatch: 2,
    consecutiveFailures: 0,
    lastActionTimestamp: 1670000000,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should set the state in Redis with correct namespace and TTL', async () => {
    await WarmupCacheService.setState(mockInstanceId, mockState);
    expect(redisClient.set).toHaveBeenCalledWith(
      `warmup:state:${mockInstanceId}`,
      JSON.stringify(mockState),
      'EX',
      86400
    );
  });

  it('should get the state from Redis and parse it', async () => {
    (redisClient.get as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockState));
    
    const result = await WarmupCacheService.getState(mockInstanceId);
    expect(redisClient.get).toHaveBeenCalledWith(`warmup:state:${mockInstanceId}`);
    expect(result).toEqual(mockState);
  });

  it('should return null if state does not exist in Redis', async () => {
    (redisClient.get as jest.Mock).mockResolvedValueOnce(null);
    
    const result = await WarmupCacheService.getState(mockInstanceId);
    expect(result).toBeNull();
  });

  it('should delete the state from Redis', async () => {
    await WarmupCacheService.deleteState(mockInstanceId);
    expect(redisClient.del).toHaveBeenCalledWith(`warmup:state:${mockInstanceId}`);
  });

  describe('Conversation History', () => {
    it('should append message to history, trim to 4, and set TTL', async () => {
      jest.spyOn(Date, 'now').mockReturnValue(100000);
      const jid = '5511999999999';
      await WarmupCacheService.appendConversationHistory(mockInstanceId, jid, 'oi', 'me');

      const expectedKey = `warmup:history:${mockInstanceId}:${jid}`;
      expect(redisClient.rpush).toHaveBeenCalledWith(expectedKey, JSON.stringify({ sender: 'me', message: 'oi', timestamp: 100000 }));
      expect(redisClient.ltrim).toHaveBeenCalledWith(expectedKey, -4, -1);
      expect(redisClient.expire).toHaveBeenCalledWith(expectedKey, 86400);
    });

    it('should retrieve conversation history', async () => {
      const jid = '5511999999999';
      const mockHistory = [
        JSON.stringify({ sender: 'other', message: 'Oi', timestamp: 100000 }),
        JSON.stringify({ sender: 'me', message: 'Tudo bem?', timestamp: 100005 })
      ];
      (redisClient.lrange as jest.Mock).mockResolvedValueOnce(mockHistory);

      const result = await WarmupCacheService.getConversationHistory(mockInstanceId, jid);
      expect(redisClient.lrange).toHaveBeenCalledWith(`warmup:history:${mockInstanceId}:${jid}`, 0, -1);
      expect(result).toHaveLength(2);
      expect(result[1].message).toBe('Tudo bem?');
    });

    it('should return empty array if no history', async () => {
      (redisClient.lrange as jest.Mock).mockResolvedValueOnce(null);
      const result = await WarmupCacheService.getConversationHistory(mockInstanceId, '123');
      expect(result).toEqual([]);
    });
  });
});
