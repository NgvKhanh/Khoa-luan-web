import dotenv from 'dotenv';

// Doc file .env va nap vao process.env
dotenv.config();

/**
 * Lay 1 bien moi truong dang chuoi.
 * - Neu khong co va cung khong co gia tri mac dinh -> nem loi ngay khi khoi dong.
 */
function getString(key: string, defaultValue?: string): string {
  const value = process.env[key];

  if (value === undefined || value.trim() === '') {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(
      `Thieu bien moi truong bat buoc: ${key}. Hay tao file .env tu .env.example.`
    );
  }

  return value.trim();
}

/**
 * Lay 1 bien moi truong dang so nguyen duong (dung cho PORT).
 */
function getPort(key: string, defaultValue: number): number {
  const raw = process.env[key];

  if (raw === undefined || raw.trim() === '') {
    return defaultValue;
  }

  const parsed = Number(raw);

  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(
      `Bien moi truong ${key} phai la so nguyen tu 1 den 65535, dang nhan duoc: "${raw}"`
    );
  }

  return parsed;
}

const nodeEnv = getString('NODE_ENV', 'development');
const allowedNodeEnv = ['development', 'production', 'test'];

if (!allowedNodeEnv.includes(nodeEnv)) {
  throw new Error(
    `NODE_ENV phai la mot trong: ${allowedNodeEnv.join(', ')}. Dang nhan duoc: "${nodeEnv}"`
  );
}

export const env = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: getPort('PORT', 4000),
  /** Danh sach domain frontend duoc phep goi API */
  corsOrigins: getString('CORS_ORIGIN', 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0),
  /** Chuoi ket noi PostgreSQL, bat buoc phai co */
  databaseUrl: getString('DATABASE_URL'),
  /** Khoa bi mat de ky JWT, bat buoc phai co va nen du dai/kho doan */
  jwtSecret: getString('JWT_SECRET'),
  /** Thoi gian song cua JWT, vi du "7d", "1h" */
  jwtExpiresIn: getString('JWT_EXPIRES_IN', '7d'),
  /**
   * Access Key cua Unsplash (https://unsplash.com/oauth/applications).
   * Dung cho thu vien anh nen bang. Khong bat buoc: neu de trong thi
   * API /api/unsplash tra ve 503 va frontend chi hien mau/gradient.
   */
  unsplashAccessKey: getString('UNSPLASH_ACCESS_KEY', ''),
  /**
   * Cau hinh gui email (quen mat khau, xac minh email).
   * Neu SMTP_HOST de trong -> backend tu dung Ethereal (mail ao, co link xem truoc).
   */
  mail: {
    host: getString('SMTP_HOST', ''),
    port: getPort('SMTP_PORT', 587),
    user: getString('SMTP_USER', ''),
    pass: getString('SMTP_PASS', ''),
    from: getString('MAIL_FROM', 'TaskFlow <no-reply@taskflow.local>'),
  },
  /** URL frontend, dung de tao link trong noi dung email. */
  frontendUrl: getString('FRONTEND_URL', 'http://localhost:5173'),
};
