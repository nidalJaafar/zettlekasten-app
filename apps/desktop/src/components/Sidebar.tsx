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
    <nav style={{
      width: 152,
      background: BG.surface,
      borderRight: `1px solid ${BORDER.dim}`,
      display: 'flex',
      flexDirection: 'column',
      padding: '20px 0 16px',
      flexShrink: 0,
      userSelect: 'none',
    }}>
      {/* App monogram */}
      <div style={{
        padding: '0 20px 18px',
        fontFamily: FONT.serif,
        fontSize: 28,
        fontWeight: 700,
        color: ACCENT.gold,
        letterSpacing: '-0.01em',
        lineHeight: 1,
      }}>
        Z
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: BORDER.dim, marginBottom: 8 }} />

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
              gap: 0,
              padding: '9px 18px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              width: '100%',
              textAlign: 'left',
              position: 'relative',
              color: active ? ACCENT.gold : TEXT.dim,
              fontSize: 13,
              fontWeight: active ? 500 : 400,
              letterSpacing: '0.01em',
            }}
          >
            {/* Active left bar */}
            {active && (
              <div style={{
                position: 'absolute',
                left: 0,
                top: 6,
                bottom: 6,
                width: 2,
                background: ACCENT.gold,
                borderRadius: '0 1px 1px 0',
              }} />
            )}
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.id === 'inbox' && inboxCount > 0 && (
              <span style={{
                background: 'rgba(201,125,42,0.18)',
                color: ACCENT.amber,
                fontSize: 10,
                fontWeight: 600,
                padding: '1px 6px',
                borderRadius: 10,
                lineHeight: 1.8,
              }}>
                {inboxCount}
              </span>
            )}
          </button>
        )
      })}

      {/* Wordmark footer */}
      <div style={{
        marginTop: 'auto',
        padding: '0 18px',
        fontSize: 9,
        color: TEXT.muted,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
      }}>
        Zettelkasten
      </div>
    </nav>
  )
}
