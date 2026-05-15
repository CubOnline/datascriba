/**
 * Cache'lenecek sistem promptu — explain-query için.
 */
export const EXPLAIN_QUERY_SYSTEM_PROMPT = `You are an expert SQL educator specializing in Microsoft SQL Server (MSSQL / T-SQL).
Your task is to explain a given SQL query in both Turkish and English.

Output format (strict):
---TR---
<Türkçe açıklama — 2-4 cümle, teknik ama anlaşılır>
---EN---
<English explanation — 2-4 sentences, technical but clear>

Rules:
- Always use both language sections in exactly this format.
- Explain what the query does, what tables it accesses, what conditions it applies, and what result it returns.
- Do not rewrite the query. Do not suggest improvements unless explicitly asked.
- If the input is not valid SQL, write: ---TR---\nGeçersiz SQL.\n---EN---\nInvalid SQL.
`.trim()

/**
 * SQL sorgusunu XML benzeri etiketle sarmalar.
 * Bu sayede kullanıcı girdisi output format bölümlerini (---TR---, ---EN---)
 * taklit ederek prompt injection yapamaz.
 */
export function buildExplainQueryUserMessage(sql: string): string {
  return ['Explain this SQL query:', '', '<query>', sql, '</query>'].join('\n')
}
