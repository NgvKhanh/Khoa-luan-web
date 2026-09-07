import rateLimit from 'express-rate-limit';

/**
 * Gioi han so lan goi cac endpoint "nhay cam" theo dia chi IP.
 * Dung cho: quen mat khau, gui lai mail xac minh... de tranh bi lam dung
 * gui mail hang loat.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phut
  limit: 10, // toi da 10 lan / IP / 15 phut
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Ban thao tac qua nhieu lan. Vui long thu lai sau it phut.',
  },
});
