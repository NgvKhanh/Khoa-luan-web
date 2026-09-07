import { z } from 'zod';

export const createCardSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Noi dung the khong duoc de trong')
    .max(500, 'Noi dung the qua dai'),
});

export const updateCardSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Noi dung the khong duoc de trong')
      .max(500, 'Noi dung the qua dai')
      .optional(),
    description: z
      .union([z.string().trim().max(5000, 'Mo ta qua dai'), z.null()])
      .optional(),
    isDone: z.boolean().optional(),
    // ISO date string, hoac null de bo ngay bat dau / het han
    startDate: z.union([z.string().datetime(), z.null()]).optional(),
    dueDate: z.union([z.string().datetime(), z.null()]).optional(),
    // Anh bia: mau hex hoac null; duong dan anh hoac null
    coverColor: z
      .union([z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Mau khong hop le'), z.null()])
      .optional(),
    coverImageUrl: z
      .union([z.string().trim().max(500), z.null()])
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Khong co du lieu nao de cap nhat',
  });

// Sao chep the
export const copyCardSchema = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  listId: z.string().min(1).optional(),
});

// Keo tha the: chuyen the sang danh sach listId, chen vao vi tri position
export const moveCardSchema = z.object({
  listId: z.string().min(1, 'Thieu danh sach dich'),
  position: z
    .number()
    .int('Vi tri phai la so nguyen')
    .min(0, 'Vi tri khong hop le'),
});

export type CreateCardInput = z.infer<typeof createCardSchema>;
export type UpdateCardInput = z.infer<typeof updateCardSchema>;
export type CopyCardInput = z.infer<typeof copyCardSchema>;
export type MoveCardInput = z.infer<typeof moveCardSchema>;
