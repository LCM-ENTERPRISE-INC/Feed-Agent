"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WarmupAlertService = void 0;
const axios_1 = __importDefault(require("axios"));
const warmupLogger_1 = require("../utils/warmupLogger");
class WarmupAlertService {
    /**
     * Sends an alert notification if a critical risk condition is met.
     */
    static async sendCriticalAlert(instanceId, reason, severity = 'CRITICAL') {
        const message = `🚨 [WARMUP ALERT] Instance ${instanceId} | Severity: ${severity} | Reason: ${reason}`;
        // Log explicitly in winston with high visibility
        if (severity === 'CRITICAL' || severity === 'HIGH') {
            warmupLogger_1.warmupLogger.error(message);
        }
        else {
            warmupLogger_1.warmupLogger.warn(message);
        }
        const webhookUrl = process.env.WEBHOOK_ALERT_URL;
        if (!webhookUrl) {
            warmupLogger_1.warmupLogger.warn(`[WarmupAlertService] No WEBHOOK_ALERT_URL defined. Skipping webhook dispatch.`);
            return;
        }
        try {
            await axios_1.default.post(webhookUrl, {
                instanceId,
                severity,
                reason,
                timestamp: new Date().toISOString()
            }, {
                timeout: 5000 // Do not block
            });
            warmupLogger_1.warmupLogger.info(`[WarmupAlertService] Webhook alert dispatched for instance ${instanceId}.`);
        }
        catch (err) {
            warmupLogger_1.warmupLogger.error(`[WarmupAlertService] Failed to dispatch webhook alert to ${webhookUrl}:`, err.message);
        }
    }
}
exports.WarmupAlertService = WarmupAlertService;
