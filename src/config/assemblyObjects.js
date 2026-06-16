export const ASSEMBLY_OBJECT_CLASSES = [
  {
    id: 'hole',
    label: 'Hole',
    material: { color: '#111111', metalness: 0.2, roughness: 0.6 },
    params: { diameter: 10, depth: 3 },
  },
  {
    id: 'knob',
    label: 'Knob',
    material: { color: '#c9920a', metalness: 0.45, roughness: 0.35 },
    params: { diameter: 18, depth: 12 },
  },
  {
    id: 'generic',
    label: 'Generic',
    material: { color: '#4a90d9', metalness: 0.2, roughness: 0.5 },
    params: { width: 14, height: 14, depth: 6 },
  },
]

export const DEFAULT_OBJECT_HOST_ID = 'front_panel'

export const HOST_PLACEMENT_PRESETS = {
  front_panel: {
    position: [0, 0, 1.5],
    rotation: [0, 0, 0],
    normal: [0, 0, 1],
  },
  back_panel: {
    position: [0, 0, -1.5],
    rotation: [0, Math.PI, 0],
    normal: [0, 0, -1],
  },
}

function dimensionNumber(dimensions, key) {
  const number = Number(dimensions?.[key])
  return Number.isFinite(number) && number > 0 ? number : null
}

export function getAssemblyObjectClass(className) {
  return ASSEMBLY_OBJECT_CLASSES.find((objectClass) => objectClass.id === className)
    || ASSEMBLY_OBJECT_CLASSES[0]
}

export function getHostPlacement(hostId, dimensions = null) {
  const preset = HOST_PLACEMENT_PRESETS[hostId] || HOST_PLACEMENT_PRESETS[DEFAULT_OBJECT_HOST_ID]
  const depth = dimensionNumber(dimensions, 'depth')

  if (!depth) return preset

  if (hostId === 'front_panel') {
    return {
      ...preset,
      position: [0, 0, depth / 2],
    }
  }

  if (hostId === 'back_panel') {
    return {
      ...preset,
      position: [0, 0, -depth / 2],
    }
  }

  return preset
}

export function createAssemblyObject(className, hostId = DEFAULT_OBJECT_HOST_ID, dimensions = null) {
  const objectClass = getAssemblyObjectClass(className)
  const placement = getHostPlacement(hostId, dimensions)
  const suffix = Math.random().toString(16).slice(2)

  return {
    id: `${objectClass.id}_${Date.now()}_${suffix}`,
    class: objectClass.id,
    label: objectClass.label,
    hostId,
    position: [...placement.position],
    rotation: [...placement.rotation],
    normal: [...placement.normal],
    visible: true,
    locked: false,
    material: { ...objectClass.material },
    transparency: 0,
    params: { ...objectClass.params },
  }
}
