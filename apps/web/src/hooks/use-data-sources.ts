import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { DataSourceRecord } from '@datascriba/shared-types'
import { apiClient } from '@/lib/api-client'

const QUERY_KEY = ['dataSources'] as const

interface CreateDataSourcePayload {
  name: string
  host: string
  port: number
  database: string
  username: string
  password: string
  encrypt?: boolean
  trustServerCertificate?: boolean
  connectionTimeoutMs?: number
  queryTimeoutMs?: number
}

export function useDataSources() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => apiClient.get<DataSourceRecord[]>('/data-sources'),
  })
}

export function useDataSource(id: string) {
  return useQuery({
    queryKey: [...QUERY_KEY, id],
    queryFn: () => apiClient.get<DataSourceRecord>(`/data-sources/${id}`),
    enabled: Boolean(id),
  })
}

export function useCreateDataSource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateDataSourcePayload) =>
      apiClient.post<DataSourceRecord>('/data-sources', payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useUpdateDataSource(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: Partial<CreateDataSourcePayload>) =>
      apiClient.put<DataSourceRecord>(`/data-sources/${id}`, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useDeleteDataSource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<void>(`/data-sources/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useTestDataSource() {
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post<{ success: boolean; latencyMs: number }>(`/data-sources/${id}/test`, {}),
  })
}
