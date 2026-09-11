import rateLimit from 'express-rate-limit';

/**
 * Gioi han so lan goi cac endpoint "nhay cam" theo dia chi IP.
 * Dung cho: quen mat khau, gui lai mail xac minh... de tranh bi lam dung
 * gui mail hang loat.
 */
const TOO_MANY = {
  success: false,
  message: 'Ban thao tac qua nhieu lan. Vui long thu lai sau it phut.',
};

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phut
  limit: 10, // toi da 10 lan / IP / 15 phut
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: TOO_MANY,
});

/**
 * Chan do mat khau: gioi han so lan goi /login theo IP.
 * Noi long hon authLimiter mot chut de tranh khoa nham nguoi dung that
 * (nhieu nguoi cung mot mang NAT), nhung van chan duoc kieu dò tu dong.
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phut
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true, // dang nhap dung thi khong tinh vao han muc
  message: TOO_MANY,
});

/**
 * Chan tao tai khoan / gui email xac minh hang loat tu mot IP.
 */
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 gio
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: TOO_MANY,
});

/**
 * Endpoint xem bang CONG KHAI: khong doi hoi dang nhap (ai co link deu goi
 * duoc) nen de mo hon nhung van gioi han theo IP de tranh cao du lieu hang loat.
 */
export const publicBoardLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 phut
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: TOO_MANY,
});
