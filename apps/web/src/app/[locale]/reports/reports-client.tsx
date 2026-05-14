'use client'
import { Plus, Play, Trash2, Clock } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useReports, useDeleteReport } from '@/hooks/use-reports'
import { RunReportDialog } from './run-report-dialog'

export function ReportsClient() {
  const t = useTranslations()
  const { data: reports, isLoading } = useReports()
  const deleteReport = useDeleteReport()
  const [runDialogReportId, setRunDialogReportId] = useState<string | null>(null)

  if (isLoading) return <p className="text-muted-foreground">{t('common.loading')}</p>

  return (
    <>
      <div className="flex justify-end">
        <Button asChild>
          <Link href="/reports/new">
            <Plus className="mr-2 h-4 w-4" />
            {t('report.createNew')}
          </Link>
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reports?.map((report) => (
          <Card key={report.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{report.name}</CardTitle>
                <div className="flex gap-1">
                  {report.exportFormats.map((f) => (
                    <Badge key={f} variant="secondary" className="text-xs">{f}</Badge>
                  ))}
                </div>
              </div>
              {report.description && (
                <p className="text-sm text-muted-foreground">{report.description}</p>
              )}
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" onClick={() => setRunDialogReportId(report.id)}>
                  <Play className="mr-1 h-3 w-3" />
                  {t('report.run')}
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/reports/${report.id}/edit`}>
                    {t('common.edit')}
                  </Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/reports/${report.id}/runs`}>
                    <Clock className="mr-1 h-3 w-3" />
                    {t('report.runHistory')}
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => deleteReport.mutate(report.id)}
                  disabled={deleteReport.isPending}
                >
                  <Trash2 className="mr-1 h-3 w-3" />
                  {t('common.delete')}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {reports?.length === 0 && (
          <p className="col-span-full text-muted-foreground">{t('common.noData')}</p>
        )}
      </div>
      {runDialogReportId && (
        <RunReportDialog
          reportId={runDialogReportId}
          open={Boolean(runDialogReportId)}
          onOpenChange={(open) => { if (!open) setRunDialogReportId(null) }}
        />
      )}
    </>
  )
}
