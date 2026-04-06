import type { Database } from './types'

export const SQL_CREATE_SOURCES = `
  CREATE TABLE IF NOT EXISTS sources (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK(type IN ('book','article','video','podcast','conversation','other')),
    label TEXT NOT NULL,
    description TEXT,
    created_at INTEGER NOT NULL
  )
`

export const SQL_CREATE_NOTES = `
  CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK(type IN ('fleeting','literature','permanent')),
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    source_id TEXT REFERENCES sources(id),
    own_words_confirmed INTEGER NOT NULL DEFAULT 0,
    deleted_at INTEGER,
    processed_at INTEGER
  )
`

export const SQL_CREATE_NOTE_LINKS = `
  CREATE TABLE IF NOT EXISTS note_links (
    from_note_id TEXT NOT NULL REFERENCES notes(id),
    to_note_id TEXT NOT NULL REFERENCES notes(id),
    created_at INTEGER NOT NULL,
    PRIMARY KEY (from_note_id, to_note_id)
  )
`

export async function runMigrations(db: Database): Promise<void> {
  await db.execute(SQL_CREATE_SOURCES)
  await db.execute(SQL_CREATE_NOTES)
  await db.execute(SQL_CREATE_NOTE_LINKS)
  // Safe migration: add processed_at to existing tables that predate this column.
  // ALTER TABLE fails with "duplicate column name" if the column already exists — catch and ignore.
  try {
    await db.execute(`ALTER TABLE notes ADD COLUMN processed_at INTEGER`)
  } catch (err: unknown) {
    if (!String(err).includes('duplicate column name')) throw err
  }
}
