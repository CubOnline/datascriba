import { Test, TestingModule } from '@nestjs/testing'
import { describe, it, expect, beforeEach, vi } from 'vitest'

import { AppController } from './app.controller'
import { AppService } from './app.service'

describe('AppController', () => {
  let appController: AppController
  let appService: AppService

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile()

    appController = app.get<AppController>(AppController)
    appService = app.get<AppService>(AppService)
  })

  describe('getHealth', () => {
    it('should return status ok', () => {
      const result = appController.getHealth()
      expect(result.status).toBe('ok')
    })

    it('should return a valid ISO timestamp', () => {
      const result = appController.getHealth()
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp)
    })

    it('should return version 0.1.0', () => {
      const result = appController.getHealth()
      expect(result.version).toBe('0.1.0')
    })

    it('should delegate to AppService.getHealth()', () => {
      const spy = vi.spyOn(appService, 'getHealth')
      appController.getHealth()
      expect(spy).toHaveBeenCalledOnce()
    })
  })
})
