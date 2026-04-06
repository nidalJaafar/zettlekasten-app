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
    const note = await createNote(db, {
      type: 'literature',
      title: 'Notes on Kahneman',
      source_id: 'src-1',
    })
    expect(note.source_id).toBe('src-1')
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
    await createNote(db, { type: 'fleeting', title: 'First' })
    await createNote(db, { type: 'literature', title: 'Lit note', source_id: 'src-1' })
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
