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
  // Cot (List) chua the moi. Neu khong truyen, backend xep vao cot dau tien cua du an.
  listId: z.string().min(1).optional(),
  assigneeId: z.string().min(1).optional(),
  priority: taskPriorityEnum.optional(),
  startDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
  estimatedHours: z.number().nonnegative('Gio du kien khong the am').optional(),
});

// Keo tha the tren bang: chuyen the sang cot listId, chen vao vi tri position
export const moveTaskSchema = z.object({
  listId: z.string().min(1, 'Thieu cot dich'),
  position: z
    .number()
    .int('Vi tri phai la so nguyen')
    .min(0, 'Vi tri khong hop le'),
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
    // Luu y: z.null() phai dat TRUOC z.coerce.date() trong union.
    // Ly do: z.coerce.date() goi new Date(null) va JS tra ve epoch (1970-01-01)
    // thay vi bao loi, nen se "nuot" gia tri null truoc khi toi luot z.null().
    startDate: z.union([z.null(), z.coerce.date()]).optional(),
    dueDate: z.union([z.null(), z.coerce.date()]).optional(),
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

export const taskQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  status: taskStatusEnum.optional(),
  priority: taskPriorityEnum.optional(),
  assigneeId: z.string().min(1).optional(),
  sortBy: z.enum(['dueDate', 'createdAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type MoveTaskInput = z.infer<typeof moveTaskSchema>;
export type TaskQueryInput = z.infer<typeof taskQuerySchema>;
