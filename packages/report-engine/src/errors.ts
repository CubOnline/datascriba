export class ReportEngineError extends Error {
  override readonly cause?: unknown

  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'ReportEngineError'
    this.cause = cause
  }
}

export class RenderError extends ReportEngineError {
  constructor(message: string, cause?: unknown) {
    super(message, cause)
    this.name = 'RenderError'
  }
}

export class TemplateError extends ReportEngineError {
  constructor(message: string, cause?: unknown) {
    super(message, cause)
    this.name = 'TemplateError'
  }
}

export class ParameterValidationError extends ReportEngineError {
  constructor(
    message: string,
    public readonly field: string,
    cause?: unknown,
  ) {
    super(message, cause)
    this.name = 'ParameterValidationError'
  }
}

export class UnsupportedFormatError extends ReportEngineError {
  constructor(format: string) {
    super(`Unsupported export format: ${format}`)
    this.name = 'UnsupportedFormatError'
  }
}
