import type { DataSourceType } from '@datascriba/shared-types'

import { MssqlDriver } from './drivers/mssql.driver'
import { UnsupportedDriverError } from './errors'
import type { DataSourceDriver, DriverConnectionOptions } from './types'

/**
 * Creates a driver instance for the given DataSourceType.
 * Phase 2: Only MSSQL is supported. Other types throw UnsupportedDriverError.
 */
export function createDriver(
  type: DataSourceType,
  options: DriverConnectionOptions,
): DataSourceDriver {
  switch (type) {
    case 'mssql':
      return new MssqlDriver(options)
    default: {
      const exhaustive: never = type
      throw new UnsupportedDriverError(String(exhaustive))
    }
  }
}
