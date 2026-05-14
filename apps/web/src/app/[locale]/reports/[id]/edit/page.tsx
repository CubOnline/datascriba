import { ReportEditorClient } from './report-editor-client'

interface EditReportPageProps {
  params: Promise<{ id: string }>
}

export default async function EditReportPage({ params }: EditReportPageProps) {
  const { id } = await params
  return <ReportEditorClient reportId={id} />
}
