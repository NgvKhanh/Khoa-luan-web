import { z } from 'zod';

export const createSubtaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Ten cong viec con khong duoc de trong')
    .max(200, 'Ten cong viec con qua dai'),
});

export const updateSubtaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Ten cong viec con khong duoc de trong')
    .max(200, 'Ten cong viec con qua dai')
    .optional(),
  isDone: z.boolean().optional(),
});

export type CreateSubtaskInput = z.infer<typeof createSubtaskSchema>;
export type UpdateSubtaskInput = z.infer<typeof updateSubtaskSchema>;
