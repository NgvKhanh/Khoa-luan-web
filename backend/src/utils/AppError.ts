/**
 * Loi nghiep vu co ma trang thai HTTP cu the (vi du 400, 401, 404).
 * Dung de phan biet voi loi he thong khong luong truoc duoc (mac dinh tra 500).
 */
export class AppError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}
