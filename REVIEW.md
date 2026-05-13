# REVIEW.md — Phase 3: Rapor Motoru (CSV + Excel)

**Reviewer:** reviewer agent
**Date:** 2026-05-13
**Verdict:** APPROVED_WITH_CHANGES

---

## Executive Summary

Phase 3 delivers a clean, well-decomposed Report Engine implementation covering CSV and Excel renderers, Handlebars-based SQL template composition, Zod-powered parameter validation, a NestJS report module (CRUD + run), and a global exception filter extended to cover all new error types. TypeScript hygiene is strong throughout — zero `any`, zero `console.log`, zero `var`, zero `==`, and all exports are named. The NestJS wiring, `StreamableFile` + `@Res({ passthrough: true })` for Fastify, MIME types, and error-to-status-code mapping are all correct.

Four issues require attention before commit: (1) the output filename is built from an unsanitised `report.name`, enabling path traversal and Content-Disposition injection when names contain characters like `/`, `..`, or `"`; (2) the redundant double-branch in the `run()` catch block is dead code and should be collapsed; (3) `select`/`multiSelect` parameter types accept `z.unknown()` / `z.array(z.unknown())` without validating against the declared `options` list, leaving a validation gap; and (4) `CreateReportDto.parameters` is typed as `unknown[]` with no per-element validation, meaning malformed parameter definitions are silently cast and then stored. Three warnings and four optional suggestions are also noted.

---

## Dimension Scores

| Dimension | Status | Notes |
|-----------|--------|-------|
| TypeScript strictness | ✅ PASS | No `any`, explicit return types on all exports, correct `interface`/`type` usage throughout |
| Security | ⚠️ WARNING | Filename from unsanitised `report.name` enables path traversal and Content-Disposition injection (C-1); `noEscape: true` in Handlebars compile is documented and structurally correct but warrants test coverage |
| NestJS patterns | ✅ PASS | Module wiring, DI, `StreamableFile`, `@Res({ passthrough: true })`, `APP_FILTER` global token all correct |
| Renderer correctness | ✅ PASS | CSV header row present, Excel freeze row set, MIME types correct, `ExportFormat` enum values consistent across packages |
| Error handling | ⚠️ WARNING | Redundant dead-code branch in `run()` catch (C-2); no test for `app-exception.filter.ts` covering Phase 3 error mappings |
| Test quality | ⚠️ WARNING | `select`/`multiSelect` validation not tested; no edge-case test for `report.name` containing special chars; `compileTemplate` happy-path test does not exercise a genuine compile-time error |
| CLAUDE.md compliance | ✅ PASS | No `any`, no `console.log`, no `var`, no `==`, named exports, NestJS `Logger` used correctly |
| Cross-package consistency | ✅ PASS | `ExportFormat`, `ReportParameter`, `ReportDefinition`, `RunRecord`, `RunStatus` match exactly between `report-engine/src/types.ts` and `shared-types/src/report.ts` |

---

## Issues Found

### Critical (must fix before commit)

**C-1 — Unsanitised `report.name` in output filename enables path traversal and Content-Disposition header injection**
File: `apps/api/src/modules/report/report.service.ts`, line 149

```ts
const filename = `${report.name.replace(/\s+/g, '-')}-${runId}.${ext}`
const outputPath = path.join(OUTPUT_DIR, filename)
```

`report.name` is a free-text field stored at `create` time. The only transformation applied is replacing whitespace with hyphens. A name such as `../../etc/passwd` would produce `outputPath = /output/../../etc/passwd`, writing the buffer outside the intended output directory. A name containing a double-quote such as `My "Sales" Report` would produce a malformed `Content-Disposition: attachment; filename="My "Sales" Report-<uuid>.csv"` header, which violates RFC 6266 and can be exploited on some user-agents.

Two fixes are required:

**(a) Sanitise the filename component before `path.join`:**
```ts
// Strip any character that is not alphanumeric, hyphen, underscore, or dot.
const safeName = report.name
  .replace(/\s+/g, '-')
  .replace(/[^a-zA-Z0-9._-]/g, '_')

const filename = `${safeName}-${runId}.${ext}`
const outputPath = path.join(OUTPUT_DIR, filename)

// Guard against traversal after join (belt-and-suspenders)
if (!outputPath.startsWith(OUTPUT_DIR + path.sep)) {
  throw new RenderError('Invalid output path — possible path traversal attempt')
}
```

**(b) Quote the filename correctly in Content-Disposition (RFC 5987 encoding, or simply percent-encode):**
```ts
// In report.controller.ts, line 87 — replace the raw interpolation:
void res.header(
  'Content-Disposition',
  `attachment; filename="${encodeURIComponent(filename)}"`,
)
```

The current code is a security defect that must be fixed before any file-writing path goes to production.

---

**C-2 — Dead-code double-branch in `run()` catch block (always re-throws, first branch is unreachable)**
File: `apps/api/src/modules/report/report.service.ts`, lines 180–182

```ts
// Re-throw so the exception filter handles it
if (err instanceof ParameterValidationError) throw err
throw err
```

Both branches execute `throw err`. The `instanceof` check adds zero value — all errors are re-thrown regardless. This reads as if the author intended different behaviour per error type (e.g. wrapping non-`ParameterValidationError` exceptions in a `RenderError`) but left both branches identical, creating misleading dead code. Collapse to:

```ts
// Re-throw so the exception filter handles it
throw err
```

If per-type re-wrapping is genuinely intended, implement it explicitly (e.g. wrap unexpected errors in `new RenderError(..., err)`). As written, this is a correctness defect: the first `throw` makes the second unreachable.

---

**C-3 — `select` / `multiSelect` parameters are not validated against the `options` list**
File: `packages/report-engine/src/parameters.ts`, lines 16–19

```ts
case 'select':
  return z.unknown()
case 'multiSelect':
  return z.array(z.unknown())
```

`ReportParameter.options` declares the set of valid values for `select` and `multiSelect` parameters. The Zod schemas built here ignore `options` entirely, so any value passes validation. A `select` parameter declared with `options: [{label:'Active', value:'active'}, {label:'Inactive', value:'inactive'}]` silently accepts `{value: 'injected-table-name'}`.

Fix by threading `param` into the schema builder and constraining to declared option values:

```ts
case 'select': {
  if (param.options && param.options.length > 0) {
    const values = param.options.map((o) => o.value)
    return z.custom<unknown>((v) => values.includes(v), {
      message: `Value must be one of: ${values.join(', ')}`,
    })
  }
  return z.unknown()
}
case 'multiSelect': {
  if (param.options && param.options.length > 0) {
    const values = param.options.map((o) => o.value)
    return z.array(
      z.custom<unknown>((v) => values.includes(v), {
        message: `Each value must be one of: ${values.join(', ')}`,
      }),
    )
  }
  return z.array(z.unknown())
}
```

This closes a structural validation gap that could allow arbitrary values to reach the SQL template when parameters are used in `{{#ifEq}}` or direct substitution blocks.

---

**C-4 — `CreateReportDto.parameters` is `unknown[]` with no per-element validation — malformed definitions silently stored**
File: `apps/api/src/modules/report/dto/create-report.dto.ts`, lines 31–33

```ts
@IsOptional()
@IsArray()
parameters?: unknown[]
```

`class-validator`'s `@IsArray()` verifies only that the field is an array — it does not validate array elements. An array element of `{name: null, type: 'invalid', required: 'yes'}` passes this guard and is then cast at service line 62:

```ts
parameters: (dto.parameters ?? []) as ReportParameter[],
```

The `as ReportParameter[]` cast at service line 62 — and again at line 91 — is a forced type assertion over an unvalidated value. If the stored `parameters` array contains malformed entries, `validateParameters()` may throw unexpected runtime errors, and `buildSchema()` hits the `never` guard with a non-`never` value.

Fix: Either add a nested DTO class with `@ValidateNested({ each: true })` + `@Type(() => ReportParameterDto)`, or validate the array elements with Zod in the service before casting:

```ts
import { reportParameterSchema } from '@datascriba/report-engine' // expose from parameters.ts

// In service.create():
const parsedParams = z.array(reportParameterSchema).parse(dto.parameters ?? [])
```

At minimum, remove the unsafe `as ReportParameter[]` cast and replace it with a runtime-validated assignment.

---

### Warning (should fix soon)

**W-1 — No tests for the exception filter covering Phase 3 error types**
File: `apps/api/src/common/filters/app-exception.filter.ts`, lines 90–101

`app-exception.filter.ts` now maps `ParameterValidationError → 422`, `TemplateError → 400`, `UnsupportedFormatError → 400`, and `RenderError → 500`. None of these new mappings have a corresponding test. The Phase 2 review noted the same gap for Phase 2 db-driver errors. This filter is the single critical path preventing internal error details from leaking to API consumers. Add a `app-exception.filter.spec.ts`:

- `ParameterValidationError` → 422 with `message` set to `exception.message`
- `TemplateError` → 400
- `UnsupportedFormatError` → 400
- `RenderError` → 500
- Unknown error → 500 with message `'Internal server error'` (not the raw error message)
- No `stack` or `cause` field in any response body

---

**W-2 — `outputPath` is stored as an absolute host path — not portable and leaks filesystem layout**
File: `apps/api/src/modules/report/report.service.ts`, line 158 and `report.repository.ts`

```ts
await this.repository.updateRun(runId, {
  status: 'completed',
  completedAt: new Date(),
  outputPath,     // ← /absolute/host/path/output/Report-Name-<uuid>.csv
})
```

`RunRecord.outputPath` will eventually be read by the frontend or a download endpoint. Storing an absolute host path is a filesystem layout disclosure and breaks in containerised deployments where the host path differs from the container path. Store only the relative filename (or a logical key):

```ts
outputPath: filename,   // just 'Report-Name-<uuid>.csv'
```

Resolve it to an absolute path only when serving the file. This is a warning rather than a critical because no download-by-path endpoint exists yet, but it should be corrected before one is added.

---

**W-3 — `formatDate` helper uses local time methods, not UTC — output varies by server timezone**
File: `packages/report-engine/src/template.ts`, lines 24–36

```ts
const year = date.getFullYear()    // local time
const month = String(date.getMonth() + 1).padStart(2, '0')   // local time
const day = String(date.getDate()).padStart(2, '0')           // local time
```

`Date` methods without the `UTC` prefix return values in the server's local timezone. A server running in UTC+3 will format `2026-01-01T00:00:00Z` as `2025-12-31` (the previous day). For a reporting platform, all date formatting should be timezone-explicit. Switch to `getUTCFullYear()`, `getUTCMonth()`, `getUTCDate()`, `getUTCHours()`, `getUTCMinutes()`, `getUTCSeconds()`. Alternatively, accept a `timezone` argument and use `Intl.DateTimeFormat`.

The existing `template.spec.ts` test at line 67 (`toMatch(/2026-03-15/)`) will pass on UTC servers but fail silently in CI environments configured with a non-UTC timezone (common with Windows build agents). This creates a flaky test that masks the real bug.

---

### Suggestions (optional)

**S-1 — `ReportParameter.defaultValue` and `options[].value` typed as `unknown` — consider using a constrained type**
File: `packages/report-engine/src/types.ts`, lines 36–38 and `packages/shared-types/src/report.ts`, lines 22–23

`unknown` is correct for safety, but consuming code (services, renderers) must cast or narrow these values every time they are used. A union type `string | number | boolean | null` would cover all realistic parameter value types and eliminate the need for unsafe casts downstream.

---

**S-2 — `buildSchema` is a module-private function but its logic is not unit tested independently**
File: `packages/report-engine/src/parameters.ts`, lines 6–28

`buildSchema` drives all validation logic and contains the exhaustiveness guard. The `parameters.spec.ts` file tests `validateParameters` end-to-end, which exercises `buildSchema` indirectly, but the `select` and `multiSelect` branches are not covered at all (no test exists for either type — confirmed by searching the spec file). Add tests for `select` (valid value in options, invalid value rejected) and `multiSelect` (array of valid values, mixed valid/invalid rejected).

---

**S-3 — `POST /reports` returns `200 OK` instead of `201 Created`**
File: `apps/api/src/modules/report/report.controller.ts`, line 35–40

REST convention for resource creation is `201 Created`. Add `@HttpCode(HttpStatus.CREATED)` to the `create` handler and a corresponding `@ApiCreatedResponse` decorator. The Phase 2 review noted the same issue for `POST /data-sources` (S-2).

---

**S-4 — `noEscape: true` in `compileTemplate` is correct but should be accompanied by a test that demonstrates values are NOT HTML-escaped in SQL output**
File: `packages/report-engine/src/template.ts`, line 63

`noEscape: true` is the right choice for SQL template generation — you do not want Handlebars HTML-encoding `<`, `>`, `&` in schema names or identifiers. However, the comment block (lines 6–11) correctly warns that user values must not be injected into SQL via template expressions. A regression test demonstrating that a structural substitution (table name, schema name) works correctly with `noEscape: true` would make this intent explicit and prevent a future developer from removing the flag "for safety" without understanding the consequences.

---

## Verdict Details

**APPROVED_WITH_CHANGES.** The architecture is sound, the renderer implementations are correct, the NestJS wiring is idiomatic, cross-package type consistency is exact, and CLAUDE.md compliance is clean throughout. No `any`, no `console.log`, no `var`, no `==`, no default exports.

Four issues must be resolved before commit:

1. **C-1** — Sanitise `report.name` before using it in `path.join()` and add a path-traversal guard (`outputPath.startsWith(OUTPUT_DIR + path.sep)`). Fix Content-Disposition quoting to use `encodeURIComponent`.
2. **C-2** — Collapse the redundant double-branch in `run()` catch to a single `throw err`.
3. **C-3** — Add option-list validation for `select` and `multiSelect` parameter types in `buildSchema` (`parameters.ts`).
4. **C-4** — Add per-element validation to `CreateReportDto.parameters` (nested DTO with `@ValidateNested` or Zod schema parse). Remove the unsafe `as ReportParameter[]` casts in `report.service.ts`.

C-1 is a security defect; C-2 through C-4 are correctness gaps. None require architectural redesign — all are localised fixes within existing files.

---

## Handoff Note

**Builder must address C-1 through C-4 before tester handoff.**

Tester targets once fixes land:

- **C-1 path-traversal:** test that `report.name = '../../etc/passwd'` does not write outside `OUTPUT_DIR`; test that `report.name = 'My "Report"'` produces a valid Content-Disposition header.
- **C-2:** no test needed (dead code removal); verify catch block still records failed runs correctly.
- **C-3 select/multiSelect:** add parameter validation tests for `select` type (valid option accepted, invalid option throws `ParameterValidationError`) and `multiSelect` type (all-valid array accepted, mixed array rejected).
- **C-4 DTO:** test that `POST /reports` with `parameters: [{name: null}]` returns `400` rather than storing a malformed definition.
- **W-1 exception filter:** add `app-exception.filter.spec.ts` covering all Phase 3 error-to-status mappings and verifying no `stack` field leaks.
- **W-3 formatDate timezone:** add a test that explicitly asserts UTC output regardless of server locale (use `TZ=America/New_York vitest` or equivalent to surface the bug).
- **S-2:** add tests for `select` and `multiSelect` branches in `parameters.spec.ts`.
