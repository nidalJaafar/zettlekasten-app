import type { Database, NoteLink } from './types'

export async function addLink(db: Database, fromId: string, toId: string): Promise<void> {
  const now = Date.now()
  await db.execute(
    `INSERT OR IGNORE INTO note_links (from_note_id, to_note_id, created_at) VALUES (?, ?, ?)`,
    [fromId, toId, now]
  )
  await db.execute(
    `INSERT OR IGNORE INTO note_links (from_note_id, to_note_id, created_at) VALUES (?, ?, ?)`,
    [toId, fromId, now]
  )
}

export async function removeLink(db: Database, fromId: string, toId: string): Promise<void> {
  await db.execute(
    `DELETE FROM note_links WHERE (from_note_id = ? AND to_note_id = ?) OR (from_note_id = ? AND to_note_id = ?)`,
    [fromId, toId, toId, fromId]
  )
}

export async function getLinkedNoteIds(db: Database, noteId: string): Promise<string[]> {
  const rows = await db.query<{ to_note_id: string }>(
    `SELECT nl.to_note_id
     FROM note_links nl
     JOIN notes from_note ON from_note.id = nl.from_note_id AND from_note.deleted_at IS NULL
     JOIN notes to_note ON to_note.id = nl.to_note_id AND to_note.deleted_at IS NULL
     WHERE nl.from_note_id = ?`,
    [noteId]
  )
  return rows.map((r) => r.to_note_id)
}

export async function getAllLinks(db: Database): Promise<NoteLink[]> {
  return db.query<NoteLink>(
    `SELECT nl.*
     FROM note_links nl
     JOIN notes from_note ON from_note.id = nl.from_note_id AND from_note.deleted_at IS NULL
     JOIN notes to_note ON to_note.id = nl.to_note_id AND to_note.deleted_at IS NULL
     WHERE nl.from_note_id < nl.to_note_id
     ORDER BY nl.created_at ASC`
  )
}
