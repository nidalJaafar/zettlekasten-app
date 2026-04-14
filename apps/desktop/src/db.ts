import Database from '@tauri-apps/plugin-sql'
import type { Database as CoreDatabase } from '@zettelkasten/core'

let _db: Database | null = null
let _dbPromise: Promise<Database> | null = null

export async function getDb(): Promise<CoreDatabase> {
  if (!_db) {
    _dbPromise ??= (async () => {
      const db = await Database.load('sqlite:zettelkasten.db')
      await db.execute('PRAGMA journal_mode = WAL')
      await db.execute('PRAGMA foreign_keys = ON')
      _db = db
      return db
    })().catch((error) => {
      _dbPromise = null
      throw error
    })

    await _dbPromise
  }
  return {
    async execute(sql: string, params: unknown[] = []) {
      await _db!.execute(sql, params)
    },
    async query<T>(sql: string, params: unknown[] = []) {
      return _db!.select<T[]>(sql, params)
    },
    async queryOne<T>(sql: string, params: unknown[] = []) {
      const rows = await _db!.select<T[]>(sql, params)
      return rows[0] ?? null
    },
  }
}
