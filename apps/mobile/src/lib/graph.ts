import type { Note, NoteLink } from '@zettelkasten/core'

export interface GraphNode {
  id: string
  title: string
  type: string
}

export interface GraphEdge {
  source: string
  target: string
}

export function buildNeighborhood(
  focusNoteId: string | null,
  notes: Note[],
  links: NoteLink[],
  maxDepth: number = 2,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  if (!focusNoteId || notes.length === 0) {
    return {
      nodes: notes.map((n) => ({ id: n.id, title: n.title, type: n.type })),
      edges: [],
    }
  }

  const adjacency = new Map<string, Set<string>>()
  for (const link of links) {
    let neighbors = adjacency.get(link.from_note_id)
    if (!neighbors) {
      neighbors = new Set()
      adjacency.set(link.from_note_id, neighbors)
    }
    neighbors.add(link.to_note_id)

    let reverseNeighbors = adjacency.get(link.to_note_id)
    if (!reverseNeighbors) {
      reverseNeighbors = new Set()
      adjacency.set(link.to_note_id, reverseNeighbors)
    }
    reverseNeighbors.add(link.from_note_id)
  }

  const visited = new Set<string>()
  const queue: Array<{ id: string; depth: number }> = [{ id: focusNoteId, depth: 0 }]
  visited.add(focusNoteId)

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!
    if (depth >= maxDepth) continue

    const neighbors = adjacency.get(id)
    if (!neighbors) continue

    for (const neighborId of neighbors) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId)
        queue.push({ id: neighborId, depth: depth + 1 })
      }
    }
  }

  const noteMap = new Map(notes.map((n) => [n.id, n]))
  const nodes: GraphNode[] = []
  for (const id of visited) {
    const note = noteMap.get(id)
    if (note) nodes.push({ id: note.id, title: note.title, type: note.type })
  }

  const edges: GraphEdge[] = []
  for (const link of links) {
    if (visited.has(link.from_note_id) && visited.has(link.to_note_id)) {
      edges.push({ source: link.from_note_id, target: link.to_note_id })
    }
  }

  return { nodes, edges }
}
