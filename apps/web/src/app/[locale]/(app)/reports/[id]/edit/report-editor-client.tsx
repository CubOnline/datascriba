'use client'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { Clock, Save, Sparkles } from 'lucide-react'
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
    <div className="flex h-full gap-6">
      {/* Left settings panel */}
      <div className="w-80 shrink-0 flex flex-col gap-4 overflow-y-auto">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
            {reportId ? t('editTitle') : t('createNew')}
          </h1>
          <div className="flex items-center gap-2">
            {store.isDirty && (
              <span className="text-xs text-slate-400">{tc('unsavedChanges')}</span>
            )}
            <Button onClick={handleSave} disabled={isPending} size="sm">
              <Save className="h-3.5 w-3.5" />
              {tc('save')}
            </Button>
          </div>
        </div>

        {/* Settings card */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 space-y-4 shadow-sm">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{tc('name')}</Label>
            <Input
              value={store.name}
              onChange={(e) => store.setField('name', e.target.value)}
              placeholder="Rapor adı..."
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{tc('description')}</Label>
            <Input
              value={store.description}
              onChange={(e) => store.setField('description', e.target.value)}
              placeholder="Açıklama (isteğe bağlı)"
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Veri Kaynağı</Label>
            <Select value={store.dataSourceId} onValueChange={(v) => store.setField('dataSourceId', v)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Seçin..." />
              </SelectTrigger>
              <SelectContent>
                {dataSources?.map((ds) => (
                  <SelectItem key={ds.id} value={ds.id}>{ds.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('exportFormats')}</Label>
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
                  <Label className="text-sm capitalize">{fmt}</Label>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Parameters */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
          <Label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3 block">{t('parameters')}</Label>
          <ParameterList />
        </div>

        {/* Schedule button */}
        {reportId && (
          <Button variant="outline" size="sm" onClick={() => setScheduleOpen(true)} className="w-full">
            <Clock className="h-3.5 w-3.5" />
            {ts('scheduleReport')}
          </Button>
        )}
      </div>

      {/* Right editor panel */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('query')}</Label>
          <span className="flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400">
            <Sparkles className="h-3 w-3" /> AI Yardımcısı aktif
          </span>
        </div>
        <div className="flex-1 min-h-0 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
          <MonacoEditor
            height="100%"
            language="sql"
            theme="vs-dark"
            value={store.query}
            onChange={(v) => store.setField('query', v ?? '')}
            options={{ minimap: { enabled: false }, fontSize: 13, wordWrap: 'on', padding: { top: 12 } }}
          />
        </div>
      </div>

      {/* AI Panel */}
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
