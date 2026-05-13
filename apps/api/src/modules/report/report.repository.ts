import type { ReportDefinition, RunRecord } from '@datascriba/report-engine'
import { Injectable } from '@nestjs/common'

/**
 * Phase 3 stub: stores ReportDefinition and RunRecord records in-memory.
 * A future phase will replace this with a real Prisma implementation.
 */
@Injectable()
export class ReportRepository {
  private readonly reportStore = new Map<string, ReportDefinition>()
  private readonly runStore = new Map<string, RunRecord>()

  // ─── ReportDefinition CRUD ─────────────────────────────────────────────────

  async findAll(workspaceId: string): Promise<ReportDefinition[]> {
    return [...this.reportStore.values()].filter((r) => r.workspaceId === workspaceId)
  }

  async findById(id: string): Promise<ReportDefinition | null> {
    return this.reportStore.get(id) ?? null
  }

  async create(
    data: Omit<ReportDefinition, 'id' | 'createdAt' | 'updatedAt' | 'version'>,
  ): Promise<ReportDefinition> {
    const id = crypto.randomUUID()
    const now = new Date()
    const record: ReportDefinition = {
      ...data,
      id,
      version: 1,
      createdAt: now,
      updatedAt: now,
    }
    this.reportStore.set(id, record)
    return record
  }

  async update(
    id: string,
    patch: Partial<Omit<ReportDefinition, 'id' | 'workspaceId' | 'createdAt'>>,
  ): Promise<ReportDefinition | null> {
    const existing = this.reportStore.get(id)
    if (!existing) return null
    const updated: ReportDefinition = {
      ...existing,
      ...patch,
      version: existing.version + 1,
      updatedAt: new Date(),
    }
    this.reportStore.set(id, updated)
    return updated
  }

  async delete(id: string): Promise<boolean> {
    return this.reportStore.delete(id)
  }

  // ─── RunRecord CRUD ────────────────────────────────────────────────────────

  async findRunsByReportId(reportId: string): Promise<RunRecord[]> {
    return [...this.runStore.values()].filter((r) => r.reportId === reportId)
  }

  async findRunById(id: string): Promise<RunRecord | null> {
    return this.runStore.get(id) ?? null
  }

  async createRun(run: RunRecord): Promise<RunRecord> {
    this.runStore.set(run.id, run)
    return run
  }

  async updateRun(
    id: string,
    patch: Partial<Omit<RunRecord, 'id' | 'reportId'>>,
  ): Promise<RunRecord | null> {
    const existing = this.runStore.get(id)
    if (!existing) return null
    const updated: RunRecord = { ...existing, ...patch }
    this.runStore.set(id, updated)
    return updated
  }
}
