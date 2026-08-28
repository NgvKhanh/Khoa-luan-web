import { z } from 'zod';

export const createProjectSchema = z.object({
  teamId: z.string().min(1, 'Thieu teamId'),
  name: z
    .string()
    .trim()
    .min(2, 'Ten du an phai co it nhat 2 ky tu')
    .max(100, 'Ten du an qua dai'),
  description: z.string().trim().max(500, 'Mo ta qua dai').optional(),
});

export const updateProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Ten du an phai co it nhat 2 ky tu')
    .max(100, 'Ten du an qua dai')
    .optional(),
  description: z
    .union([z.string().trim().max(500, 'Mo ta qua dai'), z.null()])
    .optional(),
});

export const addProjectMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email khong hop le'),
});

export const updateProjectMemberRoleSchema = z.object({
  role: z.enum(['MANAGER', 'MEMBER']),
});

export const starProjectSchema = z.object({
  starred: z.boolean(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type StarProjectInput = z.infer<typeof starProjectSchema>;
export type AddProjectMemberInput = z.infer<typeof addProjectMemberSchema>;
export type UpdateProjectMemberRoleInput = z.infer<
  typeof updateProjectMemberRoleSchema
>;
