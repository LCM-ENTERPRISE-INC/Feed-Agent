import { WarmupConnectionMonitor } from '../services/WarmupConnectionMonitor';
import { WarmupProfileService } from '../services/WarmupProfileService';
import { WarmupStatus } from '@prisma/client';
import { EventEmitter } from 'events';
import { Boom } from '@hapi/boom';

jest.mock('../services/WarmupProfileService', () => ({
  WarmupProfileService: {
    updateStatus: jest.fn(),
    getProfile: jest.fn(),
  }
}));

describe('WarmupConnectionMonitor', () => {
  let mockService: EventEmitter;

  beforeEach(() => {
    jest.clearAllMocks();
    mockService = new EventEmitter();
  });

  it('should attach listeners without errors', () => {
    expect(() => {
      WarmupConnectionMonitor.attachMonitor(mockService as any, 1);
    }).not.toThrow();
    
    expect(mockService.listenerCount('close')).toBe(1);
    expect(mockService.listenerCount('open')).toBe(1);
  });

  it('should call updateStatus(PAUSED) when connection closes', async () => {
    WarmupConnectionMonitor.attachMonitor(mockService as any, 1);
    
    (WarmupProfileService.updateStatus as jest.Mock).mockResolvedValueOnce(undefined);
    
    mockService.emit('close', 'Network error');
    
    // allow microtasks to flush
    await new Promise(process.nextTick);

    expect(WarmupProfileService.updateStatus).toHaveBeenCalledWith(
      '1',
      WarmupStatus.PAUSED,
      'Connection Dropped. Reason: Network error'
    );
  });

  it('should ignore 404 errors when pausing if profile does not exist', async () => {
    WarmupConnectionMonitor.attachMonitor(mockService as any, 1);
    
    (WarmupProfileService.updateStatus as jest.Mock).mockRejectedValueOnce(new Boom('Not found', { statusCode: 404 }));
    
    mockService.emit('close', 'Network error');
    
    await new Promise(process.nextTick);
    expect(WarmupProfileService.updateStatus).toHaveBeenCalled(); // Should not throw unhandled rejection
  });

  it('should auto-resume if profile was paused due to connection drop', async () => {
    WarmupConnectionMonitor.attachMonitor(mockService as any, 1);
    
    (WarmupProfileService.getProfile as jest.Mock).mockResolvedValueOnce({
      status: WarmupStatus.PAUSED,
      statusHistory: [
        { reason: 'Connection Dropped. Reason: Network error' }
      ]
    });
    
    mockService.emit('open');
    
    await new Promise(process.nextTick);

    expect(WarmupProfileService.updateStatus).toHaveBeenCalledWith(
      '1',
      WarmupStatus.IDLE,
      'Auto-resumed after connection restored'
    );
  });

  it('should NOT auto-resume if profile was paused for other reasons', async () => {
    WarmupConnectionMonitor.attachMonitor(mockService as any, 1);
    
    (WarmupProfileService.getProfile as jest.Mock).mockResolvedValueOnce({
      status: WarmupStatus.PAUSED,
      statusHistory: [
        { reason: 'Manual pause via API' } // Different reason
      ]
    });
    
    mockService.emit('open');
    
    await new Promise(process.nextTick);

    expect(WarmupProfileService.updateStatus).not.toHaveBeenCalled();
  });
});
