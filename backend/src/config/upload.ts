import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { AppError } from '../utils/AppError';

// Thu muc luu file tai len (nam ngoai src, khong commit len git)
export const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');
const BOARD_BG_DIR = path.join(UPLOAD_ROOT, 'boards');

fs.mkdirSync(BOARD_BG_DIR, { recursive: true });

// Chi cho phep vai dinh dang anh; suy ra duoi file tu mime de khong tin ten goc
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, BOARD_BG_DIR),
  filename: (_req, file, cb) => {
    const ext = MIME_TO_EXT[file.mimetype] ?? '';
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const boardBackgroundUpload = multer({
  storage,
  limits: { fileSize: MAX_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (MIME_TO_EXT[file.mimetype]) {
      cb(null, true);
    } else {
      cb(new AppError('Chi chap nhan anh JPG, PNG, WEBP hoac GIF', 400));
    }
  },
});

/**
 * Middleware nhan 1 file o field "image", da chuyen loi cua Multer
 * thanh AppError de tra ve JSON thong nhat (400) thay vi 500 kho hieu.
 */
export function uploadBoardBackground(
  req: Request,
  res: Response,
  next: NextFunction
) {
  boardBackgroundUpload.single('image')(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      next(new AppError('Anh qua lon (toi da 5MB)', 400));
      return;
    }
    next(err instanceof AppError ? err : new AppError('Tai anh len that bai', 400));
  });
}

// Duong dan cong khai (luu vao DB) tu ten file
export function boardBackgroundPublicPath(filename: string): string {
  return `/uploads/boards/${filename}`;
}

// Xoa file anh nen cu tren dia (bo qua neu khong con)
export function removeBoardBackgroundFile(publicPath: string | null): void {
  if (!publicPath) return;
  const filename = path.basename(publicPath);
  const fullPath = path.join(BOARD_BG_DIR, filename);
  fs.promises.unlink(fullPath).catch(() => {
    // File co the da bi xoa truoc do -> bo qua
  });
}
