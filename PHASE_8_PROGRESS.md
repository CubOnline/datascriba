# Phase 8 Progress — Test, Documentation & Deploy

> **Status:** COMPLETE
> **Date:** 2026-05-16
> **Agent:** builder

---

## Summary

All 18 steps in `TASK_PLAN.md` for Phase 8 have been implemented.

---

## Steps Completed

### Backend E2E Integration Tests

| Step | File | Tests | Status |
|------|------|-------|--------|
| STEP-1 | `apps/api/vitest.e2e.config.ts` — updated include paths | — | Done |
| STEP-2 | `apps/api/src/modules/data-source/data-source.e2e-spec.ts` | 12 | Done |
| STEP-3 | `apps/api/src/modules/report/report.e2e-spec.ts` | 12 | Done |
| STEP-4 | `apps/api/src/modules/schedule/schedule.e2e-spec.ts` | 13 | Done |
| STEP-5 | `apps/api/src/modules/ai/ai.e2e-spec.ts` | 5 | Done |

**API E2E total: 42 tests passing**

### Package Unit Tests

| Step | Package | Status |
|------|---------|--------|
| STEP-6 | `packages/shared-types` — existing `parameters.spec.ts` preserved | Done |
| STEP-7 | `packages/report-engine` — existing `csv-renderer.spec.ts`, `excel-renderer.spec.ts` preserved | Done |
| STEP-8 | `packages/db-drivers` — existing `crypto.spec.ts`, `query-guard.spec.ts` preserved | Done |

**API unit test total: 37 tests passing (no regressions)**

### Frontend Tests

| Step | File | Tests | Status |
|------|------|-------|--------|
| STEP-9 | `apps/web/vitest.config.ts` | — | Done |
| STEP-9 | `apps/web/src/test-setup.ts` | — | Done |
| STEP-9 | `apps/web/src/hooks/use-ai.test.ts` | 9 | Done |
| STEP-9 | `apps/web/src/components/ai/ai-assistant-panel.test.tsx` | 6 | Done |

**Web test total: 15 tests passing**

### Documentation

| Step | File | Status |
|------|------|--------|
| STEP-10 | `README.md` | Done |
| STEP-11 | `docs/architecture.md` (with Mermaid diagrams) | Done |
| STEP-12 | `docs/api.md` | Done |
| STEP-13 | `docs/deployment.md` | Done |
| STEP-14 | `docs/adr/001-mssql-only.md` | Done |
| STEP-14 | `docs/adr/002-in-memory-repo.md` | Done |
| STEP-14 | `docs/adr/003-csv-excel-only.md` | Done |
| STEP-15 | `CONTRIBUTING.md` | Done |

### DevOps

| Step | File | Status |
|------|------|--------|
| STEP-16 | `docker/docker-compose.prod.yml` | Done |
| STEP-16 | `apps/api/Dockerfile` — production stage improvements | Done |
| STEP-16 | `apps/worker/Dockerfile` — production stage improvements | Done |
| STEP-16 | `.env.example` — full rewrite with organized sections | Done |
| STEP-17 | `.github/workflows/ci.yml` — added integration-tests job | Done |
| STEP-17 | `.github/workflows/deploy.yml` — tag-based with GitHub Release | Done |

### Swagger Decorator Improvements

| Step | File | Status |
|------|------|--------|
| STEP-18 | `apps/api/src/modules/ai/ai.controller.ts` — added `@ApiProduces` to SSE endpoints | Done |

---

## Test Results

```
apps/api (unit):   37/37 passing
apps/api (E2E):    42/42 passing (4 Phase 8 spec files)
apps/web:          15/15 passing

Pre-existing failure (not Phase 8):
  test/app.e2e-spec.ts — Fastify duplicate /health route (pre-existing issue)
```

---

## Key Implementation Notes

- `@IsPublicHost()` blocks loopback/RFC-1918 addresses — used `db.example.com` in DataSource E2E tests
- `@IsUUID()` requires valid UUID v4 — used `6ca1a115-787f-48e5-9a52-d75d066dc90a` for reportId in Schedule tests
- BullMQ module needs `BullModule.forRoot()` even when overriding the queue token; Schedule E2E builds a minimal test module directly to avoid Redis connection
- `@Sse()` decorator registers GET routes in NestJS — AI SSE endpoints tested with GET requests
- NestJS `@Post()` defaults to HTTP 201 — trigger, run, and explain endpoints use `expect([200, 201]).toContain(res.status)`
- Radix UI Tabs renders inactive tab content as `hidden` in DOM — explain tab test uses `userEvent` + `waitFor` to activate the tab before querying its content
- `@vitejs/plugin-react` pinned to `^4.7.0` (v6 is ESM-only, incompatible with vitest CJS config loading)
