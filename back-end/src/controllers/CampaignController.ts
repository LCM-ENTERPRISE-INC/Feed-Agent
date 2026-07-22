import { Request, Response, NextFunction } from 'express';
import campaignService from '../services/CampaignService';
import campaignEventBus, { CampaignSseEvent } from '../services/CampaignEventBus';
import { ApiResponse } from '../utils/ApiResponse';
import { AppError } from '../utils/AppError';

const SSE_HEARTBEAT_MS = 25_000;

export class CampaignController {
  async audiencePreview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const {
        selectionMode = 'all',
        contactIds,
        excludedIds,
        skipAlreadySent,
        draftId,
      } = req.body || {};

      if (selectionMode !== 'all' && selectionMode !== 'specific') {
        throw new AppError('selectionMode must be "all" or "specific".', 400);
      }

      const preview = await campaignService.previewAudience(userId, {
        selectionMode,
        contactIds,
        excludedIds,
        skipAlreadySent,
        draftId: draftId != null ? Number(draftId) : undefined,
      });
      ApiResponse.success(res, preview, 'Audience preview generated.');
    } catch (err) {
      next(err);
    }
  }

  async launch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const result = await campaignService.createAndEnqueue(userId, {
        selectionMode: req.body.selectionMode || 'all',
        contactIds: req.body.contactIds,
        excludedIds: req.body.excludedIds,
        delaySeconds: Number(req.body.delaySeconds),
        draftId: req.body.draftId != null ? Number(req.body.draftId) : undefined,
        title: req.body.title,
        expectedRecipients:
          req.body.expectedRecipients != null ? Number(req.body.expectedRecipients) : undefined,
        skipAlreadySent: req.body.skipAlreadySent !== false,
        batchSize: req.body.batchSize != null ? Number(req.body.batchSize) : undefined,
      });

      if (!result.queuedJobs || result.queuedJobs <= 0) {
        throw new AppError('Launch failed: queuedJobs=0.', 500);
      }

      ApiResponse.success(res, result, 'Campaign queued successfully.', 201);
    } catch (err) {
      next(err);
    }
  }

  async progress(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const campaignId = String(req.params.id);
      const data = await campaignService.getProgress(userId, campaignId);
      ApiResponse.success(res, data, 'Campaign progress.');
    } catch (err) {
      next(err);
    }
  }

  async jobs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const campaignId = String(req.params.id);
      const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
      const data = await campaignService.listJobs(userId, campaignId, page, limit);
      ApiResponse.success(res, data, 'Campaign jobs.');
    } catch (err) {
      next(err);
    }
  }

  async history(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
      const data = await campaignService.listHistory(userId, page, limit);
      ApiResponse.success(res, data, 'Campaign history.');
    } catch (err) {
      next(err);
    }
  }

  async active(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const campaign = await campaignService.getActiveCampaign(userId);
      ApiResponse.success(
        res,
        campaign ? await campaignService.getProgress(userId, campaign.id) : null,
        'Active campaign.',
      );
    } catch (err) {
      next(err);
    }
  }

  async pause(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const campaign = await campaignService.pause(userId, String(req.params.id));
      ApiResponse.success(res, campaign, 'Campaign paused.');
    } catch (err) {
      next(err);
    }
  }

  async resume(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const campaign = await campaignService.resume(userId, String(req.params.id));
      ApiResponse.success(res, campaign, 'Campaign resumed.');
    } catch (err) {
      next(err);
    }
  }

  async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const campaign = await campaignService.cancel(userId, String(req.params.id));
      ApiResponse.success(res, campaign, 'Campaign cancelled.');
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/campaigns/events?token=JWT
   * SSE stream + initial snapshot of active campaign.
   */
  async events(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders?.();

      const send = (event: string, data: unknown) => {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      const active = await campaignService.getActiveCampaign(userId);
      if (active) {
        const progress = await campaignService.getProgress(userId, active.id);
        send('snapshot', progress);
      } else {
        send('snapshot', null);
      }

      const onEvent = (e: CampaignSseEvent) => {
        send(e.type, e);
      };
      campaignEventBus.onUser(userId, onEvent);

      const heartbeat = setInterval(() => {
        res.write(`: heartbeat ${Date.now()}\n\n`);
      }, SSE_HEARTBEAT_MS);

      req.on('close', () => {
        clearInterval(heartbeat);
        campaignEventBus.offUser(userId, onEvent);
      });
    } catch (err) {
      next(err);
    }
  }
}

export default new CampaignController();
