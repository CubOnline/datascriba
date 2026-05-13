import Handlebars from 'handlebars'

import { TemplateError } from './errors'

/**
 * IMPORTANT: Handlebars is used ONLY for structural SQL composition
 * (conditional blocks, choosing table/schema names by parameter).
 * User-supplied values that go into WHERE clauses must be passed
 * as parameterized query bindings — never injected directly via
 * template expressions — to prevent SQL injection.
 */

// Register custom helpers once at module load
Handlebars.registerHelper(
  'formatDate',
  (value: unknown, format: unknown): string => {
    const date = value instanceof Date ? value : new Date(String(value))

    if (isNaN(date.getTime())) {
      return String(value)
    }

    const fmt = typeof format === 'string' ? format : 'YYYY-MM-DD'

    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')

    return fmt
      .replace('YYYY', String(year))
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hours)
      .replace('mm', minutes)
      .replace('ss', seconds)
  },
)

Handlebars.registerHelper(
  'ifEq',
  function (
    this: unknown,
    a: unknown,
    b: unknown,
    options: Handlebars.HelperOptions,
  ): string {
    if (a === b) {
      return options.fn(this)
    }
    return options.inverse(this)
  },
)

/**
 * Compiles a Handlebars template string.
 * Throws TemplateError if the syntax is invalid.
 */
export function compileTemplate(query: string): HandlebarsTemplateDelegate {
  try {
    return Handlebars.compile(query, { noEscape: true })
  } catch (err: unknown) {
    throw new TemplateError(
      `Failed to compile SQL template: ${err instanceof Error ? err.message : String(err)}`,
      err,
    )
  }
}

/**
 * Compiles and renders a Handlebars SQL template with the given parameters.
 * Returns the rendered SQL string for structural composition only —
 * user data values must still be passed as parameterized query bindings.
 */
export function renderTemplate(
  query: string,
  parameters: Record<string, unknown>,
): string {
  try {
    const template = compileTemplate(query)
    return template(parameters)
  } catch (err: unknown) {
    if (err instanceof TemplateError) throw err
    throw new TemplateError(
      `Failed to render SQL template: ${err instanceof Error ? err.message : String(err)}`,
      err,
    )
  }
}
