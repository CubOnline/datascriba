/**
 * Minimal structured logger for the db-drivers package.
 * Uses console methods only in development/test; production callers
 * should inject a pino instance via the NestJS layer.
 *
 * This keeps db-drivers free of a heavy pino peer dependency while
 * still providing structured logging support.
 */

export interface Logger {
  info(obj: Record<string, unknown>, msg: string): void
  warn(obj: Record<string, unknown>, msg: string): void
  error(obj: Record<string, unknown>, msg: string): void
  debug(obj: Record<string, unknown>, msg: string): void
}

function formatLog(level: string, context: string, obj: Record<string, unknown>, msg: string): void {
  const entry = JSON.stringify({ level, context, ...obj, msg })
  if (level === 'error') {
    process.stderr.write(entry + '\n')
  } else {
    process.stdout.write(entry + '\n')
  }
}

export function createLogger(context: string): Logger {
  return {
    info: (obj, msg) => formatLog('info', context, obj, msg),
    warn: (obj, msg) => formatLog('warn', context, obj, msg),
    error: (obj, msg) => formatLog('error', context, obj, msg),
    debug: (obj, msg) => formatLog('debug', context, obj, msg),
  }
}
