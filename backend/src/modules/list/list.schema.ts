import { z } from 'zod';

export const createListSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Ten danh sach khong duoc de trong')
    .max(100, 'Ten danh sach qua dai'),
});

export const updateListSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Ten danh sach khong duoc de trong')
      .max(100, 'Ten danh sach qua dai')
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Khong co du lieu nao de cap nhat',
  });

export type CreateListInput = z.infer<typeof createListSchema>;
export type UpdateListInput = z.infer<typeof updateListSchema>;
