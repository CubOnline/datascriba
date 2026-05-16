'use client'

import { useCallback, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCreateSchedule } from '@/hooks/use-schedules'
import { useReports } from '@/hooks/use-reports'

const createScheduleSchema = z.object({
  reportId: z.string().min(1, 'Select a report'),
  cronExpression: z.string().min(9, 'Enter a valid cron expression'),
  format: z.enum(['csv', 'excel']),
  notifyEmail: z.string().email().optional().or(z.literal('')),
})

type CreateScheduleForm = z.infer<typeof createScheduleSchema>

interface CreateScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialReportId?: string
}

export function CreateScheduleDialog({
  open,
  onOpenChange,
  initialReportId,
}: CreateScheduleDialogProps) {
  const t = useTranslations('schedule')
  const tc = useTranslations('common')
  const { data: reports } = useReports()
  const createMutation = useCreateSchedule()

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateScheduleForm>({
    resolver: zodResolver(createScheduleSchema),
    defaultValues: {
      reportId: initialReportId ?? '',
      cronExpression: '0 8 * * 1-5',
      format: 'excel',
    },
  })

  useEffect(() => {
    if (initialReportId) setValue('reportId', initialReportId)
  }, [initialReportId, setValue])

  const onSubmit = useCallback(
    async (data: CreateScheduleForm) => {
      await createMutation.mutateAsync({
        reportId: data.reportId,
        cronExpression: data.cronExpression,
        format: data.format,
        notifyEmail: data.notifyEmail || undefined,
        enabled: true,
      })
      reset()
      onOpenChange(false)
    },
    [createMutation, reset, onOpenChange],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t('createNew')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Report selector */}
          <div className="space-y-1">
            <Label htmlFor="reportId">{t('report')}</Label>
            <Select
              onValueChange={(val) => setValue('reportId', val)}
              defaultValue={initialReportId}
            >
              <SelectTrigger id="reportId">
                <SelectValue placeholder="Select a report" />
              </SelectTrigger>
              <SelectContent>
                {reports?.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.reportId && (
              <p className="text-xs text-destructive">{errors.reportId.message}</p>
            )}
          </div>

          {/* Cron expression */}
          <div className="space-y-1">
            <Label htmlFor="cronExpression">{t('cronExpression')}</Label>
            <Input
              id="cronExpression"
              {...register('cronExpression')}
              placeholder="0 8 * * 1-5"
              className="font-mono text-sm"
            />
            {errors.cronExpression && (
              <p className="text-xs text-destructive">{errors.cronExpression.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              e.g. <code>0 8 * * 1-5</code> = weekdays at 08:00
            </p>
          </div>

          {/* Format */}
          <div className="space-y-1">
            <Label htmlFor="format">{t('format')}</Label>
            <Select
              onValueChange={(val) => setValue('format', val as 'csv' | 'excel')}
              defaultValue="excel"
            >
              <SelectTrigger id="format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="excel">Excel (.xlsx)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notify email */}
          <div className="space-y-1">
            <Label htmlFor="notifyEmail">{t('notifyEmail')}</Label>
            <Input
              id="notifyEmail"
              {...register('notifyEmail')}
              placeholder={t('notifyEmailPlaceholder')}
              type="email"
            />
            {errors.notifyEmail && (
              <p className="text-xs text-destructive">{errors.notifyEmail.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? tc('loading') : tc('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
