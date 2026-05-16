'use client'
import { Clock, FileText, Plus, Play, Pencil, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useReports, useDeleteReport } from '@/hooks/use-reports'
import { RunReportDialog } from './run-report-dialog'

const formatVariant: Record<string, 'success' | 'info'> = {
  csv: 'success',
  excel: 'info',
}

export function ReportsClient() {
  const t = useTranslations()
  const { data: reports, isLoading } = useReports()
  const deleteReport = useDeleteReport()
  const [runDialogReportId, setRunDialogReportId] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-48 rounded-xl border border-slate-200 bg-white animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-900/30">
            <FileText className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t('report.title')}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{reports?.length ?? 0} rapor</p>
          </div>
        </div>
        <Button asChild>
          <Link href="/reports/new">
            <Plus className="h-4 w-4" />
            {t('report.createNew')}
          </Link>
        </Button>
      </div>

      {/* Cards */}
      {reports && reports.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {reports.map((report) => (
            <div
              key={report.id}
              className="group rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
            >
              {/* Format badges */}
              <div className="flex items-center gap-1.5 mb-4">
                {report.exportFormats.map((f) => (
                  <Badge key={f} variant={formatVariant[f] ?? 'secondary'} className="uppercase">
                    {f}
                  </Badge>
                ))}
              </div>

              {/* Title */}
              <p className="font-semibold text-slate-900 dark:text-white truncate">{report.name}</p>
              {report.description && (
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 line-clamp-2">{report.description}</p>
              )}

              {/* Actions */}
              <div className="mt-5 flex items-center gap-2">
                <Button size="sm" onClick={() => setRunDialogReportId(report.id)} className="flex-1">
                  <Play className="h-3.5 w-3.5" />
                  {t('report.run')}
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/reports/${report.id}/edit`}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/reports/${report.id}/runs`}>
                    <Clock className="h-3.5 w-3.5" />
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteReport.mutate(report.id)}
                  disabled={deleteReport.isPending}
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-violet-50 dark:bg-violet-900/30 mb-4">
            <FileText className="h-7 w-7 text-violet-500" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">Henüz rapor yok</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-xs">
            İlk raporunuzu oluşturun ve veri kaynaklarınızı sorgulayın.
          </p>
          <Button asChild>
            <Link href="/reports/new">
              <Plus className="h-4 w-4" />
              {t('report.createNew')}
            </Link>
          </Button>
        </div>
      )}

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
