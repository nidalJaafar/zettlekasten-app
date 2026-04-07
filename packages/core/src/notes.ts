import type { Database, Note, NoteType } from './types'

export interface CreateNoteInput {
  type: NoteType
  title: string
  content?: string
  source_id?: string
}

function assertLiteratureHasSource(type: NoteType, sourceId: string | null | undefined): void {
  if (type === 'literature' && !sourceId) {
    throw new Error('Literature notes require a source.')
  }
}

export async function createNote(db: Database, input: CreateNoteInput): Promise<Note> {
  assertLiteratureHasSource(input.type, input.source_id)

  const note: Note = {
    id: globalThis.crypto.randomUUID(),
    type: input.type,
    title: input.title,
    content: input.content ?? '',
    created_at: Date.now(),
    updated_at: Date.now(),
    source_id: input.source_id ?? null,
    own_words_confirmed: 0,
    deleted_at: null,
    processed_at: null,
  }
  await db.execute(
    `INSERT INTO notes (id, type, title, content, created_at, updated_at, source_id, own_words_confirmed, deleted_at, processed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [note.id, note.type, note.title, note.content, note.created_at, note.updated_at,
     note.source_id, note.own_words_confirmed, note.deleted_at, note.processed_at]
  )
  return note
}

export async function getNoteById(db: Database, id: string): Promise<Note | null> {
  return db.queryOne<Note>(
    `SELECT * FROM notes WHERE id = ? AND deleted_at IS NULL`,
    [id]
  )
}

export async function getNotesByType(db: Database, type: NoteType): Promise<Note[]> {
  return db.query<Note>(
    `SELECT * FROM notes WHERE type = ? AND deleted_at IS NULL ORDER BY created_at ASC`,
    [type]
  )
}

export async function updateNote(
  db: Database,
  id: string,
  updates: Partial<Pick<Note, 'title' | 'content' | 'type' | 'source_id' | 'own_words_confirmed' | 'processed_at'>>
): Promise<void> {
  const entries = Object.entries(updates).filter(([, value]) => value !== undefined)
  if (entries.length === 0) return

  const current = await db.queryOne<Pick<Note, 'type' | 'source_id'>>(
    `SELECT type, source_id FROM notes WHERE id = ?`,
    [id]
  )
  if (!current) throw new Error('Note not found.')

  const nextType = updates.type ?? current.type
  const nextSourceId = updates.source_id !== undefined ? updates.source_id : current.source_id
  if (updates.type !== undefined || updates.source_id !== undefined) {
    assertLiteratureHasSource(nextType, nextSourceId)
  }

  const fields = entries.map(([k]) => `${k} = ?`).join(', ')
  const values = [...entries.map(([, v]) => v), Date.now(), id]
  await db.execute(`UPDATE notes SET ${fields}, updated_at = ? WHERE id = ?`, values)
}

export async function softDeleteNote(db: Database, id: string): Promise<void> {
  await db.execute(
    `UPDATE notes SET deleted_at = ? WHERE id = ?`,
    [Date.now(), id]
  )
}

export async function countNotesByType(db: Database, type: NoteType): Promise<number> {
  const row = await db.queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM notes WHERE type = ? AND deleted_at IS NULL`,
    [type]
  )
  return row?.count ?? 0
}
