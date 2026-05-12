import type { DataSourceDriver } from './types'

/**
 * Singleton map from dataSourceId → driver instance.
 * Manages one driver instance (connection pool) per DataSource ID.
 * The pool entry is created and stored externally; this just tracks them.
 * Call `remove(id)` when a DataSource is deleted.
 * Call `closeAll()` during application shutdown.
 */
export class PoolManager {
  private readonly pools = new Map<string, DataSourceDriver>()

  get(id: string): DataSourceDriver | undefined {
    return this.pools.get(id)
  }

  set(id: string, driver: DataSourceDriver): void {
    this.pools.set(id, driver)
  }

  async remove(id: string): Promise<void> {
    const driver = this.pools.get(id)
    if (driver) {
      await driver.close()
      this.pools.delete(id)
    }
  }

  async closeAll(): Promise<void> {
    const ids = [...this.pools.keys()]
    await Promise.all(ids.map((id) => this.remove(id)))
  }
}
