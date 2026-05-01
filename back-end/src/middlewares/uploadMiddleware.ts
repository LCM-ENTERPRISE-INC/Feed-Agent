import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { Request } from 'express';
import { AppError } from '../utils/AppError';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// Ensure the uploads directory exists on startup
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// Multer Storage Engine
// ─────────────────────────────────────────────────────────────────────────────

const storage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req: Request, file: Express.Multer.File, cb) => {
    // Generate a unique, safe filename: timestamp-random.ext
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// File Filter & Validation
// ─────────────────────────────────────────────────────────────────────────────

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'application/pdf'];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError(`Invalid file type: ${file.mimetype}. Allowed types are: JPEG, PNG, PDF.`, 415) as any, false);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exported Middleware instances
// ─────────────────────────────────────────────────────────────────────────────

export const uploadMiddleware = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter,
});

/**
 * Middleware for single file upload (news source image/pdf).
 * Form field name must be "file".
 */
export const uploadNewsSource = uploadMiddleware.single('file');
