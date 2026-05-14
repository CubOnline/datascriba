# TASK_PLAN.md — Phase 4: Görsel Rapor Tasarımcısı

**Agent:** builder
**Phase:** 4
**Effort:** XL (~3-4 weeks)
**Created by:** planner
**Date:** 2026-05-14

---

## Hedef

`apps/web` altında Next.js 15 App Router tabanlı bir frontend oluşturmak:
- Rapor tanımı oluşturma / düzenleme (sürükle-bırak parametre yönetimi, Monaco SQL editörü)
- Veri kaynağı yönetimi (listeleme, bağlantı testi, CRUD)
- Rapor çalıştırma & dosya indirme (CSV / Excel)
- Geçmiş çalıştırma kayıtları
- Dark mode, EN + TR i18n

---

## Teknoloji Kararları

| Bileşen | Seçim |
|---------|-------|
| Framework | Next.js 15.3 App Router |
| Stil | TailwindCSS 4 (`@import "tailwindcss"`, config dosyası yok) |
| Komponent kütüphanesi | shadcn/ui v2 |
| State (client) | Zustand 5 + zundo (undo/redo) |
| State (server) | TanStack Query v5 |
| Sürükle-bırak | @dnd-kit/core |
| SQL editörü | Monaco Editor (dynamic, ssr:false) |
| i18n | next-intl v3 |
| Tema | next-themes |
| Form | React Hook Form + Zod resolver |
| HTTP client | fetch (native) + custom wrapper |

---

## Görevler

### STEP-01: apps/web package.json

Dosya: `apps/web/package.json`

```json
{
  "name": "web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "next": "15.3.2",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@tanstack/react-query": "^5.56.2",
    "@tanstack/react-query-devtools": "^5.56.2",
    "zustand": "^5.0.1",
    "zundo": "^2.2.0",
    "@dnd-kit/core": "^6.3.1",
    "@dnd-kit/sortable": "^8.0.0",
    "@dnd-kit/utilities": "^3.2.2",
    "next-intl": "^3.22.2",
    "next-themes": "^0.4.3",
    "react-hook-form": "^7.53.0",
    "@hookform/resolvers": "^3.9.0",
    "zod": "^3.23.8",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.2",
    "lucide-react": "^0.447.0",
    "@radix-ui/react-dialog": "^1.1.2",
    "@radix-ui/react-dropdown-menu": "^2.1.2",
    "@radix-ui/react-label": "^2.1.0",
    "@radix-ui/react-select": "^2.1.2",
    "@radix-ui/react-separator": "^1.1.0",
    "@radix-ui/react-slot": "^1.1.0",
    "@radix-ui/react-switch": "^1.1.1",
    "@radix-ui/react-tabs": "^1.1.1",
    "@radix-ui/react-toast": "^1.2.2",
    "@radix-ui/react-tooltip": "^1.1.3",
    "@monaco-editor/react": "^4.6.0",
    "date-fns": "^4.1.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.5.4",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/postcss": "^4.0.0",
    "postcss": "^8.4.47",
    "eslint": "^9.0.0",
    "eslint-config-next": "^15.0.0"
  }
}
```

---

### STEP-02: apps/web tsconfig.json

Dosya: `apps/web/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

---

### STEP-03: apps/web next.config.ts

Dosya: `apps/web/next.config.ts`

```typescript
import createNextIntlPlugin from 'next-intl/plugin'
import type { NextConfig } from 'next'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@datascriba/shared-types'],
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
}

export default withNextIntl(config)
```

---

### STEP-04: apps/web postcss.config.mjs

Dosya: `apps/web/postcss.config.mjs`

```javascript
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}

export default config
```

---

### STEP-05: apps/web src/lib/utils.ts

Dosya: `apps/web/src/lib/utils.ts`

```typescript
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
```

---

### STEP-06: apps/web src/lib/env.ts

Dosya: `apps/web/src/lib/env.ts`

```typescript
import { z } from 'zod'

const schema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url(),
})

export const env = schema.parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
})
```

---

### STEP-07: apps/web .env.local

Dosya: `apps/web/.env.local`

```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

### STEP-08: i18n — mesaj dosyaları

Dosya: `apps/web/src/i18n/messages/en.json`

```json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "create": "Create",
    "loading": "Loading...",
    "error": "Error",
    "success": "Success",
    "confirm": "Confirm",
    "back": "Back",
    "name": "Name",
    "description": "Description",
    "actions": "Actions",
    "noData": "No data found",
    "testConnection": "Test Connection",
    "connected": "Connected",
    "failed": "Failed"
  },
  "nav": {
    "dataSources": "Data Sources",
    "reports": "Reports",
    "settings": "Settings"
  },
  "dataSource": {
    "title": "Data Sources",
    "createNew": "New Data Source",
    "editTitle": "Edit Data Source",
    "host": "Host",
    "port": "Port",
    "database": "Database",
    "username": "Username",
    "password": "Password",
    "encrypt": "Encrypt Connection",
    "trustServerCertificate": "Trust Server Certificate",
    "connectionTimeout": "Connection Timeout (ms)",
    "queryTimeout": "Query Timeout (ms)",
    "deleteConfirm": "Are you sure you want to delete this data source?"
  },
  "report": {
    "title": "Reports",
    "createNew": "New Report",
    "editTitle": "Edit Report",
    "query": "SQL Query",
    "parameters": "Parameters",
    "exportFormats": "Export Formats",
    "run": "Run Report",
    "runHistory": "Run History",
    "format": "Format",
    "download": "Download",
    "status": "Status",
    "startedAt": "Started At",
    "completedAt": "Completed At",
    "running": "Running",
    "completed": "Completed",
    "failed": "Failed",
    "addParameter": "Add Parameter",
    "paramName": "Parameter Name",
    "paramType": "Type",
    "paramLabel": "Label",
    "paramRequired": "Required",
    "paramDefault": "Default Value"
  }
}
```

Dosya: `apps/web/src/i18n/messages/tr.json`

```json
{
  "common": {
    "save": "Kaydet",
    "cancel": "İptal",
    "delete": "Sil",
    "edit": "Düzenle",
    "create": "Oluştur",
    "loading": "Yükleniyor...",
    "error": "Hata",
    "success": "Başarılı",
    "confirm": "Onayla",
    "back": "Geri",
    "name": "Ad",
    "description": "Açıklama",
    "actions": "İşlemler",
    "noData": "Veri bulunamadı",
    "testConnection": "Bağlantıyı Test Et",
    "connected": "Bağlandı",
    "failed": "Başarısız"
  },
  "nav": {
    "dataSources": "Veri Kaynakları",
    "reports": "Raporlar",
    "settings": "Ayarlar"
  },
  "dataSource": {
    "title": "Veri Kaynakları",
    "createNew": "Yeni Veri Kaynağı",
    "editTitle": "Veri Kaynağını Düzenle",
    "host": "Sunucu",
    "port": "Port",
    "database": "Veritabanı",
    "username": "Kullanıcı Adı",
    "password": "Şifre",
    "encrypt": "Bağlantıyı Şifrele",
    "trustServerCertificate": "Sunucu Sertifikasına Güven",
    "connectionTimeout": "Bağlantı Zaman Aşımı (ms)",
    "queryTimeout": "Sorgu Zaman Aşımı (ms)",
    "deleteConfirm": "Bu veri kaynağını silmek istediğinizden emin misiniz?"
  },
  "report": {
    "title": "Raporlar",
    "createNew": "Yeni Rapor",
    "editTitle": "Raporu Düzenle",
    "query": "SQL Sorgusu",
    "parameters": "Parametreler",
    "exportFormats": "Dışa Aktarma Formatları",
    "run": "Raporu Çalıştır",
    "runHistory": "Çalıştırma Geçmişi",
    "format": "Format",
    "download": "İndir",
    "status": "Durum",
    "startedAt": "Başlangıç",
    "completedAt": "Bitiş",
    "running": "Çalışıyor",
    "completed": "Tamamlandı",
    "failed": "Başarısız",
    "addParameter": "Parametre Ekle",
    "paramName": "Parametre Adı",
    "paramType": "Tür",
    "paramLabel": "Etiket",
    "paramRequired": "Zorunlu",
    "paramDefault": "Varsayılan Değer"
  }
}
```

---

### STEP-09: i18n — request.ts ve routing

Dosya: `apps/web/src/i18n/request.ts`

```typescript
import { getRequestConfig } from 'next-intl/server'
import { routing } from './routing'

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale
  if (!locale || !routing.locales.includes(locale as 'en' | 'tr')) {
    locale = routing.defaultLocale
  }
  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)) as Record<string, unknown>,
  }
})
```

Dosya: `apps/web/src/i18n/routing.ts`

```typescript
import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['en', 'tr'],
  defaultLocale: 'en',
})
```

---

### STEP-10: Middleware

Dosya: `apps/web/src/middleware.ts`

```typescript
import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'

export default createMiddleware(routing)

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
```

---

### STEP-11: API Client

Dosya: `apps/web/src/lib/api-client.ts`

```typescript
import { env } from './env'

class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${env.NEXT_PUBLIC_API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new ApiError(res.status, text)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const apiClient = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
  postRaw: (path: string, body: unknown) =>
    fetch(`${env.NEXT_PUBLIC_API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
}
```

---

### STEP-12: TanStack Query hooks — Data Sources

Dosya: `apps/web/src/hooks/use-data-sources.ts`

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { DataSourceRecord } from '@datascriba/shared-types'
import { apiClient } from '@/lib/api-client'

const QUERY_KEY = ['dataSources'] as const

interface CreateDataSourcePayload {
  name: string
  host: string
  port: number
  database: string
  username: string
  password: string
  encrypt?: boolean
  trustServerCertificate?: boolean
  connectionTimeoutMs?: number
  queryTimeoutMs?: number
}

export function useDataSources() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => apiClient.get<DataSourceRecord[]>('/data-sources'),
  })
}

export function useDataSource(id: string) {
  return useQuery({
    queryKey: [...QUERY_KEY, id],
    queryFn: () => apiClient.get<DataSourceRecord>(`/data-sources/${id}`),
    enabled: Boolean(id),
  })
}

export function useCreateDataSource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateDataSourcePayload) =>
      apiClient.post<DataSourceRecord>('/data-sources', payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useUpdateDataSource(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: Partial<CreateDataSourcePayload>) =>
      apiClient.put<DataSourceRecord>(`/data-sources/${id}`, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useDeleteDataSource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<void>(`/data-sources/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useTestDataSource() {
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post<{ success: boolean; latencyMs: number }>(`/data-sources/${id}/test`, {}),
  })
}
```

---

### STEP-13: TanStack Query hooks — Reports

Dosya: `apps/web/src/hooks/use-reports.ts`

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ReportDefinition, RunRecord } from '@datascriba/shared-types'
import { apiClient } from '@/lib/api-client'

const QUERY_KEY = ['reports'] as const

interface ReportParameterPayload {
  name: string
  type: string
  label: string
  required: boolean
  defaultValue?: unknown
  options?: Array<{ label: string; value: unknown }>
  dependsOn?: string[]
}

interface CreateReportPayload {
  name: string
  dataSourceId: string
  query: string
  description?: string
  parameters?: ReportParameterPayload[]
  exportFormats: string[]
}

interface RunReportPayload {
  format: 'csv' | 'excel'
  parameters?: Record<string, unknown>
}

export function useReports() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => apiClient.get<ReportDefinition[]>('/reports'),
  })
}

export function useReport(id: string) {
  return useQuery({
    queryKey: [...QUERY_KEY, id],
    queryFn: () => apiClient.get<ReportDefinition>(`/reports/${id}`),
    enabled: Boolean(id),
  })
}

export function useCreateReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateReportPayload) =>
      apiClient.post<ReportDefinition>('/reports', payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useUpdateReport(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: Partial<CreateReportPayload>) =>
      apiClient.put<ReportDefinition>(`/reports/${id}`, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useDeleteReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<void>(`/reports/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useRunReport() {
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: RunReportPayload }) =>
      apiClient.postRaw(`/reports/${id}/run`, payload),
  })
}

export function useReportRuns(reportId: string) {
  return useQuery({
    queryKey: [...QUERY_KEY, reportId, 'runs'],
    queryFn: () => apiClient.get<RunRecord[]>(`/reports/${reportId}/runs`),
    enabled: Boolean(reportId),
  })
}
```

---

### STEP-14: Zustand Editor Store

Dosya: `apps/web/src/store/report-editor.store.ts`

```typescript
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
```

---

### STEP-15: TailwindCSS globals.css

Dosya: `apps/web/src/app/globals.css`

```css
@import "tailwindcss";

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 238.7 83.5% 66.7%;
    --primary-foreground: 0 0% 100%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 238.7 83.5% 66.7%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 238.7 83.5% 66.7%;
    --primary-foreground: 0 0% 100%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 238.7 83.5% 66.7%;
  }

  * {
    border-color: hsl(var(--border));
  }

  body {
    background-color: hsl(var(--background));
    color: hsl(var(--foreground));
    font-family: Inter, system-ui, sans-serif;
  }
}
```

---

### STEP-16: shadcn/ui temel bileşenler

**STEP-16a:** `apps/web/src/components/ui/button.tsx`

```tsx
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  },
)
Button.displayName = 'Button'
```

**STEP-16b:** `apps/web/src/components/ui/input.tsx`

```tsx
import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
)
Input.displayName = 'Input'
```

**STEP-16c:** `apps/web/src/components/ui/label.tsx`

```tsx
'use client'
import * as LabelPrimitive from '@radix-ui/react-label'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from '@/lib/utils'

const labelVariants = cva(
  'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
)

export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root ref={ref} className={cn(labelVariants(), className)} {...props} />
))
Label.displayName = LabelPrimitive.Root.displayName
```

**STEP-16d:** `apps/web/src/components/ui/select.tsx`

```tsx
'use client'
import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'
import * as React from 'react'
import { cn } from '@/lib/utils'

export const Select = SelectPrimitive.Root
export const SelectGroup = SelectPrimitive.Group
export const SelectValue = SelectPrimitive.Value

export const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

export const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = 'popper', ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        'relative z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md',
        position === 'popper' && 'translate-y-1',
        className,
      )}
      position={position}
      {...props}
    >
      <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
SelectContent.displayName = SelectPrimitive.Content.displayName

export const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = SelectPrimitive.Item.displayName
```

**STEP-16e:** `apps/web/src/components/ui/badge.tsx`

```tsx
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        outline: 'text-foreground',
        success: 'border-transparent bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
        warning: 'border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}
```

**STEP-16f:** `apps/web/src/components/ui/card.tsx`

```tsx
import * as React from 'react'
import { cn } from '@/lib/utils'

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('rounded-lg border bg-card text-card-foreground shadow-sm', className)}
      {...props}
    />
  ),
)
Card.displayName = 'Card'

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
  ),
)
CardHeader.displayName = 'CardHeader'

export const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('text-2xl font-semibold leading-none tracking-tight', className)} {...props} />
  ),
)
CardTitle.displayName = 'CardTitle'

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
  ),
)
CardContent.displayName = 'CardContent'

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center p-6 pt-0', className)} {...props} />
  ),
)
CardFooter.displayName = 'CardFooter'
```

**STEP-16g:** `apps/web/src/components/ui/dialog.tsx`

```tsx
'use client'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import * as React from 'react'
import { cn } from '@/lib/utils'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogPortal = DialogPrimitive.Portal

export const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn('fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0', className)}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg sm:rounded-lg',
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

export const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props} />
)

export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn('text-lg font-semibold', className)} {...props} />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName
```

**STEP-16h:** `apps/web/src/components/ui/switch.tsx`

```tsx
'use client'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import * as React from 'react'
import { cn } from '@/lib/utils'

export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    className={cn(
      'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input',
      className,
    )}
    ref={ref}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        'pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0',
      )}
    />
  </SwitchPrimitive.Root>
))
Switch.displayName = SwitchPrimitive.Root.displayName
```

---

### STEP-17: Providers

Dosya: `apps/web/src/components/providers.tsx`

```tsx
'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { ThemeProvider } from 'next-themes'
import * as React from 'react'

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60 * 1000, retry: 1 },
    },
  })
}

let browserQueryClient: QueryClient | undefined

function getQueryClient(): QueryClient {
  if (typeof window === 'undefined') return makeQueryClient()
  if (!browserQueryClient) browserQueryClient = makeQueryClient()
  return browserQueryClient
}

interface ProvidersProps {
  children: React.ReactNode
}

export function Providers({ children }: ProvidersProps) {
  const qc = getQueryClient()
  return (
    <QueryClientProvider client={qc}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        {children}
        <ReactQueryDevtools initialIsOpen={false} />
      </ThemeProvider>
    </QueryClientProvider>
  )
}
```

---

### STEP-18: Sidebar Navigation

Dosya: `apps/web/src/components/layout/sidebar.tsx`

```tsx
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
```

---

### STEP-19: Header

Dosya: `apps/web/src/components/layout/header.tsx`

```tsx
'use client'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useLocale } from 'next-intl'
import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function Header() {
  const { theme, setTheme } = useTheme()
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()

  function toggleLocale() {
    const next = locale === 'en' ? 'tr' : 'en'
    const segments = pathname.split('/')
    segments[1] = next
    router.push(segments.join('/'))
  }

  return (
    <header className="flex h-16 items-center justify-end border-b bg-card px-6 gap-2">
      <Button variant="ghost" size="icon" onClick={toggleLocale}>
        <span className="text-xs font-bold">{locale.toUpperCase()}</span>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      >
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
    </header>
  )
}
```

---

### STEP-20: Root layout (locale-aware)

Dosya: `apps/web/src/app/[locale]/layout.tsx`

```tsx
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import type { Metadata } from 'next'
import { Providers } from '@/components/providers'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import '../globals.css'

export const metadata: Metadata = {
  title: 'DataScriba',
  description: 'AI-powered reporting platform',
}

interface LocaleLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params
  const messages = await getMessages()

  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider messages={messages}>
          <Providers>
            <div className="flex h-screen overflow-hidden">
              <Sidebar />
              <div className="flex flex-1 flex-col overflow-hidden">
                <Header />
                <main className="flex-1 overflow-auto p-6">{children}</main>
              </div>
            </div>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
```

---

### STEP-21: Root redirect page

Dosya: `apps/web/src/app/[locale]/page.tsx`

```tsx
import { redirect } from 'next/navigation'
import { useLocale } from 'next-intl'

export default function HomePage() {
  redirect('/reports')
}
```

Dosya: `apps/web/src/app/page.tsx`

```tsx
import { redirect } from 'next/navigation'

export default function RootPage() {
  redirect('/en/reports')
}
```

---

### STEP-22: Data Sources list page

Dosya: `apps/web/src/app/[locale]/data-sources/page.tsx`

```tsx
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
```

Dosya: `apps/web/src/app/[locale]/data-sources/data-sources-client.tsx`

```tsx
'use client'
import { Plus, Trash2, Wifi } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useDataSources, useDeleteDataSource, useTestDataSource } from '@/hooks/use-data-sources'
import { DataSourceDialog } from './data-source-dialog'

export function DataSourcesClient() {
  const t = useTranslations()
  const { data: sources, isLoading } = useDataSources()
  const deleteSource = useDeleteDataSource()
  const testSource = useTestDataSource()
  const [testResults, setTestResults] = useState<Record<string, boolean>>({})
  const [dialogOpen, setDialogOpen] = useState(false)

  async function handleTest(id: string) {
    const result = await testSource.mutateAsync(id)
    setTestResults((prev) => ({ ...prev, [id]: result.success }))
  }

  if (isLoading) return <p className="text-muted-foreground">{t('common.loading')}</p>

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t('dataSource.createNew')}
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sources?.map((source) => (
          <Card key={source.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{source.name}</CardTitle>
                {testResults[source.id] !== undefined && (
                  <Badge variant={testResults[source.id] ? 'success' : 'destructive'}>
                    {testResults[source.id] ? t('common.connected') : t('common.failed')}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {source.host}:{source.port}/{source.database}
              </p>
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleTest(source.id)}
                  disabled={testSource.isPending}
                >
                  <Wifi className="mr-1 h-3 w-3" />
                  {t('common.testConnection')}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => deleteSource.mutate(source.id)}
                  disabled={deleteSource.isPending}
                >
                  <Trash2 className="mr-1 h-3 w-3" />
                  {t('common.delete')}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {sources?.length === 0 && (
          <p className="col-span-full text-muted-foreground">{t('common.noData')}</p>
        )}
      </div>
      <DataSourceDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  )
}
```

---

### STEP-23: Data Source dialog (create/edit)

Dosya: `apps/web/src/app/[locale]/data-sources/data-source-dialog.tsx`

```tsx
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

  async function onSubmit(values: FormValues) {
    await create.mutateAsync(values)
    form.reset()
    onOpenChange(false)
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
```

---

### STEP-24: Reports list page

Dosya: `apps/web/src/app/[locale]/reports/page.tsx`

```tsx
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
```

Dosya: `apps/web/src/app/[locale]/reports/reports-client.tsx`

```tsx
'use client'
import { Plus, Play, Trash2, Clock } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useReports, useDeleteReport } from '@/hooks/use-reports'
import { RunReportDialog } from './run-report-dialog'

export function ReportsClient() {
  const t = useTranslations()
  const { data: reports, isLoading } = useReports()
  const deleteReport = useDeleteReport()
  const [runDialogReportId, setRunDialogReportId] = useState<string | null>(null)

  if (isLoading) return <p className="text-muted-foreground">{t('common.loading')}</p>

  return (
    <>
      <div className="flex justify-end">
        <Button asChild>
          <Link href="/reports/new">
            <Plus className="mr-2 h-4 w-4" />
            {t('report.createNew')}
          </Link>
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reports?.map((report) => (
          <Card key={report.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{report.name}</CardTitle>
                <div className="flex gap-1">
                  {report.exportFormats.map((f) => (
                    <Badge key={f} variant="secondary" className="text-xs">{f}</Badge>
                  ))}
                </div>
              </div>
              {report.description && (
                <p className="text-sm text-muted-foreground">{report.description}</p>
              )}
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" onClick={() => setRunDialogReportId(report.id)}>
                  <Play className="mr-1 h-3 w-3" />
                  {t('report.run')}
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/reports/${report.id}/edit`}>
                    {t('common.edit')}
                  </Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/reports/${report.id}/runs`}>
                    <Clock className="mr-1 h-3 w-3" />
                    {t('report.runHistory')}
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => deleteReport.mutate(report.id)}
                  disabled={deleteReport.isPending}
                >
                  <Trash2 className="mr-1 h-3 w-3" />
                  {t('common.delete')}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {reports?.length === 0 && (
          <p className="col-span-full text-muted-foreground">{t('common.noData')}</p>
        )}
      </div>
      {runDialogReportId && (
        <RunReportDialog
          reportId={runDialogReportId}
          open={Boolean(runDialogReportId)}
          onOpenChange={(open) => { if (!open) setRunDialogReportId(null) }}
        />
      )}
    </>
  )
}
```

---

### STEP-25: Run Report Dialog

Dosya: `apps/web/src/app/[locale]/reports/run-report-dialog.tsx`

```tsx
'use client'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useRunReport } from '@/hooks/use-reports'

const schema = z.object({
  format: z.enum(['csv', 'excel']),
})

type FormValues = z.infer<typeof schema>

interface RunReportDialogProps {
  reportId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RunReportDialog({ reportId, open, onOpenChange }: RunReportDialogProps) {
  const t = useTranslations('report')
  const tc = useTranslations('common')
  const runReport = useRunReport()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { format: 'csv' },
  })

  async function onSubmit(values: FormValues) {
    const res = await runReport.mutateAsync({ id: reportId, payload: { format: values.format } })
    if (res.ok) {
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition') ?? ''
      const match = /filename="([^"]+)"/.exec(disposition)
      const filename = match?.[1] ?? `report.${values.format === 'excel' ? 'xlsx' : 'csv'}`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = decodeURIComponent(filename)
      a.click()
      URL.revokeObjectURL(url)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('run')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label>{t('format')}</Label>
            <Select
              value={form.watch('format')}
              onValueChange={(v) => form.setValue('format', v as 'csv' | 'excel')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="excel">Excel</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={runReport.isPending}>
              {t('download')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

---

### STEP-26: Report Editor — New Report page

Dosya: `apps/web/src/app/[locale]/reports/new/page.tsx`

```tsx
import { ReportEditorClient } from '../[id]/edit/report-editor-client'

export default function NewReportPage() {
  return <ReportEditorClient />
}
```

---

### STEP-27: Report Editor Client — Full Designer

Dosya: `apps/web/src/app/[locale]/reports/[id]/edit/page.tsx`

```tsx
import { ReportEditorClient } from './report-editor-client'

interface EditReportPageProps {
  params: Promise<{ id: string }>
}

export default async function EditReportPage({ params }: EditReportPageProps) {
  const { id } = await params
  return <ReportEditorClient reportId={id} />
}
```

Dosya: `apps/web/src/app/[locale]/reports/[id]/edit/report-editor-client.tsx`

```tsx
'use client'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useReport, useCreateReport, useUpdateReport } from '@/hooks/use-reports'
import { useDataSources } from '@/hooks/use-data-sources'
import { useReportEditorStore } from '@/store/report-editor.store'
import { ParameterList } from './parameter-list'
import { useRouter } from 'next/navigation'

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false })

interface ReportEditorClientProps {
  reportId?: string
}

export function ReportEditorClient({ reportId }: ReportEditorClientProps) {
  const t = useTranslations('report')
  const tc = useTranslations('common')
  const router = useRouter()

  const store = useReportEditorStore()
  const { data: report } = useReport(reportId ?? '')
  const { data: dataSources } = useDataSources()
  const createReport = useCreateReport()
  const updateReport = useUpdateReport(reportId ?? '')

  useEffect(() => {
    if (report) store.loadReport(report as Parameters<typeof store.loadReport>[0])
  }, [report])

  async function handleSave() {
    const payload = {
      name: store.name,
      description: store.description || undefined,
      dataSourceId: store.dataSourceId,
      query: store.query,
      parameters: store.parameters,
      exportFormats: store.exportFormats,
    }
    if (reportId) {
      await updateReport.mutateAsync(payload)
    } else {
      const created = await createReport.mutateAsync(payload)
      router.push(`/reports/${created.id}/edit`)
    }
    store.resetDirty()
  }

  const isPending = createReport.isPending || updateReport.isPending

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {reportId ? t('editTitle') : t('createNew')}
        </h1>
        <div className="flex gap-2">
          {store.isDirty && (
            <span className="text-sm text-muted-foreground self-center">Unsaved changes</span>
          )}
          <Button onClick={handleSave} disabled={isPending}>
            {tc('save')}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>{tc('name')}</Label>
            <Input value={store.name} onChange={(e) => store.setField('name', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>{tc('description')}</Label>
            <Input
              value={store.description}
              onChange={(e) => store.setField('description', e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Data Source</Label>
            <Select
              value={store.dataSourceId}
              onValueChange={(v) => store.setField('dataSourceId', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select data source..." />
              </SelectTrigger>
              <SelectContent>
                {dataSources?.map((ds) => (
                  <SelectItem key={ds.id} value={ds.id}>{ds.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>{t('exportFormats')}</Label>
            <div className="flex gap-4">
              {(['csv', 'excel'] as const).map((fmt) => (
                <div key={fmt} className="flex items-center gap-2">
                  <Switch
                    checked={store.exportFormats.includes(fmt)}
                    onCheckedChange={(checked) => {
                      const next = checked
                        ? [...store.exportFormats, fmt]
                        : store.exportFormats.filter((f) => f !== fmt)
                      store.setField('exportFormats', next)
                    }}
                  />
                  <Label className="capitalize">{fmt}</Label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <Label>{t('query')}</Label>
          <div className="h-64 rounded-md border overflow-hidden">
            <MonacoEditor
              height="100%"
              language="sql"
              theme="vs-dark"
              value={store.query}
              onChange={(v) => store.setField('query', v ?? '')}
              options={{ minimap: { enabled: false }, fontSize: 13, wordWrap: 'on' }}
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t('parameters')}</Label>
        <ParameterList />
      </div>
    </div>
  )
}
```

---

### STEP-28: Parameter List with DnD

Dosya: `apps/web/src/app/[locale]/reports/[id]/edit/parameter-list.tsx`

```tsx
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
  const tc = useTranslations('common')
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
```

---

### STEP-29: Run History page

Dosya: `apps/web/src/app/[locale]/reports/[id]/runs/page.tsx`

```tsx
import { RunHistoryClient } from './run-history-client'

interface RunsPageProps {
  params: Promise<{ id: string }>
}

export default async function RunsPage({ params }: RunsPageProps) {
  const { id } = await params
  return <RunHistoryClient reportId={id} />
}
```

Dosya: `apps/web/src/app/[locale]/reports/[id]/runs/run-history-client.tsx`

```tsx
'use client'
import { format } from 'date-fns'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useReportRuns } from '@/hooks/use-reports'

interface RunHistoryClientProps {
  reportId: string
}

export function RunHistoryClient({ reportId }: RunHistoryClientProps) {
  const t = useTranslations('report')
  const tc = useTranslations('common')
  const { data: runs, isLoading } = useReportRuns(reportId)

  const statusVariant = (status: string) => {
    if (status === 'completed') return 'success' as const
    if (status === 'failed') return 'destructive' as const
    return 'secondary' as const
  }

  if (isLoading) return <p className="text-muted-foreground">{tc('loading')}</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('runHistory')}</h1>
        <Button variant="outline" asChild>
          <Link href={`/reports/${reportId}/edit`}>{tc('back')}</Link>
        </Button>
      </div>
      <div className="space-y-2">
        {runs?.map((run) => (
          <Card key={run.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant={statusVariant(run.status)}>{t(run.status as 'running' | 'completed' | 'failed')}</Badge>
                  <span className="text-sm font-medium uppercase">{run.format}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('startedAt')}: {format(new Date(run.startedAt), 'dd MMM yyyy HH:mm:ss')}
                </p>
                {run.completedAt && (
                  <p className="text-xs text-muted-foreground">
                    {t('completedAt')}: {format(new Date(run.completedAt), 'dd MMM yyyy HH:mm:ss')}
                  </p>
                )}
                {run.errorMessage && (
                  <p className="text-xs text-destructive">{run.errorMessage}</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {runs?.length === 0 && <p className="text-muted-foreground">{tc('noData')}</p>}
      </div>
    </div>
  )
}
```

---

### STEP-30: Settings page (placeholder)

Dosya: `apps/web/src/app/[locale]/settings/page.tsx`

```tsx
export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="text-muted-foreground">Coming soon.</p>
    </div>
  )
}
```

---

### STEP-31: Not Found page

Dosya: `apps/web/src/app/[locale]/not-found.tsx`

```tsx
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <h2 className="text-3xl font-bold">404</h2>
      <p className="text-muted-foreground">Page not found</p>
      <Button asChild>
        <Link href="/reports">Go to Reports</Link>
      </Button>
    </div>
  )
}
```

---

### STEP-32: turbo.json güncelleme

Mevcut `turbo.json` dosyasına `web` pipeline ekle:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "type-check": {},
    "test": {
      "dependsOn": ["^build"]
    },
    "test:coverage": {
      "dependsOn": ["^build"]
    }
  }
}
```

---

### STEP-33: packages/shared-types — DataSourceRecord type

`packages/shared-types/src/index.ts` dosyasında `DataSourceRecord` tipinin eksik alanları varsa ekle (host, port, database, username alanları). Bu tipin `apps/api` datasource repository'si ile uyumlu olduğunu doğrula.

---

### STEP-34: Doğrulama Komutları

Builder, her adımdan sonra aşağıdaki komutları çalıştırarak doğrulama yapmalı:

```bash
# Type check
cd apps/web && pnpm type-check

# Lint
cd apps/web && pnpm lint

# Build check (dev olmadan)
cd apps/web && pnpm build
```

---

### STEP-35: PHASE_4_PROGRESS.md oluştur

Builder, tüm adımları tamamladıktan sonra `PHASE_4_PROGRESS.md` dosyasını oluşturmalı:

```markdown
# PHASE_4_PROGRESS.md

**Faz:** 4 — Görsel Rapor Tasarımcısı
**Durum:** ✅ Tamamlandı
**Tarih:** [TARİH]

## Tamamlanan Adımlar

- [x] STEP-01: apps/web package.json
- [x] STEP-02: tsconfig.json
- [x] STEP-03: next.config.ts
- [x] STEP-04: postcss.config.mjs
- [x] STEP-05: lib/utils.ts
- [x] STEP-06: lib/env.ts
- [x] STEP-07: .env.local
- [x] STEP-08: i18n message dosyaları (en + tr)
- [x] STEP-09: i18n request.ts + routing.ts
- [x] STEP-10: middleware.ts
- [x] STEP-11: lib/api-client.ts
- [x] STEP-12: hooks/use-data-sources.ts
- [x] STEP-13: hooks/use-reports.ts
- [x] STEP-14: store/report-editor.store.ts
- [x] STEP-15: globals.css (TailwindCSS v4)
- [x] STEP-16a-h: UI bileşenleri (button, input, label, select, badge, card, dialog, switch)
- [x] STEP-17: providers.tsx
- [x] STEP-18: layout/sidebar.tsx
- [x] STEP-19: layout/header.tsx
- [x] STEP-20: app/[locale]/layout.tsx
- [x] STEP-21: app/[locale]/page.tsx + app/page.tsx
- [x] STEP-22: data-sources page + client
- [x] STEP-23: data-source-dialog.tsx
- [x] STEP-24: reports page + client
- [x] STEP-25: run-report-dialog.tsx
- [x] STEP-26: reports/new/page.tsx
- [x] STEP-27: report-editor-client.tsx
- [x] STEP-28: parameter-list.tsx (DnD)
- [x] STEP-29: run-history page + client
- [x] STEP-30: settings page
- [x] STEP-31: not-found page
- [x] STEP-32: turbo.json güncelleme
- [x] STEP-33: shared-types DataSourceRecord doğrulama
- [x] STEP-34: Doğrulama komutları
- [x] STEP-35: PHASE_4_PROGRESS.md

## Notlar
- apps/web Next.js 15 + TailwindCSS v4 + shadcn/ui v2 ile oluşturuldu
- i18n: EN + TR (next-intl v3)
- Dark mode: next-themes
- SQL editörü: Monaco (dynamic import, ssr:false)
- Sürükle-bırak parametre sıralama: @dnd-kit
- Undo/redo: zundo + Zustand
```

---

## Tamamlanma Kriterleri

- [ ] `pnpm type-check --filter=web` hatasız geçiyor
- [ ] `pnpm lint --filter=web` hatasız geçiyor
- [ ] `pnpm build --filter=web` başarıyla tamamlanıyor
- [ ] `/en/data-sources` sayfası API'den veri kaynakları listiyor
- [ ] `/en/reports` sayfası rapor listesini gösteriyor
- [ ] Yeni rapor oluşturma formu çalışıyor
- [ ] Monaco SQL editörü yükleniyor
- [ ] Parametre sürükle-bırak sıralama çalışıyor
- [ ] Rapor çalıştırma ve dosya indirme çalışıyor
- [ ] Dark mode toggle çalışıyor
- [ ] EN/TR dil değişimi çalışıyor
