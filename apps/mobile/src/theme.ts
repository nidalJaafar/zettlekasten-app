import { StyleSheet } from 'react-native'

export const BG = {
  base: '#111318',
  panel: '#171a20',
  raised: '#1d2128',
  canvas: '#0d0f13',
  hover: '#222730',
} as const

export const BORDER = {
  faint: '#232831',
  base: '#2b313c',
  strong: '#3a4350',
} as const

export const TEXT = {
  primary: '#e7e0d1',
  secondary: '#b4ab99',
  muted: '#7f7a70',
  faint: '#5e5b55',
} as const

export const ACCENT = {
  ink: '#8f98a8',
  inkSoft: 'rgba(143,152,168,0.14)',
  fleeting: '#9a7a5a',
  literature: '#6d8394',
  permanent: '#8d879f',
  success: '#6d8e7a',
  danger: '#b06c68',
} as const

export const FONT = {
  display: 'System',
  ui: 'System',
  mono: 'Menlo',
} as const

export function typeColor(type: string): string {
  if (type === 'fleeting') return ACCENT.fleeting
  if (type === 'literature') return ACCENT.literature
  return ACCENT.permanent
}

export const glassStyle = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(23, 26, 32, 0.85)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER.base,
    overflow: 'hidden',
  },
  header: {
    backgroundColor: 'rgba(23, 26, 32, 0.9)',
    borderBottomWidth: 1,
    borderBottomColor: BORDER.faint,
  },
  pill: {
    backgroundColor: 'rgba(29, 33, 40, 0.9)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: BORDER.base,
  },
  tabBar: {
    backgroundColor: 'rgba(17, 19, 24, 0.9)',
    borderTopWidth: 1,
    borderTopColor: BORDER.faint,
  },
})
