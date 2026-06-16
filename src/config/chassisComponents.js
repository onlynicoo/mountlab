export const MATERIAL_PRESETS = [
  {
    id: 'aluminum',
    label: 'Aluminum',
    color: '#8a9db5',
    metalness: 0.8,
    roughness: 0.3,
  },
  {
    id: 'black_anodized',
    label: 'Black anodized',
    color: '#1a1a1a',
    metalness: 0.4,
    roughness: 0.5,
  },
  {
    id: 'raw_steel',
    label: 'Raw steel',
    color: '#6b7280',
    metalness: 0.75,
    roughness: 0.38,
  },
]

const ALUMINUM = MATERIAL_PRESETS[0]
const BLACK_ANODIZED = MATERIAL_PRESETS[1]
const RAW_STEEL = MATERIAL_PRESETS[2]

export const CHASSIS_MATERIAL_BY_KIND = {
  body: ALUMINUM,
  rackmount: ALUMINUM,
  front_panel: BLACK_ANODIZED,
  back_panel: BLACK_ANODIZED,
  chassis: ALUMINUM,
  steel: RAW_STEEL,
}

export const CHASSIS_PART_DEFINITIONS = [
  {
    id: 'body',
    label: 'Chassis Body',
    fileName: 'body.stl',
    aliases: ['shell.stl'],
    materialPreset: ALUMINUM,
    visible: true,
    locked: true,
    opacity: 0.8,
  },
  {
    id: 'front_panel',
    label: 'Front Panel',
    fileName: 'front_panel.stl',
    aliases: ['front-panel.stl'],
    materialPreset: BLACK_ANODIZED,
    visible: true,
    locked: true,
    opacity: 1,
  },
  {
    id: 'back_panel',
    label: 'Back Panel',
    fileName: 'back_panel.stl',
    aliases: ['rear_panel.stl', 'rear-panel.stl', 'back-panel.stl'],
    materialPreset: BLACK_ANODIZED,
    visible: true,
    locked: true,
    opacity: 1,
  },
  {
    id: 'rackmount',
    label: 'Rackmount',
    fileName: 'rackmount.stl',
    aliases: ['rack_mount.stl', 'rack-mount.stl', 'rack_ears.stl'],
    materialPreset: ALUMINUM,
    visible: true,
    locked: true,
    opacity: 1,
  },
]

export const CHASSIS_COMPONENTS = CHASSIS_PART_DEFINITIONS.map((definition) => ({
  id: definition.id,
  label: definition.label,
  path: `/models/chassis/${definition.fileName}`,
  material: materialFromPreset(definition.materialPreset),
  visible: definition.visible,
  locked: definition.locked,
  opacity: definition.opacity,
  position: [0, 0, 0],
  rotation: [0, 0, 0],
}))

export function createDefaultChassisComponents() {
  return CHASSIS_COMPONENTS.map((component) => ({
    ...component,
    material: { ...component.material },
  }))
}

export function findMaterialPresetByColor(color) {
  return MATERIAL_PRESETS.find((preset) => (
    preset.color.toLowerCase() === color?.toLowerCase()
  ))
}

export function materialFromPreset(preset) {
  return {
    color: preset.color,
    metalness: preset.metalness,
    roughness: preset.roughness,
  }
}

export function findChassisPartDefinition(fileName) {
  const normalizedFileName = fileName.toLowerCase()

  return CHASSIS_PART_DEFINITIONS.find((definition) => (
    definition.fileName === normalizedFileName
    || definition.aliases.includes(normalizedFileName)
  ))
}
