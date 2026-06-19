export const RACK_UNIT_HEIGHT_MM = 44.45
export const STANDARD_RACK_WIDTH_MM = 482.6
export const HALF_RACK_WIDTH_MM = 241.3

export const RACK_PRESETS = [
  {
    id: '1u-shallow',
    label: 'Shallow 1U',
    rackUnits: 1,
    width: STANDARD_RACK_WIDTH_MM,
    depth: 150,
  },
  {
    id: '1u-deep',
    label: 'Deep 1U',
    rackUnits: 1,
    width: STANDARD_RACK_WIDTH_MM,
    depth: 250,
  },
  {
    id: '2u-standard',
    label: 'Standard 2U',
    rackUnits: 2,
    width: STANDARD_RACK_WIDTH_MM,
    depth: 200,
  },
  {
    id: '3u-utility',
    label: 'Utility 3U',
    rackUnits: 3,
    width: STANDARD_RACK_WIDTH_MM,
    depth: 250,
  },
  {
    id: '5u-mixer',
    label: 'Mixer/Crossover 5U',
    rackUnits: 5,
    width: STANDARD_RACK_WIDTH_MM,
    depth: 150,
  },
]

export const DEFAULT_RACK_PRESET_ID = '2u-standard'

export function rackHeightForUnits(rackUnits) {
  const units = Number(rackUnits)
  return Number.isFinite(units) && units > 0
    ? Number((units * RACK_UNIT_HEIGHT_MM).toFixed(2))
    : RACK_UNIT_HEIGHT_MM
}

export function dimensionsForRackPreset(preset) {
  return {
    width: Number(preset.width),
    height: rackHeightForUnits(preset.rackUnits),
    depth: Number(preset.depth),
    rack_units: Number(preset.rackUnits),
    rack_width: Number(preset.width) === HALF_RACK_WIDTH_MM ? 'half-rack' : '19in',
  }
}

export function findRackPreset(id) {
  return RACK_PRESETS.find((preset) => preset.id === id)
    || RACK_PRESETS.find((preset) => preset.id === DEFAULT_RACK_PRESET_ID)
    || RACK_PRESETS[0]
}
