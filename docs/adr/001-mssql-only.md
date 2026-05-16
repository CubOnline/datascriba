# ADR-001: MSSQL-Only Database Driver

**Date:** 2026-05
**Status:** Accepted

## Context

DataScriba needs to connect to customer databases. Multiple database engines exist. The primary
target user base for the initial release is enterprise teams running Microsoft SQL Server.

## Decision

Ship with MSSQL-only support using the `mssql` npm package. The driver factory uses a
`DataSourceDriver` interface so future drivers slot in without changing callers.

## Consequences

**Positive:** Faster delivery, focused security review, strong parameterization via `Request.input()`.

**Negative:** PostgreSQL/MySQL users cannot use DataScriba until additional drivers are added.

## Future

Add `PostgresDriver`, `MySqlDriver` implementing:

```typescript
interface DataSourceDriver {
  test(): Promise<boolean>
  listTables(): Promise<TableMeta[]>
  describeTable(name: string): Promise<ColumnMeta[]>
  execute(sql: string, params: unknown[]): Promise<QueryResult>
  close(): Promise<void>
}
```
