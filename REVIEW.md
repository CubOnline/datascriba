# REVIEW.md — Phase 1: Turborepo Monorepo + NestJS API Skeleton

**Reviewer:** reviewer agent
**Date:** 2026-05-12
**Verdict:** APPROVED_WITH_CHANGES

---

## Executive Summary

The Phase 1 implementation is of high quality overall — the monorepo scaffold is clean, NestJS patterns are correctly applied, and the code is free of `any`, `console.log`, `var`, and hardcoded secrets. Two issues require fixing before the tester proceeds: the `HealthResponse` interface is duplicated between `app.controller.ts` and `app.service.ts` instead of being declared once in a shared location, and the `apps/api/.eslintrc.js` adds an undocumented rule override (`'@typescript-eslint/dot-notation': 'off'`) that was not in the TASK_PLAN and silences a useful safety check without explanation. All four builder deviations from the plan are justified and correctly implemented.

---

## Dimension Scores

| Dimension | Status | Notes |
|-----------|--------|-------|
| TypeScript strictness | ✅ PASS | No `any`, explicit return types on all exports, `interface` used for object shapes, strict mode on |
| Security | ✅ PASS | No hardcoded secrets, no `console.log`, env access uses `process.env['KEY']` throughout, CORS uses env var with safe fallback |
| NestJS patterns | ✅ PASS | Module/controller/service DI is correct, global prefix with health exclude correct, Swagger gated to non-production |
| Test quality | ⚠️ WARNING | Unit tests are meaningful (3 distinct assertions), e2e uses real Fastify adapter correctly; minor: e2e does not assert timestamp format validity |
| Monorepo config | ✅ PASS | pnpm workspace correct, turbo.json pipeline correct and complete, shared packages use `workspace:*`, tsconfig inheritance chain is sound |
| Code style | ✅ PASS | No semis, single quotes, trailing commas, 100-char width — matches `.prettierrc` exactly; kebab-case files, PascalCase classes, no prefix `I`/`T` |
| CLAUDE.md compliance | ⚠️ WARNING | No violations of hard rules (`any`, `var`, `==`, `console.log`); however `HealthResponse` interface is defined twice (controller + service) instead of once — violates DRY and the single-declaration intent of `interface` for object shapes |
| TASK_PLAN.md deviations | ✅ PASS | All 4 deviations are justified and correctly implemented (see section below) |

---

## Issues Found

### 🔴 Critical (must fix before next phase)

**1. `HealthResponse` interface duplicated across two files**

- `apps/api/src/app.controller.ts` lines 6-10
- `apps/api/src/app.service.ts` lines 3-7

Both files define an identical `interface HealthResponse`. This is not a compile error today, but it is a maintenance trap: when a field is added to the health response (e.g., `uptime`, `env`) it must be updated in two places and can silently diverge. The correct pattern for a NestJS skeleton is to either:

- Move `HealthResponse` to a `dto/health-response.dto.ts` file and import it in both files, or
- Export it from `app.service.ts` and import it in `app.controller.ts`.

Since Phase 1 has no `dto/` directory yet, exporting from `app.service.ts` is the minimal-change fix.

**Fix:**
```ts
// apps/api/src/app.service.ts — add `export`
export interface HealthResponse {
  status: 'ok'
  timestamp: string
  version: string
}
```
```ts
// apps/api/src/app.controller.ts — remove local interface, import instead
import type { HealthResponse } from './app.service'
```

---

**2. Undocumented ESLint rule override in `apps/api/.eslintrc.js`**

- `apps/api/.eslintrc.js` line 12: `'@typescript-eslint/dot-notation': 'off'`

This rule was not in the TASK_PLAN (Step 16) and is not present in either the shared `nestjs.js` or the root `.eslintrc.js`. Disabling `dot-notation` suppresses the rule that enforces `obj['key']` vs `obj.key` consistency. Given that CLAUDE.md mandates `process.env['KEY']` (bracket notation for env access), disabling this rule could allow `process.env.KEY` to slip through in future code without a lint error. The override needs either:

- A comment explaining why it is needed for NestJS (e.g., if Reflect.metadata access causes false positives), or
- Removal if there is no NestJS-specific reason.

**Fix:** Remove line 12 (`'@typescript-eslint/dot-notation': 'off'`) unless there is a documented reason it is needed for NestJS decorator patterns.

---

### 🟡 Warning (should fix soon)

**3. `apps/api/tsconfig.build.json` is redundant with `tsconfig.json`**

- `apps/api/tsconfig.build.json` (all 4 lines)

The file extends `./tsconfig.json` and repeats the same `exclude` list that is already in `tsconfig.json`. This adds no value — `tsconfig.build.json` and `tsconfig.json` are identical in effect. The `nest-cli.json` points to `tsconfig.build.json`, which is conventional, but the file should at minimum differ from `tsconfig.json` (e.g., by removing source maps or declarations for the production build). This is a low-risk issue now but becomes confusing once the project grows.

**Suggested fix:** Either add production-optimised flags (`"sourceMap": false, "declaration": false`) to `tsconfig.build.json`, or consolidate and have `nest-cli.json` point directly to `tsconfig.json`.

---

**4. E2E test does not validate timestamp format**

- `apps/api/test/app.e2e-spec.ts` line 47: `expect(typeof response.body.timestamp).toBe('string')`

The unit test correctly validates the timestamp is a valid ISO string (`new Date(result.timestamp).toISOString() === result.timestamp`), but the e2e test only checks that `timestamp` is a string. A non-ISO string would pass. This is a weak assertion for an HTTP-level test.

**Suggested fix:**
```ts
expect(new Date(response.body.timestamp as string).toISOString()).toBe(response.body.timestamp)
```

---

**5. `version` is hardcoded as `'0.1.0'` in `AppService`**

- `apps/api/src/app.service.ts` line 14

The version string is not read from `package.json` or an environment variable — it is a literal. When the package version changes, the health endpoint will silently return a stale value. This is acceptable for a skeleton but should be noted as technical debt before Phase 2.

**Suggested fix (Phase 2):** Read from `process.env['npm_package_version']` or use a build-time constant injected via `@nestjs/config`.

---

**6. `shared-types` package not referenced by `apps/api`**

- `apps/api/package.json` has no dependency on `@datascriba/shared-types`

The `packages/shared-types` package defines `ApiResponse<T>` and `PaginatedResponse<T>` that the API will need in Phase 2. The package is not wired as a dependency of `@datascriba/api`. This is not a bug in Phase 1 (the skeleton does not use these types yet), but it should be added before Phase 2 feature work begins to avoid a disruptive package.json change mid-phase.

**Suggested fix:** Add `"@datascriba/shared-types": "workspace:*"` to `apps/api/package.json` dependencies before Phase 2 starts.

---

### 🟢 Suggestions (optional improvements)

**S1. `vitest.e2e.config.ts` has no coverage config**

Unlike the unit config, the e2e config does not define a `coverage` block. This is intentional for e2e runs but worth noting: if someone runs `vitest run --coverage --config vitest.e2e.config.ts` the output may be unexpected.

**S2. `CORS` allows `http://localhost:3000` as fallback in all environments**

`apps/api/src/main.ts` line 30-33: in production with `FRONTEND_URL` unset, CORS would allow `localhost:3000`. A safer pattern is to make CORS origin `undefined` (no CORS) when `NODE_ENV === 'production'` and `FRONTEND_URL` is unset.

**S3. `@nestjs/swagger` Swagger plugin `controllerKeyOfTags: false` is a non-standard option**

`nest-cli.json` line 14: `controllerKeyOfTags` is not a documented option for the `@nestjs/swagger` CLI plugin (documented options are `introspectComments`, `classValidatorShim`, `dtoFileNameSuffix`, `dtoKeyOfComment`, `controllerFileNameSuffix`). It will be silently ignored. Remove it to keep the config clean.

**S4. `packages/shared-types` `main` points to a `.ts` source file**

`packages/shared-types/package.json` lines 5-6: `"main": "./src/index.ts"` and `"types": "./src/index.ts"` — pointing `main` to a `.ts` file works in a monorepo with TypeScript resolution but is non-standard and will break if the package is ever published or consumed by a non-TS tool.

---

## Builder Deviations — Justified?

### Deviation 1: Added `root: true` to `apps/api/.eslintrc.js`

**Was it necessary?** Yes. Without `root: true`, ESLint walks up the directory tree and merges the root `.eslintrc.js` config into the API's config. The root config enables `plugin:@typescript-eslint/recommended-type-checked` with `project: ['./tsconfig.base.json', './apps/*/tsconfig.json', ...]` which conflicts with the API's own project reference. Adding `root: true` stops the walk and gives the API package a clean, self-contained config.

**Correctly implemented?** Yes — placed at line 4, before `extends`.

**Any risk?** None. This is the standard Turborepo pattern.

---

### Deviation 2: Added `tsconfig.eslint.json` to `apps/api/`

**Was it necessary?** Yes. The TASK_PLAN pointed `parserOptions.project` to `./tsconfig.json`, but `tsconfig.json` excludes `test/**` and `**/*spec.ts`. ESLint needs to parse those files for type-checked rules. `tsconfig.eslint.json` extends `tsconfig.json` and adds `test/**/*` to `include` without affecting the build output.

**Correctly implemented?** Yes — `tsconfig.eslint.json` extends `./tsconfig.json`, adds `test/**/*` to `include`, removes spec patterns from `exclude`. The `.eslintrc.js` references `./tsconfig.eslint.json` correctly via `parserOptions.project`.

**Any risk?** Minimal. The pattern is well-established in the NestJS + typescript-eslint ecosystem.

---

### Deviation 3: Added `unplugin-swc` and `@swc/core` to Vitest configs

**Was it necessary?** Yes. Vitest's default transformer (esbuild) does not emit TypeScript decorator metadata (`emitDecoratorMetadata`), which NestJS's DI system requires at runtime. Without SWC as the transformer, `@nestjs/testing` `Test.createTestingModule()` fails because providers are not resolved. The TASK_PLAN used plain `defineConfig` without a plugin — the builder discovered this limitation and correctly fixed it.

**Correctly implemented?** Yes — `unplugin-swc` is used as a Vite plugin in both `vitest.config.ts` and `vitest.e2e.config.ts` with `decoratorMetadata: true` and `legacyDecorator: true`. SWC target is set to `es2022`, matching the TypeScript config.

**Any risk?** Low. SWC is a well-maintained project (Vercel-backed). The only risk is an SWC/NestJS version mismatch in future — pinning `@swc/core` to a minor range (`^1.x`) mitigates this.

---

### Deviation 4: Added `class-validator` and `class-transformer` as runtime dependencies

**Was it necessary?** Yes. The `ValidationPipe` in `main.ts` uses `transform: true` and `whitelist: true`. These options are no-ops without `class-transformer` and `class-validator` installed at runtime. Even though no DTOs are defined in Phase 1, the pipe is active and these packages are its peer dependencies. Without them, a future DTO decorated with `@IsString()` would fail silently.

**Correctly implemented?** Yes — both are in `dependencies` (runtime), not `devDependencies`. Versions are appropriate (`class-validator ^0.15.1`, `class-transformer ^0.5.1`).

**Any risk?** Low. These are the standard NestJS validation stack. One note: CLAUDE.md lists "Zod" as the validation tool. Using `class-validator` alongside `zod` is acceptable for DTO validation (the two serve different layers), but the team should document which validator is used where to avoid drift.

---

## Verdict Details

**APPROVED_WITH_CHANGES**

The skeleton is well-built. Strict TypeScript mode is fully applied, security practices are followed, the NestJS/Fastify setup is correct, and the monorepo plumbing (pnpm, turbo, tsconfig inheritance) is sound. The four builder deviations all improve correctness over the plan.

**Required changes before tester can proceed:**

1. **Fix `HealthResponse` duplication** — export from `app.service.ts`, import in `app.controller.ts`. This is the only structural issue. (Critical #1)
2. **Remove or document `@typescript-eslint/dot-notation: off`** in `apps/api/.eslintrc.js`. If there is a NestJS-specific reason it must be off, add a comment. If not, remove it to keep CORS/env-access enforcement intact. (Critical #2)

These two changes are small (< 10 lines total) and do not affect any pipeline steps.

---

## Handoff to Tester

The tester can proceed once the two critical fixes are applied. Focus areas:

1. **Run unit tests** (`pnpm --filter=@datascriba/api test`) — confirm all 3 pass, especially the ISO timestamp test which exercises a real `Date` object.
2. **Run e2e tests** (`pnpm --filter=@datascriba/api test:e2e`) — confirm `GET /health` returns HTTP 200 with the correct body shape. Note: the e2e test uses `supertest` against a real Fastify instance; the `app.getHttpAdapter().getInstance().ready()` call is critical and is already present.
3. **Strengthen e2e timestamp assertion** — update `app.e2e-spec.ts` line 47 to validate ISO format, not just `typeof === 'string'` (Warning #4).
4. **Coverage** — target at least 80% on `app.service.ts` and `app.controller.ts`; current unit tests already cover all branches of the only exported method, so coverage should be near 100% for those files.
5. **Edge cases to probe:**
   - What does `GET /api/v1/health` return? It should 404 because `/health` is excluded from the global prefix (routed as `/health`, not `/api/v1/health`). Verify this is intentional and add a test if needed.
   - Start the server with `NODE_ENV=production` and confirm Swagger UI is not reachable at `/api/docs`.
