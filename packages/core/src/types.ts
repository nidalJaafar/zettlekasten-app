export type NoteType = 'fleeting' | 'literature' | 'permanent'

export type SourceType =
  | 'book'
  | 'article'
  | 'video'
  | 'podcast'
  | 'conversation'
  | 'other'

export interface Note {
  id: string
  type: NoteType
  title: string
  content: string
  created_at: number
  updated_at: number
  source_id: string | null
  own_words_confirmed: 0 | 1
  deleted_at: number | null
}

export interface Source {
  id: string
  type: SourceType
  label: string
  description: string | null
  created_at: number
}

export interface NoteLink {
  from_note_id: string
  to_note_id: string
  created_at: number
}

export interface PromotionContext {
  linkedPermanentNoteIds: string[]
  totalPermanentNotes: number
}

export type Result =
  | { ok: true }
  | { ok: false; reason: string }

export interface Database {
  execute(sql: string, params?: unknown[]): Promise<void>
  query<T>(sql: string, params?: unknown[]): Promise<T[]>
  queryOne<T>(sql: string, params?: unknown[]): Promise<T | null>
}
