import { create } from 'zustand'
import type { Database, Note, ReviewDraft } from '@zettelkasten/core'
import { getDb } from './db'

export type WorkspaceOrigin = '/(tabs)' | '/(tabs)/review' | '/(tabs)/library' | '/(tabs)/graph'

interface AppState {
  db: Database | null
  activeNote: Note | null
  workspaceOrigin: WorkspaceOrigin
  pendingReviewHandoff: boolean
  initialized: boolean
  initDb: () => Promise<void>
  setActiveNote: (note: Note | null) => void
  setWorkspaceOrigin: (origin: WorkspaceOrigin) => void
  setPendingReviewHandoff: (pending: boolean) => void
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
  pendingReviewHandoff: false,
  initialized: false,
  initDb: async () => {
    const db = await getDb()
    set({ db, initialized: true })
  },
  setActiveNote: (note) => set({ activeNote: note }),
  setWorkspaceOrigin: (origin) => set({ workspaceOrigin: origin }),
  setPendingReviewHandoff: (pending) => set({ pendingReviewHandoff: pending }),
  pendingSourceCallback: null,
  setPendingSourceCallback: (cb) => set({ pendingSourceCallback: cb }),
  pendingLinkCallback: null,
  setPendingLinkCallback: (cb) => set({ pendingLinkCallback: cb }),
  pendingReviewDraft: null,
  setPendingReviewDraft: (draft) => set({ pendingReviewDraft: draft }),
}))
