import Database from '@tauri-apps/plugin-sql'
import type { Database as CoreDatabase } from '@zettelkasten/core'

let _db: Database | null = null
let _dbPromise: Promise<Database> | null = null
let _transactionQueue: Promise<void> = Promise.resolve()

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

  const adapter: CoreDatabase & {
    transaction<T>(work: (db: CoreDatabase) => Promise<T>): Promise<T>
  } = {
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
    async transaction<T>(work: (db: CoreDatabase) => Promise<T>) {
      const previousTransaction = _transactionQueue
      let releaseTransaction!: () => void
      _transactionQueue = new Promise<void>((resolve) => {
        releaseTransaction = resolve
      })

      await previousTransaction

      let beganTransaction = false
      try {
        await _db!.execute('BEGIN IMMEDIATE')
        beganTransaction = true
        const result = await work(adapter)
        await _db!.execute('COMMIT')
        return result
      } catch (error) {
        if (beganTransaction) {
          await _db!.execute('ROLLBACK')
        }
        throw error
      } finally {
        releaseTransaction()
      }
    },
  }

  return adapter
}
