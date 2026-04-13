import {
  addLink,
  canPromoteToLiterature,
  canSavePermanentNote,
  countNotesByType,
  createNote,
  getLinkedNoteIds,
  removeLink,
  updateNote,
  type Database,
  type Note,
} from '@zettelkasten/core'

export async function runInTransaction<T>(db: Database, work: () => Promise<T>): Promise<T> {
  await db.execute('BEGIN')
  try {
    const result = await work()
    await db.execute('COMMIT')
    return result
  } catch (error) {
    await db.execute('ROLLBACK')
    throw error
  }
}

export async function promoteFleetingToLiterature(
  db: Database,
  note: Note,
  title: string,
  content: string,
  sourceId: string
): Promise<void> {
  const check = canPromoteToLiterature({ ...note, source_id: sourceId })
  if (!check.ok) {
    throw new Error(check.reason)
  }

  await updateNote(db, note.id, {
    type: 'literature',
    title,
    content,
    source_id: sourceId,
  })
}

export async function saveLiteratureAsPermanent(
  db: Database,
  note: Note,
  title: string,
  content: string,
  linkedIds: string[],
  ownWords: boolean
): Promise<Note> {
  const totalPermanentNotes = await countNotesByType(db, 'permanent')
  const check = canSavePermanentNote(
    { own_words_confirmed: ownWords ? 1 : 0 },
    { linkedPermanentNoteIds: linkedIds, totalPermanentNotes }
  )
  if (!check.ok) {
    throw new Error(check.reason)
  }

  return runInTransaction(db, async () => {
    const permanent = await createNote(db, { type: 'permanent', title, content })
    await updateNote(db, permanent.id, { own_words_confirmed: 1 })
    for (const linkedId of linkedIds) {
      await addLink(db, permanent.id, linkedId)
    }
    await updateNote(db, note.id, { processed_at: Date.now() })
    return { ...permanent, own_words_confirmed: 1 }
  })
}

export async function createPermanentDraft(
  db: Database,
  title: string,
  content: string,
  linkedIds: string[],
  ownWords: boolean
): Promise<Note> {
  const totalPermanentNotes = await countNotesByType(db, 'permanent')
  const check = canSavePermanentNote(
    { own_words_confirmed: ownWords ? 1 : 0 },
    { linkedPermanentNoteIds: linkedIds, totalPermanentNotes }
  )
  if (!check.ok) {
    throw new Error(check.reason)
  }

  return runInTransaction(db, async () => {
    const permanent = await createNote(db, { type: 'permanent', title, content })
    await updateNote(db, permanent.id, { own_words_confirmed: 1 })
    for (const linkedId of linkedIds) {
      await addLink(db, permanent.id, linkedId)
    }
    return { ...permanent, own_words_confirmed: 1 }
  })
}

export async function syncNoteLinks(db: Database, noteId: string, nextLinkedIds: string[]): Promise<void> {
  const currentLinkedIds = await getLinkedNoteIds(db, noteId)
  const currentSet = new Set(currentLinkedIds)
  const nextSet = new Set(nextLinkedIds)

  for (const linkedId of currentSet) {
    if (!nextSet.has(linkedId)) {
      await removeLink(db, noteId, linkedId)
    }
  }

  for (const linkedId of nextSet) {
    if (!currentSet.has(linkedId)) {
      await addLink(db, noteId, linkedId)
    }
  }
}
