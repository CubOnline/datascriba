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

/**
 * ADO.NET connection string değerinde özel karakterleri escape eder.
 * Değer içinde `;` veya `=` varsa tüm değer `{...}` ile sarılır.
 * `{` ve `}` karakterleri içeride çift yazılır (ADO.NET escape kuralı).
 * Bu sayede host/database/username/password alanlarına yazılan
 * kötü amaçlı veriler ek connection string parametresi enjekte edemez.
 */
function escapeConnectionStringValue(value: string): string {
  // Kaçış gerektiren karakter var mı?
  if (/[;={}]/.test(value)) {
    // İçindeki { ve } karakterlerini double'la, sonra { } ile sar
    return `{${value.replace(/[{}]/g, (c) => c + c)}}`
  }
  return value
}

function buildConnectionString(opts: {
  host: string
  port: number
  database: string
  username: string
  password: string
  encrypt?: boolean
  trustServerCertificate?: boolean
  connectionTimeoutMs?: number
}): string {
  const encrypt = opts.encrypt ?? true
  const trust = opts.trustServerCertificate ?? false
  const timeoutSec = Math.round((opts.connectionTimeoutMs ?? 30_000) / 1000)

  const host = escapeConnectionStringValue(opts.host)
  const database = escapeConnectionStringValue(opts.database)
  const username = escapeConnectionStringValue(opts.username)
  const password = escapeConnectionStringValue(opts.password)

  return (
    `Server=${host},${opts.port};` +
    `Database=${database};` +
    `User Id=${username};` +
    `Password=${password};` +
    `Encrypt=${encrypt};` +
    `TrustServerCertificate=${trust};` +
    `Connection Timeout=${timeoutSec};`
  )
}

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
    const connectionString = buildConnectionString({
      host: dto.host,
      port: dto.port,
      database: dto.database,
      username: dto.username,
      password: dto.password,
      encrypt: dto.encrypt,
      trustServerCertificate: dto.trustServerCertificate,
      connectionTimeoutMs: dto.connectionTimeoutMs,
    })
    const encryptedConnectionString = encrypt(connectionString, this.getMasterKey())
    const record = await this.repository.create({
      name: dto.name,
      type: dto.type,
      host: dto.host,
      port: dto.port,
      database: dto.database,
      username: dto.username,
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

    const patch: Partial<Omit<DataSourceRecord, 'id' | 'workspaceId' | 'createdAt'>> = {}
    if (dto.name !== undefined) patch.name = dto.name
    if (dto.host !== undefined) patch.host = dto.host
    if (dto.port !== undefined) patch.port = dto.port
    if (dto.database !== undefined) patch.database = dto.database
    if (dto.username !== undefined) patch.username = dto.username

    const needsReEncrypt =
      dto.host !== undefined ||
      dto.port !== undefined ||
      dto.database !== undefined ||
      dto.username !== undefined ||
      dto.password !== undefined ||
      dto.encrypt !== undefined ||
      dto.trustServerCertificate !== undefined ||
      dto.connectionTimeoutMs !== undefined

    if (needsReEncrypt) {
      const connectionString = buildConnectionString({
        host: dto.host ?? existing.host,
        port: dto.port ?? existing.port,
        database: dto.database ?? existing.database,
        username: dto.username ?? existing.username,
        password: dto.password ?? '',
        encrypt: dto.encrypt,
        trustServerCertificate: dto.trustServerCertificate,
        connectionTimeoutMs: dto.connectionTimeoutMs,
      })
      patch.encryptedConnectionString = encrypt(connectionString, this.getMasterKey())
    }

    const updated = await this.repository.update(id, patch)
    if (!updated) throw new NotFoundException(`DataSource '${id}' not found`)

    this.logger.log({ dataSourceId: id }, 'DataSource updated')
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

  private sanitize(record: DataSourceRecord): DataSourceRecord {
    return {
      ...record,
      encryptedConnectionString: '[REDACTED]',
    }
  }
}
