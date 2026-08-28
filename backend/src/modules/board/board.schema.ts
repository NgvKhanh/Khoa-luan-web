import { z } from 'zod';

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Mau khong hop le (can dang #RRGGBB)');

export const createBoardSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Ten bang khong duoc de trong')
    .max(100, 'Ten bang qua dai'),
  color: hexColor.optional(),
});

export const updateBoardSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Ten bang khong duoc de trong')
      .max(100, 'Ten bang qua dai')
      .optional(),
    color: hexColor.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Khong co du lieu nao de cap nhat',
  });

export type CreateBoardInput = z.infer<typeof createBoardSchema>;
export type UpdateBoardInput = z.infer<typeof updateBoardSchema>;
