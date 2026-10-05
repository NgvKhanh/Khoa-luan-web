import { z } from 'zod';
import { CardStatus } from '../../generated/prisma/enums';

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
    // Doi trang thai the. The dang o cot CO trang thai se tu chuyen sang cot dau
    // tien mang trang thai moi (neu bang co) - xem updateCard().
    status: z.enum(CardStatus, { error: 'Trang thai khong hop le' }).optional(),
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
  })
  // isDone la loi tat cua "status = DONE" -> gui ca hai thi phai khop nhau
  .refine(
    (data) =>
      data.status === undefined ||
      data.isDone === undefined ||
      data.isDone === (data.status === 'DONE'),
    {
      message: 'Trang thai va danh dau hoan thanh mau thuan nhau',
      path: ['isDone'],
    }
  );

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

// Nhac han: chi cho phep vai muc co san (phut truoc dueDate)
export const REMINDER_OFFSETS = [10, 60, 1440] as const;
export const createReminderSchema = z.object({
  offsetMinutes: z.number().int().refine(
    (v) => (REMINDER_OFFSETS as readonly number[]).includes(v),
    'Muc nhac khong hop le'
  ),
});

export type CreateCardInput = z.infer<typeof createCardSchema>;
export type UpdateCardInput = z.infer<typeof updateCardSchema>;
export type CopyCardInput = z.infer<typeof copyCardSchema>;
export type MoveCardInput = z.infer<typeof moveCardSchema>;
export type CreateReminderInput = z.infer<typeof createReminderSchema>;
