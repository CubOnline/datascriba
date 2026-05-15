import { z } from 'zod'

/**
 * Type-safe payload for the RunReport BullMQ job.
 * Both API (producer) and Worker (consumer) import this schema.
 */
export const RunReportJobSchema = z.object({
  scheduleId: z.string().uuid(),
  reportId: z.string().uuid(),
  format: z.enum(['csv', 'excel']),
  parameters: z.record(z.string(), z.unknown()).default({}),
  notifyEmail: z.string().email().optional(),
  triggeredBy: z.enum(['scheduler', 'manual']),
  triggeredAt: z.string().datetime(),
})

export type RunReportJobPayload = z.infer<typeof RunReportJobSchema>
