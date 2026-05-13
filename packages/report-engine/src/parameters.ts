import { z } from 'zod'

import { ParameterValidationError } from './errors'
import type { ReportParameter } from './types'

function buildSchema(param: ReportParameter): z.ZodTypeAny {
  switch (param.type) {
    case 'string':
      return z.string()
    case 'number':
      return z.number()
    case 'date':
      return z.union([z.string().datetime({ offset: true }), z.date()])
    case 'dateRange':
      return z.object({ from: z.string(), to: z.string() })
    case 'select': {
      if (param.options && param.options.length > 0) {
        const allowed = param.options.map((o) => o.value)
        return z.unknown().refine((v) => allowed.includes(v), {
          message: `Value must be one of: ${allowed.map(String).join(', ')}`,
        })
      }
      return z.unknown()
    }
    case 'multiSelect': {
      if (param.options && param.options.length > 0) {
        const allowed = param.options.map((o) => o.value)
        return z.array(
          z.unknown().refine((v) => allowed.includes(v), {
            message: `Each value must be one of: ${allowed.map(String).join(', ')}`,
          }),
        )
      }
      return z.array(z.unknown())
    }
    case 'boolean':
      return z.boolean()
    default: {
      // exhaustiveness guard
      const _exhaustive: never = param.type
      return _exhaustive
    }
  }
}

/**
 * Validates each parameter value against its declared type.
 * Throws ParameterValidationError with the field name on failure.
 * Returns a record of resolved (and validated) values.
 */
export function validateParameters(
  params: ReportParameter[],
  values: Record<string, unknown>,
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {}

  for (const param of params) {
    const rawValue = values[param.name]

    if (rawValue === undefined || rawValue === null) {
      if (param.required) {
        throw new ParameterValidationError(
          `Required parameter '${param.name}' is missing`,
          param.name,
        )
      }
      if (param.defaultValue !== undefined) {
        resolved[param.name] = param.defaultValue
      }
      continue
    }

    const schema = buildSchema(param)
    const result = schema.safeParse(rawValue)

    if (!result.success) {
      throw new ParameterValidationError(
        `Invalid value for parameter '${param.name}': ${result.error.issues[0]?.message ?? 'validation failed'}`,
        param.name,
        result.error,
      )
    }

    resolved[param.name] = result.data
  }

  return resolved
}
