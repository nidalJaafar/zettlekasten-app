import { create } from 'zustand'
import type { Database, Note } from '@zettelkasten/core'
import { getDb } from './db'
import type { ReviewDraft } from './lib/note-workflow'

export type WorkspaceOrigin = '/(tabs)' | '/(tabs)/review' | '/(tabs)/library' | '/(tabs)/graph'

interface AppState {
  db: Database | null
  activeNote: Note | null
  workspaceOrigin: WorkspaceOrigin
  initialized: boolean
  initDb: () => Promise<void>
  setActiveNote: (note: Note | null) => void
  setWorkspaceOrigin: (origin: WorkspaceOrigin) => void
  pendingSourceCallback: ((id: string | null) => void) | null
  setPendingSourceCallback: (cb: ((id: string | null) => void) | null) => void
  pendingLinkCallback: ((ids: string[]) => void) | null
  setPendingLinkCallback: (cb: ((ids: string[]) => void) | null) => void
  pendingReviewDraft: ReviewDraft | null
  setPendingReviewDraft: (draft: ReviewDraft | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  db: null,
  activeNote: null,
  workspaceOrigin: '/(tabs)',
  initialized: false,
  initDb: async () => {
    const db = await getDb()
    set({ db, initialized: true })
  },
  setActiveNote: (note) => set({ activeNote: note }),
  setWorkspaceOrigin: (origin) => set({ workspaceOrigin: origin }),
  pendingSourceCallback: null,
  setPendingSourceCallback: (cb) => set({ pendingSourceCallback: cb }),
  pendingLinkCallback: null,
  setPendingLinkCallback: (cb) => set({ pendingLinkCallback: cb }),
  pendingReviewDraft: null,
  setPendingReviewDraft: (draft) => set({ pendingReviewDraft: draft }),
}))
