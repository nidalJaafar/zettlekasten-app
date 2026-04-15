import { describe, expect, it } from 'vitest'
import initSqlJs from 'sql.js'
import { runMigrations } from '../src/schema'
import type { Database } from '../src/types'

async function createRawDb(sql?: string): Promise<Database> {
  const SQL = await initSqlJs({})
  const raw = new SQL.Database()
  if (sql) raw.run(sql)
  return {
    async execute(statement: string, params: unknown[] = []) {
      raw.run(statement, params as never[])
    },
    async query<T>(statement: string, params: unknown[] = []) {
      const result = raw.exec(statement, params as never[])
      if (result.length === 0) return []
      const [{ columns, values }] = result
      return values.map((row) => Object.fromEntries(columns.map((c, i) => [c, row[i]])) as T)
    },
    async queryOne<T>(statement: string, params: unknown[] = []) {
      const rows = await this.query<T>(statement, params)
      return rows[0] ?? null
    },
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

    await runMigrations(db)

    const row = await db.queryOne<{ processed_at: number | null }>(
      'SELECT processed_at FROM notes LIMIT 1'
    )
    expect(row ?? null).toBeNull()
  })
})
