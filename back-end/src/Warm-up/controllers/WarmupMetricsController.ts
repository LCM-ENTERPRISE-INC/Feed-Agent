import { Request, Response, NextFunction } from 'express';
import { WarmupMetricsService } from '../services/WarmupMetricsService';

export class WarmupMetricsController {
  static async getMetrics(req: Request, res: Response, next: NextFunction) {
    try {
      const instanceId = req.params.instanceId as string;
      const metrics = await WarmupMetricsService.getInstanceMetrics(instanceId);
      res.status(200).json(metrics);
    } catch (error) {
      next(error);
    }
  }
}
