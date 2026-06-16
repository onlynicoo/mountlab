import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { Router } from 'express'
import { httpError } from '../lib/errors.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const positionsPath = path.resolve(__dirname, '..', 'positions.json')
const router = Router()

const DEFAULT_CHASSIS_COMPONENTS = [
  {
    id: 'body',
    label: 'Chassis Body',
    path: '/models/chassis/body.stl',
    material: { color: '#8a9db5', metalness: 0.8, roughness: 0.3 },
    visible: true,
    locked: true,
    opacity: 0.8,
  },
  {
    id: 'front_panel',
    label: 'Front Panel',
    path: '/models/chassis/front_panel.stl',
    material: { color: '#1a1a1a', metalness: 0.4, roughness: 0.5 },
    visible: true,
    locked: true,
    opacity: 1,
  },
  {
    id: 'back_panel',
    label: 'Back Panel',
    path: '/models/chassis/back_panel.stl',
    material: { color: '#1a1a1a', metalness: 0.4, roughness: 0.5 },
    visible: true,
    locked: true,
    opacity: 1,
  },
  {
    id: 'rackmount',
    label: 'Rackmount',
    path: '/models/chassis/rackmount.stl',
    material: { color: '#8a9db5', metalness: 0.8, roughness: 0.3 },
    visible: true,
    locked: true,
    opacity: 1,
  },
]

const EMPTY_POSITIONS = {
  assemblyMeta: { units: 'mm', dimensions: null },
  chassisComponents: DEFAULT_CHASSIS_COMPONENTS,
  pcbs: [],
  assemblyObjects: [],
}

const DEFAULT_OBJECT_CLASSES = {
  hole: {
    label: 'Hole',
    material: { color: '#111111', metalness: 0.2, roughness: 0.6 },
    params: { diameter: 10, depth: 3 },
  },
  knob: {
    label: 'Knob',
    material: { color: '#c9920a', metalness: 0.45, roughness: 0.35 },
    params: { diameter: 18, depth: 12 },
  },
  generic: {
    label: 'Generic',
    material: { color: '#4a90d9', metalness: 0.2, roughness: 0.5 },
    params: { width: 14, height: 14, depth: 6 },
  },
}

const HOST_PLACEMENT_PRESETS = {
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

function normalizeNumber(value, fallback, min, max) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, number))
}

function normalizeTransparency(value, fallback) {
  return Math.round(normalizeNumber(value, fallback, 0, 100))
}

function normalizeTransform(values, fallback) {
  if (!Array.isArray(values)) return fallback
  return values.slice(0, 3).map((value, index) => {
    const number = Number(value)
    return Number.isFinite(number) ? number : fallback[index]
  })
}

function normalizeDimensions(dimensions) {
  if (!dimensions || typeof dimensions !== 'object') return null

  return Object.fromEntries(
    Object.entries(dimensions)
      .map(([key, value]) => [key, Number(value)])
      .filter(([, value]) => Number.isFinite(value)),
  )
}

function normalizeAssemblyMeta(meta) {
  return {
    units: typeof meta?.units === 'string' ? meta.units : 'mm',
    dimensions: normalizeDimensions(meta?.dimensions),
  }
}

function normalizeChassisComponents(components) {
  if (!Array.isArray(components)) return DEFAULT_CHASSIS_COMPONENTS

  return components.map((component) => {
    const defaultComponent = DEFAULT_CHASSIS_COMPONENTS.find((candidate) => candidate.id === component.id)
    return {
      ...(defaultComponent || {}),
      id: String(component.id || defaultComponent?.id || crypto.randomUUID?.() || Date.now()),
      label: String(component.label || defaultComponent?.label || 'Chassis Component'),
      path: String(component.path || defaultComponent?.path || ''),
      visible: typeof component.visible === 'boolean'
        ? component.visible
        : defaultComponent?.visible ?? true,
      locked: true,
      opacity: normalizeNumber(component.opacity, defaultComponent?.opacity ?? 1, 0, 1),
      position: normalizeTransform(component.position, defaultComponent?.position || [0, 0, 0]),
      rotation: normalizeTransform(component.rotation, defaultComponent?.rotation || [0, 0, 0]),
      material: {
        color: typeof component.material?.color === 'string'
          ? component.material.color
          : defaultComponent?.material.color || '#8a9db5',
        metalness: normalizeNumber(
          component.material?.metalness,
          defaultComponent?.material.metalness ?? 0.8,
          0,
          1,
        ),
        roughness: normalizeNumber(
          component.material?.roughness,
          defaultComponent?.material.roughness ?? 0.3,
          0,
          1,
        ),
      },
    }
  })
}

function normalizeAssemblyObjects(objects, chassisComponents, assemblyMeta = null) {
  if (!Array.isArray(objects)) return []
  const hostIds = chassisComponents.map((component) => component.id)
  const fallbackHostId = hostIds.includes('front_panel') ? 'front_panel' : hostIds[0] || 'front_panel'
  const manifestDepth = Number(assemblyMeta?.dimensions?.depth)

  return objects.map((rawObject) => {
    const object = rawObject || {}
    const objectClass = DEFAULT_OBJECT_CLASSES[object.class] ? object.class : 'hole'
    const objectDefaults = DEFAULT_OBJECT_CLASSES[objectClass]
    const hostId = hostIds.includes(object.hostId) ? object.hostId : fallbackHostId
    const placement = { ...(HOST_PLACEMENT_PRESETS[hostId] || HOST_PLACEMENT_PRESETS.front_panel) }
    if (Number.isFinite(manifestDepth) && manifestDepth > 0) {
      if (hostId === 'front_panel') placement.position = [0, 0, manifestDepth / 2]
      if (hostId === 'back_panel') placement.position = [0, 0, -manifestDepth / 2]
    }

    return {
      id: String(object.id || crypto.randomUUID?.() || Date.now()),
      class: objectClass,
      label: String(object.label || objectDefaults.label),
      hostId,
      position: normalizeTransform(object.position, placement.position),
      rotation: normalizeTransform(object.rotation, placement.rotation),
      normal: normalizeTransform(object.normal, placement.normal),
      visible: typeof object.visible === 'boolean' ? object.visible : true,
      locked: Boolean(object.locked),
      material: {
        color: typeof object.material?.color === 'string'
          ? object.material.color
          : objectDefaults.material.color,
        metalness: normalizeNumber(
          object.material?.metalness,
          objectDefaults.material.metalness,
          0,
          1,
        ),
        roughness: normalizeNumber(
          object.material?.roughness,
          objectDefaults.material.roughness,
          0,
          1,
        ),
      },
      transparency: normalizeTransparency(object.transparency, 0),
      params: {
        ...objectDefaults.params,
        ...(object.params || {}),
      },
    }
  })
}

async function readPositions() {
  try {
    const contents = await fs.readFile(positionsPath, 'utf8')
    const payload = JSON.parse(contents)
    const assemblyMeta = normalizeAssemblyMeta(payload.assemblyMeta)
    const chassisComponents = normalizeChassisComponents(payload.chassisComponents)

    return {
      assemblyMeta,
      chassisComponents,
      pcbs: Array.isArray(payload.pcbs) ? payload.pcbs : [],
      assemblyObjects: normalizeAssemblyObjects(
        payload.assemblyObjects || payload.objects,
        chassisComponents,
        assemblyMeta,
      ),
    }
  } catch (error) {
    if (error.code === 'ENOENT') return EMPTY_POSITIONS
    throw error
  }
}

router.get('/positions', async (_req, res, next) => {
  try {
    res.json(await readPositions())
  } catch (error) {
    next(error)
  }
})

router.post('/positions', async (req, res, next) => {
  try {
    const payload = Array.isArray(req.body)
      ? { pcbs: req.body }
      : req.body

    if (!payload || !Array.isArray(payload.pcbs)) {
      throw httpError(400, 'Positions payload must include a pcbs array.')
    }

    const assemblyMeta = normalizeAssemblyMeta(payload.assemblyMeta)
    const normalizedPayload = {
      assemblyMeta,
      chassisComponents: normalizeChassisComponents(payload.chassisComponents),
      pcbs: payload.pcbs.map((pcb) => ({
        id: String(pcb.id || pcb.path || crypto.randomUUID?.() || Date.now()),
        path: String(pcb.path || ''),
        color: typeof pcb.color === 'string' ? pcb.color : '#1a7a4a',
        transparency: normalizeTransparency(pcb.transparency, 0),
        position: Array.isArray(pcb.position) ? pcb.position.slice(0, 3).map(Number) : [0, 0, 0],
        rotation: Array.isArray(pcb.rotation) ? pcb.rotation.slice(0, 3).map(Number) : [0, 0, 0],
      })),
    }
    normalizedPayload.assemblyObjects = normalizeAssemblyObjects(
      payload.assemblyObjects || payload.objects,
      normalizedPayload.chassisComponents,
      assemblyMeta,
    )

    await fs.writeFile(positionsPath, `${JSON.stringify(normalizedPayload, null, 2)}\n`, 'utf8')
    res.json({ status: 'saved' })
  } catch (error) {
    next(error)
  }
})

export default router
