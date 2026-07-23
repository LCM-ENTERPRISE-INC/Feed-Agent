import axios from 'axios';
import { warmupLogger } from '../utils/warmupLogger';

export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export class WarmupAlertService {
  /**
   * Sends an alert notification if a critical risk condition is met.
   */
  static async sendCriticalAlert(instanceId: string | number, reason: string, severity: AlertSeverity = 'CRITICAL'): Promise<void> {
    const message = `🚨 [WARMUP ALERT] Instance ${instanceId} | Severity: ${severity} | Reason: ${reason}`;
    
    // Log explicitly in winston with high visibility
    if (severity === 'CRITICAL' || severity === 'HIGH') {
      warmupLogger.error(message);
    } else {
      warmupLogger.warn(message);
    }

    const webhookUrl = process.env.WEBHOOK_ALERT_URL;

    if (!webhookUrl) {
      warmupLogger.warn(`[WarmupAlertService] No WEBHOOK_ALERT_URL defined. Skipping webhook dispatch.`);
      return;
    }

    try {
      await axios.post(webhookUrl, {
        instanceId,
        severity,
        reason,
        timestamp: new Date().toISOString()
      }, {
        timeout: 5000 // Do not block
      });
      warmupLogger.info(`[WarmupAlertService] Webhook alert dispatched for instance ${instanceId}.`);
    } catch (err: any) {
      warmupLogger.error(`[WarmupAlertService] Failed to dispatch webhook alert to ${webhookUrl}:`, err.message);
    }
  }
}
