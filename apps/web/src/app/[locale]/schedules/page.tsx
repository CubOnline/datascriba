import { useTranslations } from 'next-intl'
import { SchedulesClient } from './schedules-client'

export default function SchedulesPage() {
  const t = useTranslations('schedule')
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <SchedulesClient />
    </div>
  )
}
