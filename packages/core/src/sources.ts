import type { Database, Source, SourceType } from './types'

export interface CreateSourceInput {
  type: SourceType
  label: string
  description?: string
}

export async function createSource(db: Database, input: CreateSourceInput): Promise<Source> {
  const source: Source = {
    id: globalThis.crypto.randomUUID(),
    type: input.type,
    label: input.label.trim(),
    description: input.description?.trim() ?? null,
    created_at: Date.now(),
  }
  await db.execute(
    `INSERT INTO sources (id, type, label, description, created_at) VALUES (?, ?, ?, ?, ?)`,
    [source.id, source.type, source.label, source.description, source.created_at]
  )
  return source
}

export async function getSourceById(db: Database, id: string): Promise<Source | null> {
  return db.queryOne<Source>(`SELECT * FROM sources WHERE id = ?`, [id])
}

export async function getAllSources(db: Database): Promise<Source[]> {
  return db.query<Source>(`SELECT * FROM sources ORDER BY label ASC`)
}

export async function updateSource(
  db: Database,
  id: string,
  updates: Partial<Pick<Source, 'label' | 'description'>>
): Promise<void> {
  const entries = Object.entries(updates).filter(([, v]) => v !== undefined)
  if (entries.length === 0) return
  const fields = entries.map(([k]) => `${k} = ?`).join(', ')
  const values = [...entries.map(([, v]) => v), id]
  await db.execute(`UPDATE sources SET ${fields} WHERE id = ?`, values)
}

export async function countNotesBySource(db: Database, sourceId: string): Promise<number> {
  const row = await db.queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM notes WHERE source_id = ? AND deleted_at IS NULL`,
    [sourceId]
  )
  return row?.count ?? 0
}

export async function deleteSource(db: Database, id: string): Promise<void> {
  const count = await countNotesBySource(db, id)
  if (count > 0) {
    throw new Error(`Cannot delete source: ${count} note(s) still in use.`)
  }
  await db.execute(`DELETE FROM sources WHERE id = ?`, [id])
}
