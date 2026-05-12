export { createDriver } from './driver-factory'
export { PoolManager } from './pool-manager'
export { SchemaCache } from './schema-cache'
export { encrypt, decrypt } from './crypto'
export { assertQueryAllowed, assertParameterized } from './query-guard'
export {
  DataSourceError,
  ConnectionError,
  QueryError,
  QueryTimeoutError,
  QueryBlockedError,
  EncryptionError,
  UnsupportedDriverError,
  DangerousQueryError,
} from './errors'
export type { DataSourceDriver, DriverConnectionOptions } from './types'
export { MssqlDriver } from './drivers/mssql.driver'
