export type DataSourceType = 'mssql'

export interface TableMeta {
  schema: string
  name: string
  type: 'table' | 'view'
}

export interface ColumnMeta {
  name: string
  dataType: string
  nullable: boolean
  isPrimaryKey: boolean
  defaultValue: string | null
}

export interface Row {
  [column: string]: unknown
}

export interface QueryResult {
  columns: ColumnMeta[]
  rows: Row[]
  rowCount: number
  durationMs: number
}

export interface DataSourceRecord {
  id: string
  workspaceId: string
  name: string
  type: DataSourceType
  host: string
  port: number
  database: string
  username: string
  encryptedConnectionString: string
  createdAt: Date
  updatedAt: Date
}
