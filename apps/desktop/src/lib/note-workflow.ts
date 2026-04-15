import {
  addLink,
  canPromoteToLiterature,
  canSavePermanentNote,
  countNotesByType,
  createNote,
  extractWikilinkTitles,
  getLinkedNoteIds,
  removeLink,
  updateNote,
  type Database,
  type Note,
} from '@zettelkasten/core'
import { rewriteTitleBasedWikilinks } from '@zettelkasten/core'

export { rewriteTitleBasedWikilinks }

type TransactionalDatabase = Database & {
  transaction<T>(work: (db: Database) => Promise<T>): Promise<T>
}

export const DUPLICATE_ACTIVE_TITLE_ERROR = 'Another active note already uses this title.'

export async function runInTransaction<T>(db: Database, work: (db: Database) => Promise<T>): Promise<T> {
  if (!('transaction' in db) || typeof db.transaction !== 'function') {
    throw new Error('Database adapter does not support transactions.')
  }

  return (db as TransactionalDatabase).transaction(work)
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

  if (note.title !== title && title.trim() !== '') {
    await ensureUniqueActiveTitle(db, title, note.id)
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

  return runInTransaction(db, async (tx) => {
    await ensureUniqueActiveTitle(tx, title)

    const permanent = await createNote(tx, { type: 'permanent', title, content })
    await updateNote(tx, permanent.id, { own_words_confirmed: 1 })
    for (const linkedId of linkedIds) {
      await addLink(tx, permanent.id, linkedId)
    }
    await updateNote(tx, note.id, { processed_at: Date.now() })
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

  return runInTransaction(db, async (tx) => {
    await ensureUniqueActiveTitle(tx, title)

    const permanent = await createNote(tx, { type: 'permanent', title, content })
    await updateNote(tx, permanent.id, { own_words_confirmed: 1 })
    for (const linkedId of linkedIds) {
      await addLink(tx, permanent.id, linkedId)
    }
    return { ...permanent, own_words_confirmed: 1 }
  })
}

const AMBIGUOUS_TITLE_PROPAGATION_ERROR = 'Cannot propagate title-based wikilinks for ambiguous active titles.'

export async function syncTitleBasedWikilinks(db: Database, oldTitle: string, newTitle: string): Promise<void> {
  if (oldTitle === newTitle || oldTitle.trim() === '' || newTitle.trim() === '') {
    return
  }

  const notes = await db.query<Pick<Note, 'id' | 'content'>>(
    'SELECT id, content FROM notes WHERE deleted_at IS NULL'
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

export async function ensureUniqueActiveTitle(db: Database, title: string, noteId?: string): Promise<void> {
  if (title.trim() === '') {
    return
  }

  const match = noteId
    ? await db.queryOne<{ id: string }>(
      'SELECT id FROM notes WHERE title = ? AND deleted_at IS NULL AND id != ? LIMIT 1',
      [title, noteId]
    )
    : await db.queryOne<{ id: string }>(
      'SELECT id FROM notes WHERE title = ? AND deleted_at IS NULL LIMIT 1',
      [title]
    )

  if (match) {
    throw new Error(DUPLICATE_ACTIVE_TITLE_ERROR)
  }
}

export async function syncWikilinksToLinks(db: Database, noteId: string, content: string): Promise<void> {
  const titles = extractWikilinkTitles(content)
  const resolvedIds = new Set<string>()

  for (const title of titles) {
    const match = await db.queryOne<{ id: string }>(
      'SELECT id FROM notes WHERE title = ? AND deleted_at IS NULL AND id != ? LIMIT 1',
      [title, noteId]
    )
    if (match) {
      resolvedIds.add(match.id)
    }
  }

  const currentIds = await getLinkedNoteIds(db, noteId)
  const currentSet = new Set(currentIds)

  for (const id of currentSet) {
    if (!resolvedIds.has(id)) {
      await removeLink(db, noteId, id)
    }
  }

  for (const id of resolvedIds) {
    if (!currentSet.has(id)) {
      await addLink(db, noteId, id)
    }
  }
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
  await runInTransaction(db, async (tx) => {
    if (note.title !== updates.title && updates.title.trim() !== '') {
      await ensureUniqueActiveTitle(tx, updates.title, note.id)
    }

    if (note.title.trim() !== '' && updates.title.trim() !== '' && note.title !== updates.title) {
      if (
        await hasAnotherActiveNoteWithTitle(tx, note.id, note.title)
        || await hasAnotherActiveNoteWithTitle(tx, note.id, updates.title)
      ) {
        throw new Error(AMBIGUOUS_TITLE_PROPAGATION_ERROR)
      }

      await updateNote(tx, note.id, updates)
      await syncTitleBasedWikilinks(tx, note.title, updates.title)
      await syncWikilinksToLinks(tx, note.id, updates.content)
      return
    }

    await updateNote(tx, note.id, updates)
    await syncWikilinksToLinks(tx, note.id, updates.content)
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
