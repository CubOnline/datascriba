/**
 * Report-domain types shared across packages.
 * These are copied (not re-exported) from @datascriba/report-engine
 * to avoid a circular dependency between shared-types and report-engine.
 */

export type ExportFormat = 'csv' | 'excel'

export type ReportParameterType =
  | 'string'
  | 'number'
  | 'date'
  | 'dateRange'
  | 'select'
  | 'multiSelect'
  | 'boolean'

export interface ReportParameter {
  name: string
  type: ReportParameterType
  label: string
  required: boolean
  defaultValue?: unknown
  options?: Array<{ label: string; value: unknown }>
  dependsOn?: string[]
}

export interface ReportDefinition {
  id: string
  workspaceId: string
  name: string
  description?: string
  dataSourceId: string
  query: string
  parameters: ReportParameter[]
  exportFormats: ExportFormat[]
  version: number
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export type RunStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface RunRecord {
  id: string
  reportId: string
  status: RunStatus
  format: ExportFormat
  parameters: Record<string, unknown>
  startedAt: Date
  completedAt?: Date
  errorMessage?: string
  outputPath?: string
}
