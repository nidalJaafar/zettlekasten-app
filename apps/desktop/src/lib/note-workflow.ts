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
  try {
    await db.execute('BEGIN')
  } catch {
    return work()
  }
  try {
    const result = await work()
    await db.execute('COMMIT')
    return result
  } catch (error) {
    try { await db.execute('ROLLBACK') } catch {}
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

const AMBIGUOUS_TITLE_PROPAGATION_ERROR = 'Cannot propagate title-based wikilinks for ambiguous active titles.'

export function rewriteTitleBasedWikilinks(content: string, oldTitle: string, newTitle: string): string {
  if (oldTitle === newTitle || oldTitle.trim() === '' || newTitle.trim() === '') {
    return content
  }

  return content.replace(/\[\[([^\[\]\|]+)(\|[^\[\]]*)?\]\]/g, (match, target: string, alias?: string) => {
    if (target !== oldTitle) {
      return match
    }

    return `[[${newTitle}${alias ?? ''}]]`
  })
}

export async function syncTitleBasedWikilinks(db: Database, oldTitle: string, newTitle: string): Promise<void> {
  if (oldTitle === newTitle || oldTitle.trim() === '' || newTitle.trim() === '') {
    return
  }

  const notes = await db.query<Pick<Note, 'id' | 'content'>>(
    'SELECT id, content FROM notes'
  )

  for (const note of notes) {
    const nextContent = rewriteTitleBasedWikilinks(note.content, oldTitle, newTitle)
    if (nextContent !== note.content) {
      await updateNote(db, note.id, { content: nextContent })
    }
  }
}

async function hasAnotherActiveNoteWithTitle(db: Database, noteId: string, title: string): Promise<boolean> {
  const match = await db.queryOne<{ id: string }>(
    'SELECT id FROM notes WHERE title = ? AND deleted_at IS NULL AND id != ? LIMIT 1',
    [title, noteId]
  )

  return match !== null
}

export async function savePersistedNote(
  db: Database,
  note: Note,
  updates: {
    title: string
    content: string
    source_id?: string | null
  }
): Promise<void> {
  await runInTransaction(db, async () => {
    if (note.title.trim() !== '' && updates.title.trim() !== '' && note.title !== updates.title) {
      if (
        await hasAnotherActiveNoteWithTitle(db, note.id, note.title)
        || await hasAnotherActiveNoteWithTitle(db, note.id, updates.title)
      ) {
        throw new Error(AMBIGUOUS_TITLE_PROPAGATION_ERROR)
      }

      await updateNote(db, note.id, updates)
      await syncTitleBasedWikilinks(db, note.title, updates.title)
      return
    }

    await updateNote(db, note.id, updates)
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
