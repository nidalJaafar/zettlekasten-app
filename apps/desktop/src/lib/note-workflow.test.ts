import { beforeEach, describe, expect, it } from 'vitest'
import {
  createNote,
  getLinkedNoteIds,
  getNoteById,
  type Database,
  type Note,
} from '@zettelkasten/core'
import { createMigratedDb } from '../../../../packages/core/tests/helpers/db'
import {
  createPermanentDraft,
  promoteFleetingToLiterature,
  runInTransaction,
  saveLiteratureAsPermanent,
  syncNoteLinks,
} from './note-workflow'

describe('note-workflow helpers', () => {
  let db: Database

  beforeEach(async () => {
    db = await createMigratedDb()
  })

  it('commits successful transactions', async () => {
    await runInTransaction(db, async () => {
      await createNote(db, { type: 'fleeting', title: 'Inside transaction', content: 'Body' })
    })

    const notes = await db.query<Note>('SELECT * FROM notes')
    expect(notes).toHaveLength(1)
    expect(notes[0]?.title).toBe('Inside transaction')
  })

  it('rolls back failed transactions', async () => {
    await expect(runInTransaction(db, async () => {
      await createNote(db, { type: 'fleeting', title: 'Will rollback', content: 'Body' })
      throw new Error('boom')
    })).rejects.toThrow('boom')

    const notes = await db.query<Note>('SELECT * FROM notes')
    expect(notes).toHaveLength(0)
  })

  it('promotes a fleeting note to literature in place', async () => {
    const fleeting = await createNote(db, { type: 'fleeting', title: 'Quick thought', content: 'Original' })
    const sourceId = await insertSource(db)

    await promoteFleetingToLiterature(db, fleeting, 'Refined title', 'Refined body', sourceId)

    const updated = await getNoteById(db, fleeting.id)
    expect(updated).toMatchObject({
      id: fleeting.id,
      type: 'literature',
      title: 'Refined title',
      content: 'Refined body',
      source_id: sourceId,
    })
  })

  it('saves a literature note as a new permanent note and marks the literature note processed', async () => {
    const literature = await createNote(db, {
      type: 'literature',
      title: 'Literature note',
      content: 'Source summary',
      source_id: await insertSource(db),
    })
    const linked = await createNote(db, { type: 'permanent', title: 'Existing permanent', content: 'Anchor' })

    const permanent = await saveLiteratureAsPermanent(
      db,
      literature,
      'Permanent idea',
      'My synthesis',
      [linked.id],
      true
    )

    const created = await getNoteById(db, permanent.id)
    const processed = await getNoteById(db, literature.id)
    const linkedIds = await getLinkedNoteIds(db, permanent.id)

    expect(created).toMatchObject({
      id: permanent.id,
      type: 'permanent',
      title: 'Permanent idea',
      content: 'My synthesis',
      own_words_confirmed: 1,
    })
    expect(processed?.processed_at).not.toBeNull()
    expect(linkedIds).toEqual([linked.id])
  })

  it('creates a permanent draft with links and own-words confirmation', async () => {
    const firstPermanent = await createNote(db, { type: 'permanent', title: 'Existing', content: 'Anchor' })

    const draft = await createPermanentDraft(db, 'Draft permanent', 'Draft body', [firstPermanent.id], true)

    const saved = await getNoteById(db, draft.id)
    const linkedIds = await getLinkedNoteIds(db, draft.id)

    expect(saved).toMatchObject({
      id: draft.id,
      type: 'permanent',
      title: 'Draft permanent',
      content: 'Draft body',
      own_words_confirmed: 1,
    })
    expect(linkedIds).toEqual([firstPermanent.id])
  })

  it('syncs permanent note links to match the requested set', async () => {
    const target = await createNote(db, { type: 'permanent', title: 'Target', content: 'Body' })
    const keep = await createNote(db, { type: 'permanent', title: 'Keep', content: 'Body' })
    const remove = await createNote(db, { type: 'permanent', title: 'Remove', content: 'Body' })
    const add = await createNote(db, { type: 'permanent', title: 'Add', content: 'Body' })

    await createPermanentDraft(db, 'Seed helper', 'Seed', [keep.id], true)
    await syncNoteLinks(db, target.id, [keep.id, remove.id])

    await syncNoteLinks(db, target.id, [keep.id, add.id])

    const linkedIds = await getLinkedNoteIds(db, target.id)
    expect(linkedIds).toEqual([add.id, keep.id].sort())
  })
})

async function insertSource(db: Database): Promise<string> {
  const id = globalThis.crypto.randomUUID()
  await db.execute(
    'INSERT INTO sources (id, type, label, description, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, 'book', 'Test source', null, Date.now()]
  )
  return id
}
