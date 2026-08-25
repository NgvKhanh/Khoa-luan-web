import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

/**
 * Tao middleware validate req.body theo 1 Zod schema.
 * Neu du lieu sai, tra loi 400 kem danh sach loi cu the tung truong
 * (thay vi de loi roi xuong tang database/logic gay crash kho hieu).
 */
export function validateBody(schema: z.ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        success: false,
        message: 'Du lieu gui len khong hop le',
        errors: result.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
      return;
    }

    req.body = result.data;
    next();
  };
}
