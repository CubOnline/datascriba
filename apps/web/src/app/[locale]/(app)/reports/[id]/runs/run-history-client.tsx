'use client'
import { format } from 'date-fns'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useReportRuns } from '@/hooks/use-reports'

interface RunHistoryClientProps {
  reportId: string
}

export function RunHistoryClient({ reportId }: RunHistoryClientProps) {
  const t = useTranslations('report')
  const tc = useTranslations('common')
  const { data: runs, isLoading } = useReportRuns(reportId)

  const statusVariant = (status: string) => {
    if (status === 'completed') return 'success' as const
    if (status === 'failed') return 'destructive' as const
    return 'secondary' as const
  }

  if (isLoading) return <p className="text-muted-foreground">{tc('loading')}</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('runHistory')}</h1>
        <Button variant="outline" asChild>
          <Link href={`/reports/${reportId}/edit`}>{tc('back')}</Link>
        </Button>
      </div>
      <div className="space-y-2">
        {runs?.map((run) => (
          <Card key={run.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant={statusVariant(run.status)}>{t(run.status as 'running' | 'completed' | 'failed')}</Badge>
                  <span className="text-sm font-medium uppercase">{run.format}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('startedAt')}: {format(new Date(run.startedAt), 'dd MMM yyyy HH:mm:ss')}
                </p>
                {run.completedAt && (
                  <p className="text-xs text-muted-foreground">
                    {t('completedAt')}: {format(new Date(run.completedAt), 'dd MMM yyyy HH:mm:ss')}
                  </p>
                )}
                {run.errorMessage && (
                  <p className="text-xs text-destructive">{run.errorMessage}</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {runs?.length === 0 && <p className="text-muted-foreground">{tc('noData')}</p>}
      </div>
    </div>
  )
}
