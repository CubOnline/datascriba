import { useTranslations } from 'next-intl'
import { ReportsClient } from './reports-client'

export default function ReportsPage() {
  const t = useTranslations('report')
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <ReportsClient />
    </div>
  )
}
