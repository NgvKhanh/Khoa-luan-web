import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { AppError } from '../utils/AppError';

// Thu muc luu file tai len (nam ngoai src, khong commit len git)
export const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');
const BOARD_BG_DIR = path.join(UPLOAD_ROOT, 'boards');
const CARD_ATTACH_DIR = path.join(UPLOAD_ROOT, 'cards');
const AVATAR_DIR = path.join(UPLOAD_ROOT, 'avatars');

fs.mkdirSync(BOARD_BG_DIR, { recursive: true });
fs.mkdirSync(CARD_ATTACH_DIR, { recursive: true });
fs.mkdirSync(AVATAR_DIR, { recursive: true });

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

// ===================== ANH DAI DIEN =====================

const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2MB

const avatarUploadMw = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, AVATAR_DIR),
    filename: (_req, file, cb) => {
      const ext = MIME_TO_EXT[file.mimetype] ?? '';
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: AVATAR_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (MIME_TO_EXT[file.mimetype]) {
      cb(null, true);
    } else {
      cb(new AppError('Chỉ chấp nhận ảnh JPG, PNG, WEBP hoặc GIF', 400));
    }
  },
});

export function uploadAvatar(req: Request, res: Response, next: NextFunction) {
  avatarUploadMw.single('image')(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      next(new AppError('Ảnh quá lớn (tối đa 2MB)', 400));
      return;
    }
    next(err instanceof AppError ? err : new AppError('Tải ảnh lên thất bại', 400));
  });
}

export function avatarPublicPath(filename: string): string {
  return `/uploads/avatars/${filename}`;
}

export function removeAvatarFile(publicPath: string | null): void {
  if (!publicPath || !publicPath.startsWith('/uploads/avatars/')) return;
  fs.promises
    .unlink(path.join(AVATAR_DIR, path.basename(publicPath)))
    .catch(() => {});
}

// ===================== TEP DINH KEM CUA THE =====================

const ATTACH_MAX_BYTES = 10 * 1024 * 1024; // 10MB
const ATTACH_ALLOWED_EXT = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.pdf',
  '.txt',
  '.csv',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.zip',
]);

const cardAttachmentUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, CARD_ATTACH_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(
        null,
        `${crypto.randomUUID()}${ATTACH_ALLOWED_EXT.has(ext) ? ext : ''}`
      );
    },
  }),
  limits: { fileSize: ATTACH_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ATTACH_ALLOWED_EXT.has(ext)) {
      cb(null, true);
    } else {
      cb(new AppError('Định dạng tệp không được hỗ trợ', 400));
    }
  },
});

export function uploadCardAttachment(
  req: Request,
  res: Response,
  next: NextFunction
) {
  cardAttachmentUpload.single('file')(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      next(new AppError('Tệp quá lớn (tối đa 10MB)', 400));
      return;
    }
    next(err instanceof AppError ? err : new AppError('Tải tệp lên thất bại', 400));
  });
}

export function cardAttachmentPublicPath(filename: string): string {
  return `/uploads/cards/${filename}`;
}

export function removeCardAttachmentFile(publicPath: string | null): void {
  if (!publicPath || !publicPath.startsWith('/uploads/cards/')) return;
  const fullPath = path.join(CARD_ATTACH_DIR, path.basename(publicPath));
  fs.promises.unlink(fullPath).catch(() => {
    // File co the da bi xoa -> bo qua
  });
}

// Xoa file anh nen cu tren dia (bo qua neu khong con)
export function removeBoardBackgroundFile(publicPath: string | null): void {
  if (!publicPath) return;
  // Chi xoa file do minh luu (duong dan /uploads/boards/...). Anh ngoai
  // (vd link Unsplash) khong co file tren dia nen bo qua.
  if (!publicPath.startsWith('/uploads/boards/')) return;
  const filename = path.basename(publicPath);
  const fullPath = path.join(BOARD_BG_DIR, filename);
  fs.promises.unlink(fullPath).catch(() => {
    // File co the da bi xoa truoc do -> bo qua
  });
}
