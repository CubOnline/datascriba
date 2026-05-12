export class DataSourceError extends Error {
  constructor(
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'DataSourceError'
    if (cause instanceof Error) {
      this.stack = `${this.stack ?? ''}\nCaused by: ${cause.stack ?? cause.message}`
    }
  }
}

export class ConnectionError extends DataSourceError {
  constructor(message: string, cause?: unknown) {
    super(message, cause)
    this.name = 'ConnectionError'
  }
}

export class QueryError extends DataSourceError {
  constructor(
    message: string,
    public readonly sql: string,
    cause?: unknown,
  ) {
    super(message, cause)
    this.name = 'QueryError'
  }
}

export class QueryTimeoutError extends QueryError {
  constructor(sql: string, timeoutMs: number) {
    super(`Query exceeded timeout of ${timeoutMs}ms`, sql)
    this.name = 'QueryTimeoutError'
  }
}

export class QueryBlockedError extends QueryError {
  constructor(sql: string, reason: string) {
    super(`Query blocked: ${reason}`, sql)
    this.name = 'QueryBlockedError'
  }
}

export class EncryptionError extends DataSourceError {
  constructor(message: string, cause?: unknown) {
    super(message, cause)
    this.name = 'EncryptionError'
  }
}

export class UnsupportedDriverError extends DataSourceError {
  constructor(driverType: string) {
    super(`Driver type '${driverType}' is not supported`)
    this.name = 'UnsupportedDriverError'
  }
}

export class DangerousQueryError extends DataSourceError {
  constructor(message: string, cause?: unknown) {
    super(message, cause)
    this.name = 'DangerousQueryError'
  }
}
