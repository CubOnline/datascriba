import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ReportDefinition, RunRecord } from '@datascriba/shared-types'
import { apiClient } from '@/lib/api-client'

const QUERY_KEY = ['reports'] as const

interface ReportParameterPayload {
  name: string
  type: string
  label: string
  required: boolean
  defaultValue?: unknown
  options?: Array<{ label: string; value: unknown }>
  dependsOn?: string[]
}

interface CreateReportPayload {
  name: string
  dataSourceId: string
  query: string
  description?: string
  parameters?: ReportParameterPayload[]
  exportFormats: string[]
}

interface RunReportPayload {
  format: 'csv' | 'excel'
  parameters?: Record<string, unknown>
}

export function useReports() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => apiClient.get<ReportDefinition[]>('/reports'),
  })
}

export function useReport(id: string) {
  return useQuery({
    queryKey: [...QUERY_KEY, id],
    queryFn: () => apiClient.get<ReportDefinition>(`/reports/${id}`),
    enabled: Boolean(id),
  })
}

export function useCreateReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateReportPayload) =>
      apiClient.post<ReportDefinition>('/reports', payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useUpdateReport(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: Partial<CreateReportPayload>) =>
      apiClient.put<ReportDefinition>(`/reports/${id}`, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useDeleteReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<void>(`/reports/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useRunReport() {
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: RunReportPayload }) =>
      apiClient.postRaw(`/reports/${id}/run`, payload),
  })
}

export function useReportRuns(reportId: string) {
  return useQuery({
    queryKey: [...QUERY_KEY, reportId, 'runs'],
    queryFn: () => apiClient.get<RunRecord[]>(`/reports/${reportId}/runs`),
    enabled: Boolean(reportId),
  })
}
