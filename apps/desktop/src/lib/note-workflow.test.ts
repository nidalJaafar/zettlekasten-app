import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createNote,
  getLinkedNoteIds,
  getNoteById,
  updateNote,
  type Database,
  type Note,
} from '@zettelkasten/core'
import { createMigratedDb } from '../../../../packages/core/tests/helpers/db'
import {
  createPermanentDraft,
  promoteFleetingToLiterature,
  rewriteTitleBasedWikilinks,
  runInTransaction,
  saveLiteratureAsPermanent,
  savePersistedNote,
  syncNoteLinks,
  syncWikilinksToLinks,
} from './note-workflow'

const mockDatabaseLoad = vi.fn()

vi.mock('@tauri-apps/plugin-sql', () => ({
  default: {
    load: mockDatabaseLoad,
  },
}))

type TransactionalDatabase = Database & {
  transaction<T>(work: (db: Database) => Promise<T>): Promise<T>
}

type Snapshot = {
  sources: Record<string, unknown>[]
  notes: Record<string, unknown>[]
  noteLinks: Record<string, unknown>[]
}

async function createTransactionalTestDb(options?: {
  failOnExecute?: (sql: string, params: unknown[]) => boolean
}): Promise<TransactionalDatabase> {
  const baseDb = await createMigratedDb()

  async function takeSnapshot(): Promise<Snapshot> {
    return {
      sources: await baseDb.query<Record<string, unknown>>('SELECT * FROM sources ORDER BY id'),
      notes: await baseDb.query<Record<string, unknown>>('SELECT * FROM notes ORDER BY id'),
      noteLinks: await baseDb.query<Record<string, unknown>>(
        'SELECT * FROM note_links ORDER BY from_note_id, to_note_id'
      ),
    }
  }

  async function restoreTable(db: Database, table: string, rows: Record<string, unknown>[]): Promise<void> {
    for (const row of rows) {
      const columns = Object.keys(row)
      const placeholders = columns.map(() => '?').join(', ')
      await db.execute(
        `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
        columns.map((column) => row[column])
      )
    }
  }

  async function restoreSnapshot(snapshot: Snapshot): Promise<void> {
    await baseDb.execute('DELETE FROM note_links')
    await baseDb.execute('DELETE FROM notes')
    await baseDb.execute('DELETE FROM sources')
    await restoreTable(baseDb, 'sources', snapshot.sources)
    await restoreTable(baseDb, 'notes', snapshot.notes)
    await restoreTable(baseDb, 'note_links', snapshot.noteLinks)
  }

  const db: TransactionalDatabase = {
    async execute(sql: string, params: unknown[] = []) {
      if (options?.failOnExecute?.(sql, params)) {
        throw new Error('Injected execute failure')
      }
      await baseDb.execute(sql, params)
    },
    async query<T>(sql: string, params: unknown[] = []) {
      return baseDb.query<T>(sql, params)
    },
    async queryOne<T>(sql: string, params: unknown[] = []) {
      return baseDb.queryOne<T>(sql, params)
    },
    async transaction<T>(work: (db: Database) => Promise<T>) {
      const snapshot = await takeSnapshot()
      try {
        return await work(db)
      } catch (error) {
        await restoreSnapshot(snapshot)
        throw error
      }
    },
  }

  return db
}

describe('note-workflow helpers', () => {
  let db: Database

  beforeEach(async () => {
    db = await createTransactionalTestDb()
  })

  it('commits successful operations', async () => {
    await createNote(db, { type: 'fleeting', title: 'Created', content: 'Body' })

    const notes = await db.query<Note>('SELECT * FROM notes')
    expect(notes).toHaveLength(1)
    expect(notes[0]?.title).toBe('Created')
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

  it('rolls back permanent creation when linking fails mid-sequence', async () => {
    let shouldFailLinkInsert = true
    const transactionalDb = await createTransactionalTestDb({
      failOnExecute(sql) {
        if (!shouldFailLinkInsert) {
          return false
        }

        const normalizedSql = sql.replace(/\s+/g, ' ').trim()
        if (normalizedSql.startsWith('INSERT OR IGNORE INTO note_links')) {
          shouldFailLinkInsert = false
          return true
        }

        return false
      },
    })

    const literature = await createNote(transactionalDb, {
      type: 'literature',
      title: 'Literature note',
      content: 'Source summary',
      source_id: await insertSource(transactionalDb),
    })
    const linked = await createNote(transactionalDb, {
      type: 'permanent',
      title: 'Existing permanent',
      content: 'Anchor',
    })

    await expect(saveLiteratureAsPermanent(
      transactionalDb,
      literature,
      'Permanent idea',
      'My synthesis',
      [linked.id],
      true
    )).rejects.toThrow('Injected execute failure')

    const permanentNotes = await transactionalDb.query<Pick<Note, 'id' | 'title'>>(
      'SELECT id, title FROM notes WHERE type = ?',
      ['permanent']
    )
    const processed = await getNoteById(transactionalDb, literature.id)

    expect(permanentNotes).toEqual([{ id: linked.id, title: 'Existing permanent' }])
    expect(processed?.processed_at).toBeNull()
  })

  it('serializes overlapping desktop transactions on the shared connection', async () => {
    vi.resetModules()
    mockDatabaseLoad.mockReset()

    const executeCalls: string[] = []
    let inTransaction = false
    let releaseFirstTransaction: (() => void) | null = null
    let firstTransactionStarted!: () => void
    const firstTransactionStartedPromise = new Promise<void>((resolve) => {
      firstTransactionStarted = resolve
    })
    const firstTransactionGate = new Promise<void>((resolve) => {
      releaseFirstTransaction = resolve
    })

    mockDatabaseLoad.mockResolvedValue({
      async execute(sql: string) {
        executeCalls.push(sql)

        if (sql === 'BEGIN IMMEDIATE') {
          if (inTransaction) {
            throw new Error('cannot start a transaction within a transaction')
          }
          inTransaction = true
          return
        }

        if (sql === 'COMMIT' || sql === 'ROLLBACK') {
          inTransaction = false
        }
      },
      async select<T>() {
        return [] as T[]
      },
    })

    const { getDb } = await import('../db')
    const adapter = await getDb() as Database & {
      transaction<T>(work: (db: Database) => Promise<T>): Promise<T>
    }

    const firstTransaction = adapter.transaction(async () => {
      firstTransactionStarted()
      await firstTransactionGate
      return 'first'
    })

    await firstTransactionStartedPromise

    const secondTransaction = adapter.transaction(async () => 'second')

    releaseFirstTransaction?.()

    await expect(Promise.all([firstTransaction, secondTransaction])).resolves.toEqual(['first', 'second'])
    expect(executeCalls).toEqual([
      'PRAGMA journal_mode = WAL',
      'PRAGMA foreign_keys = ON',
      'BEGIN IMMEDIATE',
      'COMMIT',
      'BEGIN IMMEDIATE',
      'COMMIT',
    ])
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

  it('rewrites only matching title-based wikilinks', () => {
    const content = [
      'See [[Old Title]] and [[Old Title|Alias]].',
      'Leave [[Other Title]] and plain Old Title text alone.',
    ].join(' ')

    expect(rewriteTitleBasedWikilinks(content, 'Old Title', 'New Title')).toBe(
      'See [[New Title]] and [[New Title|Alias]]. Leave [[Other Title]] and plain Old Title text alone.'
    )
  })

  it('propagates persisted title changes through stored wikilinks on non-deleted notes', async () => {
    const renamed = await createNote(db, { type: 'permanent', title: 'Old Title', content: 'Renamed note body' })
    const linked = await createNote(db, {
      type: 'permanent',
      title: 'Consumer',
      content: 'Link [[Old Title]] and alias [[Old Title|Alias]] stay in sync.',
    })
    const unrelated = await createNote(db, {
      type: 'permanent',
      title: 'Unrelated',
      content: 'Keep [[Someone Else]] untouched.',
    })
    const deleted = await createNote(db, {
      type: 'permanent',
      title: 'Deleted consumer',
      content: 'Deleted [[Old Title]] should not change.',
    })

    await updateNote(db, deleted.id, { deleted_at: Date.now() })

    await savePersistedNote(db, renamed, {
      title: 'New Title',
      content: 'Renamed note body',
    })

    expect(await getNoteById(db, renamed.id)).toMatchObject({ title: 'New Title' })
    expect(await getNoteById(db, linked.id)).toMatchObject({
      content: 'Link [[New Title]] and alias [[New Title|Alias]] stay in sync.',
    })
    expect(await getNoteById(db, unrelated.id)).toMatchObject({
      content: 'Keep [[Someone Else]] untouched.',
    })
    expect(await db.queryOne<{ content: string }>('SELECT content FROM notes WHERE id = ?', [deleted.id])).toMatchObject({
      content: 'Deleted [[New Title]] should not change.',
    })
  })

  it('rejects title propagation when the old title is ambiguous among active notes', async () => {
    const renamed = await createNote(db, { type: 'permanent', title: 'Old Title', content: 'Renamed note body' })
    await createNote(db, { type: 'permanent', title: 'Old Title', content: 'Second active duplicate' })
    const linked = await createNote(db, {
      type: 'permanent',
      title: 'Consumer',
      content: 'Link [[Old Title]] should stay untouched.',
    })

    await expect(savePersistedNote(db, renamed, {
      title: 'New Title',
      content: 'Renamed note body',
    })).rejects.toThrow('Cannot propagate title-based wikilinks for ambiguous active titles.')

    expect(await getNoteById(db, renamed.id)).toMatchObject({ title: 'Old Title' })
    expect(await getNoteById(db, linked.id)).toMatchObject({
      content: 'Link [[Old Title]] should stay untouched.',
    })
  })

  it('rejects title propagation when the new title is ambiguous among active notes', async () => {
    const renamed = await createNote(db, { type: 'permanent', title: 'Old Title', content: 'Renamed note body' })
    await createNote(db, { type: 'permanent', title: 'New Title', content: 'Existing active duplicate' })

    await expect(savePersistedNote(db, renamed, {
      title: 'New Title',
      content: 'Renamed note body',
    })).rejects.toThrow('Cannot propagate title-based wikilinks for ambiguous active titles.')

    expect(await getNoteById(db, renamed.id)).toMatchObject({ title: 'Old Title' })
  })

  it('allows renaming when only deleted notes share the old or new title', async () => {
    const renamed = await createNote(db, { type: 'permanent', title: 'Old Title', content: 'Renamed note body' })
    const deletedOld = await createNote(db, { type: 'permanent', title: 'Old Title', content: 'Deleted old duplicate' })
    const deletedNew = await createNote(db, { type: 'permanent', title: 'New Title', content: 'Deleted new duplicate' })

    await updateNote(db, deletedOld.id, { deleted_at: Date.now() })
    await updateNote(db, deletedNew.id, { deleted_at: Date.now() })

    await savePersistedNote(db, renamed, {
      title: 'New Title',
      content: 'Renamed note body',
    })

    expect(await getNoteById(db, renamed.id)).toMatchObject({ title: 'New Title' })
  })

  it('allows a newly created fleeting note title to be used as a wikilink target', async () => {
    const consumer = await createNote(db, { type: 'permanent', title: 'Consumer', content: 'Body' })
    const created = await createNote(db, { type: 'fleeting', title: 'New Linked Note' })

    const updatedContent = 'See [[New Linked Note]] for details.'
    await savePersistedNote(db, consumer, { title: consumer.title, content: updatedContent })

    const saved = await getNoteById(db, consumer.id)
    expect(saved?.content).toBe(updatedContent)

    const resolved = await db.queryOne<{ id: string }>(
      'SELECT id FROM notes WHERE title = ? AND deleted_at IS NULL',
      ['New Linked Note']
    )
    expect(resolved?.id).toBe(created.id)
  })

  it('syncs wikilinks in content to note_links for graph connectivity', async () => {
    const target = await createNote(db, { type: 'permanent', title: 'Target Note', content: 'Body' })
    const source = await createNote(db, { type: 'permanent', title: 'Source Note', content: 'Original' })

    await savePersistedNote(db, source, {
      title: source.title,
      content: 'See [[Target Note]] for details.',
    })

    const links = await getLinkedNoteIds(db, source.id)
    expect(links).toContain(target.id)
  })

  it('removes stale note_links when wikilinks are removed from content', async () => {
    const target = await createNote(db, { type: 'permanent', title: 'Target Note', content: 'Body' })
    const source = await createNote(db, { type: 'permanent', title: 'Source Note', content: `See [[Target Note]]` })

    await savePersistedNote(db, source, { title: source.title, content: 'No more links.' })

    const links = await getLinkedNoteIds(db, source.id)
    expect(links).not.toContain(target.id)
  })

  it('syncs multiple wikilinks in a single note', async () => {
    const a = await createNote(db, { type: 'permanent', title: 'Note A', content: 'A' })
    const b = await createNote(db, { type: 'permanent', title: 'Note B', content: 'B' })
    const source = await createNote(db, { type: 'permanent', title: 'Hub', content: '' })

    await syncWikilinksToLinks(db, source.id, 'Links to [[Note A]] and [[Note B]].')

    const links = await getLinkedNoteIds(db, source.id)
    expect(links.sort()).toEqual([a.id, b.id].sort())
  })

  it('ignores wikilinks that do not resolve to existing notes', async () => {
    const source = await createNote(db, { type: 'permanent', title: 'Source', content: '' })

    await syncWikilinksToLinks(db, source.id, 'See [[Phantom Note]] nowhere.')

    const links = await getLinkedNoteIds(db, source.id)
    expect(links).toEqual([])
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
