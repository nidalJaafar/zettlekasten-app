import initSqlJs from 'sql.js'
import { runMigrations } from '../../src/schema'
import type { Database } from '../../src/types'

function rowsToObjects<T>(result: ReturnType<Awaited<ReturnType<typeof initSqlJs>>['Database']['prototype']['exec']>): T[] {
  if (result.length === 0) return []
  const { columns, values } = result[0]
  return values.map((row) => {
    const obj: Record<string, unknown> = {}
    columns.forEach((col, i) => { obj[col] = row[i] })
    return obj as T
  })
}

export async function createTestDb(): Promise<Database> {
  const SQL = await initSqlJs()
  const sqlite = new SQL.Database()

  return {
    async execute(sql: string, params: unknown[] = []) {
      const stmt = sqlite.prepare(sql)
      stmt.run(params)
      stmt.free()
    },
    async query<T>(sql: string, params: unknown[] = []) {
      const result = sqlite.exec(sql, params)
      return rowsToObjects<T>(result)
    },
    async queryOne<T>(sql: string, params: unknown[] = []) {
      const result = sqlite.exec(sql, params)
      const rows = rowsToObjects<T>(result)
      return rows[0] ?? null
    },
  }
}

export async function createMigratedDb(): Promise<Database> {
  const db = await createTestDb()
  await runMigrations(db)
  return db
}
