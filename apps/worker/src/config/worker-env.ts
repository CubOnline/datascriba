import { z } from 'zod'

const workerEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  REDIS_HOST: z.string().default('127.0.0.1'),
  REDIS_PORT: z.coerce.number().int().min(1).max(65535).default(6379),
  REDIS_PASSWORD: z.string().optional(),
  /** URL of the API service — worker uses this to fetch report definitions */
  INTERNAL_API_URL: z.string().url().default('http://localhost:3001'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().email().optional(),
  /** Master encryption key — needed to decrypt data-source credentials */
  ENCRYPTION_MASTER_KEY: z.string().min(64),
})

export type WorkerEnv = z.infer<typeof workerEnvSchema>

export function validateWorkerEnv(): WorkerEnv {
  const result = workerEnvSchema.safeParse(process.env)
  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')
    process.stderr.write(`Worker environment validation failed:\n${formatted}\n`)
    process.exit(1)
  }
  return result.data
}
