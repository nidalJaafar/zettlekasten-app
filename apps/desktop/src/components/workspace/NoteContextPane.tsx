import type { Database, Note } from '@zettelkasten/core'
import SourcePicker from '../SourcePicker'
import LinkPicker from '../LinkPicker'
import { ACCENT, BG, BORDER, FONT, TEXT, typeColor } from '../../theme'

interface Props {
  db: Database
  note: Note | null
  draftType: 'literature' | 'permanent' | null
  sourceId: string | null
  ownWords: boolean
  linkedIds: string[]
  error: string | null
  onSourceIdChange: (sourceId: string | null) => void
  onOwnWordsChange: (ownWords: boolean) => void
  onToggleLink: (noteId: string) => void
  onPromoteToLiterature: () => void
  onSaveAsPermanent: () => void
  onDeleteNote?: () => void
}

export default function NoteContextPane({
  db,
  note,
  draftType,
  sourceId,
  ownWords,
  linkedIds,
  error,
  onSourceIdChange,
  onOwnWordsChange,
  onToggleLink,
  onPromoteToLiterature,
  onSaveAsPermanent,
  onDeleteNote,
}: Props) {
  const currentType = note?.type ?? draftType
  const isLiteratureFlow = currentType === 'literature'
  const isPermanent = currentType === 'permanent'
  const isFleeting = currentType === 'fleeting'
  const actionLabel = isPermanent
    ? 'Update Links'
    : isLiteratureFlow
      ? 'Save As Permanent'
      : 'Promote To Literature'
  const actionDisabled = (!isPermanent && !isLiteratureFlow && !sourceId) || !currentType

  return (
    <aside
      style={{
        borderLeft: `1px solid ${BORDER.faint}`,
        padding: 24,
        overflowY: 'auto',
        minHeight: 0,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <div style={sectionLabelStyle}>Note Type</div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              border: `1px solid ${BORDER.faint}`,
              borderRadius: 999,
              padding: '7px 11px',
              fontSize: 11,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: currentType ? typeColor(currentType) : TEXT.faint,
              background: BG.raised,
              fontFamily: FONT.ui,
            }}
          >
            {currentType ?? 'draft'}
          </div>
        </div>

        {(isFleeting || isLiteratureFlow) && (
          <div>
            <div style={sectionLabelStyle}>Source</div>
            <SourcePicker db={db} selectedId={sourceId} onSelect={(value) => onSourceIdChange(value)} />
          </div>
        )}

        {isLiteratureFlow && (
          <>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={ownWords}
                onChange={(event) => onOwnWordsChange(event.target.checked)}
                style={{ width: 14, height: 14, accentColor: ACCENT.success }}
              />
              <span style={{ fontSize: 12, color: TEXT.secondary, fontFamily: FONT.ui }}>
                Written in my own words
              </span>
            </label>
            <div>
              <div style={sectionLabelStyle}>Link To Permanent Notes</div>
              <LinkPicker db={db} selectedIds={linkedIds} onToggle={onToggleLink} />
            </div>
          </>
        )}

        {isPermanent && (
          <div>
            <div style={sectionLabelStyle}>Linked Permanent Notes</div>
            <LinkPicker db={db} selectedIds={linkedIds} onToggle={onToggleLink} />
          </div>
        )}

        {error && (
          <div
            style={{
              padding: '9px 12px',
              background: 'rgba(176,108,104,0.10)',
              border: '1px solid rgba(176,108,104,0.25)',
              borderRadius: 5,
              fontSize: 12,
              color: ACCENT.danger,
              letterSpacing: '0.01em',
              fontFamily: FONT.ui,
            }}
          >
            {error}
          </div>
        )}

        <button
          onClick={isPermanent || isLiteratureFlow ? onSaveAsPermanent : onPromoteToLiterature}
          disabled={actionDisabled}
          style={{
            width: '100%',
            padding: '13px 16px',
            border: `1px solid ${actionDisabled ? BORDER.faint : ACCENT.ink}`,
            borderRadius: 12,
            fontSize: 11,
            fontWeight: 500,
            cursor: actionDisabled ? 'not-allowed' : 'pointer',
            background: actionDisabled ? BG.raised : ACCENT.inkSoft,
            color: actionDisabled ? TEXT.faint : TEXT.primary,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            fontFamily: FONT.ui,
          }}
        >
          {actionLabel}
        </button>

        {onDeleteNote && (
          <button
            onClick={onDeleteNote}
            style={{
              width: '100%',
              padding: '13px 16px',
              border: `1px solid ${ACCENT.danger}`,
              borderRadius: 12,
              fontSize: 11,
              fontWeight: 500,
              cursor: 'pointer',
              background: BG.raised,
              color: ACCENT.danger,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              fontFamily: FONT.ui,
            }}
          >
            Delete Note
          </button>
        )}
      </div>
    </aside>
  )
}

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 500,
  color: TEXT.faint,
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
  marginBottom: 10,
  fontFamily: FONT.ui,
}
