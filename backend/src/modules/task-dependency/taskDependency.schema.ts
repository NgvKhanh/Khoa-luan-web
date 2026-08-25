import { z } from 'zod';

export const addDependencySchema = z.object({
  dependsOnTaskId: z.string().min(1, 'Thieu dependsOnTaskId'),
});

export type AddDependencyInput = z.infer<typeof addDependencySchema>;
