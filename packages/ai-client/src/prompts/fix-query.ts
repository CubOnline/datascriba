/**
 * Cache'lenecek sistem promptu — fix-query için.
 */
export const FIX_QUERY_SYSTEM_PROMPT = `You are an expert SQL debugger specializing in Microsoft SQL Server (MSSQL / T-SQL).
Your task is to fix a broken SQL query given the original query and the error message.

Rules:
- Output ONLY the corrected SQL query, no explanation, no markdown code fences.
- Preserve the original intent of the query.
- Use proper T-SQL syntax.
- If the error cannot be fixed (e.g. references non-existent objects you cannot know), output the original query unchanged with a comment: -- FIX_FAILED: <reason>
`.trim()

/**
 * SQL ve hata mesajını XML benzeri etiketlerle sarmalar.
 * Bu sayede kullanıcı girdisi (sql, errorMessage) prompt yapısını
 * bozarak injection yapamaz — içerik etiket dışına çıkamaz.
 */
export function buildFixQueryUserMessage(sql: string, errorMessage: string): string {
  return [
    'Fix this SQL query.',
    '',
    '<error>',
    errorMessage,
    '</error>',
    '',
    '<query>',
    sql,
    '</query>',
  ].join('\n')
}
