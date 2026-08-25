import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

export interface JwtPayload {
  userId: string;
}

/** Ky 1 JWT chua userId, dung khi dang nhap/dang ky thanh cong. */
export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  } as SignOptions);
}

/**
 * Xac minh JWT. Nem loi neu token khong hop le hoac het han,
 * noi goi phai tu bat loi nay (asyncHandler se chuyen ve middleware loi).
 */
export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwtSecret) as JwtPayload;
}
