import { temporal } from 'zundo'
import { create } from 'zustand'

interface ReportParameter {
  id: string
  name: string
  type: string
  label: string
  required: boolean
  defaultValue?: unknown
  options?: Array<{ label: string; value: unknown }>
}

interface ReportEditorState {
  reportId: string | null
  name: string
  description: string
  dataSourceId: string
  query: string
  parameters: ReportParameter[]
  exportFormats: string[]
  isDirty: boolean

  setField: <K extends keyof Omit<ReportEditorState, 'setField' | 'addParameter' | 'removeParameter' | 'reorderParameters' | 'resetDirty' | 'loadReport' | 'isDirty'>>(
    key: K,
    value: ReportEditorState[K],
  ) => void
  addParameter: (param: ReportParameter) => void
  removeParameter: (id: string) => void
  reorderParameters: (from: number, to: number) => void
  resetDirty: () => void
  loadReport: (report: {
    id: string
    name: string
    description?: string
    dataSourceId: string
    query: string
    parameters: ReportParameter[]
    exportFormats: string[]
  }) => void
}

export const useReportEditorStore = create<ReportEditorState>()(
  temporal((set) => ({
    reportId: null,
    name: '',
    description: '',
    dataSourceId: '',
    query: '',
    parameters: [],
    exportFormats: ['csv'],
    isDirty: false,

    setField: (key, value) =>
      set((state) => ({ ...state, [key]: value, isDirty: true })),

    addParameter: (param) =>
      set((state) => ({
        parameters: [...state.parameters, param],
        isDirty: true,
      })),

    removeParameter: (id) =>
      set((state) => ({
        parameters: state.parameters.filter((p) => p.id !== id),
        isDirty: true,
      })),

    reorderParameters: (from, to) =>
      set((state) => {
        const params = [...state.parameters]
        const [moved] = params.splice(from, 1)
        params.splice(to, 0, moved!)
        return { parameters: params, isDirty: true }
      }),

    resetDirty: () => set((state) => ({ ...state, isDirty: false })),

    loadReport: (report) =>
      set({
        reportId: report.id,
        name: report.name,
        description: report.description ?? '',
        dataSourceId: report.dataSourceId,
        query: report.query,
        parameters: report.parameters,
        exportFormats: report.exportFormats,
        isDirty: false,
      }),
  })),
)
