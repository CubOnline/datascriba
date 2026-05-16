'use client'
import { Database, Plus, Trash2, Wifi, CheckCircle2, XCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useDataSources, useDeleteDataSource, useTestDataSource } from '@/hooks/use-data-sources'
import { DataSourceDialog } from './data-source-dialog'

export function DataSourcesClient() {
  const t = useTranslations()
  const { data: sources, isLoading } = useDataSources()
  const deleteSource = useDeleteDataSource()
  const testSource = useTestDataSource()
  const [testResults, setTestResults] = useState<Record<string, boolean>>({})
  const [dialogOpen, setDialogOpen] = useState(false)

  async function handleTest(id: string) {
    const result = await testSource.mutateAsync(id)
    setTestResults((prev) => ({ ...prev, [id]: result.success }))
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-40 rounded-xl border border-slate-200 bg-white animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-900/30">
            <Database className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t('dataSource.title')}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{sources?.length ?? 0} bağlantı</p>
          </div>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          {t('dataSource.createNew')}
        </Button>
      </div>

      {/* Cards */}
      {sources && sources.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sources.map((source) => {
            const tested = testResults[source.id]
            return (
              <div
                key={source.id}
                className="group rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                {/* Card header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-900/30">
                    <Database className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  {tested !== undefined && (
                    <Badge variant={tested ? 'success' : 'destructive'}>
                      {tested ? (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> {t('common.connected')}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <XCircle className="h-3 w-3" /> {t('common.failed')}
                        </span>
                      )}
                    </Badge>
                  )}
                </div>

                {/* Info */}
                <p className="font-semibold text-slate-900 dark:text-white truncate">{source.name}</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 font-mono truncate">
                  {source.host}:{source.port}/{source.database}
                </p>

                {/* Actions */}
                <div className="mt-4 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleTest(source.id)}
                    disabled={testSource.isPending}
                    className="flex-1"
                  >
                    <Wifi className="h-3.5 w-3.5" />
                    {t('common.testConnection')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteSource.mutate(source.id)}
                    disabled={deleteSource.isPending}
                    className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* Empty state */
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-900/30 mb-4">
            <Database className="h-7 w-7 text-indigo-500" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">Henüz veri kaynağı yok</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-xs">
            İlk veri kaynağınızı ekleyerek raporlarınızı oluşturmaya başlayın.
          </p>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            {t('dataSource.createNew')}
          </Button>
        </div>
      )}

      <DataSourceDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  )
}
