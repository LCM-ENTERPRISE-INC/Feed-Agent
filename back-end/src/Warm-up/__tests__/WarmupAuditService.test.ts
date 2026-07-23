import { WarmupAuditService } from '../services/WarmupAuditService';
import { WarmupHistoryLog } from '../../models/WarmupHistoryLog';
import { warmupLogger } from '../utils/warmupLogger';

jest.mock('../../models/WarmupHistoryLog', () => ({
  WarmupHistoryLog: jest.fn().mockImplementation(() => ({
    save: jest.fn().mockResolvedValue(true)
  }))
}));

jest.mock('../utils/warmupLogger', () => ({
  warmupLogger: {
    debug: jest.fn(),
    error: jest.fn()
  }
}));

describe('WarmupAuditService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should log interaction and save to MongoDB', async () => {
    const mockSave = jest.fn().mockResolvedValue(true);
    (WarmupHistoryLog as unknown as jest.Mock).mockImplementation(() => ({
      save: mockSave
    }));

    WarmupAuditService.logInteraction({
      instanceId: '1',
      contactJid: '123@s.whatsapp.net',
      direction: 'SENT',
      content: 'Hello',
      isAiGenerated: true
    });

    // Wait for promise resolution since logInteraction uses fire-and-forget
    await new Promise(process.nextTick);

    expect(WarmupHistoryLog).toHaveBeenCalledWith({
      instanceId: '1',
      contactJid: '123@s.whatsapp.net',
      direction: 'SENT',
      content: 'Hello',
      isAiGenerated: true
    });
    expect(mockSave).toHaveBeenCalled();
    expect(warmupLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Logged SENT interaction for instance 1'));
  });

  it('should catch errors and not throw to caller', async () => {
    const mockSave = jest.fn().mockRejectedValue(new Error('MongoError'));
    (WarmupHistoryLog as unknown as jest.Mock).mockImplementation(() => ({
      save: mockSave
    }));

    // This should not throw
    WarmupAuditService.logInteraction({
      instanceId: '2',
      contactJid: '123@s.whatsapp.net',
      direction: 'RECEIVED',
      content: 'Hi',
      isAiGenerated: false
    });

    await new Promise(process.nextTick);

    expect(mockSave).toHaveBeenCalled();
    expect(warmupLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to log interaction to MongoDB for instance 2'),
      expect.any(Error)
    );
  });
});
