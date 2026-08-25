import { z } from 'zod';

export const createCommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Noi dung binh luan khong duoc de trong')
    .max(3000, 'Noi dung binh luan qua dai'),
  parentId: z.string().min(1).optional(),
});

export const updateCommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Noi dung binh luan khong duoc de trong')
    .max(3000, 'Noi dung binh luan qua dai'),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
