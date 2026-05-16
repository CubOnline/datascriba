'use client'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useCreateDataSource } from '@/hooks/use-data-sources'

const schema = z.object({
  name: z.string().min(1),
  host: z.string().min(1),
  port: z.coerce.number().int().min(1).max(65535).default(1433),
  database: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(1),
  encrypt: z.boolean().default(true),
  trustServerCertificate: z.boolean().default(false),
  connectionTimeoutMs: z.coerce.number().default(30000),
  queryTimeoutMs: z.coerce.number().default(60000),
})

type FormValues = z.infer<typeof schema>

interface DataSourceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DataSourceDialog({ open, onOpenChange }: DataSourceDialogProps) {
  const t = useTranslations('dataSource')
  const tc = useTranslations('common')
  const create = useCreateDataSource()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      port: 1433,
      encrypt: true,
      trustServerCertificate: false,
      connectionTimeoutMs: 30000,
      queryTimeoutMs: 60000,
    },
  })

  async function onSubmit(values: FormValues): Promise<void> {
    try {
      await create.mutateAsync(values)
      form.reset()
      onOpenChange(false)
    } catch {
      // Error is surfaced via create.isError / create.error in the UI.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('createNew')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <Label>{tc('name')}</Label>
              <Input {...form.register('name')} />
            </div>
            <div className="space-y-1">
              <Label>{t('host')}</Label>
              <Input {...form.register('host')} />
            </div>
            <div className="space-y-1">
              <Label>{t('port')}</Label>
              <Input type="number" {...form.register('port')} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>{t('database')}</Label>
              <Input {...form.register('database')} />
            </div>
            <div className="space-y-1">
              <Label>{t('username')}</Label>
              <Input {...form.register('username')} />
            </div>
            <div className="space-y-1">
              <Label>{t('password')}</Label>
              <Input type="password" {...form.register('password')} />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.watch('encrypt')}
                onCheckedChange={(v) => form.setValue('encrypt', v)}
              />
              <Label>{t('encrypt')}</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.watch('trustServerCertificate')}
                onCheckedChange={(v) => form.setValue('trustServerCertificate', v)}
              />
              <Label>{t('trustServerCertificate')}</Label>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {tc('save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
