import type { Screen } from '../App'

interface Props {
  current: Screen
  onNavigate: (screen: Screen) => void
  inboxCount: number
}

const items: { id: Screen; label: string; icon: string }[] = [
  { id: 'inbox', label: 'Inbox', icon: '📥' },
  { id: 'review', label: 'Review', icon: '🔄' },
  { id: 'graph', label: 'Graph', icon: '🕸️' },
]

export default function Sidebar({ current, onNavigate, inboxCount }: Props) {
  return (
    <nav style={{
      width: 160,
      background: '#13132a',
      borderRight: '1px solid #2a2a4a',
      display: 'flex',
      flexDirection: 'column',
      padding: '16px 8px',
      gap: 4,
      flexShrink: 0,
    }}>
      <div style={{ padding: '0 8px 16px', fontSize: 14, fontWeight: 700, color: '#e0e0ff' }}>
        Zettelkasten
      </div>
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onNavigate(item.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 10px',
            borderRadius: 6,
            border: 'none',
            cursor: 'pointer',
            background: current === item.id ? '#6c63ff' : 'transparent',
            color: current === item.id ? 'white' : '#7f8fa6',
            fontSize: 13,
            fontWeight: current === item.id ? 600 : 400,
            width: '100%',
            textAlign: 'left',
          }}
        >
          <span>{item.icon}</span>
          <span style={{ flex: 1 }}>{item.label}</span>
          {item.id === 'inbox' && inboxCount > 0 && (
            <span style={{
              background: '#ff6b81',
              color: 'white',
              fontSize: 10,
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: 8,
            }}>
              {inboxCount}
            </span>
          )}
        </button>
      ))}
    </nav>
  )
}
