import { describe, expect, it } from 'vitest'
import { createMigratedDb } from './helpers/db'
import {
  createSource,
  getSourceById,
  getAllSources,
  updateSource,
  deleteSource,
  countNotesBySource,
} from '../src/sources'

describe('sources', () => {
  it('creates a source and retrieves it', async () => {
    const db = await createMigratedDb()
    const source = await createSource(db, {
      type: 'book',
      label: 'Thinking, Fast and Slow',
      description: 'Daniel Kahneman',
    })
    expect(source.type).toBe('book')
    expect(source.label).toBe('Thinking, Fast and Slow')
    expect(source.description).toBe('Daniel Kahneman')
    expect(source.id).toBeTruthy()

    const retrieved = await getSourceById(db, source.id)
    expect(retrieved).toEqual(source)
  })

  it('creates a source without description', async () => {
    const db = await createMigratedDb()
    const source = await createSource(db, { type: 'article', label: 'Minimal Source' })
    expect(source.description).toBeNull()
  })

  it('lists all sources ordered by label', async () => {
    const db = await createMigratedDb()
    await createSource(db, { type: 'book', label: 'Zen' })
    await createSource(db, { type: 'book', label: 'Alpha' })
    await createSource(db, { type: 'book', label: 'Middle' })

    const sources = await getAllSources(db)
    expect(sources.map((s) => s.label)).toEqual(['Alpha', 'Middle', 'Zen'])
  })

  it('updates a source label and description', async () => {
    const db = await createMigratedDb()
    const source = await createSource(db, { type: 'book', label: 'Old Label' })
    await updateSource(db, source.id, { label: 'New Label', description: 'Added desc' })

    const updated = await getSourceById(db, source.id)
    expect(updated!.label).toBe('New Label')
    expect(updated!.description).toBe('Added desc')
  })

  it('deletes a source when no notes reference it', async () => {
    const db = await createMigratedDb()
    const source = await createSource(db, { type: 'book', label: 'Deletable' })
    await deleteSource(db, source.id)
    const retrieved = await getSourceById(db, source.id)
    expect(retrieved).toBeNull()
  })

  it('refuses to delete a source when notes reference it', async () => {
    const db = await createMigratedDb()
    const source = await createSource(db, { type: 'book', label: 'Referenced' })
    const { createNote } = await import('../src/notes')
    await createNote(db, { type: 'literature', title: 'Lit', source_id: source.id })

    await expect(deleteSource(db, source.id)).rejects.toThrow(/in use/i)
  })

  it('counts notes by source', async () => {
    const db = await createMigratedDb()
    const source = await createSource(db, { type: 'book', label: 'Counted' })
    const { createNote } = await import('../src/notes')
    expect(await countNotesBySource(db, source.id)).toBe(0)
    await createNote(db, { type: 'literature', title: 'One', source_id: source.id })
    await createNote(db, { type: 'literature', title: 'Two', source_id: source.id })
    expect(await countNotesBySource(db, source.id)).toBe(2)
  })

  it('counts zero for nonexistent source', async () => {
    const db = await createMigratedDb()
    expect(await countNotesBySource(db, 'no-such-id')).toBe(0)
  })
})
