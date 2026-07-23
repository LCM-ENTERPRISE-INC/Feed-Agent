import { WarmupBusinessHoursService } from '../services/WarmupBusinessHoursService';
import { WarmupCronService } from '../services/WarmupCronService';
import { WarmupQueue } from '../queues/WarmupQueue';

jest.mock('../queues/WarmupQueue', () => ({
  WarmupQueue: {
    pauseQueue: jest.fn().mockResolvedValue(undefined),
    resumeQueue: jest.fn().mockResolvedValue(undefined),
  }
}));

describe('WarmupBusinessHoursService', () => {
  it('should return true during business hours (10:00)', () => {
    const mockDate = new Date();
    jest.spyOn(mockDate, 'getHours').mockReturnValue(10);
    expect(WarmupBusinessHoursService.isBusinessHours(mockDate)).toBe(true);
  });

  it('should return false during off hours (03:00)', () => {
    const mockDate = new Date();
    jest.spyOn(mockDate, 'getHours').mockReturnValue(3);
    expect(WarmupBusinessHoursService.isBusinessHours(mockDate)).toBe(false);
  });
});

describe('WarmupCronService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    // Reset private state
    (WarmupCronService as any).isCurrentlyPaused = false;
  });

  afterEach(() => {
    WarmupCronService.stopBusinessHoursCron();
    jest.useRealTimers();
  });

  it('should pause the queue if started during off-hours', () => {
    jest.spyOn(WarmupBusinessHoursService, 'isBusinessHours').mockReturnValue(false);
    
    WarmupCronService.startBusinessHoursCron();
    
    expect(WarmupQueue.pauseQueue).toHaveBeenCalledTimes(1);
    expect(WarmupQueue.resumeQueue).not.toHaveBeenCalled();
  });

  it('should resume the queue when transitioning from off-hours to business hours', async () => {
    // Start as off-hours
    const isBusinessSpy = jest.spyOn(WarmupBusinessHoursService, 'isBusinessHours').mockReturnValue(false);
    WarmupCronService.startBusinessHoursCron();
    
    // Wait for the immediate async call to finish updating state
    await Promise.resolve();
    
    expect(WarmupQueue.pauseQueue).toHaveBeenCalledTimes(1);
    
    // Simulate time passing and hitting 08:00
    isBusinessSpy.mockReturnValue(true);
    jest.advanceTimersByTime(60000); // 1 minute passed
    
    // Wait for the interval async call to finish
    await Promise.resolve();
    
    expect(WarmupQueue.resumeQueue).toHaveBeenCalledTimes(1);
  });
});
