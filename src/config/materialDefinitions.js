// Material property definitions per color key
export const MATERIALS = {
  black:       { color: '#2c3240', roughness: 0.88, metalness: 0.04 },
  black_bare:  { color: '#111111', roughness: 0.4,  metalness: 0.6  },
  red:         { color: '#7a0000', roughness: 0.55, metalness: 0.1  },
  gold:        { color: '#c9920a', roughness: 0.25, metalness: 0.85 },
  green:       { color: '#1b4332', roughness: 0.55, metalness: 0.1  },
  silver:      { color: '#c8c8c8', roughness: 0.2,  metalness: 0.9  },
  blue:        { color: '#1b3564', roughness: 0.55, metalness: 0.1  },
  purple:      { color: '#4a0e78', roughness: 0.55, metalness: 0.1  },
  light_blue:  { color: '#4a8ab5', roughness: 0.45, metalness: 0.1  },
  dark_blue:   { color: '#0d1b40', roughness: 0.55, metalness: 0.1  },
  light_green: { color: '#4caf50', roughness: 0.45, metalness: 0.1  },
  dark_green:  { color: '#14401f', roughness: 0.55, metalness: 0.1  },
  wood:        { color: '#8b6333', roughness: 0.85, metalness: 0.0, isWood: true },
}

// Fixed chassis/hardware materials
export const FIXED_MATERIALS = {
  chassis:       { color: '#8a8a8a', roughness: 0.35, metalness: 0.85 },
  rack_ear:      { color: '#6e6e6e', roughness: 0.4,  metalness: 0.8  },
  screw:         { color: '#aaaaaa', roughness: 0.3,  metalness: 0.9  },
  branding_gold: { color: '#c9920a', roughness: 0.2,  metalness: 0.9, emissive: '#5a3f00', emissiveIntensity: 0.3 },
  pointer:       { color: '#c9920a', roughness: 0.25, metalness: 0.85 },
}

// Mesh group definitions — stable keys for material mapping layer
const rowKeys = (letter) =>
  Array.from({ length: 10 }, (_, i) => `knob_row_${letter}_${String(i + 1).padStart(2, '0')}`)

const largeKeys = Array.from({ length: 5 }, (_, i) => `knob_large_${String(i + 1).padStart(2, '0')}`)

export const MESH_GROUPS = {
  front_panel:  ['front_panel'],
  rear_panel:   ['rear_panel'],
  all_panels:   ['front_panel', 'rear_panel'],
  row_A:        rowKeys('A'),
  row_B:        rowKeys('B'),
  row_C:        rowKeys('C'),
  row_D:        rowKeys('D'),
  row_E:        rowKeys('E'),
  large_knobs:  largeKeys,
  all_knobs:    [...rowKeys('A'), ...rowKeys('B'), ...rowKeys('C'), ...rowKeys('D'), ...rowKeys('E'), ...largeKeys],
}
