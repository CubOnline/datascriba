'use client'
import { Database, FileText, Settings } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/data-sources', icon: Database, labelKey: 'dataSources' },
  { href: '/reports', icon: FileText, labelKey: 'reports' },
  { href: '/settings', icon: Settings, labelKey: 'settings' },
] as const

export function Sidebar() {
  const t = useTranslations('nav')
  const pathname = usePathname()

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-card">
      <div className="flex h-16 items-center border-b px-6">
        <span className="text-xl font-bold tracking-tight text-primary">DataScriba</span>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map(({ href, icon: Icon, labelKey }) => {
          const active = pathname.includes(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {t(labelKey)}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
