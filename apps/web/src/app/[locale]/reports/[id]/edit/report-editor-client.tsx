'use client'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useReport, useCreateReport, useUpdateReport } from '@/hooks/use-reports'
import { useDataSources } from '@/hooks/use-data-sources'
import { useReportEditorStore } from '@/store/report-editor.store'
import { AiAssistantPanel } from '@/components/ai/ai-assistant-panel'
import { CreateScheduleDialog } from '../../../schedules/create-schedule-dialog'
import { ParameterList } from './parameter-list'
import { useRouter } from 'next/navigation'

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false })

interface ReportEditorClientProps {
  reportId?: string
}

export function ReportEditorClient({ reportId }: ReportEditorClientProps) {
  const t = useTranslations('report')
  const tc = useTranslations('common')
  const ts = useTranslations('schedule')
  const router = useRouter()

  const [scheduleOpen, setScheduleOpen] = useState(false)
  const store = useReportEditorStore()
  const loadReport = useReportEditorStore((s) => s.loadReport)
  const { data: report } = useReport(reportId ?? '')
  const { data: dataSources } = useDataSources()
  const createReport = useCreateReport()
  const updateReport = useUpdateReport(reportId ?? '')

  useEffect(() => {
    if (report) {
      loadReport({
        id: report.id,
        name: report.name,
        description: report.description,
        dataSourceId: report.dataSourceId,
        query: report.query,
        parameters: report.parameters.map((p, i) => ({
          id: `param-${i}`,
          name: p.name,
          type: p.type,
          label: p.label,
          required: p.required,
          defaultValue: p.defaultValue,
          options: p.options,
        })),
        exportFormats: report.exportFormats,
      })
    }
  }, [report, loadReport])

  async function handleSave(): Promise<void> {
    try {
      const payload = {
        name: store.name,
        description: store.description || undefined,
        dataSourceId: store.dataSourceId,
        query: store.query,
        parameters: store.parameters,
        exportFormats: store.exportFormats,
      }
      if (reportId) {
        await updateReport.mutateAsync(payload)
      } else {
        const created = await createReport.mutateAsync(payload)
        const safeId = /^[\w-]+$/.test(created.id) ? created.id : null
        if (!safeId) throw new Error('Invalid report id returned from server')
        router.push(`/reports/${safeId}/edit`)
      }
      store.resetDirty()
    } catch (err) {
      throw err
    }
  }

  const isPending = createReport.isPending || updateReport.isPending

  return (
    <div className="flex h-full">
      {/* Ana editor alani */}
      <div className="flex-1 overflow-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">
            {reportId ? t('editTitle') : t('createNew')}
          </h1>
          <div className="flex gap-2">
            {store.isDirty && (
              <span className="text-sm text-muted-foreground self-center">{tc('unsavedChanges')}</span>
            )}
            {reportId && (
              <Button variant="outline" size="sm" onClick={() => setScheduleOpen(true)}>
                <Clock className="mr-2 h-4 w-4" />
                {ts('scheduleReport')}
              </Button>
            )}
            <Button onClick={handleSave} disabled={isPending}>
              {tc('save')}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>{tc('name')}</Label>
              <Input value={store.name} onChange={(e) => store.setField('name', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{tc('description')}</Label>
              <Input
                value={store.description}
                onChange={(e) => store.setField('description', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Data Source</Label>
              <Select
                value={store.dataSourceId}
                onValueChange={(v) => store.setField('dataSourceId', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select data source..." />
                </SelectTrigger>
                <SelectContent>
                  {dataSources?.map((ds) => (
                    <SelectItem key={ds.id} value={ds.id}>{ds.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t('exportFormats')}</Label>
              <div className="flex gap-4">
                {(['csv', 'excel'] as const).map((fmt) => (
                  <div key={fmt} className="flex items-center gap-2">
                    <Switch
                      checked={store.exportFormats.includes(fmt)}
                      onCheckedChange={(checked) => {
                        const next = checked
                          ? [...store.exportFormats, fmt]
                          : store.exportFormats.filter((f) => f !== fmt)
                        store.setField('exportFormats', next)
                      }}
                    />
                    <Label className="capitalize">{fmt}</Label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <Label>{t('query')}</Label>
            <div className="h-64 rounded-md border overflow-hidden">
              <MonacoEditor
                height="100%"
                language="sql"
                theme="vs-dark"
                value={store.query}
                onChange={(v) => store.setField('query', v ?? '')}
                options={{ minimap: { enabled: false }, fontSize: 13, wordWrap: 'on' }}
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t('parameters')}</Label>
          <ParameterList />
        </div>
      </div>

      {/* AI Yardimcisi paneli -- sagda, collapsible */}
      <AiAssistantPanel
        dataSourceId={store.dataSourceId}
        currentSql={store.query}
        onApplySql={(sql) => store.setField('query', sql)}
      />

      {reportId && (
        <CreateScheduleDialog
          open={scheduleOpen}
          onOpenChange={setScheduleOpen}
          initialReportId={reportId}
        />
      )}
    </div>
  )
}
