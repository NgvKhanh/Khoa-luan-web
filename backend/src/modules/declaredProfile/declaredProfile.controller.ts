import type { Request, Response } from 'express';
import { trustedCvContentType } from '../../config/upload';
import { AppError } from '../../utils/AppError';
import { asyncHandler } from '../../utils/asyncHandler';
import type { DeclaredProfileInput } from './declaredProfile.schema';
import {
  cvFileFor,
  deleteMyCv,
  getMyDeclaredProfile,
  saveMyDeclaredProfile,
  uploadMyCv,
} from './declaredProfile.service';

function requireUserId(req: Request): string {
  if (!req.user) throw new AppError('Ban chua dang nhap', 401);
  return req.user.id;
}

export const getMyProfileHandler = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await getMyDeclaredProfile(requireUserId(req)) });
});

export const putMyProfileHandler = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await saveMyDeclaredProfile(requireUserId(req), req.body as DeclaredProfileInput) });
});

export const uploadCvHandler = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await uploadMyCv(requireUserId(req), req.file) });
});

export const deleteCvHandler = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await deleteMyCv(requireUserId(req)) });
});

/**
 * Tai tep CV (cua chinh minh, hoac cua thanh vien khi minh la OWNER/ADMIN khong gian chung). LUON tai xuong (attachment), Content-Type
 * suy tu duoi tep TREN DIA (do may chu dat theo loai noi dung that), nosniff, khong luu dem - mau attachment.serve.ts.
 */
function sendCv(targetOf: (req: Request) => string) {
  return asyncHandler(async (req: Request, res: Response) => {
    const file = await cvFileFor(requireUserId(req), targetOf(req));
    res.setHeader('Content-Type', trustedCvContentType(file.storedName));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`);
    res.sendFile(file.diskPath);
  });
}

export const downloadMyCvHandler = sendCv((req) => requireUserId(req));
export const downloadUserCvHandler = sendCv((req) => req.params.userId as string);
