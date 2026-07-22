import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../utils/ApiResponse';
import { AppError } from '../utils/AppError';
import draftService from '../services/DraftService';
import { DraftStatus } from '@prisma/client';

export class DraftController {
  /**
   * GET /api/drafts
   * Lists all drafts for the authenticated user.
   * Can be filtered by status via query param (e.g., ?status=PENDING)
   */
  async getDrafts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const statusQuery = req.query.status as string | undefined;

      let statusFilter: DraftStatus | undefined;
      
      if (statusQuery) {
        const upperStatus = statusQuery.toUpperCase();
        if (!Object.values(DraftStatus).includes(upperStatus as DraftStatus)) {
          throw new AppError(`Invalid status. Allowed values: ${Object.values(DraftStatus).join(', ')}`, 400);
        }
        statusFilter = upperStatus as DraftStatus;
      }

      const drafts = await draftService.getUserDrafts(userId, statusFilter);
      
      ApiResponse.success(res, drafts, 'Drafts retrieved successfully.', 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/drafts/:id
   * Retrieves specific details of a draft, including the original OCR text.
   */
  async getDraftById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const draftId = parseInt(req.params.id as string, 10);

      if (isNaN(draftId)) {
        throw new AppError('Invalid draft ID provided.', 400);
      }

      const draft = await draftService.getDraftById(draftId, userId);

      if (!draft) {
        throw new AppError('Draft not found or does not belong to user.', 404);
      }

      ApiResponse.success(res, draft, 'Draft details retrieved successfully.', 200);
    } catch (err) {
      next(err);
    }
  }
  /**
   * POST /api/drafts
   * Manually creates a new draft from the studio.
   */
  async createDraft(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { title, summary, content, source, category, priority, status, imagePath } = req.body;

      if (!title || !content) {
        throw new AppError('Title and content are required.', 400);
      }

      const generatedContent = {
        titulo: title,
        resumo: summary || '',
        corpo: content || '',
        fonte: source || 'Estúdio Kanban Manual'
      };

      const originalText = content;

      const draft = await draftService.createDraft(userId, originalText, generatedContent, imagePath, status);

      // Map back to frontend expected fields if needed, but the frontend reloads or maps it
      ApiResponse.success(res, draft, 'Draft created successfully.', 201);
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /api/drafts/:id
   * Updates the generated content (NewsArticleJSON) of a specific draft.
   */
  async updateDraft(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const draftId = parseInt(req.params.id as string, 10);

      if (isNaN(draftId)) {
        throw new AppError('Invalid draft ID provided.', 400);
      }

      if (!req.body || typeof req.body !== 'object') {
        throw new AppError('Invalid request body. Expected a JSON object.', 400);
      }

      const { status, ...generatedContent } = req.body;

      const updatedDraft = await draftService.updateDraftContent(draftId, userId, generatedContent);
      
      if (status) {
        await draftService.updateDraftStatus(draftId, status);
        updatedDraft.status = status;
      }

      ApiResponse.success(res, updatedDraft, 'Draft updated successfully.', 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/drafts/:id/approve
   * Marks the draft as APPROVED and triggers the broadcast event.
   */
  async approveDraft(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const draftId = parseInt(req.params.id as string, 10);

      if (isNaN(draftId)) {
        throw new AppError('Invalid draft ID provided.', 400);
      }

      // Verify ownership first
      const draft = await draftService.getDraftById(draftId, userId);
      if (!draft) {
        throw new AppError('Draft not found or does not belong to user.', 404);
      }

      const includeImage = req.body.includeImage === true;

      const updatedDraft = await draftService.updateDraftStatus(draftId, DraftStatus.APPROVED);

      ApiResponse.success(res, updatedDraft, 'Draft approved successfully.', 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/drafts/:id/reject
   * Marks the draft as REJECTED. It will not be sent to contacts.
   */
  async rejectDraft(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const draftId = parseInt(req.params.id as string, 10);

      if (isNaN(draftId)) {
        throw new AppError('Invalid draft ID provided.', 400);
      }

      // Verify ownership first
      const draft = await draftService.getDraftById(draftId, userId);
      if (!draft) {
        throw new AppError('Draft not found or does not belong to user.', 404);
      }

      const updatedDraft = await draftService.updateDraftStatus(draftId, DraftStatus.REJECTED);

      ApiResponse.success(res, updatedDraft, 'Draft rejected successfully.', 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/drafts/:id/cancel
   * Cancels a pending or active broadcast.
   */
  async cancelDraft(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const draftId = parseInt(req.params.id as string, 10);

      if (isNaN(draftId)) {
        throw new AppError('Invalid draft ID provided.', 400);
      }

      const draft = await draftService.getDraftById(draftId, userId);
      if (!draft) {
        throw new AppError('Draft not found or does not belong to user.', 404);
      }

      await draftService.cancelBroadcast(draftId, userId);

      ApiResponse.success(res, null, 'Broadcast cancelled successfully.', 200);
    } catch (err) {
      next(err);
    }
  }
  /**
   * DELETE /api/drafts/:id
   * Hard deletes a draft.
   */
  async deleteDraft(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const draftId = parseInt(req.params.id as string, 10);

      if (isNaN(draftId)) {
        throw new AppError('Invalid draft ID provided.', 400);
      }

      await draftService.deleteDraft(draftId, userId);

      ApiResponse.success(res, null, 'Draft deleted successfully.', 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/drafts/broadcast/launch
   * Legacy entry — delegates to CampaignService with selectionMode=specific|all.
   */
  async launchBroadcast(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const {
        contactIds,
        delaySeconds,
        selectionMode,
        excludedIds,
        expectedRecipients,
        draftId,
        skipAlreadySent,
      } = req.body;

      if (typeof delaySeconds !== 'number' || delaySeconds < 1) {
        throw new AppError('A valid delaySeconds (>= 1) is required.', 400);
      }

      const mode = selectionMode === 'all' || selectionMode === 'specific'
        ? selectionMode
        : (Array.isArray(contactIds) && contactIds.length > 0 ? 'specific' : 'all');

      if (mode === 'specific' && (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0)) {
        throw new AppError('A valid array of contactIds is required for selectionMode=specific.', 400);
      }

      const campaignService = (await import('../services/CampaignService')).default;
      const result = await campaignService.createAndEnqueue(userId, {
        selectionMode: mode,
        contactIds,
        excludedIds,
        delaySeconds,
        draftId,
        expectedRecipients,
        skipAlreadySent: skipAlreadySent !== false,
      });

      if (!result.queuedJobs) {
        throw new AppError('Launch failed: queuedJobs=0.', 500);
      }

      ApiResponse.success(res, result, 'Broadcast launched successfully.', 201);
    } catch (err) {
      next(err);
    }
  }
}

export default new DraftController();
