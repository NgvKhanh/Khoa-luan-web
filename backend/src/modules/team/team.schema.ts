import { z } from 'zod';

export const createTeamSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Ten nhom phai co it nhat 2 ky tu')
    .max(100, 'Ten nhom qua dai'),
  description: z
    .string()
    .trim()
    .max(500, 'Mo ta qua dai')
    .optional(),
});

export const updateTeamSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Ten nhom phai co it nhat 2 ky tu')
    .max(100, 'Ten nhom qua dai')
    .optional(),
  description: z
    .union([z.string().trim().max(500, 'Mo ta qua dai'), z.null()])
    .optional(),
});

export const addTeamMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email khong hop le'),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(['LEADER', 'MEMBER']),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
export type AddTeamMemberInput = z.infer<typeof addTeamMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
