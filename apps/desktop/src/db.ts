import Database from '@tauri-apps/plugin-sql'
import type { Database as CoreDatabase } from '@zettelkasten/core'

let _db: Database | null = null

export async function getDb(): Promise<CoreDatabase> {
  if (!_db) {
    _db = await Database.load('sqlite:zettelkasten.db')
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
