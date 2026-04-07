import { describe, it, expect, beforeEach } from 'vitest'
import { addLink, removeLink, getLinkedNoteIds, getAllLinks } from '../src/links'
import { createNote, softDeleteNote } from '../src/notes'
import { createMigratedDb } from './helpers/db'
import type { Database } from '../src/types'

let db: Database
let idA: string
let idB: string
let idC: string

beforeEach(async () => {
  db = await createMigratedDb()
  const a = await createNote(db, { type: 'permanent', title: 'Note A' })
  const b = await createNote(db, { type: 'permanent', title: 'Note B' })
  const c = await createNote(db, { type: 'permanent', title: 'Note C' })
  idA = a.id
  idB = b.id
  idC = c.id
})

describe('addLink', () => {
  it('creates bidirectional link', async () => {
    await addLink(db, idA, idB)
    const fromA = await getLinkedNoteIds(db, idA)
    const fromB = await getLinkedNoteIds(db, idB)
    expect(fromA).toContain(idB)
    expect(fromB).toContain(idA)
  })

  it('is idempotent — duplicate add does not throw', async () => {
    await addLink(db, idA, idB)
    await expect(addLink(db, idA, idB)).resolves.not.toThrow()
  })

  it('rejects when destination note does not exist', async () => {
    await expect(addLink(db, idA, 'missing-note')).rejects.toThrow(/foreign key/i)

    expect(await getLinkedNoteIds(db, idA)).toEqual([])
    expect(await getAllLinks(db)).toEqual([])
  })
})

describe('removeLink', () => {
  it('removes both directions', async () => {
    await addLink(db, idA, idB)
    await removeLink(db, idA, idB)
    const fromA = await getLinkedNoteIds(db, idA)
    const fromB = await getLinkedNoteIds(db, idB)
    expect(fromA).not.toContain(idB)
    expect(fromB).not.toContain(idA)
  })
})

describe('getLinkedNoteIds', () => {
  it('returns all directly connected note ids', async () => {
    await addLink(db, idA, idB)
    await addLink(db, idA, idC)
    const linked = await getLinkedNoteIds(db, idA)
    expect(linked).toHaveLength(2)
    expect(linked).toContain(idB)
    expect(linked).toContain(idC)
  })

  it('returns empty array when no links', async () => {
    const linked = await getLinkedNoteIds(db, idA)
    expect(linked).toHaveLength(0)
  })

  it('hides linked note ids when the linked note is soft-deleted', async () => {
    await addLink(db, idA, idB)
    await softDeleteNote(db, idB)

    await expect(getLinkedNoteIds(db, idA)).resolves.toEqual([])
  })
})

describe('getAllLinks', () => {
  it('returns each pair once (deduplicated)', async () => {
    await addLink(db, idA, idB)
    await addLink(db, idA, idC)
    const all = await getAllLinks(db)
    expect(all).toHaveLength(2)
  })

  it('omits deleted-note edges from getAllLinks', async () => {
    await addLink(db, idA, idB)
    await addLink(db, idA, idC)
    await softDeleteNote(db, idB)

    const links = await getAllLinks(db)

    expect(links).toHaveLength(1)
    expect([links[0].from_note_id, links[0].to_note_id].sort()).toEqual([idA, idC].sort())
  })
})
