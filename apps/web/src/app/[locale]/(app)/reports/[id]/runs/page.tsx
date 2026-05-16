import { RunHistoryClient } from './run-history-client'

interface RunsPageProps {
  params: Promise<{ id: string }>
}

export default async function RunsPage({ params }: RunsPageProps) {
  const { id } = await params
  return <RunHistoryClient reportId={id} />
}
