import type { ScheduleDefinition } from '@datascriba/shared-types'
import { Injectable } from '@nestjs/common'

/**
 * Phase 6 stub: in-memory schedule store.
 * A future phase replaces this with Prisma.
 */
@Injectable()
export class ScheduleRepository {
  private readonly store = new Map<string, ScheduleDefinition>()

  async findAll(): Promise<ScheduleDefinition[]> {
    return [...this.store.values()]
  }

  async findById(id: string): Promise<ScheduleDefinition | null> {
    return this.store.get(id) ?? null
  }

  async findEnabled(): Promise<ScheduleDefinition[]> {
    return [...this.store.values()].filter((s) => s.enabled)
  }

  async create(
    data: Omit<ScheduleDefinition, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ScheduleDefinition> {
    const id = crypto.randomUUID()
    const now = new Date()
    const record: ScheduleDefinition = { ...data, id, createdAt: now, updatedAt: now }
    this.store.set(id, record)
    return record
  }

  async update(
    id: string,
    patch: Partial<Omit<ScheduleDefinition, 'id' | 'createdAt'>>,
  ): Promise<ScheduleDefinition | null> {
    const existing = this.store.get(id)
    if (!existing) return null
    const updated: ScheduleDefinition = { ...existing, ...patch, updatedAt: new Date() }
    this.store.set(id, updated)
    return updated
  }

  async delete(id: string): Promise<boolean> {
    return this.store.delete(id)
  }
}
