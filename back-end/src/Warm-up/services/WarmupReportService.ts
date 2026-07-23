import { WarmupHistoryLog } from '../../models/WarmupHistoryLog';
import { WarmupMetricsService } from './WarmupMetricsService';
import { WarmupProfileService } from './WarmupProfileService';
import { warmupLogger } from '../utils/warmupLogger';

export interface WeeklyReportJSON {
  instanceId: string;
  reportDate: string;
  periodDays: number;
  profile: {
    name: string;
    phase: string;
    status: string;
    dailyLimit: number;
  };
  metrics: {
    trustScore: number;
    riskLevel: string;
    totalMessagesSent: number;
    totalMessagesReceived: number;
    aiGeneratedCount: number;
    humanFallbackCount: number;
    bouncesOrFailures: number;
  };
}

export class WarmupReportService {
  /**
   * Generates a weekly report containing aggregated metrics.
   */
  static async generateWeeklyReport(instanceId: string, days: number = 7): Promise<WeeklyReportJSON> {
    warmupLogger.info(`[WarmupReportService] Generating report for instance ${instanceId} (last ${days} days)...`);
    
    // Fetch basic profile
    const profile = await WarmupProfileService.getProfile(instanceId);

    // Fetch Trust Score and generic metrics
    const metrics = await WarmupMetricsService.getInstanceMetrics(instanceId);

    // Calculate dates
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Aggregate from MongoDB
    const sentCount = await WarmupHistoryLog.countDocuments({
      instanceId,
      direction: 'SENT',
      createdAt: { $gte: startDate, $lte: endDate }
    });

    const receivedCount = await WarmupHistoryLog.countDocuments({
      instanceId,
      direction: 'RECEIVED',
      createdAt: { $gte: startDate, $lte: endDate }
    });

    const aiGeneratedCount = await WarmupHistoryLog.countDocuments({
      instanceId,
      direction: 'SENT',
      isAiGenerated: true,
      createdAt: { $gte: startDate, $lte: endDate }
    });

    const humanFallbackCount = sentCount - aiGeneratedCount;

    // Failures (we don't persist network failures in Mongo usually, we might have them in Prisma history, 
    // but for now we can mock or pull from metrics/redis if available.
    const bouncesOrFailures = 0;

    return {
      instanceId,
      reportDate: endDate.toISOString(),
      periodDays: days,
      profile: {
        name: profile.name,
        phase: profile.currentPhase,
        status: profile.status,
        dailyLimit: profile.dailyLimit,
      },
      metrics: {
        trustScore: metrics.trustScore,
        riskLevel: metrics.riskLevel,
        totalMessagesSent: sentCount,
        totalMessagesReceived: receivedCount,
        aiGeneratedCount,
        humanFallbackCount,
        bouncesOrFailures
      }
    };
  }

  /**
   * Converts the JSON report into a styled HTML table.
   */
  static generateHtmlReport(report: WeeklyReportJSON): string {
    const riskColor = report.metrics.riskLevel === 'CRITICAL' ? 'red' : 
                      report.metrics.riskLevel === 'HIGH' ? 'orange' :
                      report.metrics.riskLevel === 'MEDIUM' ? '#d4a017' : 'green';

    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px; }
          .container { background: #fff; padding: 20px; border-radius: 8px; max-width: 600px; margin: auto; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
          h2 { color: #333; text-align: center; }
          .metric { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
          .metric:last-child { border-bottom: none; }
          .label { font-weight: bold; color: #555; }
          .value { color: #000; }
          .highlight { color: ${riskColor}; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Relatório de Aquecimento (Últimos ${report.periodDays} dias)</h2>
          <div class="metric"><span class="label">Instância:</span> <span class="value">${report.profile.name} (ID: ${report.instanceId})</span></div>
          <div class="metric"><span class="label">Fase Atual:</span> <span class="value">${report.profile.phase}</span></div>
          <div class="metric"><span class="label">Status:</span> <span class="value">${report.profile.status}</span></div>
          <div class="metric"><span class="label">Trust Score:</span> <span class="value highlight">${report.metrics.trustScore}/100 (${report.metrics.riskLevel})</span></div>
          <div class="metric"><span class="label">Mensagens Enviadas:</span> <span class="value">${report.metrics.totalMessagesSent}</span></div>
          <div class="metric"><span class="label">Mensagens Recebidas:</span> <span class="value">${report.metrics.totalMessagesReceived}</span></div>
          <div class="metric"><span class="label">Geradas por IA:</span> <span class="value">${report.metrics.aiGeneratedCount}</span></div>
          <div class="metric"><span class="label">Falhas/Bounces (Hoje):</span> <span class="value">${report.metrics.bouncesOrFailures}</span></div>
        </div>
      </body>
      </html>
    `.trim();
  }
}
