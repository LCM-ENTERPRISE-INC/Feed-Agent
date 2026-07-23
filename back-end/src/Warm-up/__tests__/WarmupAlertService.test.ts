import axios from 'axios';
import { WarmupAlertService } from '../services/WarmupAlertService';
import { warmupLogger } from '../utils/warmupLogger';

jest.mock('axios');
jest.mock('../utils/warmupLogger', () => ({
  warmupLogger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn()
  }
}));

describe('WarmupAlertService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should log an error but skip webhook if WEBHOOK_ALERT_URL is not set', async () => {
    delete process.env.WEBHOOK_ALERT_URL;

    await WarmupAlertService.sendCriticalAlert('123', 'Test Reason', 'CRITICAL');

    expect(warmupLogger.error).toHaveBeenCalledWith(expect.stringContaining('Severity: CRITICAL'));
    expect(warmupLogger.warn).toHaveBeenCalledWith(expect.stringContaining('No WEBHOOK_ALERT_URL defined'));
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('should call axios.post if WEBHOOK_ALERT_URL is defined', async () => {
    process.env.WEBHOOK_ALERT_URL = 'http://example.com/webhook';
    (axios.post as jest.Mock).mockResolvedValue({ status: 200 });

    await WarmupAlertService.sendCriticalAlert('123', 'Test Reason', 'HIGH');

    expect(warmupLogger.error).toHaveBeenCalledWith(expect.stringContaining('Severity: HIGH'));
    expect(axios.post).toHaveBeenCalledWith(
      'http://example.com/webhook',
      expect.objectContaining({
        instanceId: '123',
        severity: 'HIGH',
        reason: 'Test Reason'
      }),
      { timeout: 5000 }
    );
    expect(warmupLogger.info).toHaveBeenCalledWith(expect.stringContaining('Webhook alert dispatched'));
  });

  it('should catch axios errors and log them gracefully', async () => {
    process.env.WEBHOOK_ALERT_URL = 'http://example.com/webhook';
    (axios.post as jest.Mock).mockRejectedValue(new Error('Network Error'));

    await WarmupAlertService.sendCriticalAlert('123', 'Test Reason', 'CRITICAL');

    expect(axios.post).toHaveBeenCalled();
    expect(warmupLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to dispatch webhook alert'),
      'Network Error'
    );
  });
});
