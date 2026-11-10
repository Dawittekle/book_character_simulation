export const READER_THEMES = {
  parchment: {
    id: 'parchment',
    name: 'Warm Paper',
    description: 'Gentle on the eyes, warm amber undertones with zero blue-light strain.',
    bg: '#FAF7F0',
    cardBg: '#F3EFE6',
    text: '#2A2521',
    textMuted: '#70675D',
    accent: '#D97706',
    border: '#E8E1D3',
    navBg: 'rgba(250, 247, 240, 0.92)',
    highlightBg: 'rgba(245, 158, 11, 0.22)',
    sentenceGlow: 'rgba(217, 119, 6, 0.16)',
  },
  light: {
    id: 'light',
    name: 'Pure White',
    description: 'Crisp daylight contrast, modern editorial clarity.',
    bg: '#FFFFFF',
    cardBg: '#F8F9FA',
    text: '#18181B',
    textMuted: '#71717A',
    accent: '#D97706',
    border: '#E4E4E7',
    navBg: 'rgba(255, 255, 255, 0.92)',
    highlightBg: 'rgba(251, 191, 36, 0.25)',
    sentenceGlow: 'rgba(251, 191, 36, 0.2)',
  },
  sepia: {
    id: 'sepia',
    name: 'Quiet Sepia',
    description: 'Classic antique book hue, reminiscent of old library editions.',
    bg: '#F4EBD9',
    cardBg: '#ECE1CB',
    text: '#3D332A',
    textMuted: '#6B5E51',
    accent: '#B45309',
    border: '#E2D5BC',
    navBg: 'rgba(244, 235, 217, 0.92)',
    highlightBg: 'rgba(180, 83, 9, 0.22)',
    sentenceGlow: 'rgba(180, 83, 9, 0.16)',
  },
  slate: {
    id: 'slate',
    name: 'Dark Slate',
    description: 'Low-contrast graphite, calm for late evening reading.',
    bg: '#1E2022',
    cardBg: '#272A2D',
    text: '#E2E8F0',
    textMuted: '#94A3B8',
    accent: '#F59E0B',
    border: '#33373B',
    navBg: 'rgba(30, 32, 34, 0.92)',
    highlightBg: 'rgba(245, 158, 11, 0.28)',
    sentenceGlow: 'rgba(245, 158, 11, 0.22)',
  },
  obsidian: {
    id: 'obsidian',
    name: 'Obsidian OLED',
    description: 'Pure pitch black for minimal light emission and maximum battery savings.',
    bg: '#0A0A0C',
    cardBg: '#141418',
    text: '#E4E4E7',
    textMuted: '#A1A1AA',
    accent: '#F59E0B',
    border: '#222329',
    navBg: 'rgba(10, 10, 12, 0.94)',
    highlightBg: 'rgba(245, 158, 11, 0.3)',
    sentenceGlow: 'rgba(245, 158, 11, 0.25)',
  },
};

export const FONT_FAMILIES = {
  serif: {
    id: 'serif',
    name: 'Literature Serif',
    cssFamily: '"Merriweather", "Georgia", "Cambria", serif',
  },
  sans: {
    id: 'sans',
    name: 'Modern Sans',
    cssFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  classic: {
    id: 'classic',
    name: 'Editorial Classic',
    cssFamily: '"Charter", "Palatino", "Times New Roman", serif',
  },
};

export const DEFAULT_READER_SETTINGS = {
  theme: 'parchment',
  fontFamily: 'serif',
  fontSize: 18,
  lineHeight: 1.75,
  columnWidth: 'standard', // 'compact' (620px), 'standard' (720px), 'wide' (860px)
};

export function getColumnWidthValue(columnWidth) {
  switch (columnWidth) {
    case 'compact':
      return '640px';
    case 'wide':
      return '860px';
    case 'standard':
    default:
      return '720px';
  }
}
