// Design tokens — Zettelkasten visual overhaul

export const BG = {
  base: '#0b0b10',
  surface: '#10101a',
  card: '#15151f',
  hover: '#1c1c28',
} as const

export const BORDER = {
  dim: '#1c1c28',
  base: '#252534',
  hi: '#363652',
} as const

export const TEXT = {
  primary: '#ddd8c6',
  dim: '#888070',
  muted: '#45423e',
} as const

export const ACCENT = {
  gold: '#c09a38',
  goldDim: 'rgba(192,154,56,0.10)',
  amber: '#c97d2a',    // fleeting notes
  blue: '#4e7ea6',     // literature notes
  violet: '#7060a8',   // permanent notes
  green: '#3d8f62',    // success / confirm
  red: '#b85555',      // error
} as const

export const FONT = {
  serif: "'Cormorant Garamond', Georgia, 'Times New Roman', serif",
  mono: "'DM Mono', 'Menlo', 'Monaco', monospace",
} as const

export function typeColor(type: string): string {
  if (type === 'fleeting') return ACCENT.amber
  if (type === 'literature') return ACCENT.blue
  return ACCENT.violet
}
