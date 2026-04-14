export interface ResizablePaneConfig {
  storageKey: string
  defaultWidth: number
  minWidth: number
  maxWidth: number
}

export const APP_SIDEBAR_PANE: ResizablePaneConfig = {
  storageKey: 'layout.sidebar.width',
  defaultWidth: 168,
  minWidth: 144,
  maxWidth: 320,
}

export const WORKSPACE_RAIL_PANE: ResizablePaneConfig = {
  storageKey: 'layout.workspace.rail.width',
  defaultWidth: 240,
  minWidth: 180,
  maxWidth: 360,
}

export const WORKSPACE_CONTEXT_PANE: ResizablePaneConfig = {
  storageKey: 'layout.workspace.context.width',
  defaultWidth: 280,
  minWidth: 220,
  maxWidth: 420,
}

export function clampPaneWidth(width: number, minWidth: number, maxWidth: number): number {
  return Math.min(Math.max(width, minWidth), maxWidth)
}

export function readPaneWidth(config: ResizablePaneConfig): number {
  if (typeof window === 'undefined') {
    return config.defaultWidth
  }

  try {
    const storedValue = window.localStorage.getItem(config.storageKey)
    if (storedValue === null) {
      return config.defaultWidth
    }

    const parsed = Number(storedValue)
    if (!Number.isFinite(parsed)) {
      return config.defaultWidth
    }

    return clampPaneWidth(parsed, config.minWidth, config.maxWidth)
  } catch {
    return config.defaultWidth
  }
}
