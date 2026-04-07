import type { Screen } from '../App'
import { BG, TEXT, ACCENT, FONT, BORDER } from '../theme'

interface Props {
  current: Screen
  onNavigate: (screen: Screen) => void
  inboxCount: number
}

const items: { id: Screen; label: string }[] = [
  { id: 'inbox', label: 'Inbox' },
  { id: 'review', label: 'Review' },
  { id: 'library', label: 'Library' },
  { id: 'graph', label: 'Graph' },
]

export default function Sidebar({ current, onNavigate, inboxCount }: Props) {
  return (
    <nav
      style={{
        width: 168,
        background: BG.panel,
        borderRight: `1px solid ${BORDER.faint}`,
        display: 'flex',
        flexDirection: 'column',
        padding: '26px 0 18px',
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {/* App monogram */}
      <div
        style={{
          padding: '0 22px 18px',
          fontFamily: FONT.display,
          fontSize: 23,
          fontWeight: 500,
          color: TEXT.primary,
          letterSpacing: '-0.01em',
          lineHeight: 1,
        }}
      >
        Z
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: BORDER.faint, margin: '0 18px 10px' }} />

      {items.map((item) => {
        const active = current === item.id
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`nav-item${active ? ' active' : ''}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 20px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              width: '100%',
              textAlign: 'left',
              position: 'relative',
              color: active ? TEXT.primary : TEXT.muted,
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: '0.02em',
            }}
          >
            {active && (
              <div
                style={{
                  position: 'absolute',
                  left: 14,
                  top: '50%',
                  width: 4,
                  height: 4,
                  marginTop: -2,
                  borderRadius: '50%',
                  background: ACCENT.ink,
                }}
              />
            )}
            <span style={{ flex: 1, paddingLeft: active ? 10 : 0 }}>{item.label}</span>
            {item.id === 'inbox' && inboxCount > 0 && (
              <span
                style={{
                  color: TEXT.secondary,
                  fontSize: 10,
                  padding: '0 0 0 8px',
                  lineHeight: 1.4,
                }}
              >
                {inboxCount}
              </span>
            )}
          </button>
        )
      })}

      {/* Wordmark footer */}
      <div
        style={{
          marginTop: 'auto',
          padding: '0 20px',
          fontSize: 9,
          color: TEXT.faint,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
        }}
      >
        Zettelkasten
      </div>
    </nav>
  )
}
