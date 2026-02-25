const BRACKET_NOTATION_PATTERN = /\([^)]*\)|\[[^\]]*\]|\{[^}]*\}/g

export function normalizeImportName(value: unknown): string {
  const text =
    typeof value === 'string'
      ? value
      : value === null || value === undefined
        ? ''
        : String(value)

  const trimmed = text.trim()
  if (trimmed.length === 0) return ''

  const collapsedWhitespace = trimmed.replace(/[^\S\r\n]+/g, ' ')
  const withoutBracketNotation = collapsedWhitespace
    .replace(BRACKET_NOTATION_PATTERN, '')
    .trim()
  const firstLine = withoutBracketNotation.split(/\r?\n/)[0] ?? ''

  return firstLine.trim()
}
