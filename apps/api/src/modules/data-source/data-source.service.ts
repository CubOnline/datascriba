
import {
  createDriver,
  decrypt,
  encrypt,
  PoolManager,
  SchemaCache,
} from '@datascriba/db-drivers'
import type { DataSourceDriver } from '@datascriba/db-drivers'
import type { ColumnMeta, DataSourceRecord, QueryResult, TableMeta } from '@datascriba/shared-types'
import { Injectable, Logger, NotFoundException } from '@nestjs/common'

import { DataSourceRepository } from './data-source.repository'
import type { CreateDataSourceDto } from './dto/create-data-source.dto'
import type { UpdateDataSourceDto } from './dto/update-data-source.dto'

const DEFAULT_WORKSPACE_ID = 'default'

@Injectable()
export class DataSourceService {
  private readonly logger = new Logger(DataSourceService.name)
  private readonly poolManager = new PoolManager()
  private readonly schemaCache = new SchemaCache()

  constructor(private readonly repository: DataSourceRepository) {}

  private getMasterKey(): string {
    const key = process.env['ENCRYPTION_MASTER_KEY']
    if (!key) throw new Error('ENCRYPTION_MASTER_KEY is not set')
    return key
  }

  async create(dto: CreateDataSourceDto): Promise<DataSourceRecord> {
    const encryptedConnectionString = encrypt(dto.connectionString, this.getMasterKey())
    const record = await this.repository.create({
      name: dto.name,
      type: dto.type,
      encryptedConnectionString,
      workspaceId: dto.workspaceId ?? DEFAULT_WORKSPACE_ID,
    })
    this.logger.log({ dataSourceId: record.id, type: record.type }, 'DataSource created')
    return this.sanitize(record)
  }

  async findAll(workspaceId: string = DEFAULT_WORKSPACE_ID): Promise<DataSourceRecord[]> {
    const records = await this.repository.findAll(workspaceId)
    return records.map((r) => this.sanitize(r))
  }

  async findOne(id: string): Promise<DataSourceRecord> {
    const record = await this.repository.findById(id)
    if (!record) throw new NotFoundException(`DataSource '${id}' not found`)
    return this.sanitize(record)
  }

  async update(id: string, dto: UpdateDataSourceDto): Promise<DataSourceRecord> {
    const existing = await this.repository.findById(id)
    if (!existing) throw new NotFoundException(`DataSource '${id}' not found`)

    const patch: Partial<DataSourceRecord> = {}
    if (dto.name !== undefined) patch.name = dto.name
    if (dto.connectionString !== undefined) {
      patch.encryptedConnectionString = encrypt(dto.connectionString, this.getMasterKey())
    }

    const updated = await this.repository.update(id, patch)
    if (!updated) throw new NotFoundException(`DataSource '${id}' not found`)

    this.logger.log({ dataSourceId: id }, 'DataSource updated')
    // Invalidate cached schema and pool
    this.schemaCache.invalidate(id)
    await this.poolManager.remove(id)

    return this.sanitize(updated)
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.repository.delete(id)
    if (!deleted) throw new NotFoundException(`DataSource '${id}' not found`)
    this.schemaCache.invalidate(id)
    await this.poolManager.remove(id)
    this.logger.log({ dataSourceId: id }, 'DataSource deleted')
  }

  async testConnection(id: string): Promise<boolean> {
    const record = await this.getRecord(id)
    const driver = this.getDriver(record)
    return driver.test()
  }

  async listTables(id: string): Promise<TableMeta[]> {
    const cached = this.schemaCache.get(id)
    if (cached !== null) return cached as TableMeta[]
    const record = await this.getRecord(id)
    const driver = this.getDriver(record)
    const tables = await driver.listTables()
    this.schemaCache.set(id, tables)
    return tables
  }

  async describeTable(id: string, tableName: string): Promise<ColumnMeta[]> {
    const record = await this.getRecord(id)
    const driver = this.getDriver(record)
    return driver.describeTable(tableName)
  }

  async executeQuery(id: string, sql: string, params: unknown[]): Promise<QueryResult> {
    const record = await this.getRecord(id)
    const driver = this.getDriver(record)
    return driver.execute(sql, params)
  }

  /** Returns record including encrypted string (used internally only). */
  private async getRecord(id: string): Promise<DataSourceRecord> {
    const record = await this.repository.findById(id)
    if (!record) throw new NotFoundException(`DataSource '${id}' not found`)
    return record
  }

  private getDriver(record: DataSourceRecord): DataSourceDriver {
    const existing = this.poolManager.get(record.id)
    if (existing) return existing

    const connectionString = decrypt(record.encryptedConnectionString, this.getMasterKey())
    const driver = createDriver(record.type, {
      connectionString,
      queryTimeoutMs: 30_000,
      allowMutations: false,
    })
    this.poolManager.set(record.id, driver)
    return driver
  }

  /**
   * Never expose the encrypted connection string over HTTP.
   * Return a sanitized copy.
   */
  private sanitize(record: DataSourceRecord): DataSourceRecord {
    return {
      ...record,
      encryptedConnectionString: '[REDACTED]',
    }
  }
}
