import { z } from 'zod';

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Mau khong hop le (can dang #RRGGBB)');

// URL anh nen (vd anh tu Unsplash). Chi nhan http(s).
const imageUrl = z
  .string()
  .trim()
  .regex(/^https?:\/\//, 'URL anh nen khong hop le')
  .max(2048);

export const createBoardSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Ten bang khong duoc de trong')
    .max(100, 'Ten bang qua dai'),
  color: hexColor.optional(),
  backgroundImage: imageUrl.optional(),
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
    // string -> doi sang anh nen moi; null -> bo anh nen, quay ve mau
    backgroundImage: imageUrl.nullable().optional(),
    visibility: z.enum(['PRIVATE', 'WORKSPACE', 'PUBLIC']).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Khong co du lieu nao de cap nhat',
  });

export type CreateBoardInput = z.infer<typeof createBoardSchema>;
export type UpdateBoardInput = z.infer<typeof updateBoardSchema>;
