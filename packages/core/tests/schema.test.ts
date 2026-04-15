import { describe, expect, it } from 'vitest'
import initSqlJs from 'sql.js'
import { runMigrations } from '../src/schema'
import type { Database } from '../src/types'

async function createRawDb(sql?: string): Promise<Database> {
  const SQL = await initSqlJs({})
  const raw = new SQL.Database()
  if (sql) raw.run(sql)
  const execute = (s: string, p: unknown[] = []) => { raw.run(s, p as never[]) }
  const query = <T>(s: string, p: unknown[] = []): T[] => {
    const result = raw.exec(s, p as never[])
    if (result.length === 0) return []
    const [{ columns, values }] = result
    return values.map((row) => Object.fromEntries(columns.map((c, i) => [c, row[i]])) as T)
  }
  return {
    execute: async (s: string, p: unknown[] = []) => execute(s, p),
    query: async <T,>(s: string, p: unknown[] = []) => query<T>(s, p),
    queryOne: async <T,>(s: string, p: unknown[] = []) => query<T>(s, p)[0] ?? null,
  }
}

describe('runMigrations', () => {
  it('is idempotent on an already migrated schema', async () => {
    const db = await createRawDb()
    await runMigrations(db)
    await expect(runMigrations(db)).resolves.toBeUndefined()
  })

  it('upgrades a legacy notes table without processed_at', async () => {
    const db = await createRawDb(`
      CREATE TABLE notes (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        source_id TEXT,
        own_words_confirmed INTEGER NOT NULL DEFAULT 0,
        deleted_at INTEGER
      );
      CREATE TABLE sources (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        label TEXT NOT NULL,
        description TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE note_links (
        from_note_id TEXT NOT NULL,
        to_note_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (from_note_id, to_note_id)
      );
    `)

    await db.execute(
      `INSERT INTO notes (
        id, type, title, content, created_at, updated_at, source_id, own_words_confirmed, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['legacy-note', 'literature', 'Legacy title', 'Legacy content', 1, 2, null, 0, null]
    )

    await runMigrations(db)

    const row = await db.queryOne<{
      id: string
      title: string
      processed_at: number | null
    }>(
      'SELECT id, title, processed_at FROM notes WHERE id = ?',
      ['legacy-note']
    )
    expect(row).toEqual({
      id: 'legacy-note',
      title: 'Legacy title',
      processed_at: null,
    })
  })
})
