import type { ExportFormat } from './report'

export interface ScheduleDefinition {
  id: string
  reportId: string
  cronExpression: string
  format: ExportFormat
  parameters: Record<string, unknown>
  enabled: boolean
  notifyEmail?: string
  lastRunAt?: Date
  nextRunAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface CreateScheduleRequest {
  reportId: string
  cronExpression: string
  format: ExportFormat
  parameters?: Record<string, unknown>
  notifyEmail?: string
  enabled?: boolean
}

export interface UpdateScheduleRequest {
  cronExpression?: string
  format?: ExportFormat
  parameters?: Record<string, unknown>
  notifyEmail?: string
  enabled?: boolean
}
