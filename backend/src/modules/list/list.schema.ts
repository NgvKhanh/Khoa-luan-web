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
    // Vi tri dich (chi so tu 0) khi keo sap xep lai cot tren bang
    position: z
      .number()
      .int('Vi tri phai la so nguyen')
      .min(0, 'Vi tri khong hop le')
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Khong co du lieu nao de cap nhat',
  });

export type CreateListInput = z.infer<typeof createListSchema>;
export type UpdateListInput = z.infer<typeof updateListSchema>;
