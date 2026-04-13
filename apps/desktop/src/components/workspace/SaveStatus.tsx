import { ACCENT, FONT, TEXT } from '../../theme'

export type SaveState = 'saved' | 'dirty' | 'saving' | 'error'

interface Props {
  state: SaveState
}

const COPY: Record<SaveState, string> = {
  saved: 'Saved',
  dirty: 'Unsaved changes',
  saving: 'Saving...',
  error: 'Save failed',
}

const COLOR: Record<SaveState, string> = {
  saved: TEXT.muted,
  dirty: TEXT.secondary,
  saving: TEXT.secondary,
  error: ACCENT.danger,
}

export default function SaveStatus({ state }: Props) {
  return (
    <div
      style={{
        color: COLOR[state],
        fontFamily: FONT.ui,
        fontSize: 12,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}
    >
      {COPY[state]}
    </div>
  )
}
