import { create } from 'zustand'
import type { Database, Note } from '@zettelkasten/core'
import { getDb } from './db'

interface AppState {
  db: Database | null
  activeNote: Note | null
  initialized: boolean
  initDb: () => Promise<void>
  setActiveNote: (note: Note | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  db: null,
  activeNote: null,
  initialized: false,
  initDb: async () => {
    const db = await getDb()
    set({ db, initialized: true })
  },
  setActiveNote: (note) => set({ activeNote: note }),
}))
