import type { ColumnMeta, QueryResult, Row, TableMeta } from '@datascriba/shared-types'

export interface DataSourceDriver {
  test(): Promise<boolean>
  listTables(): Promise<TableMeta[]>
  describeTable(name: string): Promise<ColumnMeta[]>
  execute(sql: string, params: unknown[]): Promise<QueryResult>
  streamExecute(sql: string, params: unknown[]): AsyncIterable<Row>
  close(): Promise<void>
}

export interface DriverConnectionOptions {
  connectionString: string
  queryTimeoutMs?: number
  allowMutations?: boolean
}
