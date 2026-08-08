import dotenv from 'dotenv';
dotenv.config();

/**
 * Centralized Environment Validation and Access
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
      return 'test-jwt-secret-for-vitest';
    }
    throw new Error('FATAL SECURITY ERROR: JWT_SECRET environment variable is not set.');
  }
  return secret;
}

export function getDatabasePassword(): string | undefined {
  return process.env.DB_PASSWORD ?? process.env.POSTGRES_PASSWORD;
}
