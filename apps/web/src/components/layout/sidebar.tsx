'use client'
import { Calendar, Database, FileText, Settings } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/data-sources', icon: Database, labelKey: 'dataSources' },
  { href: '/reports', icon: FileText, labelKey: 'reports' },
  { href: '/schedules', icon: Calendar, labelKey: 'schedules' },
  { href: '/settings', icon: Settings, labelKey: 'settings' },
] as const

function DataScribaIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" aria-hidden="true">
      <circle cx="28" cy="10" r="3" fill="#A5B4FC" />
      <circle cx="22" cy="18" r="3" fill="#A5B4FC" />
      <circle cx="34" cy="18" r="3" fill="#A5B4FC" />
      <circle cx="16" cy="26" r="3" fill="#C4B5FD" />
      <circle cx="28" cy="26" r="3" fill="#C4B5FD" />
      <circle cx="40" cy="26" r="3" fill="#C4B5FD" />
      <circle cx="22" cy="34" r="3" fill="#FDFDF7" />
      <circle cx="34" cy="34" r="3" fill="#FDFDF7" />
      <rect x="26.5" y="38" width="3" height="10" rx="1.5" fill="#FDFDF7" />
    </svg>
  )
}

export function Sidebar() {
  const t = useTranslations('nav')
  const pathname = usePathname()

  return (
    <aside className="flex h-screen w-64 flex-col bg-[#0F172A]">
      {/* Logo */}
      <div className="flex h-16 items-center px-5">
        <div className="flex items-center gap-2.5">
          <DataScribaIcon size={28} />
          <span className="text-[17px] font-semibold tracking-tight">
            <span className="text-white">Data</span>
            <span className="text-[#A5B4FC]">Scriba</span>
          </span>
        </div>
      </div>

      <div className="mx-4 border-t border-white/10" />

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 p-3 pt-4">
        {navItems.map(({ href, icon: Icon, labelKey }) => {
          const active = pathname.includes(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                active
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {t(labelKey)}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 pb-5">
        <p className="text-xs text-slate-600">v0.1.0</p>
      </div>
    </aside>
  )
}
