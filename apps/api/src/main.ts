import 'reflect-metadata'

import { Logger, ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'

import { AppModule } from './app.module'

const logger = new Logger('Bootstrap')

async function bootstrap(): Promise<void> {
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
    origin: process.env['FRONTEND_URL'] ?? 'http://localhost:3000',
    credentials: true,
  })

  if (process.env['NODE_ENV'] !== 'production') {
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

  const port = process.env['API_PORT'] ? parseInt(process.env['API_PORT'], 10) : 3001
  const host = process.env['API_HOST'] ?? '0.0.0.0'

  await app.listen(port, host)
  logger.log(`DataScriba API running on http://${host}:${port}`)
  logger.log(`Environment: ${process.env['NODE_ENV'] ?? 'development'}`)
}

void bootstrap()
