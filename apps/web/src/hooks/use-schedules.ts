import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ScheduleDefinition, CreateScheduleRequest, UpdateScheduleRequest } from '@datascriba/shared-types'
import { apiClient } from '@/lib/api-client'

const QUERY_KEY = ['schedules'] as const

export function useSchedules() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => apiClient.get<ScheduleDefinition[]>('/schedules'),
  })
}

export function useSchedule(id: string) {
  return useQuery({
    queryKey: [...QUERY_KEY, id],
    queryFn: () => apiClient.get<ScheduleDefinition>(`/schedules/${id}`),
    enabled: Boolean(id),
  })
}

export function useCreateSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateScheduleRequest) =>
      apiClient.post<ScheduleDefinition>('/schedules', payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useUpdateSchedule(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateScheduleRequest) =>
      apiClient.put<ScheduleDefinition>(`/schedules/${id}`, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useDeleteSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<void>(`/schedules/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useTriggerSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.post<{ jobId: string }>(`/schedules/${id}/trigger`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useToggleSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      apiClient.put<ScheduleDefinition>(`/schedules/${id}`, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}
