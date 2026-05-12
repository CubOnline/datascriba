import type { DataSourceRecord } from '@datascriba/shared-types'
import { Injectable } from '@nestjs/common'


/**
 * Phase 2 stub: stores DataSource records in-memory.
 * Phase 3 replaces this with a real Prisma implementation.
 * All methods simulate what Prisma would return.
 */
@Injectable()
export class DataSourceRepository {
  private readonly store = new Map<string, DataSourceRecord>()

  async findAll(workspaceId: string): Promise<DataSourceRecord[]> {
    return [...this.store.values()].filter((r) => r.workspaceId === workspaceId)
  }

  async findById(id: string): Promise<DataSourceRecord | null> {
    return this.store.get(id) ?? null
  }

  async create(data: Omit<DataSourceRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<DataSourceRecord> {
    const id = crypto.randomUUID()
    const now = new Date()
    const record: DataSourceRecord = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    }
    this.store.set(id, record)
    return record
  }

  async update(
    id: string,
    data: Partial<Omit<DataSourceRecord, 'id' | 'workspaceId' | 'createdAt'>>,
  ): Promise<DataSourceRecord | null> {
    const existing = this.store.get(id)
    if (!existing) return null
    const updated: DataSourceRecord = {
      ...existing,
      ...data,
      updatedAt: new Date(),
    }
    this.store.set(id, updated)
    return updated
  }

  async delete(id: string): Promise<boolean> {
    return this.store.delete(id)
  }
}
