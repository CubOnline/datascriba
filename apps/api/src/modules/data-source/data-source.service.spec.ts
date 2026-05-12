import type { DataSourceRecord } from '@datascriba/shared-types'
import { NotFoundException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'


import { DataSourceRepository } from './data-source.repository'
import { DataSourceService } from './data-source.service'
import type { CreateDataSourceDto } from './dto/create-data-source.dto'

// Provide a fixed encryption key in tests
const TEST_KEY = 'a'.repeat(64)

describe('DataSourceService', () => {
  let service: DataSourceService
  let repository: DataSourceRepository

  beforeEach(async () => {
    vi.stubEnv('ENCRYPTION_MASTER_KEY', TEST_KEY)

    const module: TestingModule = await Test.createTestingModule({
      providers: [DataSourceService, DataSourceRepository],
    }).compile()

    service = module.get<DataSourceService>(DataSourceService)
    repository = module.get<DataSourceRepository>(DataSourceRepository)
  })

  describe('create', () => {
    it('stores a record with encrypted connection string', async () => {
      const dto: CreateDataSourceDto = {
        name: 'Test MSSQL',
        type: 'mssql',
        connectionString: 'Server=localhost,1433;Database=test;User Id=sa;Password=secret;',
      }
      const record = await service.create(dto)
      expect(record.name).toBe('Test MSSQL')
      expect(record.encryptedConnectionString).toBe('[REDACTED]')
      expect(record.id).toBeDefined()
    })

    it('encrypts the connection string (not stored plaintext)', async () => {
      const plainCs = 'Server=localhost,1433;Database=test;User Id=sa;Password=mysecret;'
      const dto: CreateDataSourceDto = {
        name: 'Encrypted DB',
        type: 'mssql',
        connectionString: plainCs,
      }
      await service.create(dto)
      // Check the actual stored value in the repository is encrypted (not plaintext)
      const all = await repository.findAll('default')
      const stored = all[0]
      expect(stored).toBeDefined()
      expect(stored?.encryptedConnectionString).not.toBe(plainCs)
      expect(stored?.encryptedConnectionString).not.toBe('[REDACTED]')
      // Should contain hex colons (iv:authTag:ciphertext format)
      expect(stored?.encryptedConnectionString).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/)
    })
  })

  describe('findOne', () => {
    it('throws NotFoundException for unknown id', async () => {
      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException)
    })

    it('returns sanitized record', async () => {
      const dto: CreateDataSourceDto = {
        name: 'DB',
        type: 'mssql',
        connectionString: 'Server=localhost,1433;',
      }
      const created = await service.create(dto)
      const found = await service.findOne(created.id)
      expect(found.id).toBe(created.id)
      expect(found.encryptedConnectionString).toBe('[REDACTED]')
    })
  })

  describe('remove', () => {
    it('throws NotFoundException when deleting nonexistent id', async () => {
      await expect(service.remove('bad-id')).rejects.toThrow(NotFoundException)
    })

    it('removes the record', async () => {
      const dto: CreateDataSourceDto = {
        name: 'Temp',
        type: 'mssql',
        connectionString: 'Server=localhost,1433;',
      }
      const created = await service.create(dto)
      await service.remove(created.id)
      await expect(service.findOne(created.id)).rejects.toThrow(NotFoundException)
    })
  })

  describe('update', () => {
    it('updates name and returns sanitized record', async () => {
      const dto: CreateDataSourceDto = {
        name: 'Old',
        type: 'mssql',
        connectionString: 'Server=localhost,1433;',
      }
      const created = await service.create(dto)
      const updated = await service.update(created.id, { name: 'New' })
      expect(updated.name).toBe('New')
      expect(updated.encryptedConnectionString).toBe('[REDACTED]')
    })

    it('throws NotFoundException for unknown id', async () => {
      await expect(service.update('nonexistent', { name: 'New' })).rejects.toThrow(NotFoundException)
    })
  })

  describe('findAll', () => {
    it('returns only records for the given workspaceId', async () => {
      await service.create({ name: 'A', type: 'mssql', connectionString: 'Server=a;', workspaceId: 'ws-1' })
      await service.create({ name: 'B', type: 'mssql', connectionString: 'Server=b;', workspaceId: 'ws-2' })
      const ws1 = await service.findAll('ws-1')
      expect(ws1).toHaveLength(1)
      const first = ws1[0] as DataSourceRecord
      expect(first.name).toBe('A')
    })
  })
})
