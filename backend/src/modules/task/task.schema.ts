import { z } from 'zod';

const taskStatusEnum = z.enum(['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'BLOCKED']);
const taskPriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);

export const createTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, 'Tieu de phai co it nhat 2 ky tu')
    .max(200, 'Tieu de qua dai'),
  description: z.string().trim().max(5000, 'Mo ta qua dai').optional(),
  assigneeId: z.string().min(1).optional(),
  priority: taskPriorityEnum.optional(),
  startDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
  estimatedHours: z.number().nonnegative('Gio du kien khong the am').optional(),
});

export const updateTaskSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(2, 'Tieu de phai co it nhat 2 ky tu')
      .max(200, 'Tieu de qua dai')
      .optional(),
    description: z
      .union([z.string().trim().max(5000, 'Mo ta qua dai'), z.null()])
      .optional(),
    assigneeId: z.union([z.string().min(1), z.null()]).optional(),
    status: taskStatusEnum.optional(),
    priority: taskPriorityEnum.optional(),
    startDate: z.union([z.coerce.date(), z.null()]).optional(),
    dueDate: z.union([z.coerce.date(), z.null()]).optional(),
    progress: z
      .number()
      .int('Tien do phai la so nguyen')
      .min(0, 'Tien do toi thieu la 0')
      .max(100, 'Tien do toi da la 100')
      .optional(),
    estimatedHours: z
      .union([z.number().nonnegative('Gio du kien khong the am'), z.null()])
      .optional(),
    actualHours: z
      .union([z.number().nonnegative('Gio thuc te khong the am'), z.null()])
      .optional(),
    blockedReason: z
      .union([z.string().trim().max(500, 'Ly do qua dai'), z.null()])
      .optional(),
  })
  .refine(
    (data) => !(data.status === 'BLOCKED' && data.blockedReason === null),
    {
      message: 'Vui long nhap ly do khi danh dau cong viec la Bi chan',
      path: ['blockedReason'],
    }
  );

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
