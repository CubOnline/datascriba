'use client'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useId } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useReportEditorStore } from '@/store/report-editor.store'

const PARAM_TYPES = ['string', 'number', 'date', 'dateRange', 'select', 'multiSelect', 'boolean'] as const

interface SortableParamRowProps {
  param: { id: string; name: string; type: string; label: string; required: boolean }
}

function SortableParamRow({ param }: SortableParamRowProps) {
  const t = useTranslations('report')
  const store = useReportEditorStore()
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: param.id })

  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 rounded-md border p-3">
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground">
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="grid flex-1 grid-cols-4 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">{t('paramName')}</Label>
          <Input
            className="h-8 text-sm"
            value={param.name}
            onChange={(e) => {
              const params = [...store.parameters]
              const idx = params.findIndex((p) => p.id === param.id)
              if (idx !== -1) {
                params[idx] = { ...params[idx]!, name: e.target.value }
                store.setField('parameters', params)
              }
            }}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('paramLabel')}</Label>
          <Input
            className="h-8 text-sm"
            value={param.label}
            onChange={(e) => {
              const params = [...store.parameters]
              const idx = params.findIndex((p) => p.id === param.id)
              if (idx !== -1) {
                params[idx] = { ...params[idx]!, label: e.target.value }
                store.setField('parameters', params)
              }
            }}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('paramType')}</Label>
          <Select
            value={param.type}
            onValueChange={(v) => {
              const params = [...store.parameters]
              const idx = params.findIndex((p) => p.id === param.id)
              if (idx !== -1) {
                params[idx] = { ...params[idx]!, type: v }
                store.setField('parameters', params)
              }
            }}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PARAM_TYPES.map((pt) => (
                <SelectItem key={pt} value={pt}>{pt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2 pb-1">
          <div className="flex items-center gap-1">
            <Switch
              checked={param.required}
              onCheckedChange={(checked) => {
                const params = [...store.parameters]
                const idx = params.findIndex((p) => p.id === param.id)
                if (idx !== -1) {
                  params[idx] = { ...params[idx]!, required: checked }
                  store.setField('parameters', params)
                }
              }}
            />
            <Label className="text-xs">{t('paramRequired')}</Label>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-destructive"
            onClick={() => store.removeParameter(param.id)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export function ParameterList() {
  const t = useTranslations('report')
  const store = useReportEditorStore()
  const uid = useId()

  const sensors = useSensors(useSensor(PointerSensor))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = store.parameters.findIndex((p) => p.id === active.id)
    const newIndex = store.parameters.findIndex((p) => p.id === over.id)
    if (oldIndex !== -1 && newIndex !== -1) {
      store.reorderParameters(oldIndex, newIndex)
    }
  }

  function addParameter() {
    store.addParameter({
      id: crypto.randomUUID(),
      name: '',
      type: 'string',
      label: '',
      required: false,
    })
  }

  return (
    <div className="space-y-2">
      <DndContext id={uid} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={store.parameters.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          {store.parameters.map((param) => (
            <SortableParamRow key={param.id} param={param} />
          ))}
        </SortableContext>
      </DndContext>
      <Button variant="outline" size="sm" onClick={addParameter}>
        <Plus className="mr-2 h-3 w-3" />
        {t('addParameter')}
      </Button>
    </div>
  )
}
