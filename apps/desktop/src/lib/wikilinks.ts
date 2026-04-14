import { marked } from 'marked'

const WIKILINK_RE = /\[\[([^\]]+)\]\]/g

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function getWikilinkText(value: string): string {
  return value.split('|')[0].trim()
}

export function getWikilinkTarget(target: EventTarget | null): string | null {
  if (!(target instanceof Node)) {
    return null
  }

  const element = target instanceof Element ? target : target.parentElement
  if (!element) {
    return null
  }

  const link = element.closest<HTMLElement>('[data-wikilink]')
  return link?.dataset.wikilink?.trim() || null
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

  return {
    from: openIndex,
    to: cursor,
    query,
  }
}

export function insertWikilinkSelection(
  value: string,
  activeQuery: ActiveWikilinkQuery,
  title: string,
): { value: string; cursor: number } {
  const replacement = `[[${title}]]`
  const nextValue = value.slice(0, activeQuery.from) + replacement + value.slice(activeQuery.to)
  return {
    value: nextValue,
    cursor: activeQuery.from + replacement.length,
  }
}

export function renderMarkdownPreview(content: string): string {
  const withRenderedWikilinks = content.replaceAll(WIKILINK_RE, (_match, rawTarget: string) => {
    const text = getWikilinkText(rawTarget)
    const escapedText = escapeHtml(text)
    return `<a href="#" class="rendered-wikilink" data-wikilink="${escapedText}" title="Ctrl+click to open: ${escapedText}">${escapedText}</a>`
  })

  return marked.parse(withRenderedWikilinks, { async: false }) as string
}
