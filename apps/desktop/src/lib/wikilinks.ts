import { marked } from 'marked'
import {
  getActiveWikilinkQuery,
  getWikilinkText,
  insertWikilinkSelection,
  type ActiveWikilinkQuery,
} from '@zettelkasten/core'

export { getActiveWikilinkQuery, getWikilinkText, insertWikilinkSelection }
export type { ActiveWikilinkQuery }

const WIKILINK_RE = /\[\[([^\]]+)\]\]/g

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function getWikilinkTarget(target: EventTarget | null): string | null {
  if (!(target instanceof Node)) return null
  const element = target instanceof Element ? target : target.parentElement
  if (!element) return null
  const link = element.closest<HTMLElement>('[data-wikilink]')
  return link?.dataset.wikilink?.trim() || null
}

export function renderMarkdownPreview(content: string): string {
  const withRenderedWikilinks = content.replaceAll(WIKILINK_RE, (_match, rawTarget: string) => {
    const text = getWikilinkText(rawTarget)
    const escapedText = escapeHtml(text)
    return `<a href="#" class="rendered-wikilink" data-wikilink="${escapedText}" title="Ctrl+click to open: ${escapedText}">${escapedText}</a>`
  })
  return marked.parse(withRenderedWikilinks, { async: false }) as string
}
