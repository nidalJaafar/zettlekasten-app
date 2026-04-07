import { describe, it, expect, beforeEach } from 'vitest'
import {
  createNote,
  getNoteById,
  getNotesByType,
  updateNote,
  softDeleteNote,
  countNotesByType,
} from '../src/notes'
import { createMigratedDb } from './helpers/db'
import type { Database } from '../src/types'

let db: Database

async function insertSource(id = 'src-1') {
  await db.execute(
    'INSERT INTO sources (id, type, label, description, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, 'book', 'Thinking, Fast and Slow', null, Date.now()]
  )
  return id
}

beforeEach(async () => {
  db = await createMigratedDb()
})

describe('createNote', () => {
  it('inserts a fleeting note and returns it', async () => {
    const note = await createNote(db, { type: 'fleeting', title: 'Quick thought' })
    expect(note.id).toBeTruthy()
    expect(note.type).toBe('fleeting')
    expect(note.title).toBe('Quick thought')
    expect(note.content).toBe('')
    expect(note.source_id).toBeNull()
    expect(note.own_words_confirmed).toBe(0)
    expect(note.deleted_at).toBeNull()
  })

  it('inserts a literature note with a source', async () => {
    const sourceId = await insertSource()
    const note = await createNote(db, {
      type: 'literature',
      title: 'Notes on Kahneman',
      source_id: sourceId,
    })
    expect(note.source_id).toBe(sourceId)
  })

  it('rejects literature notes without a source on create', async () => {
    await expect(
      createNote(db, { type: 'literature', title: 'Missing source' })
    ).rejects.toThrow(/source/i)
  })

  it('rejects a literature note whose source does not exist', async () => {
    await expect(
      createNote(db, {
        type: 'literature',
        title: 'Broken reference',
        source_id: 'missing-source',
      })
    ).rejects.toThrow(/foreign key/i)
  })

  it('sets processed_at to null by default', async () => {
    const note = await createNote(db, { type: 'fleeting', title: 'Unprocessed' })
    expect(note.processed_at).toBeNull()
  })
})

describe('getNoteById', () => {
  it('returns the note by id', async () => {
    const created = await createNote(db, { type: 'fleeting', title: 'Hello' })
    const found = await getNoteById(db, created.id)
    expect(found?.id).toBe(created.id)
  })

  it('returns null when not found', async () => {
    const found = await getNoteById(db, 'nonexistent')
    expect(found).toBeNull()
  })

  it('returns null for soft-deleted notes', async () => {
    const note = await createNote(db, { type: 'fleeting', title: 'Gone' })
    await softDeleteNote(db, note.id)
    const found = await getNoteById(db, note.id)
    expect(found).toBeNull()
  })
})

describe('getNotesByType', () => {
  it('returns only notes of the requested type, oldest first', async () => {
    const sourceId = await insertSource()
    await createNote(db, { type: 'fleeting', title: 'First' })
    await createNote(db, { type: 'literature', title: 'Lit note', source_id: sourceId })
    await createNote(db, { type: 'fleeting', title: 'Second' })

    const fleeting = await getNotesByType(db, 'fleeting')
    expect(fleeting).toHaveLength(2)
    expect(fleeting[0].title).toBe('First')
    expect(fleeting[1].title).toBe('Second')
  })

  it('excludes soft-deleted notes', async () => {
    const note = await createNote(db, { type: 'fleeting', title: 'Deleted' })
    await softDeleteNote(db, note.id)
    const results = await getNotesByType(db, 'fleeting')
    expect(results).toHaveLength(0)
  })
})

describe('updateNote', () => {
  it('updates title and content', async () => {
    const note = await createNote(db, { type: 'fleeting', title: 'Original' })
    await updateNote(db, note.id, { title: 'Updated', content: 'New content' })
    const updated = await getNoteById(db, note.id)
    expect(updated?.title).toBe('Updated')
    expect(updated?.content).toBe('New content')
  })

  it('can set processed_at', async () => {
    const sourceId = await insertSource()
    const note = await createNote(db, { type: 'literature', title: 'To process', source_id: sourceId })
    const ts = Date.now()
    await updateNote(db, note.id, { processed_at: ts })
    const updated = await getNoteById(db, note.id)
    expect(updated?.processed_at).toBe(ts)
  })

  it('keeps a literature note source when source_id is undefined', async () => {
    const sourceId = await insertSource()
    const note = await createNote(db, { type: 'literature', title: 'Keeps source', source_id: sourceId })
    const ts = Date.now()

    await updateNote(db, note.id, { source_id: undefined, processed_at: ts })

    const updated = await getNoteById(db, note.id)
    expect(updated?.processed_at).toBe(ts)
    expect(updated?.source_id).toBe(sourceId)
  })

  it('allows unrelated updates to legacy literature notes without a source', async () => {
    const id = globalThis.crypto.randomUUID()
    const createdAt = Date.now()
    const ts = createdAt + 1

    await db.execute(
      `INSERT INTO notes (id, type, title, content, created_at, updated_at, source_id, own_words_confirmed, deleted_at, processed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, 'literature', 'Legacy literature', '', createdAt, createdAt, null, 0, null, null]
    )

    await updateNote(db, id, { processed_at: ts })

    const updated = await getNoteById(db, id)
    expect(updated?.processed_at).toBe(ts)
    expect(updated?.source_id).toBeNull()
  })

  it('rejects updating a note into literature without a source', async () => {
    const fleeting = await createNote(db, { type: 'fleeting', title: 'Draft' })

    await expect(
      updateNote(db, fleeting.id, { type: 'literature' })
    ).rejects.toThrow(/source/i)
  })

  it('allows updating a note into literature when a source is provided', async () => {
    const sourceId = await insertSource()
    const fleeting = await createNote(db, { type: 'fleeting', title: 'Draft' })

    await updateNote(db, fleeting.id, { type: 'literature', source_id: sourceId })

    const updated = await getNoteById(db, fleeting.id)
    expect(updated?.type).toBe('literature')
    expect(updated?.source_id).toBe(sourceId)
  })
})

describe('countNotesByType', () => {
  it('counts notes by type excluding deleted', async () => {
    await createNote(db, { type: 'permanent', title: 'P1' })
    await createNote(db, { type: 'permanent', title: 'P2' })
    const deleted = await createNote(db, { type: 'permanent', title: 'P3' })
    await softDeleteNote(db, deleted.id)
    const count = await countNotesByType(db, 'permanent')
    expect(count).toBe(2)
  })
})
