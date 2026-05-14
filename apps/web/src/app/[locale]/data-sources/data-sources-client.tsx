'use client'
import { Plus, Trash2, Wifi } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

  if (isLoading) return <p className="text-muted-foreground">{t('common.loading')}</p>

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t('dataSource.createNew')}
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sources?.map((source) => (
          <Card key={source.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{source.name}</CardTitle>
                {testResults[source.id] !== undefined && (
                  <Badge variant={testResults[source.id] ? 'success' : 'destructive'}>
                    {testResults[source.id] ? t('common.connected') : t('common.failed')}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {source.host}:{source.port}/{source.database}
              </p>
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleTest(source.id)}
                  disabled={testSource.isPending}
                >
                  <Wifi className="mr-1 h-3 w-3" />
                  {t('common.testConnection')}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => deleteSource.mutate(source.id)}
                  disabled={deleteSource.isPending}
                >
                  <Trash2 className="mr-1 h-3 w-3" />
                  {t('common.delete')}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {sources?.length === 0 && (
          <p className="col-span-full text-muted-foreground">{t('common.noData')}</p>
        )}
      </div>
      <DataSourceDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  )
}
