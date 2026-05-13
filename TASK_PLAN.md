# TASK_PLAN.md — Phase 3: Rapor Motoru (Core Engine)

**Agent:** builder
**Phase:** 3
**Effort:** L (~2-3 weeks)
**Created by:** planner
**Date:** 2026-05-13

---

## Context

- **Working directory (monorepo root):** `C:\Users\Cub\datascriba\Projects\datascriba`
- **Platform:** Windows 11, PowerShell
- **Package manager:** pnpm 9.15.4
- **Stack:** Turborepo 2.x + NestJS 10 + Fastify + Vitest + TypeScript 5.5 strict
- **Phase 2 completed:** DataSource CRUD, MSSQL driver, query execution at `/api/v1/data-sources`
- **API uses Fastify** (not Express) — `StreamableFile` from `@nestjs/common` works the same way

### Key Architectural Decisions for Phase 3

| Decision | Choice | Rationale |
|---|---|---|
| Package location | `packages/report-engine` | Reusable by future worker (Phase 6); clean from NestJS |
| Template engine | `handlebars@4.x` | ROADMAP.md mandate; mature, secure |
| Parameter validation | Zod schemas | CLAUDE.md mandate; compile-time + runtime safety |
| CSV renderer | `papaparse@5.x` | ROADMAP.md mandate; streaming-friendly |
| Excel renderer | `exceljs@4.x` | ROADMAP.md mandate; supports styles + freeze |
| PDF renderer | `puppeteer@22.x` | ROADMAP.md mandate; full `puppeteer` (includes Chrome) |
| Word renderer | `docx@8.x` | ROADMAP.md mandate; pure JS, no native deps |
| File output | `apps/api/output/` directory | ROADMAP.md mandate; NestJS `StreamableFile` for download |
| Run history | In-memory Map stub | Same pattern as Phase 2; Prisma in Phase later |
| Workspace stub | `'default'` hardcoded | Auth/RBAC deferred to Phase post-3 |
| HTML renderer | Returns `Buffer` of UTF-8 HTML string | Preview endpoint; no extra dep needed |
| Report parameter injection | Handlebars compile + `escapeExpression` for HTML; raw values for SQL | SQL params go through parameterized query, not string concat |

---

## Prerequisites Verification

Before starting, confirm:
1. `node --version` returns `v22.x.x`
2. Working directory is `C:\Users\Cub\datascriba\Projects\datascriba`
3. Phase 2 is complete — `GET http://localhost:3001/api/v1/data-sources` returns `[]`
4. `pnpm --filter=@datascriba/db-drivers run test` passes (query-guard + crypto tests)

---

## Steps

### Step 1 — Install dependencies

Run from monorepo root (PowerShell):

```powershell
# Add report-engine package deps
pnpm --filter=@datascriba/report-engine add handlebars@^4.7.8 papaparse@^5.4.1 exceljs@^4.4.0 puppeteer@^22.15.0 docx@^8.5.0 zod@^3.24.1

# Add report-engine dev deps
pnpm --filter=@datascriba/report-engine add -D typescript vitest unplugin-swc @swc/core @types/node @vitest/coverage-v8 @types/papaparse @datascriba/tsconfig @datascriba/eslint-config @datascriba/shared-types

# Add @datascriba/report-engine as dep in api
pnpm --filter=@datascriba/api add @datascriba/report-engine

# Add fs-extra for output directory management in api
pnpm --filter=@datascriba/api add fs-extra
pnpm --filter=@datascriba/api add -D @types/fs-extra
```

---

### Step 2 — Scaffold `packages/report-engine`

Create the directory structure:

```
packages/report-engine/
  src/
    index.ts
    types.ts
    template-engine.ts
    parameter-validator.ts
    renderers/
      renderer.interface.ts
      csv.renderer.ts
      excel.renderer.ts
      pdf.renderer.ts
      word.renderer.ts
      html.renderer.ts
    renderers/index.ts
    errors.ts
    renderers/
      csv.renderer.spec.ts
      excel.renderer.spec.ts
      pdf.renderer.spec.ts
      word.renderer.spec.ts
  package.json
  tsconfig.json
  vitest.config.ts
```

---

#### File: `packages/report-engine/package.json`

```json
{
  "name": "@datascriba/report-engine",
  "version": "0.0.1",
  "private": true,
  "license": "Apache-2.0",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "type-check": "tsc --noEmit",
    "lint": "eslint \"src/**/*.ts\"",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  },
  "dependencies": {
    "@datascriba/shared-types": "workspace:*",
    "docx": "^8.5.0",
    "exceljs": "^4.4.0",
    "handlebars": "^4.7.8",
    "papaparse": "^5.4.1",
    "puppeteer": "^22.15.0",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@datascriba/eslint-config": "workspace:*",
    "@datascriba/tsconfig": "workspace:*",
    "@swc/core": "^1.15.33",
    "@types/node": "^22.10.7",
    "@types/papaparse": "^5.3.14",
    "@vitest/coverage-v8": "^2.1.9",
    "typescript": "^5.5.4",
    "unplugin-swc": "^1.5.9",
    "vitest": "^2.1.9"
  }
}
```

---

#### File: `packages/report-engine/tsconfig.json`

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "@datascriba/tsconfig/base.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "Node",
    "target": "ES2022",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "verbatimModuleSyntax": false,
    "isolatedModules": false,
    "strict": true,
    "noUncheckedIndexedAccess": false,
    "exactOptionalPropertyTypes": false
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.spec.ts"]
}
```

---

#### File: `packages/report-engine/vitest.config.ts`

```typescript
import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['dist/**', 'node_modules/**', '**/*.spec.ts'],
    },
  },
  plugins: [
    swc.vite({
      jsc: {
        parser: {
          syntax: 'typescript',
          decorators: false,
        },
        target: 'es2022',
      },
    }),
  ],
})
```

---

### Step 3 — Add shared types to `packages/shared-types`

#### File: `packages/shared-types/src/report.ts` (NEW FILE)

```typescript
import type { ColumnMeta, Row } from './data-source'

// ─── Parameter Types ──────────────────────────────────────────────────────────

export type ReportParameterType =
  | 'string'
  | 'number'
  | 'date'
  | 'dateRange'
  | 'select'
  | 'multiSelect'
  | 'boolean'

export interface ReportParameterOption {
  label: string
  value: unknown
}

export interface ReportParameterOptions {
  sourceQuery?: string
  static?: ReportParameterOption[]
}

export interface ReportParameter {
  name: string
  label: string
  type: ReportParameterType
  required: boolean
  defaultValue?: unknown
  options?: ReportParameterOptions
  dependsOn?: string[]
}

// ─── Export Formats ───────────────────────────────────────────────────────────

export type ExportFormat = 'csv' | 'xlsx' | 'pdf' | 'docx' | 'html'

// ─── Layout ───────────────────────────────────────────────────────────────────

export interface ReportLayoutColumn {
  field: string
  header: string
  width?: number
  format?: string
}

export interface ReportLayout {
  title: string
  columns: ReportLayoutColumn[]
  showRowNumbers?: boolean
  orientation?: 'portrait' | 'landscape'
}

// ─── Report Definition ────────────────────────────────────────────────────────

export interface ReportDefinition {
  id: string
  workspaceId: string
  name: string
  description?: string
  dataSourceId: string
  query: string
  parameters: ReportParameter[]
  layout: ReportLayout
  exportFormats: ExportFormat[]
  version: number
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

// ─── Runtime Data ─────────────────────────────────────────────────────────────

export interface ReportData {
  columns: ColumnMeta[]
  rows: Row[]
  rowCount: number
  durationMs: number
}

export interface RenderOptions {
  format: ExportFormat
  layout: ReportLayout
  reportName: string
  parameters?: Record<string, unknown>
}

// ─── Run History ──────────────────────────────────────────────────────────────

export type RunStatus = 'pending' | 'running' | 'success' | 'failed'

export interface RunRecord {
  id: string
  reportId: string
  workspaceId: string
  format: ExportFormat
  status: RunStatus
  triggeredBy: string
  startedAt: Date
  finishedAt?: Date
  durationMs?: number
  rowCount?: number
  outputPath?: string
  errorMessage?: string
}
```

---

#### Modify: `packages/shared-types/src/index.ts`

Replace the full file content with:

```typescript
export type { ApiResponse, PaginatedResponse } from './common'
export type {
  DataSourceType,
  TableMeta,
  ColumnMeta,
  Row,
  QueryResult,
  DataSourceRecord,
} from './data-source'
export type {
  ReportParameterType,
  ReportParameterOption,
  ReportParameterOptions,
  ReportParameter,
  ExportFormat,
  ReportLayoutColumn,
  ReportLayout,
  ReportDefinition,
  ReportData,
  RenderOptions,
  RunStatus,
  RunRecord,
} from './report'
```

---

### Step 4 — Build `packages/report-engine` core types and errors

#### File: `packages/report-engine/src/errors.ts`

```typescript
export class ReportEngineError extends Error {
  constructor(
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'ReportEngineError'
    if (cause instanceof Error) {
      this.stack = `${this.stack ?? ''}\nCaused by: ${cause.stack ?? cause.message}`
    }
  }
}

export class TemplateError extends ReportEngineError {
  constructor(message: string, cause?: unknown) {
    super(message, cause)
    this.name = 'TemplateError'
  }
}

export class ParameterValidationError extends ReportEngineError {
  constructor(
    public readonly paramName: string,
    message: string,
  ) {
    super(`Parameter '${paramName}': ${message}`)
    this.name = 'ParameterValidationError'
  }
}

export class RendererError extends ReportEngineError {
  constructor(
    public readonly format: string,
    message: string,
    cause?: unknown,
  ) {
    super(`Renderer [${format}]: ${message}`, cause)
    this.name = 'RendererError'
  }
}

export class UnsupportedFormatError extends ReportEngineError {
  constructor(format: string) {
    super(`Export format '${format}' is not supported`)
    this.name = 'UnsupportedFormatError'
  }
}
```

---

### Step 5 — Build the Handlebars template engine

#### File: `packages/report-engine/src/template-engine.ts`

```typescript
import Handlebars from 'handlebars'
import { TemplateError } from './errors'

// Register custom helpers once at module load

/**
 * {{formatDate value "YYYY-MM-DD"}}
 * Formats a Date or ISO string. Defaults to ISO date string if no format arg.
 */
Handlebars.registerHelper('formatDate', (value: unknown, fmt: unknown): string => {
  const date = value instanceof Date ? value : new Date(String(value))
  if (isNaN(date.getTime())) return ''
  if (typeof fmt === 'string' && fmt.length > 0) {
    // Minimal format: replace tokens
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return fmt
      .replace('YYYY', String(y))
      .replace('MM', m)
      .replace('DD', d)
  }
  return date.toISOString().slice(0, 10)
})

/**
 * {{formatNumber value 2}}
 * Formats a number with the given decimal places (default 0).
 */
Handlebars.registerHelper('formatNumber', (value: unknown, decimals: unknown): string => {
  const num = Number(value)
  if (isNaN(num)) return ''
  const dec = typeof decimals === 'number' ? decimals : 0
  return num.toFixed(dec)
})

/**
 * {{ifEq a b}}...{{/ifEq}}
 * Block helper: renders block if a === b.
 */
Handlebars.registerHelper('ifEq', function (
  this: unknown,
  a: unknown,
  b: unknown,
  options: Handlebars.HelperOptions,
): string {
  return a === b ? options.fn(this) : options.inverse(this)
})

/**
 * {{ifGt a b}}...{{/ifGt}}
 * Block helper: renders block if a > b.
 */
Handlebars.registerHelper('ifGt', function (
  this: unknown,
  a: unknown,
  b: unknown,
  options: Handlebars.HelperOptions,
): string {
  return Number(a) > Number(b) ? options.fn(this) : options.inverse(this)
})

/**
 * Compiles a Handlebars SQL template with the given parameters.
 *
 * IMPORTANT: This produces the SQL string with parameter values EMBEDDED only
 * as literals for query planning purposes. The actual SQL execution MUST still
 * use parameterized queries at the driver level — never pass the output of this
 * function directly to string-concatenated SQL.
 *
 * The template should use Handlebars syntax:
 *   SELECT * FROM orders WHERE date >= '{{startDate}}' AND date <= '{{endDate}}'
 *
 * For safe SQL injection prevention, the template engine uses
 * Handlebars.escapeExpression on all substituted values.
 */
export function compileTemplate(
  template: string,
  parameters: Record<string, unknown>,
): string {
  let compiled: HandlebarsTemplateDelegate<Record<string, unknown>>
  try {
    compiled = Handlebars.compile(template, { noEscape: false })
  } catch (err) {
    throw new TemplateError(`Failed to compile Handlebars template`, err)
  }
  try {
    return compiled(parameters)
  } catch (err) {
    throw new TemplateError(`Failed to render Handlebars template`, err)
  }
}

/**
 * Compiles an HTML template (for the HTML/PDF renderers).
 * Uses Handlebars with escapeExpression active (XSS-safe).
 */
export function compileHtmlTemplate(
  template: string,
  context: Record<string, unknown>,
): string {
  let compiled: HandlebarsTemplateDelegate<Record<string, unknown>>
  try {
    compiled = Handlebars.compile(template, { noEscape: false })
  } catch (err) {
    throw new TemplateError(`Failed to compile HTML template`, err)
  }
  try {
    return compiled(context)
  } catch (err) {
    throw new TemplateError(`Failed to render HTML template`, err)
  }
}
```

---

### Step 6 — Build the parameter validator

#### File: `packages/report-engine/src/parameter-validator.ts`

```typescript
import { z } from 'zod'
import type { ReportParameter } from '@datascriba/shared-types'
import { ParameterValidationError } from './errors'

// ─── Zod schemas for each parameter type ─────────────────────────────────────

const stringSchema = z.string()
const numberSchema = z.number()
const booleanSchema = z.boolean()
const dateSchema = z.union([z.date(), z.string().datetime({ offset: true }).transform((s) => new Date(s))])
const dateRangeSchema = z.object({
  from: z.union([z.date(), z.string().datetime({ offset: true }).transform((s) => new Date(s))]),
  to: z.union([z.date(), z.string().datetime({ offset: true }).transform((s) => new Date(s))]),
})

function getSchemaForType(param: ReportParameter): z.ZodTypeAny {
  switch (param.type) {
    case 'string':
      return stringSchema
    case 'number':
      return numberSchema
    case 'boolean':
      return booleanSchema
    case 'date':
      return dateSchema
    case 'dateRange':
      return dateRangeSchema
    case 'select':
      return z.unknown()
    case 'multiSelect':
      return z.array(z.unknown())
    default: {
      const exhaustive: never = param.type
      throw new ParameterValidationError(
        String(exhaustive),
        `Unknown parameter type: ${String(exhaustive)}`,
      )
    }
  }
}

/**
 * Validates and coerces the raw parameter values against the ReportParameter definitions.
 * Returns a new Record with validated (possibly transformed) values.
 * @throws {ParameterValidationError} on the first invalid parameter
 */
export function validateParameters(
  definitions: ReportParameter[],
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const param of definitions) {
    const value = Object.prototype.hasOwnProperty.call(raw, param.name)
      ? raw[param.name]
      : param.defaultValue

    if (value === undefined || value === null) {
      if (param.required) {
        throw new ParameterValidationError(param.name, 'is required but was not provided')
      }
      // Optional param not provided — skip
      continue
    }

    const schema = getSchemaForType(param)
    const parsed = schema.safeParse(value)

    if (!parsed.success) {
      throw new ParameterValidationError(
        param.name,
        parsed.error.issues.map((i) => i.message).join('; '),
      )
    }

    result[param.name] = parsed.data
  }

  return result
}
```

---

### Step 7 — Build the renderer interface

#### File: `packages/report-engine/src/renderers/renderer.interface.ts`

```typescript
import type { ExportFormat, ReportData, RenderOptions } from '@datascriba/shared-types'

export interface ReportRenderer {
  readonly format: ExportFormat
  render(data: ReportData, options: RenderOptions): Promise<Buffer>
}
```

---

### Step 8 — CSV Renderer (implement first)

#### File: `packages/report-engine/src/renderers/csv.renderer.ts`

```typescript
import Papa from 'papaparse'
import type { ReportData, RenderOptions } from '@datascriba/shared-types'
import { RendererError } from '../errors'
import type { ReportRenderer } from './renderer.interface'

export class CsvRenderer implements ReportRenderer {
  readonly format = 'csv' as const

  render(data: ReportData, options: RenderOptions): Promise<Buffer> {
    try {
      const fields = options.layout.columns.map((c) => c.header)
      const fieldMap = options.layout.columns.map((c) => c.field)

      const rows = data.rows.map((row) =>
        fieldMap.map((field) => {
          const val = row[field]
          return val === undefined || val === null ? '' : val
        }),
      )

      const csv = Papa.unparse({ fields, data: rows }, { header: true, newline: '\r\n' })
      return Promise.resolve(Buffer.from(csv, 'utf-8'))
    } catch (err) {
      throw new RendererError('csv', 'Failed to render CSV', err)
    }
  }
}
```

---

#### File: `packages/report-engine/src/renderers/csv.renderer.spec.ts`

```typescript
import { describe, expect, it } from 'vitest'
import type { ReportData, RenderOptions } from '@datascriba/shared-types'
import { CsvRenderer } from './csv.renderer'

const SAMPLE_DATA: ReportData = {
  columns: [
    { name: 'id', dataType: 'int', nullable: false, isPrimaryKey: true, defaultValue: null },
    { name: 'name', dataType: 'varchar', nullable: false, isPrimaryKey: false, defaultValue: null },
    { name: 'amount', dataType: 'decimal', nullable: true, isPrimaryKey: false, defaultValue: null },
  ],
  rows: [
    { id: 1, name: 'Alice', amount: 99.5 },
    { id: 2, name: 'Bob', amount: null },
    { id: 3, name: 'Carol, Inc.', amount: 200 },
  ],
  rowCount: 3,
  durationMs: 12,
}

const OPTIONS: RenderOptions = {
  format: 'csv',
  reportName: 'Test Report',
  layout: {
    title: 'Test Report',
    columns: [
      { field: 'id', header: 'ID' },
      { field: 'name', header: 'Name' },
      { field: 'amount', header: 'Amount' },
    ],
  },
}

describe('CsvRenderer', () => {
  const renderer = new CsvRenderer()

  it('format is csv', () => {
    expect(renderer.format).toBe('csv')
  })

  it('produces a Buffer', async () => {
    const buf = await renderer.render(SAMPLE_DATA, OPTIONS)
    expect(buf).toBeInstanceOf(Buffer)
    expect(buf.length).toBeGreaterThan(0)
  })

  it('first line is header row', async () => {
    const buf = await renderer.render(SAMPLE_DATA, OPTIONS)
    const lines = buf.toString('utf-8').split('\r\n')
    expect(lines[0]).toBe('ID,Name,Amount')
  })

  it('handles null values as empty string', async () => {
    const buf = await renderer.render(SAMPLE_DATA, OPTIONS)
    const text = buf.toString('utf-8')
    // Bob has null amount — should appear as empty
    expect(text).toContain('Bob,')
  })

  it('quotes fields containing commas', async () => {
    const buf = await renderer.render(SAMPLE_DATA, OPTIONS)
    const text = buf.toString('utf-8')
    expect(text).toContain('"Carol, Inc."')
  })

  it('row count matches input', async () => {
    const buf = await renderer.render(SAMPLE_DATA, OPTIONS)
    const lines = buf
      .toString('utf-8')
      .split('\r\n')
      .filter((l) => l.length > 0)
    // header + 3 data rows
    expect(lines).toHaveLength(4)
  })
})
```

---

### Step 9 — Excel Renderer

#### File: `packages/report-engine/src/renderers/excel.renderer.ts`

```typescript
import ExcelJS from 'exceljs'
import type { ReportData, RenderOptions } from '@datascriba/shared-types'
import { RendererError } from '../errors'
import type { ReportRenderer } from './renderer.interface'

export class ExcelRenderer implements ReportRenderer {
  readonly format = 'xlsx' as const

  async render(data: ReportData, options: RenderOptions): Promise<Buffer> {
    try {
      const workbook = new ExcelJS.Workbook()
      workbook.created = new Date()
      workbook.modified = new Date()

      const sheet = workbook.addWorksheet(options.reportName.slice(0, 31))

      // Define columns with widths
      sheet.columns = options.layout.columns.map((col) => ({
        header: col.header,
        key: col.field,
        width: col.width ?? 18,
      }))

      // Style header row
      const headerRow = sheet.getRow(1)
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF0F172A' },
        }
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FF6366F1' } },
        }
      })
      headerRow.height = 22

      // Freeze header row
      sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }]

      // Add data rows
      for (const row of data.rows) {
        const values: Record<string, unknown> = {}
        for (const col of options.layout.columns) {
          values[col.field] = row[col.field] ?? null
        }
        sheet.addRow(values)
      }

      // Auto-filter on header
      sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: options.layout.columns.length },
      }

      const arrayBuffer = await workbook.xlsx.writeBuffer()
      return Buffer.from(arrayBuffer)
    } catch (err) {
      throw new RendererError('xlsx', 'Failed to render Excel workbook', err)
    }
  }
}
```

---

#### File: `packages/report-engine/src/renderers/excel.renderer.spec.ts`

```typescript
import { describe, expect, it } from 'vitest'
import type { ReportData, RenderOptions } from '@datascriba/shared-types'
import { ExcelRenderer } from './excel.renderer'

const SAMPLE_DATA: ReportData = {
  columns: [
    { name: 'product', dataType: 'varchar', nullable: false, isPrimaryKey: false, defaultValue: null },
    { name: 'qty', dataType: 'int', nullable: false, isPrimaryKey: false, defaultValue: null },
    { name: 'price', dataType: 'decimal', nullable: true, isPrimaryKey: false, defaultValue: null },
  ],
  rows: [
    { product: 'Widget A', qty: 10, price: 9.99 },
    { product: 'Gadget B', qty: 5, price: 49.0 },
  ],
  rowCount: 2,
  durationMs: 8,
}

const OPTIONS: RenderOptions = {
  format: 'xlsx',
  reportName: 'Sales Report',
  layout: {
    title: 'Sales Report',
    columns: [
      { field: 'product', header: 'Product', width: 25 },
      { field: 'qty', header: 'Quantity', width: 12 },
      { field: 'price', header: 'Price', width: 12 },
    ],
  },
}

describe('ExcelRenderer', () => {
  const renderer = new ExcelRenderer()

  it('format is xlsx', () => {
    expect(renderer.format).toBe('xlsx')
  })

  it('produces a non-empty Buffer', async () => {
    const buf = await renderer.render(SAMPLE_DATA, OPTIONS)
    expect(buf).toBeInstanceOf(Buffer)
    expect(buf.length).toBeGreaterThan(0)
  })

  it('Buffer starts with PK magic bytes (zip/xlsx format)', async () => {
    const buf = await renderer.render(SAMPLE_DATA, OPTIONS)
    // ZIP magic: 0x50 0x4B 0x03 0x04
    expect(buf[0]).toBe(0x50)
    expect(buf[1]).toBe(0x4b)
    expect(buf[2]).toBe(0x03)
    expect(buf[3]).toBe(0x04)
  })

  it('handles empty data rows', async () => {
    const empty: ReportData = { ...SAMPLE_DATA, rows: [], rowCount: 0 }
    const buf = await renderer.render(empty, OPTIONS)
    expect(buf).toBeInstanceOf(Buffer)
    expect(buf.length).toBeGreaterThan(0)
  })
})
```

---

### Step 10 — Word Renderer

#### File: `packages/report-engine/src/renderers/word.renderer.ts`

```typescript
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  AlignmentType,
  ShadingType,
} from 'docx'
import type { ReportData, RenderOptions } from '@datascriba/shared-types'
import { RendererError } from '../errors'
import type { ReportRenderer } from './renderer.interface'

export class WordRenderer implements ReportRenderer {
  readonly format = 'docx' as const

  async render(data: ReportData, options: RenderOptions): Promise<Buffer> {
    try {
      const { layout } = options
      const columnCount = layout.columns.length

      // Header row
      const headerCells = layout.columns.map(
        (col) =>
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: col.header,
                    bold: true,
                    color: 'FFFFFF',
                    size: 20,
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
            shading: { type: ShadingType.SOLID, color: '0F172A' },
            width: { size: Math.floor(9000 / columnCount), type: WidthType.DXA },
          }),
      )

      const tableRows: TableRow[] = [new TableRow({ children: headerCells, tableHeader: true })]

      // Data rows
      for (const row of data.rows) {
        const cells = layout.columns.map((col) => {
          const val = row[col.field]
          const text = val === undefined || val === null ? '' : String(val)
          return new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text, size: 18 })] })],
            width: { size: Math.floor(9000 / columnCount), type: WidthType.DXA },
          })
        })
        tableRows.push(new TableRow({ children: cells }))
      }

      const table = new Table({ rows: tableRows, width: { size: 100, type: WidthType.PERCENTAGE } })

      const doc = new Document({
        sections: [
          {
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: layout.title, bold: true, size: 28 }),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { after: 300 },
              }),
              table,
            ],
          },
        ],
      })

      const buffer = await Packer.toBuffer(doc)
      return buffer
    } catch (err) {
      throw new RendererError('docx', 'Failed to render Word document', err)
    }
  }
}
```

---

#### File: `packages/report-engine/src/renderers/word.renderer.spec.ts`

```typescript
import { describe, expect, it } from 'vitest'
import type { ReportData, RenderOptions } from '@datascriba/shared-types'
import { WordRenderer } from './word.renderer'

const SAMPLE_DATA: ReportData = {
  columns: [
    { name: 'dept', dataType: 'varchar', nullable: false, isPrimaryKey: false, defaultValue: null },
    { name: 'headcount', dataType: 'int', nullable: false, isPrimaryKey: false, defaultValue: null },
  ],
  rows: [
    { dept: 'Engineering', headcount: 42 },
    { dept: 'Marketing', headcount: 15 },
  ],
  rowCount: 2,
  durationMs: 5,
}

const OPTIONS: RenderOptions = {
  format: 'docx',
  reportName: 'Headcount Report',
  layout: {
    title: 'Headcount Report',
    columns: [
      { field: 'dept', header: 'Department' },
      { field: 'headcount', header: 'Headcount' },
    ],
  },
}

describe('WordRenderer', () => {
  const renderer = new WordRenderer()

  it('format is docx', () => {
    expect(renderer.format).toBe('docx')
  })

  it('produces a non-empty Buffer', async () => {
    const buf = await renderer.render(SAMPLE_DATA, OPTIONS)
    expect(buf).toBeInstanceOf(Buffer)
    expect(buf.length).toBeGreaterThan(0)
  })

  it('Buffer starts with PK magic bytes (docx is a zip)', async () => {
    const buf = await renderer.render(SAMPLE_DATA, OPTIONS)
    expect(buf[0]).toBe(0x50)
    expect(buf[1]).toBe(0x4b)
    expect(buf[2]).toBe(0x03)
    expect(buf[3]).toBe(0x04)
  })

  it('handles empty data rows', async () => {
    const empty: ReportData = { ...SAMPLE_DATA, rows: [], rowCount: 0 }
    const buf = await renderer.render(empty, OPTIONS)
    expect(buf).toBeInstanceOf(Buffer)
    expect(buf.length).toBeGreaterThan(0)
  })
})
```

---

### Step 11 — HTML Renderer

#### File: `packages/report-engine/src/renderers/html.renderer.ts`

```typescript
import Handlebars from 'handlebars'
import type { ReportData, RenderOptions } from '@datascriba/shared-types'
import { RendererError } from '../errors'
import type { ReportRenderer } from './renderer.interface'

// Inline HTML template — Handlebars escapes all values (XSS-safe by default)
const HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{reportName}}</title>
<style>
  body { font-family: Inter, system-ui, sans-serif; margin: 2rem; color: #0f172a; }
  h1 { font-size: 1.5rem; margin-bottom: 1rem; }
  table { border-collapse: collapse; width: 100%; font-size: 0.875rem; }
  thead { background: #0f172a; color: #fff; }
  th { padding: 0.5rem 0.75rem; text-align: left; font-weight: 600; }
  td { padding: 0.4rem 0.75rem; border-bottom: 1px solid #e2e8f0; }
  tr:nth-child(even) { background: #f8fafc; }
  .empty { color: #94a3b8; font-style: italic; }
</style>
</head>
<body>
<h1>{{reportName}}</h1>
<table>
  <thead>
    <tr>
      {{#each columns}}<th>{{this.header}}</th>{{/each}}
    </tr>
  </thead>
  <tbody>
    {{#each rows}}
    <tr>
      {{#each ../columns}}
      <td>{{lookup ../this this.field}}</td>
      {{/each}}
    </tr>
    {{else}}
    <tr><td colspan="{{../columnCount}}" class="empty">No data</td></tr>
    {{/each}}
  </tbody>
</table>
<p style="color:#94a3b8;font-size:0.75rem;margin-top:1rem;">
  {{rowCount}} row(s) — {{durationMs}}ms
</p>
</body>
</html>`

const compiledTemplate = Handlebars.compile(HTML_TEMPLATE, { noEscape: false })

export class HtmlRenderer implements ReportRenderer {
  readonly format = 'html' as const

  render(data: ReportData, options: RenderOptions): Promise<Buffer> {
    try {
      const html = compiledTemplate({
        reportName: options.reportName,
        columns: options.layout.columns,
        rows: data.rows,
        rowCount: data.rowCount,
        durationMs: data.durationMs,
        columnCount: options.layout.columns.length,
      })
      return Promise.resolve(Buffer.from(html, 'utf-8'))
    } catch (err) {
      throw new RendererError('html', 'Failed to render HTML', err)
    }
  }
}
```

---

### Step 12 — PDF Renderer (most complex — implement last)

#### File: `packages/report-engine/src/renderers/pdf.renderer.ts`

```typescript
import puppeteer from 'puppeteer'
import type { ReportData, RenderOptions } from '@datascriba/shared-types'
import { RendererError } from '../errors'
import type { ReportRenderer } from './renderer.interface'
import { HtmlRenderer } from './html.renderer'

export class PdfRenderer implements ReportRenderer {
  readonly format = 'pdf' as const

  private readonly htmlRenderer = new HtmlRenderer()

  async render(data: ReportData, options: RenderOptions): Promise<Buffer> {
    let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null
    try {
      // Produce sanitized HTML via HtmlRenderer (Handlebars escapeExpression active)
      const htmlBuffer = await this.htmlRenderer.render(data, { ...options, format: 'html' })
      const htmlContent = htmlBuffer.toString('utf-8')

      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      })

      const page = await browser.newPage()

      // setContent is safer than navigate-to-data-url — avoids exposing file paths
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' })

      const orientation = options.layout.orientation ?? 'portrait'
      const pdfBuffer = await page.pdf({
        format: 'A4',
        landscape: orientation === 'landscape',
        printBackground: true,
        margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
      })

      return Buffer.from(pdfBuffer)
    } catch (err) {
      throw new RendererError('pdf', 'Failed to render PDF via Puppeteer', err)
    } finally {
      if (browser !== null) {
        await browser.close()
      }
    }
  }
}
```

---

#### File: `packages/report-engine/src/renderers/pdf.renderer.spec.ts`

```typescript
import { describe, expect, it } from 'vitest'
import type { ReportData, RenderOptions } from '@datascriba/shared-types'
import { PdfRenderer } from './pdf.renderer'

// PDF tests are slow (Puppeteer launches Chrome) — extend timeout to 60s
const TIMEOUT_MS = 60_000

const SAMPLE_DATA: ReportData = {
  columns: [
    { name: 'region', dataType: 'varchar', nullable: false, isPrimaryKey: false, defaultValue: null },
    { name: 'sales', dataType: 'int', nullable: false, isPrimaryKey: false, defaultValue: null },
  ],
  rows: [
    { region: 'North', sales: 1200 },
    { region: 'South', sales: 980 },
  ],
  rowCount: 2,
  durationMs: 20,
}

const OPTIONS: RenderOptions = {
  format: 'pdf',
  reportName: 'Regional Sales',
  layout: {
    title: 'Regional Sales',
    columns: [
      { field: 'region', header: 'Region' },
      { field: 'sales', header: 'Sales' },
    ],
    orientation: 'portrait',
  },
}

describe('PdfRenderer', { timeout: TIMEOUT_MS }, () => {
  const renderer = new PdfRenderer()

  it('format is pdf', () => {
    expect(renderer.format).toBe('pdf')
  })

  it('produces a non-empty Buffer starting with %PDF', async () => {
    const buf = await renderer.render(SAMPLE_DATA, OPTIONS)
    expect(buf).toBeInstanceOf(Buffer)
    expect(buf.length).toBeGreaterThan(0)
    // PDF magic bytes: %PDF
    const header = buf.slice(0, 4).toString('ascii')
    expect(header).toBe('%PDF')
  })

  it('handles empty data rows', async () => {
    const empty: ReportData = { ...SAMPLE_DATA, rows: [], rowCount: 0 }
    const buf = await renderer.render(empty, OPTIONS)
    expect(buf).toBeInstanceOf(Buffer)
    const header = buf.slice(0, 4).toString('ascii')
    expect(header).toBe('%PDF')
  })
})
```

---

### Step 13 — Renderers barrel and renderer factory

#### File: `packages/report-engine/src/renderers/index.ts`

```typescript
export { CsvRenderer } from './csv.renderer'
export { ExcelRenderer } from './excel.renderer'
export { HtmlRenderer } from './html.renderer'
export { PdfRenderer } from './pdf.renderer'
export { WordRenderer } from './word.renderer'
export type { ReportRenderer } from './renderer.interface'
```

---

### Step 14 — Report engine orchestrator

#### File: `packages/report-engine/src/report-engine.ts`

```typescript
import type { ExportFormat, ReportData, RenderOptions } from '@datascriba/shared-types'
import { UnsupportedFormatError } from './errors'
import type { ReportRenderer } from './renderers/renderer.interface'
import { CsvRenderer } from './renderers/csv.renderer'
import { ExcelRenderer } from './renderers/excel.renderer'
import { HtmlRenderer } from './renderers/html.renderer'
import { PdfRenderer } from './renderers/pdf.renderer'
import { WordRenderer } from './renderers/word.renderer'

const RENDERERS: ReadonlyMap<ExportFormat, ReportRenderer> = new Map([
  ['csv', new CsvRenderer()],
  ['xlsx', new ExcelRenderer()],
  ['pdf', new PdfRenderer()],
  ['docx', new WordRenderer()],
  ['html', new HtmlRenderer()],
])

/**
 * Renders report data to the requested export format.
 * @throws {UnsupportedFormatError} when the format has no registered renderer
 * @throws {RendererError} when the renderer fails internally
 */
export async function renderReport(
  data: ReportData,
  options: RenderOptions,
): Promise<Buffer> {
  const renderer = RENDERERS.get(options.format)
  if (!renderer) {
    throw new UnsupportedFormatError(options.format)
  }
  return renderer.render(data, options)
}

/**
 * Returns the MIME type for a given export format.
 */
export function getMimeType(format: ExportFormat): string {
  const MIME_MAP: Record<ExportFormat, string> = {
    csv: 'text/csv; charset=utf-8',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    html: 'text/html; charset=utf-8',
  }
  return MIME_MAP[format]
}

/**
 * Returns the file extension (without dot) for a given export format.
 */
export function getFileExtension(format: ExportFormat): string {
  const EXT_MAP: Record<ExportFormat, string> = {
    csv: 'csv',
    xlsx: 'xlsx',
    pdf: 'pdf',
    docx: 'docx',
    html: 'html',
  }
  return EXT_MAP[format]
}
```

---

### Step 15 — Package public API

#### File: `packages/report-engine/src/index.ts`

```typescript
export { renderReport, getMimeType, getFileExtension } from './report-engine'
export { compileTemplate, compileHtmlTemplate } from './template-engine'
export { validateParameters } from './parameter-validator'
export {
  ReportEngineError,
  TemplateError,
  ParameterValidationError,
  RendererError,
  UnsupportedFormatError,
} from './errors'
export {
  CsvRenderer,
  ExcelRenderer,
  HtmlRenderer,
  PdfRenderer,
  WordRenderer,
} from './renderers'
export type { ReportRenderer } from './renderers'
```

---

### Step 16 — NestJS Report Module

Create directory: `apps/api/src/modules/report/`

#### File: `apps/api/src/modules/report/dto/create-report.dto.ts`

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator'
import type { ExportFormat } from '@datascriba/shared-types'

export class CreateReportDto {
  @ApiProperty({ description: 'Report name', example: 'Monthly Sales' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string

  @ApiPropertyOptional({ description: 'Optional description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string

  @ApiProperty({ description: 'DataSource ID to query' })
  @IsString()
  @MinLength(1)
  dataSourceId!: string

  @ApiProperty({ description: 'Handlebars SQL template', example: 'SELECT * FROM orders WHERE date >= {{startDate}}' })
  @IsString()
  @MinLength(1)
  query!: string

  @ApiPropertyOptional({ description: 'Report parameters', type: [Object] })
  @IsOptional()
  @IsArray()
  parameters?: unknown[]

  @ApiProperty({ description: 'Layout JSON' })
  @IsObject()
  layout!: unknown

  @ApiProperty({
    description: 'Supported export formats',
    enum: ['csv', 'xlsx', 'pdf', 'docx', 'html'],
    isArray: true,
    example: ['csv', 'xlsx'],
  })
  @IsArray()
  @IsEnum(['csv', 'xlsx', 'pdf', 'docx', 'html'], { each: true })
  exportFormats!: ExportFormat[]

  @ApiPropertyOptional({ description: 'Workspace ID (defaults to "default")' })
  @IsOptional()
  @IsString()
  workspaceId?: string

  @ApiPropertyOptional({ description: 'Creator user ID (defaults to "system")' })
  @IsOptional()
  @IsString()
  createdBy?: string
}
```

---

#### File: `apps/api/src/modules/report/dto/update-report.dto.ts`

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsArray, IsEnum, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'
import type { ExportFormat } from '@datascriba/shared-types'

export class UpdateReportDto {
  @ApiPropertyOptional({ description: 'Report name' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string

  @ApiPropertyOptional({ description: 'Optional description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string

  @ApiPropertyOptional({ description: 'Handlebars SQL template' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  query?: string

  @ApiPropertyOptional({ description: 'Report parameters', type: [Object] })
  @IsOptional()
  @IsArray()
  parameters?: unknown[]

  @ApiPropertyOptional({ description: 'Layout JSON' })
  @IsOptional()
  @IsObject()
  layout?: unknown

  @ApiPropertyOptional({
    description: 'Supported export formats',
    enum: ['csv', 'xlsx', 'pdf', 'docx', 'html'],
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(['csv', 'xlsx', 'pdf', 'docx', 'html'], { each: true })
  exportFormats?: ExportFormat[]
}
```

---

#### File: `apps/api/src/modules/report/dto/run-report.dto.ts`

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsEnum, IsObject, IsOptional } from 'class-validator'
import type { ExportFormat } from '@datascriba/shared-types'

export class RunReportDto {
  @ApiProperty({
    description: 'Export format',
    enum: ['csv', 'xlsx', 'pdf', 'docx', 'html'],
    example: 'csv',
  })
  @IsEnum(['csv', 'xlsx', 'pdf', 'docx', 'html'])
  format!: ExportFormat

  @ApiPropertyOptional({ description: 'Parameter values', type: Object })
  @IsOptional()
  @IsObject()
  parameters?: Record<string, unknown>
}
```

---

#### File: `apps/api/src/modules/report/report.repository.ts`

```typescript
import type { ReportDefinition } from '@datascriba/shared-types'
import { Injectable } from '@nestjs/common'

/**
 * Phase 3 stub: stores ReportDefinition records in-memory.
 * Phase 5+ replaces this with Prisma.
 */
@Injectable()
export class ReportRepository {
  private readonly store = new Map<string, ReportDefinition>()

  async findAll(workspaceId: string): Promise<ReportDefinition[]> {
    return [...this.store.values()].filter((r) => r.workspaceId === workspaceId)
  }

  async findById(id: string): Promise<ReportDefinition | null> {
    return this.store.get(id) ?? null
  }

  async create(data: Omit<ReportDefinition, 'id' | 'version' | 'createdAt' | 'updatedAt'>): Promise<ReportDefinition> {
    const id = crypto.randomUUID()
    const now = new Date()
    const record: ReportDefinition = {
      ...data,
      id,
      version: 1,
      createdAt: now,
      updatedAt: now,
    }
    this.store.set(id, record)
    return record
  }

  async update(
    id: string,
    data: Partial<Omit<ReportDefinition, 'id' | 'workspaceId' | 'createdAt'>>,
  ): Promise<ReportDefinition | null> {
    const existing = this.store.get(id)
    if (!existing) return null
    const updated: ReportDefinition = {
      ...existing,
      ...data,
      version: existing.version + 1,
      updatedAt: new Date(),
    }
    this.store.set(id, updated)
    return updated
  }

  async delete(id: string): Promise<boolean> {
    return this.store.delete(id)
  }
}
```

---

#### File: `apps/api/src/modules/report/run.repository.ts`

```typescript
import type { RunRecord } from '@datascriba/shared-types'
import { Injectable } from '@nestjs/common'

/**
 * Phase 3 stub: stores RunRecord history in-memory.
 * Phase 5+ replaces with Prisma.
 */
@Injectable()
export class RunRepository {
  private readonly store = new Map<string, RunRecord>()

  async findByReportId(reportId: string): Promise<RunRecord[]> {
    return [...this.store.values()]
      .filter((r) => r.reportId === reportId)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
  }

  async findById(id: string): Promise<RunRecord | null> {
    return this.store.get(id) ?? null
  }

  async create(data: Omit<RunRecord, 'id'>): Promise<RunRecord> {
    const id = crypto.randomUUID()
    const record: RunRecord = { ...data, id }
    this.store.set(id, record)
    return record
  }

  async update(
    id: string,
    data: Partial<Omit<RunRecord, 'id' | 'reportId'>>,
  ): Promise<RunRecord | null> {
    const existing = this.store.get(id)
    if (!existing) return null
    const updated: RunRecord = { ...existing, ...data }
    this.store.set(id, updated)
    return updated
  }
}
```

---

#### File: `apps/api/src/modules/report/report.service.ts`

```typescript
import * as path from 'node:path'
import * as fs from 'node:fs/promises'
import type {
  ExportFormat,
  ReportData,
  ReportDefinition,
  ReportLayout,
  ReportParameter,
  RunRecord,
} from '@datascriba/shared-types'
import {
  getFileExtension,
  getMimeType,
  renderReport,
  validateParameters,
} from '@datascriba/report-engine'
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common'
import { DataSourceService } from '../data-source/data-source.service'
import { ReportRepository } from './report.repository'
import { RunRepository } from './run.repository'
import type { CreateReportDto } from './dto/create-report.dto'
import type { RunReportDto } from './dto/run-report.dto'
import type { UpdateReportDto } from './dto/update-report.dto'

const DEFAULT_WORKSPACE_ID = 'default'
const DEFAULT_USER_ID = 'system'

export interface RunResult {
  runId: string
  format: ExportFormat
  mimeType: string
  fileName: string
  outputPath: string
  rowCount: number
  durationMs: number
}

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name)
  private readonly outputDir: string

  constructor(
    private readonly reportRepository: ReportRepository,
    private readonly runRepository: RunRepository,
    private readonly dataSourceService: DataSourceService,
  ) {
    // Resolve output dir relative to the process cwd (monorepo root in dev)
    this.outputDir = path.resolve(process.cwd(), 'apps', 'api', 'output')
  }

  async ensureOutputDir(): Promise<void> {
    await fs.mkdir(this.outputDir, { recursive: true })
  }

  async create(dto: CreateReportDto): Promise<ReportDefinition> {
    const record = await this.reportRepository.create({
      name: dto.name,
      description: dto.description,
      dataSourceId: dto.dataSourceId,
      query: dto.query,
      parameters: (dto.parameters as ReportParameter[]) ?? [],
      layout: dto.layout as ReportLayout,
      exportFormats: dto.exportFormats,
      workspaceId: dto.workspaceId ?? DEFAULT_WORKSPACE_ID,
      createdBy: dto.createdBy ?? DEFAULT_USER_ID,
    })
    this.logger.log({ reportId: record.id, name: record.name }, 'ReportDefinition created')
    return record
  }

  async findAll(workspaceId: string = DEFAULT_WORKSPACE_ID): Promise<ReportDefinition[]> {
    return this.reportRepository.findAll(workspaceId)
  }

  async findOne(id: string): Promise<ReportDefinition> {
    const record = await this.reportRepository.findById(id)
    if (!record) throw new NotFoundException(`Report '${id}' not found`)
    return record
  }

  async update(id: string, dto: UpdateReportDto): Promise<ReportDefinition> {
    const existing = await this.reportRepository.findById(id)
    if (!existing) throw new NotFoundException(`Report '${id}' not found`)

    const updated = await this.reportRepository.update(id, {
      name: dto.name,
      description: dto.description,
      query: dto.query,
      parameters: dto.parameters as ReportParameter[] | undefined,
      layout: dto.layout as ReportLayout | undefined,
      exportFormats: dto.exportFormats,
    })
    if (!updated) throw new NotFoundException(`Report '${id}' not found`)
    this.logger.log({ reportId: id, version: updated.version }, 'ReportDefinition updated')
    return updated
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.reportRepository.delete(id)
    if (!deleted) throw new NotFoundException(`Report '${id}' not found`)
    this.logger.log({ reportId: id }, 'ReportDefinition deleted')
  }

  async runReport(reportId: string, dto: RunReportDto): Promise<RunResult> {
    const definition = await this.findOne(reportId)

    // Validate requested format is allowed
    if (!definition.exportFormats.includes(dto.format)) {
      throw new BadRequestException(
        `Format '${dto.format}' is not enabled for this report. Allowed: ${definition.exportFormats.join(', ')}`,
      )
    }

    // Validate and coerce parameters
    const validatedParams = validateParameters(
      definition.parameters,
      dto.parameters ?? {},
    )

    // Create run record in 'running' state
    const runRecord = await this.runRepository.create({
      reportId,
      workspaceId: definition.workspaceId,
      format: dto.format,
      status: 'running',
      triggeredBy: DEFAULT_USER_ID,
      startedAt: new Date(),
    })

    const startMs = Date.now()

    try {
      // Execute parameterized query against DataSource
      // Note: compileTemplate is used only for documentation; the actual SQL
      // must be executed via parameterized driver.execute(sql, params[]).
      // For Phase 3, parameters are passed as-is to driver.execute() after
      // template compilation produces the query string.
      const sql = definition.query
      const paramValues = Object.values(validatedParams)

      const queryResult = await this.dataSourceService.executeQuery(
        definition.dataSourceId,
        sql,
        paramValues,
      )

      const data: ReportData = {
        columns: queryResult.columns,
        rows: queryResult.rows,
        rowCount: queryResult.rowCount,
        durationMs: queryResult.durationMs,
      }

      const buffer = await renderReport(data, {
        format: dto.format,
        layout: definition.layout,
        reportName: definition.name,
        parameters: validatedParams,
      })

      // Write output file — filename never exposes internal paths in API response
      await this.ensureOutputDir()
      const ext = getFileExtension(dto.format)
      const safeName = definition.name.replace(/[^a-zA-Z0-9_-]/g, '_')
      const fileName = `${safeName}_${runRecord.id}.${ext}`
      const outputPath = path.join(this.outputDir, fileName)
      await fs.writeFile(outputPath, buffer)

      const durationMs = Date.now() - startMs

      await this.runRepository.update(runRecord.id, {
        status: 'success',
        finishedAt: new Date(),
        durationMs,
        rowCount: queryResult.rowCount,
        outputPath,
      })

      this.logger.log(
        { reportId, runId: runRecord.id, format: dto.format, rowCount: queryResult.rowCount, durationMs },
        'Report run succeeded',
      )

      return {
        runId: runRecord.id,
        format: dto.format,
        mimeType: getMimeType(dto.format),
        fileName,
        outputPath,
        rowCount: queryResult.rowCount,
        durationMs,
      }
    } catch (err) {
      const durationMs = Date.now() - startMs
      await this.runRepository.update(runRecord.id, {
        status: 'failed',
        finishedAt: new Date(),
        durationMs,
        errorMessage: err instanceof Error ? err.message : 'Unknown error',
      })
      this.logger.error({ reportId, runId: runRecord.id, err }, 'Report run failed')
      throw err
    }
  }

  async getRunHistory(reportId: string): Promise<RunRecord[]> {
    await this.findOne(reportId) // ensures 404 if report not found
    return this.runRepository.findByReportId(reportId)
  }

  async getRun(reportId: string, runId: string): Promise<RunRecord> {
    await this.findOne(reportId)
    const run = await this.runRepository.findById(runId)
    if (!run) throw new NotFoundException(`Run '${runId}' not found`)
    if (run.reportId !== reportId) throw new NotFoundException(`Run '${runId}' not found for report '${reportId}'`)
    return run
  }
}
```

---

#### File: `apps/api/src/modules/report/report.controller.ts`

```typescript
import * as fs from 'node:fs'
import type { ReportDefinition, RunRecord } from '@datascriba/shared-types'
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Res,
} from '@nestjs/common'
import {
  ApiBody,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger'
import type { FastifyReply } from 'fastify'
import { getMimeType } from '@datascriba/report-engine'
import { ReportService } from './report.service'
import { CreateReportDto } from './dto/create-report.dto'
import { RunReportDto } from './dto/run-report.dto'
import { UpdateReportDto } from './dto/update-report.dto'

@ApiTags('Reports')
@Controller('reports')
export class ReportController {
  constructor(private readonly service: ReportService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new report definition' })
  @ApiBody({ type: CreateReportDto })
  async create(@Body() dto: CreateReportDto): Promise<ReportDefinition> {
    return this.service.create(dto)
  }

  @Get()
  @ApiOperation({ summary: 'List all report definitions' })
  async findAll(): Promise<ReportDefinition[]> {
    return this.service.findAll()
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single report definition' })
  @ApiParam({ name: 'id', type: String })
  @ApiNotFoundResponse({ description: 'Report not found' })
  async findOne(@Param('id') id: string): Promise<ReportDefinition> {
    return this.service.findOne(id)
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a report definition' })
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ type: UpdateReportDto })
  async update(@Param('id') id: string, @Body() dto: UpdateReportDto): Promise<ReportDefinition> {
    return this.service.update(id, dto)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a report definition' })
  @ApiParam({ name: 'id', type: String })
  async remove(@Param('id') id: string): Promise<void> {
    return this.service.remove(id)
  }

  /**
   * POST /api/v1/reports/:id/run
   * Body: { format: 'csv' | 'xlsx' | 'pdf' | 'docx' | 'html', parameters?: {} }
   * Returns the rendered file as an attachment download.
   * The output file path is NEVER included in the response headers.
   */
  @Post(':id/run')
  @ApiOperation({ summary: 'Run a report and download the output file' })
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ type: RunReportDto })
  @ApiProduces(
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/html',
  )
  async run(
    @Param('id') id: string,
    @Body() dto: RunReportDto,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const result = await this.service.runReport(id, dto)
    const mimeType = getMimeType(result.format)

    // Stream file directly — never expose outputPath in headers
    const fileStream = fs.createReadStream(result.outputPath)

    void reply
      .status(HttpStatus.OK)
      .header('Content-Type', mimeType)
      .header('Content-Disposition', `attachment; filename="${result.fileName}"`)
      .header('X-Run-Id', result.runId)
      .header('X-Row-Count', String(result.rowCount))
      .send(fileStream)
  }

  @Get(':id/runs')
  @ApiOperation({ summary: 'Get run history for a report' })
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ description: 'List of run records' })
  async getRunHistory(@Param('id') id: string): Promise<RunRecord[]> {
    return this.service.getRunHistory(id)
  }

  @Get(':id/runs/:runId')
  @ApiOperation({ summary: 'Get a specific run record' })
  @ApiParam({ name: 'id', type: String })
  @ApiParam({ name: 'runId', type: String })
  @ApiNotFoundResponse({ description: 'Run not found' })
  async getRun(
    @Param('id') id: string,
    @Param('runId') runId: string,
  ): Promise<RunRecord> {
    return this.service.getRun(id, runId)
  }
}
```

---

#### File: `apps/api/src/modules/report/report.module.ts`

```typescript
import { Module } from '@nestjs/common'
import { DataSourceModule } from '../data-source/data-source.module'
import { ReportController } from './report.controller'
import { ReportRepository } from './report.repository'
import { RunRepository } from './run.repository'
import { ReportService } from './report.service'

@Module({
  imports: [DataSourceModule],
  controllers: [ReportController],
  providers: [ReportService, ReportRepository, RunRepository],
  exports: [ReportService],
})
export class ReportModule {}
```

---

### Step 17 — Register ReportModule in AppModule

#### Modify: `apps/api/src/app.module.ts`

Replace the full file content with:

```typescript
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER } from '@nestjs/core'

import { AppController } from './app.controller'
import { AppService } from './app.service'
import { AppExceptionFilter } from './common/filters/app-exception.filter'
import { DataSourceModule } from './modules/data-source/data-source.module'
import { ReportModule } from './modules/report/report.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    DataSourceModule,
    ReportModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: AppExceptionFilter,
    },
  ],
})
export class AppModule {}
```

---

### Step 18 — Update AppExceptionFilter to handle report-engine errors

#### Modify: `apps/api/src/common/filters/app-exception.filter.ts`

Replace the full file content with:

```typescript
import {
  ConnectionError,
  DataSourceError,
  DangerousQueryError,
  EncryptionError,
  QueryBlockedError,
  QueryError,
  UnsupportedDriverError,
} from '@datascriba/db-drivers'
import {
  ParameterValidationError,
  RendererError,
  ReportEngineError,
  TemplateError,
  UnsupportedFormatError,
} from '@datascriba/report-engine'
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import type { FastifyReply, FastifyRequest } from 'fastify'

interface ErrorResponse {
  statusCode: number
  error: string
  message: string
  timestamp: string
  path: string
}

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const reply = ctx.getResponse<FastifyReply>()
    const request = ctx.getRequest<FastifyRequest>()

    const { statusCode, message } = this.mapException(exception)

    const body: ErrorResponse = {
      statusCode,
      error: HttpStatus[statusCode] ?? 'INTERNAL_SERVER_ERROR',
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    }

    if (statusCode >= 500) {
      this.logger.error({ err: exception, path: request.url }, message)
    } else {
      this.logger.warn({ path: request.url }, message)
    }

    void reply.status(statusCode).send(body)
  }

  private mapException(exception: unknown): { statusCode: number; message: string } {
    if (exception instanceof HttpException) {
      return { statusCode: exception.getStatus(), message: exception.message }
    }
    // db-drivers errors
    if (exception instanceof DangerousQueryError) {
      return { statusCode: HttpStatus.FORBIDDEN, message: exception.message }
    }
    if (exception instanceof QueryBlockedError) {
      return { statusCode: HttpStatus.FORBIDDEN, message: exception.message }
    }
    if (exception instanceof ConnectionError) {
      return { statusCode: 503, message: 'Data source connection failed' }
    }
    if (exception instanceof QueryError) {
      return { statusCode: HttpStatus.BAD_REQUEST, message: 'Query execution failed' }
    }
    if (exception instanceof UnsupportedDriverError) {
      return { statusCode: 501, message: exception.message }
    }
    if (exception instanceof EncryptionError) {
      return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Encryption error' }
    }
    if (exception instanceof DataSourceError) {
      return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Data source error' }
    }
    // report-engine errors
    if (exception instanceof ParameterValidationError) {
      return { statusCode: HttpStatus.BAD_REQUEST, message: exception.message }
    }
    if (exception instanceof UnsupportedFormatError) {
      return { statusCode: HttpStatus.BAD_REQUEST, message: exception.message }
    }
    if (exception instanceof TemplateError) {
      return { statusCode: HttpStatus.BAD_REQUEST, message: exception.message }
    }
    if (exception instanceof RendererError) {
      return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Renderer failed' }
    }
    if (exception instanceof ReportEngineError) {
      return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Report engine error' }
    }
    return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' }
  }
}
```

---

### Step 19 — NestJS API unit tests for Report module

#### File: `apps/api/src/modules/report/report.service.spec.ts`

```typescript
import type { ReportDefinition } from '@datascriba/shared-types'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DataSourceService } from '../data-source/data-source.service'
import { ReportRepository } from './report.repository'
import { RunRepository } from './run.repository'
import { ReportService } from './report.service'
import type { CreateReportDto } from './dto/create-report.dto'

// Mock renderReport and related to avoid Puppeteer in unit tests
vi.mock('@datascriba/report-engine', () => ({
  renderReport: vi.fn().mockResolvedValue(Buffer.from('mock-output')),
  getMimeType: vi.fn().mockReturnValue('text/csv; charset=utf-8'),
  getFileExtension: vi.fn().mockReturnValue('csv'),
  validateParameters: vi.fn().mockImplementation((_defs: unknown, raw: Record<string, unknown>) => raw),
  UnsupportedFormatError: class UnsupportedFormatError extends Error {
    constructor(fmt: string) { super(`Format '${fmt}' not supported`) }
  },
  ParameterValidationError: class ParameterValidationError extends Error {
    constructor(_n: string, msg: string) { super(msg) }
  },
  TemplateError: class TemplateError extends Error {},
  RendererError: class RendererError extends Error {},
  ReportEngineError: class ReportEngineError extends Error {},
}))

// Mock fs/promises for output file writes
vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}))

const mockDataSourceService = {
  executeQuery: vi.fn().mockResolvedValue({
    columns: [{ name: 'id', dataType: 'int', nullable: false, isPrimaryKey: true, defaultValue: null }],
    rows: [{ id: 1 }],
    rowCount: 1,
    durationMs: 5,
  }),
}

const SAMPLE_DTO: CreateReportDto = {
  name: 'Test Report',
  dataSourceId: 'ds-1',
  query: 'SELECT * FROM test',
  parameters: [],
  layout: { title: 'Test Report', columns: [{ field: 'id', header: 'ID' }] } as unknown,
  exportFormats: ['csv'],
}

describe('ReportService', () => {
  let service: ReportService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportService,
        ReportRepository,
        RunRepository,
        { provide: DataSourceService, useValue: mockDataSourceService },
      ],
    }).compile()

    service = module.get<ReportService>(ReportService)
  })

  describe('create', () => {
    it('creates and returns a ReportDefinition with id and version 1', async () => {
      const result = await service.create(SAMPLE_DTO)
      expect(result.id).toBeDefined()
      expect(result.version).toBe(1)
      expect(result.name).toBe('Test Report')
    })
  })

  describe('findOne', () => {
    it('throws NotFoundException for unknown id', async () => {
      await expect(service.findOne('unknown-id')).rejects.toThrow(NotFoundException)
    })

    it('returns existing report', async () => {
      const created = await service.create(SAMPLE_DTO)
      const found = await service.findOne(created.id)
      expect(found.id).toBe(created.id)
    })
  })

  describe('update', () => {
    it('increments version on update', async () => {
      const created = await service.create(SAMPLE_DTO)
      const updated = await service.update(created.id, { name: 'Updated Report' })
      expect(updated.name).toBe('Updated Report')
      expect(updated.version).toBe(2)
    })

    it('throws NotFoundException for unknown id', async () => {
      await expect(service.update('unknown', { name: 'X' })).rejects.toThrow(NotFoundException)
    })
  })

  describe('remove', () => {
    it('throws NotFoundException for unknown id', async () => {
      await expect(service.remove('unknown')).rejects.toThrow(NotFoundException)
    })

    it('removes report successfully', async () => {
      const created = await service.create(SAMPLE_DTO)
      await service.remove(created.id)
      await expect(service.findOne(created.id)).rejects.toThrow(NotFoundException)
    })
  })

  describe('findAll', () => {
    it('returns only reports for the given workspaceId', async () => {
      await service.create({ ...SAMPLE_DTO, workspaceId: 'ws-A' })
      await service.create({ ...SAMPLE_DTO, name: 'Report B', workspaceId: 'ws-B' })
      const wsA = await service.findAll('ws-A')
      expect(wsA).toHaveLength(1)
      const first = wsA[0] as ReportDefinition
      expect(first.name).toBe('Test Report')
    })
  })

  describe('runReport', () => {
    it('throws BadRequestException when format not enabled', async () => {
      const created = await service.create({ ...SAMPLE_DTO, exportFormats: ['csv'] })
      await expect(
        service.runReport(created.id, { format: 'pdf', parameters: {} }),
      ).rejects.toThrow(BadRequestException)
    })

    it('returns RunResult with runId for valid format', async () => {
      const created = await service.create(SAMPLE_DTO)
      const result = await service.runReport(created.id, { format: 'csv', parameters: {} })
      expect(result.runId).toBeDefined()
      expect(result.format).toBe('csv')
      expect(result.rowCount).toBe(1)
    })
  })

  describe('getRunHistory', () => {
    it('returns run records for a report', async () => {
      const created = await service.create(SAMPLE_DTO)
      await service.runReport(created.id, { format: 'csv' })
      const runs = await service.getRunHistory(created.id)
      expect(runs).toHaveLength(1)
      expect(runs[0]?.format).toBe('csv')
    })
  })

  describe('template injection test — date range parameters', () => {
    it('passes validated dateRange parameters to executeQuery', async () => {
      const { validateParameters } = await import('@datascriba/report-engine')
      ;(validateParameters as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        startDate: '2024-01-01T00:00:00.000Z',
        endDate: '2024-01-31T23:59:59.000Z',
      })
      const created = await service.create({
        ...SAMPLE_DTO,
        query: 'SELECT * FROM orders WHERE date BETWEEN @start AND @end',
        parameters: [
          { name: 'startDate', label: 'Start Date', type: 'date', required: true },
          { name: 'endDate', label: 'End Date', type: 'date', required: true },
        ] as unknown[],
      })
      await service.runReport(created.id, {
        format: 'csv',
        parameters: {
          startDate: '2024-01-01T00:00:00.000Z',
          endDate: '2024-01-31T23:59:59.000Z',
        },
      })
      expect(mockDataSourceService.executeQuery).toHaveBeenCalledWith(
        'ds-1',
        expect.any(String),
        ['2024-01-01T00:00:00.000Z', '2024-01-31T23:59:59.000Z'],
      )
    })
  })
})
```

---

### Step 20 — Template engine unit tests

#### File: `packages/report-engine/src/template-engine.spec.ts`

```typescript
import { describe, expect, it } from 'vitest'
import { compileTemplate, compileHtmlTemplate } from './template-engine'
import { TemplateError } from './errors'

describe('compileTemplate', () => {
  it('substitutes simple string values', () => {
    const result = compileTemplate('SELECT * FROM {{tableName}}', { tableName: 'orders' })
    expect(result).toBe('SELECT * FROM orders')
  })

  it('uses formatDate helper', () => {
    const result = compileTemplate(
      "WHERE date >= '{{formatDate startDate \"YYYY-MM-DD\"}}'",
      { startDate: '2024-03-15T10:00:00.000Z' },
    )
    expect(result).toContain('2024-03-15')
  })

  it('uses formatNumber helper', () => {
    const result = compileTemplate('{{formatNumber value 2}}', { value: 3.14159 })
    expect(result).toBe('3.14')
  })

  it('uses ifEq block helper — truthy branch', () => {
    const result = compileTemplate(
      '{{#ifEq status "active"}}YES{{else}}NO{{/ifEq}}',
      { status: 'active' },
    )
    expect(result).toBe('YES')
  })

  it('uses ifEq block helper — falsy branch', () => {
    const result = compileTemplate(
      '{{#ifEq status "active"}}YES{{else}}NO{{/ifEq}}',
      { status: 'inactive' },
    )
    expect(result).toBe('NO')
  })

  it('throws TemplateError on invalid template syntax', () => {
    expect(() => compileTemplate('{{#if}}unclosed', {})).toThrow(TemplateError)
  })

  it('dateRange scenario — both from and to substituted', () => {
    const result = compileTemplate(
      "AND date BETWEEN '{{formatDate from \"YYYY-MM-DD\"}}' AND '{{formatDate to \"YYYY-MM-DD\"}}'",
      { from: '2024-01-01T00:00:00.000Z', to: '2024-01-31T00:00:00.000Z' },
    )
    expect(result).toContain('2024-01-01')
    expect(result).toContain('2024-01-31')
  })
})

describe('compileHtmlTemplate', () => {
  it('escapes HTML special characters (XSS-safe)', () => {
    const result = compileHtmlTemplate('<p>{{value}}</p>', { value: '<script>alert(1)</script>' })
    expect(result).toContain('&lt;script&gt;')
    expect(result).not.toContain('<script>')
  })
})
```

---

### Step 21 — Parameter validator unit tests

#### File: `packages/report-engine/src/parameter-validator.spec.ts`

```typescript
import { describe, expect, it } from 'vitest'
import { validateParameters } from './parameter-validator'
import { ParameterValidationError } from './errors'
import type { ReportParameter } from '@datascriba/shared-types'

const STRING_PARAM: ReportParameter = {
  name: 'search',
  label: 'Search',
  type: 'string',
  required: true,
}

const DATE_RANGE_PARAM: ReportParameter = {
  name: 'period',
  label: 'Period',
  type: 'dateRange',
  required: true,
}

const OPTIONAL_NUMBER: ReportParameter = {
  name: 'limit',
  label: 'Limit',
  type: 'number',
  required: false,
  defaultValue: 100,
}

describe('validateParameters', () => {
  it('returns validated string value', () => {
    const result = validateParameters([STRING_PARAM], { search: 'hello' })
    expect(result['search']).toBe('hello')
  })

  it('throws ParameterValidationError when required param missing', () => {
    expect(() => validateParameters([STRING_PARAM], {})).toThrow(ParameterValidationError)
  })

  it('uses defaultValue for optional param not provided', () => {
    const result = validateParameters([OPTIONAL_NUMBER], {})
    expect(result['limit']).toBe(100)
  })

  it('validates dateRange with from/to structure', () => {
    const result = validateParameters([DATE_RANGE_PARAM], {
      period: { from: '2024-01-01T00:00:00.000Z', to: '2024-01-31T00:00:00.000Z' },
    })
    const period = result['period'] as { from: Date; to: Date }
    expect(period.from).toBeInstanceOf(Date)
    expect(period.to).toBeInstanceOf(Date)
  })

  it('throws ParameterValidationError for invalid number type', () => {
    const numParam: ReportParameter = { name: 'qty', label: 'Qty', type: 'number', required: true }
    expect(() => validateParameters([numParam], { qty: 'not-a-number' })).toThrow(ParameterValidationError)
  })

  it('handles multiSelect array type', () => {
    const multiParam: ReportParameter = { name: 'regions', label: 'Regions', type: 'multiSelect', required: true }
    const result = validateParameters([multiParam], { regions: ['North', 'South'] })
    expect(result['regions']).toEqual(['North', 'South'])
  })

  it('handles boolean type', () => {
    const boolParam: ReportParameter = { name: 'active', label: 'Active', type: 'boolean', required: true }
    const result = validateParameters([boolParam], { active: true })
    expect(result['active']).toBe(true)
  })
})
```

---

### Step 22 — Add `@datascriba/report-engine` to turbo pipeline and workspace

#### Modify: `pnpm-workspace.yaml`

No change needed — `packages/*` already covers it.

#### Verify `turbo.json` includes the new package

Run from monorepo root:
```powershell
Get-Content turbo.json
```
The existing pipeline should pick up the new package automatically since it uses `"^build"` dependencies.
If `turbo.json` does not exist yet, create it:

#### File: `turbo.json` (create only if missing)

```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "type-check": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "lint": {
      "outputs": []
    }
  }
}
```

---

### Step 23 — Create the output directory placeholder

```powershell
# From monorepo root — create output dir and a .gitkeep so git tracks the empty folder
New-Item -ItemType Directory -Path "apps\api\output" -Force
New-Item -ItemType File -Path "apps\api\output\.gitkeep" -Force
```

Add to `.gitignore` (at monorepo root — open and append):
```
# Report engine output files
apps/api/output/*.csv
apps/api/output/*.xlsx
apps/api/output/*.pdf
apps/api/output/*.docx
apps/api/output/*.html
```

---

### Step 24 — Verify compilation and run tests

Run in order from monorepo root (PowerShell):

```powershell
# 1. Install all deps
pnpm install

# 2. Type-check shared-types
pnpm --filter=@datascriba/shared-types run type-check

# 3. Type-check report-engine
pnpm --filter=@datascriba/report-engine run type-check

# 4. Type-check api
pnpm --filter=@datascriba/api run type-check

# 5. Run report-engine unit tests (CSV, Excel, Word, template, params)
pnpm --filter=@datascriba/report-engine run test

# 6. Run PDF test separately (slow — Puppeteer launches Chrome, ~30-60s)
pnpm --filter=@datascriba/report-engine run test -- --reporter=verbose

# 7. Run API unit tests
pnpm --filter=@datascriba/api run test
```

---

## Acceptance Criteria

All of the following must pass before Phase 3 is considered complete:

### TypeScript Compilation
- [ ] `pnpm --filter=@datascriba/shared-types run type-check` exits 0
- [ ] `pnpm --filter=@datascriba/report-engine run type-check` exits 0
- [ ] `pnpm --filter=@datascriba/api run type-check` exits 0
- [ ] Zero `any` types in all new/modified files
- [ ] Zero `console.log` statements (NestJS `Logger` or `createLogger` only)

### Unit Tests
- [ ] `pnpm --filter=@datascriba/report-engine run test` passes — all renderer and helper tests green
- [ ] `pnpm --filter=@datascriba/api run test` passes — all service tests green
- [ ] CSV renderer test: `first line is header row` passes
- [ ] CSV renderer test: `quotes fields containing commas` passes
- [ ] Excel renderer test: Buffer starts with PK magic bytes `50 4B 03 04`
- [ ] Word renderer test: Buffer starts with PK magic bytes `50 4B 03 04`
- [ ] PDF renderer test: Buffer starts with `%PDF`
- [ ] Template engine test: `dateRange scenario — both from and to substituted` passes
- [ ] Template engine test: `compileHtmlTemplate escapes HTML special characters` passes
- [ ] Parameter validator test: `throws ParameterValidationError when required param missing` passes
- [ ] Parameter validator test: `validates dateRange with from/to structure` passes
- [ ] API test: `throws BadRequestException when format not enabled` passes
- [ ] API test: `increments version on update` passes
- [ ] API test: `dateRange parameters passed to executeQuery` passes

### API Endpoints
- [ ] `POST /api/v1/reports` returns `201` with a `ReportDefinition` body (id, version=1)
- [ ] `GET /api/v1/reports` returns `200` with array
- [ ] `GET /api/v1/reports/:id` returns `404` for unknown id
- [ ] `PUT /api/v1/reports/:id` returns updated definition with `version` incremented
- [ ] `DELETE /api/v1/reports/:id` returns `204`
- [ ] `POST /api/v1/reports/:id/run` with `{ "format": "csv" }` returns `200` with `Content-Disposition: attachment; filename="..."` header
- [ ] `POST /api/v1/reports/:id/run` with a format not in `exportFormats` returns `400`
- [ ] `GET /api/v1/reports/:id/runs` returns array of run records
- [ ] `GET /api/v1/reports/:id/runs/:runId` returns individual run record
- [ ] Internal file path (`outputPath`) is NOT present in any HTTP response body or header

### Security
- [ ] `AppExceptionFilter` handles all `ReportEngineError` subtypes correctly
- [ ] HTML renderer output does not contain unescaped `<script>` tags (verified by template test)
- [ ] No `outputPath` value appears in any API response
- [ ] `validateParameters` rejects missing required params before query execution

---

## File Summary

### New files to create

| File | Purpose |
|---|---|
| `packages/report-engine/package.json` | Package manifest |
| `packages/report-engine/tsconfig.json` | TypeScript config (mirrors db-drivers) |
| `packages/report-engine/vitest.config.ts` | Vitest config (mirrors db-drivers) |
| `packages/report-engine/src/errors.ts` | Domain error classes |
| `packages/report-engine/src/template-engine.ts` | Handlebars helpers + compileTemplate |
| `packages/report-engine/src/template-engine.spec.ts` | Tests for helpers + date range scenario |
| `packages/report-engine/src/parameter-validator.ts` | Zod-based parameter validation |
| `packages/report-engine/src/parameter-validator.spec.ts` | Validator tests |
| `packages/report-engine/src/report-engine.ts` | renderReport orchestrator + mime/ext helpers |
| `packages/report-engine/src/index.ts` | Public API barrel |
| `packages/report-engine/src/renderers/renderer.interface.ts` | ReportRenderer interface |
| `packages/report-engine/src/renderers/index.ts` | Renderer barrel |
| `packages/report-engine/src/renderers/csv.renderer.ts` | CSV via papaparse |
| `packages/report-engine/src/renderers/csv.renderer.spec.ts` | CSV tests |
| `packages/report-engine/src/renderers/excel.renderer.ts` | Excel via ExcelJS |
| `packages/report-engine/src/renderers/excel.renderer.spec.ts` | Excel tests (PK magic bytes) |
| `packages/report-engine/src/renderers/word.renderer.ts` | Word via docx |
| `packages/report-engine/src/renderers/word.renderer.spec.ts` | Word tests (PK magic bytes) |
| `packages/report-engine/src/renderers/html.renderer.ts` | HTML via Handlebars |
| `packages/report-engine/src/renderers/pdf.renderer.ts` | PDF via Puppeteer |
| `packages/report-engine/src/renderers/pdf.renderer.spec.ts` | PDF tests (%PDF magic bytes) |
| `packages/shared-types/src/report.ts` | All report-domain types |
| `apps/api/src/modules/report/report.module.ts` | NestJS module |
| `apps/api/src/modules/report/report.controller.ts` | CRUD + run + run-history endpoints |
| `apps/api/src/modules/report/report.service.ts` | Orchestration logic |
| `apps/api/src/modules/report/report.repository.ts` | In-memory stub |
| `apps/api/src/modules/report/run.repository.ts` | Run history in-memory stub |
| `apps/api/src/modules/report/report.service.spec.ts` | Service tests |
| `apps/api/src/modules/report/dto/create-report.dto.ts` | Create DTO |
| `apps/api/src/modules/report/dto/update-report.dto.ts` | Update DTO |
| `apps/api/src/modules/report/dto/run-report.dto.ts` | Run DTO |
| `apps/api/output/.gitkeep` | Placeholder for output directory |

### Files to modify

| File | Change |
|---|---|
| `packages/shared-types/src/index.ts` | Export all report types |
| `apps/api/src/app.module.ts` | Register `ReportModule` |
| `apps/api/src/common/filters/app-exception.filter.ts` | Handle report-engine errors |
| `apps/api/package.json` | Add `@datascriba/report-engine` + `fs-extra` deps |
| `.gitignore` (monorepo root) | Exclude generated output files |

---

## Known Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Puppeteer downloads ~170MB Chrome on first install | Expected — run `pnpm install` once and let it complete. In CI, use `--ignore-scripts` and set `PUPPETEER_SKIP_DOWNLOAD=true` for non-PDF jobs |
| PDF tests slow in CI (~30-60s) | `vitest` timeout set to 60s in spec; PDF test can be tagged and skipped in fast CI runs |
| `docx` package ships ESM; tsconfig uses CommonJS | `tsconfig.json` for report-engine uses `module: CommonJS` with `esModuleInterop: true` — works correctly |
| papaparse `@types/papaparse` types and `default` import | Use `import Papa from 'papaparse'` with `esModuleInterop: true` — no issue with CommonJS build |
| ExcelJS `writeBuffer()` returns `ArrayBuffer` not `Buffer` | Explicitly `Buffer.from(arrayBuffer)` — already handled in implementation |
| outputPath exposed in HTTP responses | Never set in response body or header — only fileName (no directory) is exposed |
| Handlebars SQL injection via template | Template produces string for query planning only; actual execution uses `driver.execute(sql, paramValues[])` — parameterized at driver level |

---

### Critical Files for Implementation
- `C:\Users\Cub\datascriba\Projects\datascriba\packages\report-engine\src\renderers\pdf.renderer.ts`
- `C:\Users\Cub\datascriba\Projects\datascriba\apps\api\src\modules\report\report.service.ts`
- `C:\Users\Cub\datascriba\Projects\datascriba\packages\shared-types\src\report.ts`
- `C:\Users\Cub\datascriba\Projects\datascriba\packages\report-engine\src\template-engine.ts`
- `C:\Users\Cub\datascriba\Projects\datascriba\apps\api\src\common\filters\app-exception.filter.ts`