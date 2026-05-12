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
  // During module load we return a best-effort parse (may have defaults).
  // The authoritative validation and exit happens in validateEnv() at bootstrap.
  if (result.success) return result.data
  // Provide safe defaults so module loading doesn't crash during tests
  return {
    NODE_ENV: 'development',
    API_PORT: 3001,
    API_HOST: '0.0.0.0',
    ENCRYPTION_MASTER_KEY: process.env['ENCRYPTION_MASTER_KEY'] ?? '',
  } as Env
})()
