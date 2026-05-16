'use client'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useRunReport } from '@/hooks/use-reports'

const schema = z.object({
  format: z.enum(['csv', 'excel']),
})

type FormValues = z.infer<typeof schema>

interface RunReportDialogProps {
  reportId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RunReportDialog({ reportId, open, onOpenChange }: RunReportDialogProps) {
  const t = useTranslations('report')
  const tc = useTranslations('common')
  const runReport = useRunReport()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { format: 'csv' },
  })

  async function onSubmit(values: FormValues): Promise<void> {
    const res = await runReport.mutateAsync({ id: reportId, payload: { format: values.format } })
    if (res.ok) {
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition') ?? ''
      const match = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition)
      const rawFilename = match?.[1]?.replace(/['"]/g, '') ?? `report.${values.format === 'excel' ? 'xlsx' : 'csv'}`
      // Decode URI encoding safely; strip any directory traversal components
      let filename: string
      try {
        filename = decodeURIComponent(rawFilename)
      } catch {
        filename = rawFilename
      }
      // Strip directory separators to prevent path traversal via filename
      filename = filename.replace(/[/\\]/g, '_')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('run')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label>{t('format')}</Label>
            <Select
              value={form.watch('format')}
              onValueChange={(v) => form.setValue('format', v as 'csv' | 'excel')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="excel">Excel</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={runReport.isPending}>
              {t('download')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
