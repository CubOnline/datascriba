import { NestFactory } from '@nestjs/core'
import { Logger } from '@nestjs/common'
import { validateWorkerEnv } from './config/worker-env'
import { WorkerModule } from './worker.module'

async function bootstrap(): Promise<void> {
  validateWorkerEnv()
  const logger = new Logger('Worker')

  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: ['error', 'warn', 'log'],
  })

  app.enableShutdownHooks()

  logger.log('DataScriba Worker started — listening for report jobs')
}

void bootstrap()
