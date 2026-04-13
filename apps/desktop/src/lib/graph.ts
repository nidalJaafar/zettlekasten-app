import type { Note, NoteLink } from '@zettelkasten/core'

export interface GraphNeighborhood {
  notes: Note[]
  links: NoteLink[]
}

export function buildNeighborhood(
  focusNoteId: string,
  notes: Note[],
  links: NoteLink[],
  maxDepth = 1,
): GraphNeighborhood {
  const noteMap = new Map(notes.map((n) => [n.id, n]))
  if (!noteMap.has(focusNoteId)) {
    return { notes: [], links: [] }
  }

  const adj = new Map<string, Set<string>>()
  for (const link of links) {
    let s = adj.get(link.from_note_id)
    if (!s) { s = new Set(); adj.set(link.from_note_id, s) }
    s.add(link.to_note_id)

    let t = adj.get(link.to_note_id)
    if (!t) { t = new Set(); adj.set(link.to_note_id, t) }
    t.add(link.from_note_id)
  }

  const visited = new Set<string>()
  const queue: Array<{ id: string; depth: number }> = [{ id: focusNoteId, depth: 0 }]
  visited.add(focusNoteId)

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!
    if (depth >= maxDepth) continue
    const neighbors = adj.get(id)
    if (!neighbors) continue
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor) && noteMap.has(neighbor)) {
        visited.add(neighbor)
        queue.push({ id: neighbor, depth: depth + 1 })
      }
    }
  }

  const filteredNotes = notes.filter((n) => visited.has(n.id))
  const filteredLinks = links.filter(
    (l) => visited.has(l.from_note_id) && visited.has(l.to_note_id),
  )

  return { notes: filteredNotes, links: filteredLinks }
}
