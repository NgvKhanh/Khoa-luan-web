import { z } from 'zod';

// "true"/"false" tu query string -> boolean that (khac z.coerce.boolean(),
// vi chuoi "false" van la truthy nen se bi hieu nham thanh true).
const boolQueryParam = z
  .enum(['true', 'false'])
  .optional()
  .transform((v) => v === 'true');

export const searchCardsQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  assignee: z.enum(['me', 'unassigned']).optional(),
  labelName: z.string().trim().max(100).optional(),
  status: z.enum(['all', 'active', 'done']).default('all'),
  overdue: boolQueryParam,
  dueFrom: z.string().datetime().optional(),
  dueTo: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});
export type SearchCardsQuery = z.infer<typeof searchCardsQuerySchema>;

// Cung 1 bo tham so, nhung dung khi LUU bo loc (khong co "page" - luu bo
// loc la luu dieu kien, khong luu vi tri trang dang xem).
export const savedFilterParamsSchema = z.object({
  q: z.string().trim().max(200).optional(),
  assignee: z.enum(['me', 'unassigned']).optional(),
  labelName: z.string().trim().max(100).optional(),
  status: z.enum(['all', 'active', 'done']).optional(),
  overdue: z.boolean().optional(),
  dueFrom: z.string().datetime().optional(),
  dueTo: z.string().datetime().optional(),
});
export type SavedFilterParams = z.infer<typeof savedFilterParamsSchema>;

export const createSavedFilterSchema = z.object({
  name: z.string().trim().min(1, 'Thieu ten bo loc').max(60),
  params: savedFilterParamsSchema,
});
export type CreateSavedFilterInput = z.infer<typeof createSavedFilterSchema>;
