import type { SchemaContext } from '../types'

/**
 * Cache'lenecek sistem promptu — suggest-query için.
 * Kısa tutulur, şema context ayrı mesajda gönderilir.
 */
export const SUGGEST_QUERY_SYSTEM_PROMPT = `You are an expert SQL assistant specializing in Microsoft SQL Server (MSSQL / T-SQL).
Your task is to generate a valid T-SQL SELECT query based on the user's natural language request and the provided database schema.

Rules:
- Output ONLY the SQL query, no explanation, no markdown code fences.
- Use only the tables and columns from the provided schema.
- Never use DROP, DELETE, UPDATE, INSERT, TRUNCATE, ALTER, CREATE, or EXEC.
- Use proper T-SQL syntax: square bracket identifiers [schema].[table].[column].
- Always qualify table names with their schema (e.g. [dbo].[Orders]).
- Use TOP instead of LIMIT for row limiting.
- If the request is ambiguous, generate the most reasonable interpretation.
- If the request cannot be fulfilled with the given schema, respond with a single line: -- CANNOT_GENERATE: <reason>
`.trim()

/**
 * Kullanıcı prompt'undaki section delimiter karakterlerini temizler.
 * Bu sayede kullanıcı "-- DATABASE SCHEMA --" gibi sahte bölümler
 * ekleyerek prompt injection yapmaya çalışamaz.
 */
function sanitizeUserPrompt(prompt: string): string {
  // Yorum satırı (--) ile başlayan satırları silerek section header
  // injection'ı engelle. Satır başındaki boşlukları da dahil et.
  return prompt
    .split('\n')
    .map((line) => (line.trimStart().startsWith('--') ? '' : line))
    .join('\n')
    .trim()
}

/**
 * Kullanıcı mesajını şema context ile birleştirir.
 * Kullanıcı girdisi prompt injection'a karşı sanitize edilir.
 */
export function buildSuggestQueryUserMessage(
  prompt: string,
  schemaContext: SchemaContext,
): string {
  const schemaLines: string[] = ['-- DATABASE SCHEMA --']

  for (const table of schemaContext.tables) {
    schemaLines.push(`\nTable: [${table.schema}].[${table.name}] (${table.type})`)
    schemaLines.push('Columns:')
    for (const col of table.columns) {
      const pk = col.isPrimaryKey ? ' [PK]' : ''
      const nullable = col.nullable ? ' NULL' : ' NOT NULL'
      const def = col.defaultValue !== null ? ` DEFAULT ${col.defaultValue}` : ''
      schemaLines.push(`  - ${col.name}: ${col.dataType}${nullable}${pk}${def}`)
    }
  }

  // Kullanıcı girdisini sanitize et — section header injection'ı engelle
  const sanitizedPrompt = sanitizeUserPrompt(prompt)

  schemaLines.push('\n-- USER REQUEST --')
  schemaLines.push(sanitizedPrompt)

  return schemaLines.join('\n')
}
