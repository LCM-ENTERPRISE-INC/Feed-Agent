"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DraftController = void 0;
const ApiResponse_1 = require("../utils/ApiResponse");
const AppError_1 = require("../utils/AppError");
const DraftService_1 = __importDefault(require("../services/DraftService"));
const client_1 = require("@prisma/client");
class DraftController {
    /**
     * GET /api/drafts
     * Lists all drafts for the authenticated user.
     * Can be filtered by status via query param (e.g., ?status=PENDING)
     */
    async getDrafts(req, res, next) {
        try {
            const userId = req.user.userId;
            const statusQuery = req.query.status;
            let statusFilter;
            if (statusQuery) {
                const upperStatus = statusQuery.toUpperCase();
                if (!Object.values(client_1.DraftStatus).includes(upperStatus)) {
                    throw new AppError_1.AppError(`Invalid status. Allowed values: ${Object.values(client_1.DraftStatus).join(', ')}`, 400);
                }
                statusFilter = upperStatus;
            }
            const drafts = await DraftService_1.default.getUserDrafts(userId, statusFilter);
            ApiResponse_1.ApiResponse.success(res, drafts, 'Drafts retrieved successfully.', 200);
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * GET /api/drafts/:id
     * Retrieves specific details of a draft, including the original OCR text.
     */
    async getDraftById(req, res, next) {
        try {
            const userId = req.user.userId;
            const draftId = parseInt(req.params.id, 10);
            if (isNaN(draftId)) {
                throw new AppError_1.AppError('Invalid draft ID provided.', 400);
            }
            const draft = await DraftService_1.default.getDraftById(draftId, userId);
            if (!draft) {
                throw new AppError_1.AppError('Draft not found or does not belong to user.', 404);
            }
            ApiResponse_1.ApiResponse.success(res, draft, 'Draft details retrieved successfully.', 200);
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /api/drafts
     * Manually creates a new draft from the studio.
     */
    async createDraft(req, res, next) {
        try {
            const userId = req.user.userId;
            const { title, summary, content, source, category, priority, status, imagePath } = req.body;
            if (!title || !content) {
                throw new AppError_1.AppError('Title and content are required.', 400);
            }
            const generatedContent = {
                titulo: title,
                resumo: summary || '',
                corpo: content || '',
                fonte: source || 'Estúdio Kanban Manual'
            };
            const originalText = content;
            const draft = await DraftService_1.default.createDraft(userId, originalText, generatedContent, imagePath, status);
            // Map back to frontend expected fields if needed, but the frontend reloads or maps it
            ApiResponse_1.ApiResponse.success(res, draft, 'Draft created successfully.', 201);
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * PUT /api/drafts/:id
     * Updates the generated content (NewsArticleJSON) of a specific draft.
     */
    async updateDraft(req, res, next) {
        try {
            const userId = req.user.userId;
            const draftId = parseInt(req.params.id, 10);
            if (isNaN(draftId)) {
                throw new AppError_1.AppError('Invalid draft ID provided.', 400);
            }
            if (!req.body || typeof req.body !== 'object') {
                throw new AppError_1.AppError('Invalid request body. Expected a JSON object.', 400);
            }
            const { status, ...generatedContent } = req.body;
            const updatedDraft = await DraftService_1.default.updateDraftContent(draftId, userId, generatedContent);
            if (status) {
                await DraftService_1.default.updateDraftStatus(draftId, status);
                updatedDraft.status = status;
            }
            ApiResponse_1.ApiResponse.success(res, updatedDraft, 'Draft updated successfully.', 200);
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /api/drafts/:id/approve
     * Marks the draft as APPROVED and triggers the broadcast event.
     */
    async approveDraft(req, res, next) {
        try {
            const userId = req.user.userId;
            const draftId = parseInt(req.params.id, 10);
            if (isNaN(draftId)) {
                throw new AppError_1.AppError('Invalid draft ID provided.', 400);
            }
            // Verify ownership first
            const draft = await DraftService_1.default.getDraftById(draftId, userId);
            if (!draft) {
                throw new AppError_1.AppError('Draft not found or does not belong to user.', 404);
            }
            const includeImage = req.body.includeImage === true;
            const updatedDraft = await DraftService_1.default.updateDraftStatus(draftId, client_1.DraftStatus.APPROVED);
            ApiResponse_1.ApiResponse.success(res, updatedDraft, 'Draft approved successfully.', 200);
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /api/drafts/:id/reject
     * Marks the draft as REJECTED. It will not be sent to contacts.
     */
    async rejectDraft(req, res, next) {
        try {
            const userId = req.user.userId;
            const draftId = parseInt(req.params.id, 10);
            if (isNaN(draftId)) {
                throw new AppError_1.AppError('Invalid draft ID provided.', 400);
            }
            // Verify ownership first
            const draft = await DraftService_1.default.getDraftById(draftId, userId);
            if (!draft) {
                throw new AppError_1.AppError('Draft not found or does not belong to user.', 404);
            }
            const updatedDraft = await DraftService_1.default.updateDraftStatus(draftId, client_1.DraftStatus.REJECTED);
            ApiResponse_1.ApiResponse.success(res, updatedDraft, 'Draft rejected successfully.', 200);
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /api/drafts/:id/cancel
     * Cancels a pending or active broadcast.
     */
    async cancelDraft(req, res, next) {
        try {
            const userId = req.user.userId;
            const draftId = parseInt(req.params.id, 10);
            if (isNaN(draftId)) {
                throw new AppError_1.AppError('Invalid draft ID provided.', 400);
            }
            const draft = await DraftService_1.default.getDraftById(draftId, userId);
            if (!draft) {
                throw new AppError_1.AppError('Draft not found or does not belong to user.', 404);
            }
            await DraftService_1.default.cancelBroadcast(draftId, userId);
            ApiResponse_1.ApiResponse.success(res, null, 'Broadcast cancelled successfully.', 200);
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * DELETE /api/drafts/:id
     * Hard deletes a draft.
     */
    async deleteDraft(req, res, next) {
        try {
            const userId = req.user.userId;
            const draftId = parseInt(req.params.id, 10);
            if (isNaN(draftId)) {
                throw new AppError_1.AppError('Invalid draft ID provided.', 400);
            }
            await DraftService_1.default.deleteDraft(draftId, userId);
            ApiResponse_1.ApiResponse.success(res, null, 'Draft deleted successfully.', 200);
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /api/drafts/broadcast/launch
     * Launches a broadcast to specific contacts for all approved drafts.
     */
    async launchBroadcast(req, res, next) {
        try {
            const userId = req.user.userId;
            const { contactIds, delaySeconds } = req.body;
            if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
                throw new AppError_1.AppError('A valid array of contactIds is required.', 400);
            }
            if (typeof delaySeconds !== 'number' || delaySeconds < 1) {
                throw new AppError_1.AppError('A valid delaySeconds (>= 1) is required.', 400);
            }
            await DraftService_1.default.launchBroadcast(userId, contactIds, delaySeconds);
            ApiResponse_1.ApiResponse.success(res, null, 'Broadcast launched successfully for selected contacts.', 200);
        }
        catch (err) {
            next(err);
        }
    }
}
exports.DraftController = DraftController;
exports.default = new DraftController();
