'use client'
import { ArrowRight, Calendar, Database, FileText, Plus } from 'lucide-react'
import Link from 'next/link'
import { useDataSources } from '@/hooks/use-data-sources'
import { useReports } from '@/hooks/use-reports'
import { useSchedules } from '@/hooks/use-schedules'
import { cn } from '@/lib/utils'

const statDefs = [
  { label: 'Veri Kaynakları', icon: Database, href: '/data-sources', color: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300' },
  { label: 'Raporlar', icon: FileText, href: '/reports', color: 'bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-300' },
  { label: 'Zamanlamalar', icon: Calendar, href: '/schedules', color: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300' },
]

export function DashboardClient() {
  const { data: sources } = useDataSources()
  const { data: reports } = useReports()
  const { data: schedules } = useSchedules()

  const counts = [sources?.length ?? 0, reports?.length ?? 0, schedules?.length ?? 0]

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Hero banner */}
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-r from-indigo-600 to-violet-600 p-8 text-white">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <svg width="36" height="36" viewBox="0 0 56 56" aria-hidden="true">
              <circle cx="28" cy="10" r="3" fill="#FDFDF7" />
              <circle cx="22" cy="18" r="3" fill="#FDFDF7" />
              <circle cx="34" cy="18" r="3" fill="#FDFDF7" />
              <circle cx="16" cy="26" r="3" fill="rgba(253,253,247,0.7)" />
              <circle cx="28" cy="26" r="3" fill="rgba(253,253,247,0.7)" />
              <circle cx="40" cy="26" r="3" fill="rgba(253,253,247,0.7)" />
              <circle cx="22" cy="34" r="3" fill="rgba(253,253,247,0.45)" />
              <circle cx="34" cy="34" r="3" fill="rgba(253,253,247,0.45)" />
              <rect x="26.5" y="38" width="3" height="10" rx="1.5" fill="rgba(253,253,247,0.45)" />
            </svg>
            <p className="text-sm font-medium text-indigo-200 tracking-wide uppercase">AI Destekli Raporlama Platformu</p>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="text-white">Data</span><span className="text-indigo-200">Scriba</span>&apos;ya Hoş Geldiniz
          </h1>
          <p className="mt-2 text-indigo-100 max-w-lg text-sm leading-relaxed">
            Veri kaynaklarınızı bağlayın, SQL raporlarınızı tasarlayın ve AI ile verimlilik kazanın.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/reports/new"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-indigo-600 shadow-sm hover:bg-indigo-50 transition-colors duration-150"
            >
              <Plus className="h-4 w-4" />
              Yeni Rapor Oluştur
            </Link>
            <Link
              href="/data-sources"
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-500/40 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500/60 transition-colors duration-150"
            >
              Veri Kaynağı Ekle
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
        <div className="pointer-events-none absolute -right-10 -top-10 h-52 w-52 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -right-2 bottom-0 h-36 w-36 rounded-full bg-white/5" />
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {statDefs.map((stat, i) => (
          <Link key={stat.href} href={stat.href} className="block">
            <div className="group rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
              <div className={cn('inline-flex rounded-lg p-2.5 mb-4', stat.color)}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div className="text-3xl font-bold text-slate-900 dark:text-white">{counts[i]}</div>
              <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">{stat.label}</div>
              <div className="mt-3 flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                Görüntüle <ArrowRight className="h-3 w-3" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent reports */}
      {reports && reports.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Son Raporlar</h2>
            <Link
              href="/reports"
              className="flex items-center gap-1 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Tümünü gör <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700 overflow-hidden">
            {reports.slice(0, 5).map((report) => (
              <Link key={report.id} href={`/reports/${report.id}/edit`} className="block">
                <div className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors duration-100">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-900/30">
                      <FileText className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{report.name}</p>
                      {report.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{report.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 ml-4">
                    {report.exportFormats.map((f) => (
                      <span
                        key={f}
                        className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 uppercase font-medium"
                      >
                        {f}
                      </span>
                    ))}
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
