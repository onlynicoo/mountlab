// All selectable color options for panels and knobs
export const PANEL_COLOR_OPTIONS = [
  { key: 'black',      label: 'Black',          swatch: '#1a1a1a' },
  { key: 'black_bare', label: 'Black Bare',      swatch: '#111111' },
  { key: 'dark_blue',  label: 'Dark Blue',      swatch: '#0d1b40' },
  { key: 'red',        label: 'Red',             swatch: '#7a0000' },
  { key: 'gold',       label: 'Gold',            swatch: '#c9920a' },
  { key: 'green',      label: 'Green',           swatch: '#1b4332' },
  { key: 'silver',     label: 'Silver',          swatch: '#c8c8c8' },
  { key: 'blue',       label: 'Blue',            swatch: '#1b3564' },
  { key: 'purple',     label: 'Purple',          swatch: '#4a0e78' },
  { key: 'wood',       label: 'Wood',            swatch: '#8b6333' },
]

export const KNOB_COLOR_OPTIONS = [
  { key: 'black',       label: 'Black',          swatch: '#1a1a1a' },
  { key: 'light_blue',  label: 'Light Blue',     swatch: '#4a8ab5' },
  { key: 'dark_blue',   label: 'Dark Blue',      swatch: '#0d1b40' },
  { key: 'light_green', label: 'Light Green',    swatch: '#4caf50' },
  { key: 'dark_green',  label: 'Dark Green',     swatch: '#14401f' },
  { key: 'gold',        label: 'Gold',           swatch: '#c9920a' },
  { key: 'red',         label: 'Red',            swatch: '#7a0000' },
  { key: 'purple',      label: 'Purple',         swatch: '#4a0e78' },
  { key: 'wood',        label: 'Wood',           swatch: '#8b6333' },
  { key: 'multi',       label: 'Multi-colour',   swatch: null },  // special
]

// Default multi-colour palette — one color per row
export const MULTI_COLOR_DEFAULTS = {
  A:     'black',
  B:     'black',
  C:     'black',
  D:     'black',
  E:     'black',
  large: 'black',
}
