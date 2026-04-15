const WIKILINK_EXTRACT_RE = /\[\[([^\]\|]+)(?:\|[^\]]*)?\]\]/g

export function extractWikilinkTitles(content: string): string[] {
  const titles: string[] = []
  let match: RegExpExecArray | null
  WIKILINK_EXTRACT_RE.lastIndex = 0
  while ((match = WIKILINK_EXTRACT_RE.exec(content)) !== null) {
    titles.push(match[1].trim())
  }
  return titles
}

export function rewriteTitleBasedWikilinks(content: string, oldTitle: string, newTitle: string): string {
  if (oldTitle === newTitle || oldTitle.trim() === '' || newTitle.trim() === '') {
    return content
  }

  return content.replace(/\[\[([^\[\]\|]+)(\|[^\[\]]*)?\]\]/g, (match, target: string, alias?: string) => {
    if (target !== oldTitle) {
      return match
    }
    return `[[${newTitle}${alias ?? ''}]]`
  })
}

export interface ActiveWikilinkQuery {
  from: number
  to: number
  query: string
}

export function getActiveWikilinkQuery(value: string, cursor: number): ActiveWikilinkQuery | null {
  const beforeCursor = value.slice(0, cursor)
  const openIndex = beforeCursor.lastIndexOf('[[')
  if (openIndex === -1) return null

  const closingIndex = beforeCursor.indexOf(']]', openIndex)
  if (closingIndex !== -1) return null

  const query = beforeCursor.slice(openIndex + 2)
  if (query.includes('\n')) return null

  return { from: openIndex, to: cursor, query }
}

export function insertWikilinkSelection(
  value: string,
  activeQuery: ActiveWikilinkQuery,
  title: string,
): { value: string; cursor: number } {
  const replacement = `[[${title}]]`
  const nextValue = value.slice(0, activeQuery.from) + replacement + value.slice(activeQuery.to)
  return { value: nextValue, cursor: activeQuery.from + replacement.length }
}

export function getWikilinkText(value: string): string {
  return value.split('|')[0].trim()
}
