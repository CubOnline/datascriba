import type { QueueOptions, WorkerOptions } from 'bullmq'
import Redis from 'ioredis'

export const QUEUE_NAME = 'report-jobs' as const

interface RedisConfig {
  host: string
  port: number
  password?: string
}

/**
 * Creates a shared IORedis connection instance.
 * Caller is responsible for connection lifecycle.
 */
export function createRedisConnection(config: RedisConfig): Redis {
  return new Redis({
    host: config.host,
    port: config.port,
    password: config.password,
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,    // Required by BullMQ
  })
}

/**
 * BullMQ Queue options — used in apps/api (producer side).
 */
export function createQueueOptions(config: RedisConfig): QueueOptions {
  return {
    connection: createRedisConnection(config),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5_000,
      },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    },
  }
}

/**
 * BullMQ Worker options — used in apps/worker (consumer side).
 */
export function createWorkerOptions(config: RedisConfig): WorkerOptions {
  return {
    connection: createRedisConnection(config),
    concurrency: 5,
  }
}
