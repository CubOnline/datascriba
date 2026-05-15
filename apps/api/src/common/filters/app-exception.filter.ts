import {
  ConnectionError,
  DataSourceError,
  DangerousQueryError,
  EncryptionError,
  QueryBlockedError,
  QueryError,
  UnsupportedDriverError,
} from '@datascriba/db-drivers'
import {
  ParameterValidationError,
  RenderError,
  TemplateError,
  UnsupportedFormatError,
} from '@datascriba/report-engine'
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { ThrottlerException } from '@nestjs/throttler'
import type { FastifyReply, FastifyRequest } from 'fastify'

interface ErrorResponse {
  statusCode: number
  error: string
  message: string
  timestamp: string
  path: string
}

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const reply = ctx.getResponse<FastifyReply>()
    const request = ctx.getRequest<FastifyRequest>()

    const { statusCode, message } = this.mapException(exception)

    const body: ErrorResponse = {
      statusCode,
      error: HttpStatus[statusCode] ?? 'INTERNAL_SERVER_ERROR',
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    }

    if (statusCode >= 500) {
      this.logger.error({ err: exception, path: request.url }, message)
    } else {
      this.logger.warn({ path: request.url }, message)
    }

    void reply.status(statusCode).send(body)
  }

  private mapException(exception: unknown): { statusCode: number; message: string } {
    if (exception instanceof ThrottlerException) {
      return { statusCode: 429, message: 'Too many requests. Please wait before retrying.' }
    }
    if (exception instanceof HttpException) {
      return { statusCode: exception.getStatus(), message: exception.message }
    }
    if (exception instanceof DangerousQueryError) {
      return { statusCode: HttpStatus.FORBIDDEN, message: exception.message }
    }
    if (exception instanceof QueryBlockedError) {
      return { statusCode: HttpStatus.FORBIDDEN, message: exception.message }
    }
    if (exception instanceof ConnectionError) {
      return { statusCode: 503, message: 'Data source connection failed' }
    }
    if (exception instanceof QueryError) {
      return { statusCode: HttpStatus.BAD_REQUEST, message: 'Query execution failed' }
    }
    if (exception instanceof UnsupportedDriverError) {
      return { statusCode: 501, message: exception.message }
    }
    if (exception instanceof EncryptionError) {
      return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Encryption error' }
    }
    if (exception instanceof DataSourceError) {
      return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Data source error' }
    }
    if (exception instanceof ParameterValidationError) {
      return { statusCode: 422, message: exception.message }
    }
    if (exception instanceof TemplateError) {
      return { statusCode: HttpStatus.BAD_REQUEST, message: exception.message }
    }
    if (exception instanceof UnsupportedFormatError) {
      return { statusCode: HttpStatus.BAD_REQUEST, message: exception.message }
    }
    if (exception instanceof RenderError) {
      return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: exception.message }
    }
    return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' }
  }
}
