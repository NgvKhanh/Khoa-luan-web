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
};
