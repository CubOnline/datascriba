import { z } from 'zod'

const HEX_64 = /^[0-9a-fA-F]{64}$/

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  API_HOST: z.string().default('0.0.0.0'),
  FRONTEND_URL: z.string().url().optional(),
  ENCRYPTION_MASTER_KEY: z
    .string()
    .regex(HEX_64, 'ENCRYPTION_MASTER_KEY must be a 64-character hex string (32 bytes)'),
  /** Anthropic API anahtarı — AI özellikleri için zorunlu */
  ANTHROPIC_API_KEY: z.string().min(1, 'ANTHROPIC_API_KEY is required'),
  /** Kullanılacak Claude modeli. Varsayılan: claude-sonnet-4-6 */
  AI_MODEL: z.string().default('claude-sonnet-4-6'),
  /** AI endpoint başına dakikada maksimum istek sayısı */
  AI_RATE_LIMIT_RPM: z.coerce.number().int().min(1).default(10),
  // Auth
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  ADMIN_EMAIL: z.string().email().default('admin@datascriba.com'),
  ADMIN_PASSWORD_HASH: z.string().min(1, 'ADMIN_PASSWORD_HASH is required'),
  // Queue / Redis
  REDIS_HOST: z.string().default('127.0.0.1'),
  REDIS_PORT: z.coerce.number().int().min(1).max(65535).default(6379),
  REDIS_PASSWORD: z.string().optional(),
  // SMTP (optional — e-posta bildirim ozelligi)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().email().optional(),
})

export type Env = z.infer<typeof envSchema>

/**
 * Validates process.env at startup. Exits with code 1 if any required
 * variable is missing or malformed. App refuses to start on failure.
 */
export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env)
  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')
    process.stderr.write(`Environment validation failed:\n${formatted}\n`)
    process.exit(1)
  }
  return result.data
}

/**
 * Exported parsed env — call validateEnv() first in main.ts.
 * Tests can set process.env before importing this module.
 */
export const env: Env = (() => {
  const result = envSchema.safeParse(process.env)
  if (result.success) return result.data
  return {
    NODE_ENV: 'development',
    API_PORT: 3001,
    API_HOST: '0.0.0.0',
    ENCRYPTION_MASTER_KEY: process.env['ENCRYPTION_MASTER_KEY'] ?? '',
    ANTHROPIC_API_KEY: process.env['ANTHROPIC_API_KEY'] ?? '',
    AI_MODEL: process.env['AI_MODEL'] ?? 'claude-sonnet-4-6',
    AI_RATE_LIMIT_RPM: 10,
    JWT_SECRET: process.env['JWT_SECRET'] ?? '',
    ADMIN_EMAIL: process.env['ADMIN_EMAIL'] ?? 'admin@datascriba.com',
    ADMIN_PASSWORD_HASH: process.env['ADMIN_PASSWORD_HASH'] ?? '',
    REDIS_HOST: process.env['REDIS_HOST'] ?? '127.0.0.1',
    REDIS_PORT: 6379,
    REDIS_PASSWORD: process.env['REDIS_PASSWORD'],
    SMTP_HOST: process.env['SMTP_HOST'],
    SMTP_PORT: 587,
    SMTP_USER: process.env['SMTP_USER'],
    SMTP_PASS: process.env['SMTP_PASS'],
    SMTP_FROM: process.env['SMTP_FROM'],
  } as Env
})()
