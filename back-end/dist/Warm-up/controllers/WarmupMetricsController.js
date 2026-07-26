"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WarmupMetricsController = void 0;
const WarmupMetricsService_1 = require("../services/WarmupMetricsService");
class WarmupMetricsController {
    static async getMetrics(req, res, next) {
        try {
            const instanceId = req.params.instanceId;
            const metrics = await WarmupMetricsService_1.WarmupMetricsService.getInstanceMetrics(instanceId);
            res.status(200).json(metrics);
        }
        catch (error) {
            next(error);
        }
    }
}
exports.WarmupMetricsController = WarmupMetricsController;
