import * as SQLite from 'expo-sqlite'
import { runMigrations } from '@zettelkasten/core'
import type { Database } from '@zettelkasten/core'

let _db: SQLite.SQLiteDatabase | null = null

async function openDb(): Promise<SQLite.SQLiteDatabase> {
  if (!_db) {
    _db = await SQLite.openDatabaseAsync('zettelkasten.db')
    await _db.execAsync('PRAGMA foreign_keys = ON')
    await runMigrations(adapter)
  }
  return _db
}

const adapter: Database & {
  transaction<T>(work: (db: Database) => Promise<T>): Promise<T>
} = {
  async execute(sql: string, params: unknown[] = []) {
    const db = await openDb()
    if (params.length > 0) {
      await db.runAsync(sql, params as SQLite.SQLiteBindParams)
    } else {
      await db.execAsync(sql)
    }
  },
  async query<T>(sql: string, params: unknown[] = []) {
    const db = await openDb()
    return db.getAllAsync<T>(sql, params as SQLite.SQLiteBindParams)
  },
  async queryOne<T>(sql: string, params: unknown[] = []) {
    const db = await openDb()
    return db.getFirstAsync<T>(sql, params as SQLite.SQLiteBindParams) ?? null
  },
  async transaction<T>(work: (db: Database) => Promise<T>): Promise<T> {
    const db = await openDb()
    let result: T
    await db.withTransactionAsync(async () => {
      result = await work(adapter)
    })
    return result!
  },
}

export async function getDb(): Promise<typeof adapter> {
  await openDb()
  return adapter
}
