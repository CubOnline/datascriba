'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Play, Plus, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  useSchedules,
  useDeleteSchedule,
  useTriggerSchedule,
  useToggleSchedule,
} from '@/hooks/use-schedules'
import { CreateScheduleDialog } from './create-schedule-dialog'

export function SchedulesClient() {
  const t = useTranslations('schedule')
  const tc = useTranslations('common')
  const [createOpen, setCreateOpen] = useState(false)

  const { data: schedules, isLoading } = useSchedules()
  const deleteMutation = useDeleteSchedule()
  const triggerMutation = useTriggerSchedule()
  const toggleMutation = useToggleSchedule()

  if (isLoading) return <p className="text-muted-foreground">{tc('loading')}</p>

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {schedules?.length ?? 0} schedule(s)
        </p>
        <Button onClick={() => setCreateOpen(true)} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          {t('createNew')}
        </Button>
      </div>

      {schedules?.length === 0 && (
        <p className="text-center text-muted-foreground py-12">{t('noSchedules')}</p>
      )}

      {schedules && schedules.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('report')}</TableHead>
              <TableHead>{t('cronExpression')}</TableHead>
              <TableHead>{t('format')}</TableHead>
              <TableHead>{t('nextRunAt')}</TableHead>
              <TableHead>{t('lastRunAt')}</TableHead>
              <TableHead>{t('enabled')}</TableHead>
              <TableHead>{tc('actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schedules.map((schedule) => (
              <TableRow key={schedule.id}>
                <TableCell className="font-mono text-xs">{schedule.reportId}</TableCell>
                <TableCell className="font-mono text-xs">{schedule.cronExpression}</TableCell>
                <TableCell className="uppercase text-xs">{schedule.format}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {schedule.nextRunAt
                    ? format(new Date(schedule.nextRunAt), 'yyyy-MM-dd HH:mm')
                    : '—'}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {schedule.lastRunAt
                    ? format(new Date(schedule.lastRunAt), 'yyyy-MM-dd HH:mm')
                    : '—'}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={schedule.enabled}
                    onCheckedChange={(enabled) =>
                      toggleMutation.mutate({ id: schedule.id, enabled })
                    }
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => triggerMutation.mutate(schedule.id)}
                      title={t('trigger')}
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (window.confirm(t('deleteConfirm'))) {
                          deleteMutation.mutate(schedule.id)
                        }
                      }}
                      title={tc('delete')}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <CreateScheduleDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  )
}
