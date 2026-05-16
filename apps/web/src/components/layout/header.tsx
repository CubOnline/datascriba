'use client'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

const pathToKey: Record<string, 'dataSources' | 'reports' | 'schedules' | 'settings'> = {
  'data-sources': 'dataSources',
  reports: 'reports',
  schedules: 'schedules',
  settings: 'settings',
}

export function Header() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations('nav')

  function toggleLocale() {
    const next = locale === 'en' ? 'tr' : 'en'
    const segments = pathname.split('/')
    segments[1] = next
    router.push(segments.join('/'))
  }

  function getPageTitle(): string {
    for (const [segment, key] of Object.entries(pathToKey)) {
      if (pathname.includes(segment)) return t(key)
    }
    return 'Dashboard'
  }

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-6 gap-4">
      <h1 className="text-base font-semibold text-foreground">{getPageTitle()}</h1>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={toggleLocale}>
          <span className="text-xs font-bold">{locale.toUpperCase()}</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
        >
          {mounted && resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>
    </header>
  )
}
