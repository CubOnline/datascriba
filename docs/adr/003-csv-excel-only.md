# ADR-003: CSV and Excel Export Formats Only

**Date:** 2026-05
**Status:** Accepted

## Context

Formats considered: CSV, Excel, PDF, Word, HTML. PDF via Puppeteer requires a ~200 MB Chromium
binary. Word/HTML add dependencies. Phase 3 prioritized speed and small Docker images.

## Decision

Phase 3 ships CSV and Excel (.xlsx) only. The `ReportRenderer` interface makes new formats
additive:

```typescript
interface ReportRenderer {
  readonly format: ExportFormat
  render(data: ReportData, options: RenderOptions): Promise<Buffer>
}
```

## Consequences

**Positive:** Lean Docker images, small dependencies (ExcelJS + PapaParse), machine-readable outputs.

**Negative:** No print-ready PDF in Phase 3.

## Future

Phase 9+: `PdfRenderer` via Puppeteer, `WordRenderer` via `docx` package.
