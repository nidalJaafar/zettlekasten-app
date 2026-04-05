import { DatabaseSync } from 'node:sqlite'
import { runMigrations } from '../../src/schema'
import type { Database } from '../../src/types'

export function createTestDb(): Database {
  const sqlite = new DatabaseSync(':memory:')
  return {
    async execute(sql: string, params: unknown[] = []) {
      sqlite.prepare(sql).run(...(params as any[]))
    },
    async query<T>(sql: string, params: unknown[] = []) {
      return sqlite.prepare(sql).all(...(params as any[])) as T[]
    },
    async queryOne<T>(sql: string, params: unknown[] = []) {
      return (sqlite.prepare(sql).get(...(params as any[])) as T) ?? null
    },
  }
}

export async function createMigratedDb(): Promise<Database> {
  const db = createTestDb()
  await runMigrations(db)
  return db
}
