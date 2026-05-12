import 'reflect-metadata'

import { Logger, ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'

import { AppModule } from './app.module'
import { validateEnv } from './config/env'

const logger = new Logger('Bootstrap')

async function bootstrap(): Promise<void> {
  // Fail fast if env is invalid — app refuses to start
  const env = validateEnv()

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
  )

  app.setGlobalPrefix('api/v1', { exclude: ['/health'] })

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  )

  app.enableCors({
    origin: env.FRONTEND_URL ?? (env.NODE_ENV === 'production' ? undefined : 'http://localhost:3000'),
    credentials: true,
  })

  if (env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('DataScriba API')
      .setDescription('Your AI-powered data scribe — REST API')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build()

    const document = SwaggerModule.createDocument(app, config)
    SwaggerModule.setup('api/docs', app, document)
    logger.log('Swagger UI available at /api/docs')
  }

  await app.listen(env.API_PORT, env.API_HOST)
  logger.log(`DataScriba API running on http://${env.API_HOST}:${env.API_PORT}`)
  logger.log(`Environment: ${env.NODE_ENV}`)
}

void bootstrap()
