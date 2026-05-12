import type { ColumnMeta, QueryResult, Row, TableMeta } from '@datascriba/shared-types'

import { createLogger } from '../logger'
import { ConnectionError, QueryError, QueryTimeoutError, UnsupportedDriverError } from '../errors'
import { assertParameterized, assertQueryAllowed } from '../query-guard'
import type { DataSourceDriver, DriverConnectionOptions } from '../types'

// Use require to load mssql at runtime (avoids ESM/CJS issues in tests)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mssql = require('mssql') as typeof import('mssql')

const logger = createLogger('MssqlDriver')

export class MssqlDriver implements DataSourceDriver {
  private pool: import('mssql').ConnectionPool | null = null
  private readonly connectionString: string
  private readonly queryTimeoutMs: number
  private readonly allowMutations: boolean

  constructor(options: DriverConnectionOptions) {
    this.connectionString = options.connectionString
    this.queryTimeoutMs = options.queryTimeoutMs ?? 30_000
    this.allowMutations = options.allowMutations ?? false
  }

  private async getPool(): Promise<import('mssql').ConnectionPool> {
    if (this.pool?.connected) return this.pool
    try {
      // mssql.connect accepts a connection string directly
      this.pool = await mssql.connect(this.connectionString)
      return this.pool
    } catch (err) {
      logger.error({ err }, 'MSSQL connection failed')
      throw new ConnectionError('MSSQL connection failed', err)
    }
  }

  async test(): Promise<boolean> {
    const pool = await this.getPool()
    try {
      await pool.request().query('SELECT 1 AS [result]')
      return true
    } catch (err) {
      logger.error({ err }, 'MSSQL test query failed')
      throw new ConnectionError('MSSQL test query failed', err)
    }
  }

  async listTables(): Promise<TableMeta[]> {
    const pool = await this.getPool()
    try {
      const result = await pool
        .request()
        .query<{ schema: string; name: string; type: 'table' | 'view' }>(`
          SELECT TABLE_SCHEMA AS [schema], TABLE_NAME AS [name],
            CASE TABLE_TYPE WHEN 'VIEW' THEN 'view' ELSE 'table' END AS [type]
          FROM INFORMATION_SCHEMA.TABLES
          WHERE TABLE_TYPE = 'BASE TABLE'
          ORDER BY TABLE_SCHEMA, TABLE_NAME
        `)
      return result.recordset.map((r) => ({
        schema: r.schema,
        name: r.name,
        type: r.type,
      }))
    } catch (err) {
      logger.error({ err }, 'MSSQL listTables failed')
      throw new QueryError('MSSQL listTables failed', 'INFORMATION_SCHEMA.TABLES query', err)
    }
  }

  async describeTable(name: string): Promise<ColumnMeta[]> {
    const parts = name.split('.', 2)
    const [schema, table] = parts.length === 2 ? (parts as [string, string]) : ['dbo', name]
    const pool = await this.getPool()
    try {
      const result = await pool
        .request()
        .input('schema', mssql.VarChar, schema)
        .input('table', mssql.VarChar, table)
        .query<ColumnMeta>(`
          SELECT
            c.COLUMN_NAME AS name,
            c.DATA_TYPE AS dataType,
            CAST(CASE c.IS_NULLABLE WHEN 'YES' THEN 1 ELSE 0 END AS BIT) AS nullable,
            CAST(CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END AS BIT) AS isPrimaryKey,
            c.COLUMN_DEFAULT AS defaultValue
          FROM INFORMATION_SCHEMA.COLUMNS c
          LEFT JOIN (
            SELECT kcu.COLUMN_NAME
            FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
            JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
              ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
            WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
              AND tc.TABLE_SCHEMA = @schema AND tc.TABLE_NAME = @table
          ) pk ON pk.COLUMN_NAME = c.COLUMN_NAME
          WHERE c.TABLE_SCHEMA = @schema AND c.TABLE_NAME = @table
          ORDER BY c.ORDINAL_POSITION
        `)
      return result.recordset
    } catch (err) {
      logger.error({ err, table: name }, 'MSSQL describeTable failed')
      throw new QueryError('MSSQL describeTable failed', `INFORMATION_SCHEMA.COLUMNS for ${name}`, err)
    }
  }

  async execute(sql: string, params: unknown[]): Promise<QueryResult> {
    if (!this.allowMutations) assertQueryAllowed(sql)
    assertParameterized(sql, params)
    const pool = await this.getPool()
    const request = pool.request()
    params.forEach((p, i) => {
      request.input(`p${i + 1}`, p)
    })
    const start = Date.now()
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new QueryTimeoutError(sql, this.queryTimeoutMs)),
          this.queryTimeoutMs,
        )
      })
      const result = await Promise.race([request.query(sql), timeoutPromise])
      const durationMs = Date.now() - start
      const columnsMap = result.recordset?.columns as
        | Record<string, { type?: unknown; nullable?: boolean }>
        | undefined
      const columns: ColumnMeta[] = columnsMap
        ? Object.keys(columnsMap).map((colName) => ({
            name: colName,
            dataType: String(columnsMap[colName]?.type ?? 'unknown'),
            nullable: columnsMap[colName]?.nullable ?? true,
            isPrimaryKey: false,
            defaultValue: null,
          }))
        : []
      return {
        columns,
        rows: (result.recordset ?? []) as Row[],
        rowCount: result.rowsAffected.reduce((a, b) => a + b, 0),
        durationMs,
      }
    } catch (err) {
      if (err instanceof QueryTimeoutError) throw err
      logger.error({ err, sql }, 'MSSQL execute failed')
      throw new QueryError('MSSQL query failed', sql, err)
    }
  }

  // eslint-disable-next-line require-yield
  async *streamExecute(_sql: string, _params: unknown[]): AsyncIterable<Row> {
    throw new UnsupportedDriverError('streamExecute is not yet supported for MSSQL in Phase 2')
  }

  async close(): Promise<void> {
    try {
      await this.pool?.close()
    } catch (err) {
      logger.error({ err }, 'MSSQL close failed')
    } finally {
      this.pool = null
    }
  }
}
