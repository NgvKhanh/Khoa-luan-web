import { z } from 'zod';

export const addBoardMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email khong hop le'),
});

export type AddBoardMemberInput = z.infer<typeof addBoardMemberSchema>;
