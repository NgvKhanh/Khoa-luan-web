import { z } from 'zod';
import { weightIssues } from './assign.weights';

// Zod cho REQUEST BODY cua module goi y phan cong. Quy tac khoang gia tri / tong = 1 nam o assign.weights.ts
// (mot noi duy nhat, dung chung voi service va - o buoc 6 - bo hoc trong so).

export const outcomeSchema = z.object({
  /** Nguoi thuc su duoc giao. Server kiem tra nguoi nay dang o trong the (khong tin client). */
  chosenUserId: z.string().trim().min(1, 'Thieu nguoi duoc chon').max(100, 'Ma nguoi dung qua dai'),
});
export type OutcomeInput = z.infer<typeof outcomeSchema>;

export const weightsSchema = z
  .object({
    experience: z.number(),
    reliability: z.number(),
    availability: z.number(),
  })
  .superRefine((w, ctx) => {
    for (const issue of weightIssues(w)) {
      ctx.addIssue({ code: 'custom', message: issue.message, path: [issue.path] });
    }
  });
export type WeightsInput = z.infer<typeof weightsSchema>;
