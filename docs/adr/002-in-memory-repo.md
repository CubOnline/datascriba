# ADR-002: In-Memory Repositories (Phases 2–6)

**Date:** 2026-05
**Status:** Accepted (temporary)

## Context

Prisma is included in the stack but setting up full DB migrations during early development phases
adds bootstrap complexity. The goal of phases 2–6 is to deliver working business logic.

## Decision

All repositories (`DataSourceRepository`, `ReportRepository`, `ScheduleRepository`) use
in-memory `Map<string, T>` storage during development phases.

## Consequences

**Positive:** Zero DB dependency to boot the API. Repository interface is clean — switching to
Prisma only changes repository implementation, not service or controller code.

**Negative:** Data lost on restart. No advanced queries (pagination, filtering, joins).

## Migration Plan

1. Define `schema.prisma` models.
2. Run `prisma migrate dev`.
3. Replace `Map` store in each repository with `prisma.<model>.<method>()`.
4. Repository interface (`create`, `findAll`, `findById`, `update`, `delete`) stays identical.
