import { PRESET_THEMES, type Theme } from '../core/theme'

// The look of the page the demo is made for. Demo-only: they're offered there
// as downloads to import, not as presets in the extension.
export const INSTRUMENT_DARK: Theme = {
  id: 'instrument-dark',
  name: 'Instrument Dark',
  scheme: 'dark',
  radius: 16,
  colors: {
    panel: '#0B0B0A',
    selected: '#1D1D1B',
    border: '#242422',
    text: '#E9E8E3',
    muted: '#8F8E88',
    accent: '#FF6B35',
  },
}

export const INSTRUMENT_LIGHT: Theme = {
  id: 'instrument-light',
  name: 'Instrument Light',
  scheme: 'light',
  radius: 16,
  colors: {
    panel: '#F7F7F5',
    selected: '#E5E5E0',
    border: '#DCDCD6',
    text: '#121212',
    muted: '#5F5F5B',
    accent: '#E8480C',
  },
}

export const INSTRUMENT_THEMES: readonly Theme[] = [INSTRUMENT_DARK, INSTRUMENT_LIGHT]

/** What the tour offers: the page's own two first, then the extension's defaults. */
export const TOUR_THEMES: readonly Theme[] = [
  ...INSTRUMENT_THEMES,
  ...PRESET_THEMES.filter((t) => t.id === 'helium-dark' || t.id === 'helium-light'),
]
