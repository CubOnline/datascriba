import { useTranslations } from 'next-intl'
import { DataSourcesClient } from './data-sources-client'

export default function DataSourcesPage() {
  const t = useTranslations('dataSource')
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <DataSourcesClient />
    </div>
  )
}
