import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import contactService from '../services/ContactService';
import { parseCsvContacts } from '../utils/csvParser';
import { ApiResponse } from '../utils/ApiResponse';
import { AppError } from '../utils/AppError';

// ─────────────────────────────────────────────────────────────────────────────
// Multer configuration — memory storage, CSV only, max 2 MB
// ─────────────────────────────────────────────────────────────────────────────

export const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new AppError('Only .csv files are allowed.', 415) as unknown as null, false);
    }
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// ContactController
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handles HTTP transport for Contact CRUD and bulk-import operations.
 * Every handler extracts `userId` from `req.user` (set by authMiddleware),
 * ensuring strict per-tenant data isolation at the controller level.
 */
export class ContactController {
  /**
   * POST /api/contacts
   * Creates a new contact. Validates and sanitizes the phone number.
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { phoneNumber, name } = req.body;

      if (!phoneNumber || !name) {
        return next(new AppError('phoneNumber and name are required.', 400));
      }

      const contact = await contactService.create({ userId, phoneNumber, name });
      ApiResponse.success(res, contact, 'Contact created successfully.', 201);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/contacts?page=1&limit=20&onlyActive=true
   * Returns a paginated list of contacts for the authenticated user.
   */
  async findAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId     = req.user!.userId;
      const onlyActive = req.query.onlyActive === 'true';

      const page  = Math.max(1, parseInt(String(req.query.page  || '1'),  10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));

      const result = await contactService.findAllByUser(userId, { page, limit }, onlyActive);
      ApiResponse.success(res, result, 'Contacts retrieved successfully.');
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /api/contacts/:id
   * Updates a contact's name and/or active status.
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const id     = parseInt(String(req.params.id), 10);

      if (isNaN(id)) return next(new AppError('Invalid contact ID.', 400));

      const { name, active } = req.body;
      const contact = await contactService.update(id, userId, { name, active });
      ApiResponse.success(res, contact, 'Contact updated successfully.');
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/contacts/:id
   * Permanently removes a contact.
   */
  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const id     = parseInt(String(req.params.id), 10);

      if (isNaN(id)) return next(new AppError('Invalid contact ID.', 400));

      await contactService.remove(id, userId);
      ApiResponse.success(res, null, 'Contact deleted successfully.');
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/contacts/import
   * Accepts a multipart CSV file and bulk-imports contacts.
   * Returns a summary of imported, skipped, and errored rows.
   */
  async importCsv(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;

      if (!req.file) {
        return next(new AppError('No CSV file uploaded.', 400));
      }

      let rows: Array<{ name: string; phoneNumber: string }>;
      try {
        rows = parseCsvContacts(req.file.buffer);
      } catch (e: unknown) {
        return next(new AppError((e as Error).message, 422));
      }

      if (rows.length === 0) {
        return next(new AppError('CSV file contains no valid data rows.', 422));
      }

      const summary = await contactService.bulkCreate(userId, rows);
      ApiResponse.success(res, summary, 'CSV import completed.', 201);
    } catch (err) {
      next(err);
    }
  }
}

export default new ContactController();
