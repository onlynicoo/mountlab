import { useCallback, useEffect, useRef, useState } from 'react'
import { useGLTF } from '@react-three/drei'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import {
  CHASSIS_PART_DEFINITIONS,
  createDefaultChassisComponents,
  createGeneratedChassisComponents,
  findChassisPartDefinition,
  materialFromPreset,
} from '../config/chassisComponents'
import {
  DEFAULT_RACK_PRESET_ID,
  dimensionsForRackPreset,
  findRackPreset,
  rackHeightForUnits,
} from '../config/rackPresets'
import {
  DEFAULT_OBJECT_HOST_ID,
  createAssemblyObject,
  getAssemblyObjectClass,
  getHostPlacement,
} from '../config/assemblyObjects'

const API_BASE = 'http://127.0.0.1:3001'
const DIRECT_TYPES = new Map([
  ['stl', 'stl'],
  ['gltf', 'gltf'],
  ['glb', 'glb'],
])
const STEP_TYPES = new Set(['step', 'stp'])
const DEFAULT_PCB_COLOR = '#1a7a4a'
const DEFAULT_PCB_TRANSPARENCY = 0
const DEFAULT_OBJECT_TRANSPARENCY = 0
const DEFAULT_ASSEMBLY_META = { units: 'mm', dimensions: null, project: null, chassisSpec: null }
const DETECTABLE_HOLE_HOST_IDS = new Set(['front_panel', 'back_panel', 'rackmount'])
const FEATURE_EDGE_DOT_THRESHOLD = 0.78
const LOOP_VERTEX_MIN = 18
const MIN_DETECTED_HOLE_DIAMETER = 2
const MAX_DETECTED_HOLE_DIAMETER = 120
const CIRCLE_FIT_TOLERANCE = 0.08
const HOLE_DEDUPLICATION_TOLERANCE = 0.75

function extensionFor(filePath) {
  const match = filePath.toLowerCase().match(/\.([a-z0-9]+)$/)
  return match?.[1] || ''
}

function absoluteApiUrl(url) {
  if (url.startsWith('http')) return url
  return `${API_BASE}${url}`
}

function versionedUrl(url, version = Date.now()) {
  const nextUrl = new URL(absoluteApiUrl(url))
  nextUrl.searchParams.set('v', String(version))
  return nextUrl.toString()
}

function directModelUrl(filePath, type) {
  const params = new URLSearchParams({
    path: filePath,
    type,
  })
  return `${API_BASE}/api/model?${params.toString()}`
}

async function readError(response) {
  try {
    const payload = await response.json()
    return payload.details
      ? `${payload.error || response.statusText}: ${payload.details}`
      : payload.error || response.statusText
  } catch {
    return response.statusText
  }
}

async function assertLoadableStl(url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Drilled panel could not be loaded (${response.status}).`)
  }

  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('text/html') || contentType.includes('application/json')) {
    throw new Error(`Drilled panel URL returned ${contentType || 'non-STL content'}.`)
  }

  const buffer = await response.arrayBuffer()
  let geometry
  try {
    geometry = new STLLoader().parse(buffer)
    geometry.computeBoundingBox()
  } catch (error) {
    throw new Error(`Drilled panel is not a valid STL: ${error.message}`)
  }

  const positionCount = geometry.getAttribute('position')?.count || 0
  const box = geometry.boundingBox
  const isEmptyBox = !box || box.isEmpty()
  geometry.dispose()

  if (positionCount === 0 || isEmptyBox) {
    throw new Error('Drilled panel STL is empty.')
  }
}

async function resolveModel(filePath) {
  const trimmedPath = filePath.trim()
  const extension = extensionFor(trimmedPath)

  if (trimmedPath.startsWith('/projects/') || trimmedPath.startsWith('/models/')) {
    const type = DIRECT_TYPES.get(extension)
    if (type) {
      return {
        baseUrl: trimmedPath,
        type,
        url: versionedUrl(trimmedPath),
      }
    }
  }

  if (STEP_TYPES.has(extension)) {
    const response = await fetch(`${API_BASE}/api/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: trimmedPath }),
    })

    if (!response.ok) {
      throw new Error(await readError(response))
    }

    const payload = await response.json()
    const baseUrl = absoluteApiUrl(payload.url)
    return {
      baseUrl,
      type: payload.type,
      url: versionedUrl(baseUrl),
    }
  }

  const type = DIRECT_TYPES.get(extension)
  if (!type) {
    throw new Error('Unsupported format. Use STL, GLTF, GLB, STEP, or STP.')
  }

  const baseUrl = directModelUrl(trimmedPath, type)
  const response = await fetch(baseUrl, { method: 'HEAD' })

  if (!response.ok) {
    throw new Error(await readError(response))
  }

  return {
    baseUrl,
    type,
    url: versionedUrl(baseUrl),
  }
}

function preloadModel(model) {
  if (!model) return
  if (model.type === 'gltf' || model.type === 'glb') {
    useGLTF.preload(model.url)
  }
}

function pcbIdFor(filePath) {
  return `${filePath}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function objectIdFor(label = 'object') {
  return `${label.toLowerCase().replace(/[^a-z0-9]+/g, '_')}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const PASTE_OFFSET_MM = 5
const OBJECT_HISTORY_LIMIT = 50

function clonePastedObject(object, availableHostIds, offset = PASTE_OFFSET_MM) {
  const hostId = availableHostIds.includes(object.hostId) ? object.hostId : DEFAULT_OBJECT_HOST_ID
  const position = [...(object.position || [0, 0, 0])]
  position[0] += object.hostId === 'back_panel' ? -offset : offset
  position[1] -= offset

  return {
    ...object,
    id: objectIdFor(object.label || object.class),
    hostId,
    label: `${object.label || 'Object'} copy`,
    position,
    rotation: [...(object.rotation || [0, 0, 0])],
    normal: [...(object.normal || [0, 0, 1])],
    material: { ...object.material },
    params: { ...object.params },
    source: 'manual',
    status: 'editable',
  }
}

function slugForProjectName(name) {
  return String(name || 'untitled-rack-project')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'untitled-rack-project'
}

function createProjectMeta(name) {
  const now = new Date().toISOString()
  return {
    name: String(name || 'Untitled rack project').trim() || 'Untitled rack project',
    slug: slugForProjectName(name),
    version: 1,
    createdAt: now,
    updatedAt: now,
  }
}

function relativePathForFile(file) {
  return file.webkitRelativePath || file.name
}

function rootlessRelativePath(relativePath) {
  const parts = String(relativePath || 'file').split('/').filter(Boolean)
  if (parts.length <= 1) return parts[0] || 'file'
  return parts.slice(1).join('/')
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  let binary = ''

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }

  return btoa(binary)
}

async function apiJson(pathname, body) {
  let response
  try {
    response = await fetch(`${API_BASE}${pathname}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch (error) {
    throw new Error(`MountLab server is not reachable at ${API_BASE}. Start npm run dev. (${error.message})`)
  }

  if (!response.ok) {
    throw new Error(await readError(response))
  }

  return response.json()
}

async function apiGetJson(pathname) {
  let response
  try {
    response = await fetch(`${API_BASE}${pathname}`)
  } catch (error) {
    throw new Error(`MountLab server is not reachable at ${API_BASE}. Start npm run dev. (${error.message})`)
  }

  if (!response.ok) {
    throw new Error(await readError(response))
  }

  return response.json()
}

async function uploadWorkspaceFiles(files, projectName) {
  const payloadFiles = await Promise.all(files.map(async (file) => ({
    relativePath: rootlessRelativePath(relativePathForFile(file)),
    contentBase64: arrayBufferToBase64(await file.arrayBuffer()),
  })))

  const workspace = await apiJson('/api/workspace/import', {
    projectName,
    files: payloadFiles,
  })
  const pathByRelativePath = new Map(
    (workspace.files || []).map((file) => [file.relativePath, file.path]),
  )

  return {
    id: workspace.id,
    name: workspace.name,
    dir: workspace.dir,
    pathForFile(file) {
      return pathByRelativePath.get(rootlessRelativePath(relativePathForFile(file)))
        || pathByRelativePath.get(relativePathForFile(file))
        || inferPublicUrl(relativePathForFile(file))
    },
  }
}

async function createEmptyWorkspace(projectName) {
  const workspace = await apiJson('/api/workspace/new', { projectName })
  return {
    id: workspace.id,
    name: workspace.name,
    dir: workspace.dir,
  }
}

function dimensionsFromNewProjectSpec(spec = {}) {
  const preset = findRackPreset(spec.presetId || DEFAULT_RACK_PRESET_ID)
  const baseDimensions = dimensionsForRackPreset(preset)
  const rackUnits = Number(spec.rackUnits ?? baseDimensions.rack_units)
  const width = Number(spec.width ?? baseDimensions.width)
  const depth = Number(spec.depth ?? baseDimensions.depth)

  return {
    width: Number.isFinite(width) && width > 0 ? width : baseDimensions.width,
    height: rackHeightForUnits(rackUnits),
    depth: Number.isFinite(depth) && depth > 0 ? depth : baseDimensions.depth,
    rack_units: Number.isFinite(rackUnits) && rackUnits > 0 ? rackUnits : baseDimensions.rack_units,
    rack_width: width < 300 ? 'half-rack' : '19in',
  }
}

function inferPublicUrl(relativePath) {
  const parts = relativePath.split('/').filter(Boolean)
  const publicIndex = parts.indexOf('public')
  if (publicIndex >= 0 && parts[publicIndex + 1]) {
    return `/${parts.slice(publicIndex + 1).join('/')}`
  }

  const projectsIndex = parts.indexOf('projects')
  if (projectsIndex >= 0 && parts[projectsIndex + 1]) {
    return `/${parts.slice(projectsIndex).join('/')}`
  }

  if (parts.length >= 2) {
    return `/projects/${parts.join('/')}`
  }

  return `/${parts.join('/')}`
}

function fileNameForPath(filePath) {
  return filePath.split('/').filter(Boolean).pop()?.toLowerCase() || ''
}

function basename(filePath) {
  return filePath.split('/').filter(Boolean).pop() || filePath
}

function isChassisFolderPath(filePath) {
  return filePath.toLowerCase().split('/').includes('chassis')
}

function getChassisPartDefinitionForPath(filePath) {
  if (!isChassisFolderPath(filePath)) return null
  return findChassisPartDefinition(fileNameForPath(filePath))
}

function getHoleDetectionHostIdForPath(filePath) {
  if (extensionFor(filePath) !== 'stl') return null

  const fileName = fileNameForPath(filePath)
  if (
    fileName.includes('rackmount')
    || fileName.includes('rack_mount')
    || fileName.includes('rack-mount')
    || fileName.includes('rack_ears')
  ) {
    return 'rackmount'
  }
  if (
    fileName.includes('front_panel')
    || fileName.includes('front-panel')
    || /^front[._-]/.test(fileName)
    || fileName.includes('frontplate')
    || fileName.includes('faceplate')
  ) {
    return 'front_panel'
  }
  if (
    fileName.includes('back_panel')
    || fileName.includes('back-panel')
    || fileName.includes('rear_panel')
    || fileName.includes('rear-panel')
    || /^back[._-]/.test(fileName)
    || /^rear[._-]/.test(fileName)
  ) {
    return 'back_panel'
  }

  const definition = getChassisPartDefinitionForPath(filePath)
  return DETECTABLE_HOLE_HOST_IDS.has(definition?.id) ? definition.id : null
}

function isLikelyHoleDetectionPath(filePath) {
  if (extensionFor(filePath) !== 'stl') return false
  if (isChassisFolderPath(filePath)) return true

  const fileName = fileNameForPath(filePath)
  return Boolean(getHoleDetectionHostIdForPath(filePath))
    || fileName.includes('panel')
    || fileName.includes('plate')
    || fileName.includes('rack')
}

function isStaticPcbPath(filePath) {
  const normalized = filePath.toLowerCase()
  const extension = extensionFor(normalized)
  if (extension === 'gltf' || extension === 'glb') return true
  if (extension !== 'stl') return false
  return normalized.includes('/pcb/') || normalized.includes('pcb') || normalized.includes('board')
}

function createStaticPcb(filePath) {
  const extension = extensionFor(filePath)
  const type = DIRECT_TYPES.get(extension)
  if (!type) return null
  const isPublicPath = filePath.startsWith('/projects/') || filePath.startsWith('/models/')
  const baseUrl = isPublicPath ? filePath : directModelUrl(filePath, type)

  return {
    id: pcbIdFor(filePath),
    path: filePath,
    baseUrl,
    url: versionedUrl(baseUrl),
    type,
    color: DEFAULT_PCB_COLOR,
    transparency: DEFAULT_PCB_TRANSPARENCY,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
  }
}

function createImportedChassisComponent(filePath) {
  const definition = getChassisPartDefinitionForPath(filePath)
  if (!definition) return null

  return createImportedChassisComponentForHost(filePath, definition.id)
}

function createImportedChassisComponentForHost(filePath, hostId) {
  const definition = CHASSIS_PART_DEFINITIONS.find((candidate) => candidate.id === hostId)
  if (!definition) return null
  const renderPath = filePath.startsWith('/projects/') || filePath.startsWith('/models/')
    ? filePath
    : versionedUrl(directModelUrl(filePath, 'stl'))

  return {
    id: definition.id,
    label: definition.label,
    path: renderPath,
    sourcePath: filePath,
    drilledPath: null,
    drillState: 'source',
    drilledAt: null,
    material: materialFromPreset(definition.materialPreset),
    visible: definition.visible,
    locked: definition.locked,
    opacity: definition.opacity,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
  }
}

function sortChassisComponents(components) {
  return [...components].sort((a, b) => {
    const aIndex = CHASSIS_PART_DEFINITIONS.findIndex((definition) => definition.id === a.id)
    const bIndex = CHASSIS_PART_DEFINITIONS.findIndex((definition) => definition.id === b.id)
    return aIndex - bIndex
  })
}

function normalizeTransform(values, fallback) {
  if (!Array.isArray(values)) return fallback
  return values.slice(0, 3).map((value, index) => {
    const number = Number(value)
    return Number.isFinite(number) ? number : fallback[index]
  })
}

function isHexColor(color) {
  return /^#[0-9a-f]{6}$/i.test(color)
}

function normalizeMaterial(material, fallback = {}) {
  return {
    color: isHexColor(material?.color) ? material.color : fallback.color || '#111111',
    metalness: normalizeOpacity(material?.metalness, fallback.metalness ?? 0.2),
    roughness: normalizeOpacity(material?.roughness, fallback.roughness ?? 0.6),
  }
}

function normalizeTransparency(value, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(100, Math.max(0, Math.round(number)))
}

function normalizeOpacity(value, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(1, Math.max(0, number))
}

function pathFromModelUrl(filePath) {
  if (typeof filePath !== 'string') return filePath

  try {
    const parsed = new URL(filePath, API_BASE)
    if (parsed.pathname === '/api/model') {
      return parsed.searchParams.get('path') || filePath
    }
  } catch {
    return filePath
  }

  return filePath
}

function inferSourcePath(component, fallbackPath) {
  const rawPath = component?.sourcePath
    || component?.originalPath
    || component?.cleanPath
    || component?.path
    || fallbackPath
  const modelPath = pathFromModelUrl(rawPath)

  if (typeof modelPath === 'string' && modelPath.endsWith('.drilled.stl')) {
    return modelPath.replace(/\.drilled\.stl$/i, '.stl')
  }

  if (typeof modelPath === 'string' && /\.drilled-[a-f0-9]{12}\.stl$/i.test(modelPath)) {
    return modelPath.replace(/\.drilled-[a-f0-9]{12}\.stl$/i, '.stl')
  }

  return modelPath
}

function normalizeDimensions(dimensions) {
  if (!dimensions || typeof dimensions !== 'object') return null

  return Object.fromEntries(
    Object.entries(dimensions)
      .map(([key, value]) => [key, Number(value)])
      .filter(([, value]) => Number.isFinite(value)),
  )
}

function normalizeProjectMeta(project) {
  if (!project || typeof project !== 'object') return null

  return {
    name: String(project.name || 'Untitled rack project'),
    slug: String(project.slug || project.name || 'untitled-rack-project')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'untitled-rack-project',
    version: Number.isFinite(Number(project.version)) ? Number(project.version) : 1,
    createdAt: typeof project.createdAt === 'string' ? project.createdAt : new Date().toISOString(),
    updatedAt: typeof project.updatedAt === 'string' ? project.updatedAt : new Date().toISOString(),
  }
}

function normalizeAssemblyMeta(manifest) {
  return {
    units: typeof manifest?.units === 'string' ? manifest.units : 'mm',
    dimensions: normalizeDimensions(manifest?.dimensions),
    project: normalizeProjectMeta(manifest?.project),
    chassisSpec: manifest?.chassisSpec && typeof manifest.chassisSpec === 'object'
      ? manifest.chassisSpec
      : null,
  }
}

function mergeChassisComponents(savedComponents) {
  const defaults = createDefaultChassisComponents()
  if (!Array.isArray(savedComponents)) return defaults

  const baseComponents = savedComponents.length > 0 ? savedComponents : defaults
  return baseComponents.map((component) => {
    const defaultComponent = defaults.find((candidate) => candidate.id === component.id)
    const isGenerated = Boolean(component.generated)
    const sourcePath = inferSourcePath(component, defaultComponent?.sourcePath || defaultComponent?.path)
    return {
      ...(defaultComponent || {}),
      ...component,
      path: isGenerated ? null : component.path || defaultComponent?.path,
      sourcePath: isGenerated ? null : sourcePath,
      drilledPath: component.drilledPath || null,
      drillState: component.drillState || (isGenerated ? 'generated' : component.drilledPath ? 'drilled' : 'source'),
      drilledAt: component.drilledAt || null,
      generated: isGenerated ? component.generated : null,
      visible: typeof component.visible === 'boolean'
        ? component.visible
        : defaultComponent?.visible ?? true,
      locked: true,
      opacity: normalizeOpacity(component.opacity, defaultComponent?.opacity ?? 1),
      position: normalizeTransform(component.position, defaultComponent?.position || [0, 0, 0]),
      rotation: normalizeTransform(component.rotation, defaultComponent?.rotation || [0, 0, 0]),
      material: {
        ...(defaultComponent?.material || {}),
        ...(component.material || {}),
      },
    }
  })
}

function normalizeAssemblyObject(object, availableHostIds = [], dimensions = null) {
  const objectClass = getAssemblyObjectClass(object?.class)
  const fallbackHostId = availableHostIds.includes(DEFAULT_OBJECT_HOST_ID)
    ? DEFAULT_OBJECT_HOST_ID
    : availableHostIds[0] || DEFAULT_OBJECT_HOST_ID
  const hostId = availableHostIds.includes(object?.hostId) ? object.hostId : fallbackHostId
  const placement = getHostPlacement(hostId, dimensions)

  return {
    id: String(object?.id || objectIdFor(objectClass.label)),
    class: objectClass.id,
    label: String(object?.label || objectClass.label),
    hostId,
    position: normalizeTransform(object?.position, placement.position),
    rotation: normalizeTransform(object?.rotation, placement.rotation),
    normal: normalizeTransform(object?.normal, placement.normal),
    visible: typeof object?.visible === 'boolean' ? object.visible : true,
    locked: Boolean(object?.locked),
    source: typeof object?.source === 'string' ? object.source : 'manual',
    status: typeof object?.status === 'string' ? object.status : 'editable',
    sourcePath: typeof object?.sourcePath === 'string' ? object.sourcePath : null,
    material: normalizeMaterial(object?.material, objectClass.material),
    transparency: normalizeTransparency(object?.transparency, DEFAULT_OBJECT_TRANSPARENCY),
    params: {
      ...objectClass.params,
      ...(object?.params || {}),
    },
  }
}

function quantizedVertexKey(x, y, z) {
  return [
    Math.round(x * 1000),
    Math.round(y * 1000),
    Math.round(z * 1000),
  ].join(',')
}

function edgeKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

function vectorFromArray(array, index) {
  return {
    x: array[index],
    y: array[index + 1],
    z: array[index + 2],
  }
}

function subtractVectors(a, b) {
  return {
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z,
  }
}

function crossVectors(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  }
}

function normalizeVector(vector) {
  const length = Math.hypot(vector.x, vector.y, vector.z)
  if (length === 0) return { x: 0, y: 0, z: 0 }
  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length,
  }
}

function dotVectors(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

function triangleNormal(a, b, c) {
  return normalizeVector(crossVectors(
    subtractVectors(b, a),
    subtractVectors(c, a),
  ))
}

function addFeatureEdge(adjacency, featureEdges, a, b) {
  const key = edgeKey(a, b)
  featureEdges.add(key)

  if (!adjacency.has(a)) adjacency.set(a, new Set())
  if (!adjacency.has(b)) adjacency.set(b, new Set())
  adjacency.get(a).add(b)
  adjacency.get(b).add(a)
}

function isSharpFeatureEdge(edge) {
  if (!edge || edge.normals.length === 0) return false
  if (edge.normals.length === 1) return true

  for (let index = 1; index < edge.normals.length; index += 1) {
    if (Math.abs(dotVectors(edge.normals[0], edge.normals[index])) < FEATURE_EDGE_DOT_THRESHOLD) {
      return true
    }
  }

  return false
}

function buildFeatureGraph(geometry) {
  const position = geometry.getAttribute('position')
  const array = position?.array
  const vertices = new Map()
  const edges = new Map()

  if (!array || array.length < 9) return { vertices, adjacency: new Map(), featureEdges: new Set() }

  for (let index = 0; index < array.length; index += 9) {
    const points = [
      vectorFromArray(array, index),
      vectorFromArray(array, index + 3),
      vectorFromArray(array, index + 6),
    ]
    const keys = points.map((point) => {
      const key = quantizedVertexKey(point.x, point.y, point.z)
      if (!vertices.has(key)) vertices.set(key, point)
      return key
    })
    const normal = triangleNormal(points[0], points[1], points[2])

    ;[[0, 1], [1, 2], [2, 0]].forEach(([aIndex, bIndex]) => {
      const a = keys[aIndex]
      const b = keys[bIndex]
      if (a === b) return

      const key = edgeKey(a, b)
      const edge = edges.get(key) || { a, b, normals: [] }
      edge.normals.push(normal)
      edges.set(key, edge)
    })
  }

  const adjacency = new Map()
  const featureEdges = new Set()

  edges.forEach((edge) => {
    if (!isSharpFeatureEdge(edge)) return
    addFeatureEdge(adjacency, featureEdges, edge.a, edge.b)
  })

  return { vertices, adjacency, featureEdges }
}

function traceFeatureLoops(adjacency, featureEdges) {
  const visited = new Set()
  const loops = []

  featureEdges.forEach((startEdge) => {
    if (visited.has(startEdge)) return

    const [start, second] = startEdge.split('|')
    const loop = [start]
    let previous = start
    let current = second
    visited.add(startEdge)

    for (let guard = 0; guard < 10000; guard += 1) {
      loop.push(current)
      if (current === start) break

      const neighbors = Array.from(adjacency.get(current) || [])
      const next = neighbors.find((neighbor) => (
        neighbor !== previous && featureEdges.has(edgeKey(current, neighbor)) && !visited.has(edgeKey(current, neighbor))
      ))

      if (!next) break

      visited.add(edgeKey(current, next))
      previous = current
      current = next
    }

    if (loop[loop.length - 1] === start && loop.length >= LOOP_VERTEX_MIN) {
      loops.push(loop.slice(0, -1))
    }
  })

  return loops
}

function dominantPlaneAxis(points) {
  const ranges = [0, 1, 2].map((axis) => {
    const values = points.map((point) => [point.x, point.y, point.z][axis])
    return Math.max(...values) - Math.min(...values)
  })

  return ranges.indexOf(Math.min(...ranges))
}

function boundsFromGeometry(geometry) {
  const position = geometry.getAttribute('position')
  const array = position?.array
  if (!array || array.length < 3) return null

  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]

  for (let index = 0; index < array.length; index += 3) {
    min[0] = Math.min(min[0], array[index])
    min[1] = Math.min(min[1], array[index + 1])
    min[2] = Math.min(min[2], array[index + 2])
    max[0] = Math.max(max[0], array[index])
    max[1] = Math.max(max[1], array[index + 1])
    max[2] = Math.max(max[2], array[index + 2])
  }

  return {
    min,
    max,
    center: min.map((value, index) => (value + max[index]) / 2),
    range: min.map((value, index) => max[index] - value),
  }
}

function inferHoleDetectionHostIdFromGeometry(geometry) {
  const bounds = boundsFromGeometry(geometry)
  if (!bounds) return null

  const thicknessAxis = bounds.range.indexOf(Math.min(...bounds.range))
  if (thicknessAxis !== 2) return null

  const isWidePanel = bounds.range[0] > 50 && bounds.range[1] > 20 && bounds.range[2] < Math.min(bounds.range[0], bounds.range[1])
  if (!isWidePanel) return null

  return bounds.center[2] < 0 ? 'back_panel' : 'front_panel'
}

function fitCircularLoop(loop, vertices, hostId, sourcePath = null) {
  const points = loop.map((key) => vertices.get(key)).filter(Boolean)
  if (points.length < LOOP_VERTEX_MIN) return null

  const axis = dominantPlaneAxis(points)
  const coordinatePairs = points.map((point) => {
    if (axis === 0) return [point.y, point.z]
    if (axis === 1) return [point.x, point.z]
    return [point.x, point.y]
  })
  const center2d = coordinatePairs.reduce((center, pair) => [
    center[0] + pair[0] / coordinatePairs.length,
    center[1] + pair[1] / coordinatePairs.length,
  ], [0, 0])
  const radii = coordinatePairs.map((pair) => Math.hypot(
    pair[0] - center2d[0],
    pair[1] - center2d[1],
  ))
  const radius = radii.reduce((sum, value) => sum + value, 0) / radii.length
  const diameter = radius * 2
  const deviation = Math.sqrt(
    radii.reduce((sum, value) => sum + ((value - radius) ** 2), 0) / radii.length,
  )

  if (
    !Number.isFinite(radius)
    || diameter < MIN_DETECTED_HOLE_DIAMETER
    || diameter > MAX_DETECTED_HOLE_DIAMETER
    || deviation / radius > CIRCLE_FIT_TOLERANCE
  ) {
    return null
  }

  const center = points.reduce((nextCenter, point) => ({
    x: nextCenter.x + point.x / points.length,
    y: nextCenter.y + point.y / points.length,
    z: nextCenter.z + point.z / points.length,
  }), { x: 0, y: 0, z: 0 })
  const placement = getHostPlacement(hostId)

  return normalizeAssemblyObject({
    id: objectIdFor(`detected-${hostId}-hole`),
    class: 'hole',
    label: `Detected Hole ${Math.round(diameter * 10) / 10}mm`,
    hostId,
    position: [center.x, center.y, center.z],
    rotation: placement.rotation,
    normal: placement.normal,
    visible: true,
    locked: false,
    source: 'detected',
    status: 'imported',
    sourcePath,
    params: {
      diameter: Math.round(diameter * 10) / 10,
      depth: 3,
    },
  }, [hostId])
}

function dedupeDetectedHoles(holes) {
  const unique = []

  holes.forEach((hole) => {
    const duplicate = unique.some((candidate) => (
      candidate.hostId === hole.hostId
      && Math.abs((candidate.params?.diameter || 0) - (hole.params?.diameter || 0)) < HOLE_DEDUPLICATION_TOLERANCE
      && Math.hypot(
        (candidate.position?.[0] || 0) - (hole.position?.[0] || 0),
        (candidate.position?.[1] || 0) - (hole.position?.[1] || 0),
      ) < HOLE_DEDUPLICATION_TOLERANCE
    ))

    if (!duplicate) unique.push(hole)
  })

  return unique
}

function dedupeAgainstExistingObjects(detectedObjects, existingObjects) {
  return detectedObjects.filter((detected) => !existingObjects.some((existing) => (
    existing.class === 'hole'
    && existing.hostId === detected.hostId
    && Math.abs((existing.params?.diameter || 0) - (detected.params?.diameter || 0)) < HOLE_DEDUPLICATION_TOLERANCE
    && Math.hypot(
      (existing.position?.[0] || 0) - (detected.position?.[0] || 0),
      (existing.position?.[1] || 0) - (detected.position?.[1] || 0),
    ) < HOLE_DEDUPLICATION_TOLERANCE
  )))
}

async function detectHolesInStlFile(file, hostId, sourcePath) {
  if (!file) {
    return {
      holes: [],
      diagnostic: { sourcePath, hostId: null, detected: 0, loops: 0, skipped: 'missing-file' },
    }
  }

  try {
    const buffer = await file.arrayBuffer()
    const geometry = new STLLoader().parse(buffer)
    const resolvedHostId = DETECTABLE_HOLE_HOST_IDS.has(hostId)
      ? hostId
      : inferHoleDetectionHostIdFromGeometry(geometry)

    if (!DETECTABLE_HOLE_HOST_IDS.has(resolvedHostId)) {
      geometry.dispose()
      return {
        holes: [],
        diagnostic: { sourcePath, hostId: null, detected: 0, loops: 0, skipped: 'unknown-panel' },
      }
    }

    const { vertices, adjacency, featureEdges } = buildFeatureGraph(geometry)
    const loops = traceFeatureLoops(adjacency, featureEdges)
    const holes = loops
      .map((loop) => fitCircularLoop(loop, vertices, resolvedHostId, sourcePath))
      .filter(Boolean)
    const uniqueHoles = dedupeDetectedHoles(holes)

    geometry.dispose()
    return {
      holes: uniqueHoles,
      diagnostic: {
        sourcePath,
        hostId: resolvedHostId,
        detected: uniqueHoles.length,
        loops: loops.length,
        skipped: null,
      },
    }
  } catch (error) {
    return {
      holes: [],
      diagnostic: {
        sourcePath,
        hostId,
        detected: 0,
        loops: 0,
        skipped: error.message || 'parse-error',
      },
    }
  }
}

async function detectImportedHoleObjects(files, workspace = null) {
  const candidates = files
    .map((file) => {
      const publicUrl = workspace?.pathForFile
        ? workspace.pathForFile(file)
        : inferPublicUrl(relativePathForFile(file))
      return {
        file,
        publicUrl,
        hostId: getHoleDetectionHostIdForPath(publicUrl),
      }
    })
    .filter((candidate) => isLikelyHoleDetectionPath(candidate.publicUrl))

  const detected = await Promise.all(candidates.map((candidate) => (
    detectHolesInStlFile(candidate.file, candidate.hostId, candidate.publicUrl)
  )))

  return {
    objects: dedupeDetectedHoles(detected.flatMap((result) => result.holes)),
    diagnostics: detected.map((result) => result.diagnostic),
  }
}

function normalizeAssemblyObjectsWithMeta(objects, chassisComponents, assemblyMeta) {
  if (!Array.isArray(objects)) return []
  const availableHostIds = chassisComponents.map((component) => component.id)
  return objects.map((object) => normalizeAssemblyObject(
    object,
    availableHostIds,
    assemblyMeta?.dimensions,
  ))
}

function constrainObjectToPanelTransform(object, position, rotation) {
  const normal = object.normal || [0, 0, 1]
  const nextPosition = normalizeTransform(position, object.position || [0, 0, 0])
  const nextRotation = normalizeTransform(rotation, object.rotation || [0, 0, 0])
  const dominantAxis = normal
    .map((value) => Math.abs(value))
    .reduce((bestIndex, value, index, values) => (
      value > values[bestIndex] ? index : bestIndex
    ), 0)

  nextPosition[dominantAxis] = object.position?.[dominantAxis] || 0

  if (dominantAxis === 2) {
    nextRotation[0] = object.rotation?.[0] || 0
    nextRotation[1] = object.rotation?.[1] || 0
  }

  if (dominantAxis === 1) {
    nextRotation[0] = object.rotation?.[0] || 0
    nextRotation[2] = object.rotation?.[2] || 0
  }

  if (dominantAxis === 0) {
    nextRotation[1] = object.rotation?.[1] || 0
    nextRotation[2] = object.rotation?.[2] || 0
  }

  return { position: nextPosition, rotation: nextRotation }
}

async function readProjectManifest(files) {
  const manifestFile = files.find((file) => (
    fileNameForPath(file.webkitRelativePath || file.name) === 'assembly.json'
  ))
  if (!manifestFile) return null

  try {
    return JSON.parse(await manifestFile.text())
  } catch {
    return null
  }
}

function applyManifestToChassis(components, manifest) {
  if (!manifest?.chassis) return components

  return components.map((component) => {
    const fileName = basename(component.sourcePath || component.path)
    const manifestComponent = manifest.chassis[fileName] || manifest.chassis[component.id]
    if (!manifestComponent) return component

    return {
      ...component,
      sourcePath: component.sourcePath || manifestComponent.sourcePath || component.path,
      drilledPath: manifestComponent.drilledPath || component.drilledPath || null,
      drillState: manifestComponent.drillState || component.drillState || 'source',
      drilledAt: manifestComponent.drilledAt || component.drilledAt || null,
      visible: typeof manifestComponent.visible === 'boolean'
        ? manifestComponent.visible
        : component.visible,
      opacity: normalizeOpacity(manifestComponent.opacity, component.opacity),
      position: normalizeTransform(manifestComponent.position, component.position || [0, 0, 0]),
      rotation: normalizeTransform(manifestComponent.rotation, component.rotation || [0, 0, 0]),
      material: normalizeMaterial(manifestComponent.material, component.material),
    }
  })
}

function hasDrilledGeometry(component) {
  return component?.drillState === 'drilled'
    || component?.drillState === 'dirty'
    || Boolean(component?.drilledPath)
}

function isGeometryObjectUpdate(updates) {
  return Boolean(
    updates.params
    || updates.position
    || updates.rotation
    || updates.normal
    || updates.hostId
    || updates.class,
  )
}

function buildAssemblyPayload({ assemblyMeta, chassisComponents, pcbs, assemblyObjects }) {
  const nextAssemblyMeta = {
    ...assemblyMeta,
    project: assemblyMeta.project
      ? { ...assemblyMeta.project, updatedAt: new Date().toISOString() }
      : assemblyMeta.project,
  }

  return {
    chassisComponents,
    assemblyMeta: nextAssemblyMeta,
    pcbs: pcbs.map((pcb) => ({
      id: pcb.id,
      path: pcb.path,
      color: pcb.color || DEFAULT_PCB_COLOR,
      transparency: normalizeTransparency(pcb.transparency, DEFAULT_PCB_TRANSPARENCY),
      position: pcb.position,
      rotation: pcb.rotation,
    })),
    assemblyObjects,
  }
}

export function useAssembly() {
  const [chassisComponents, setChassisComponents] = useState(createDefaultChassisComponents)
  const [pcbs, setPcbs] = useState([])
  const [assemblyObjects, setAssemblyObjects] = useState([])
  const [assemblyMeta, setAssemblyMeta] = useState(DEFAULT_ASSEMBLY_META)
  const [selectedPcbId, setSelectedPcbId] = useState(null)
  const [selectedObjectIds, setSelectedObjectIds] = useState([])
  const [selectedComponent, setSelectedComponent] = useState(null)
  const [transformMode, setTransformMode] = useState('translate')
  const [pcbStatus, setPcbStatus] = useState({ state: 'idle', message: '' })
  const [persistenceStatus, setPersistenceStatus] = useState({ state: 'idle', message: '' })
  const [drillingStatus, setDrillingStatus] = useState({ state: 'idle', message: '', componentId: null })
  const [importReview, setImportReview] = useState(null)
  const [workspace, setWorkspace] = useState(null)
  const [clipboard, setClipboard] = useState([])
  const stateRef = useRef({ pcbs })
  const selectedObjectId = selectedObjectIds[selectedObjectIds.length - 1] || null

  const objectHistoryRef = useRef({ past: [], future: [] })
  const lastObjectsRef = useRef(assemblyObjects)
  const skipObjectHistoryRef = useRef(false)

  useEffect(() => {
    stateRef.current = { pcbs }
  }, [pcbs])

  // Track assemblyObjects changes for undo/redo. Changes driven by undo/redo
  // itself (or by project-level resets) set skipObjectHistoryRef so they are
  // not re-recorded.
  useEffect(() => {
    if (assemblyObjects === lastObjectsRef.current) return

    if (skipObjectHistoryRef.current) {
      skipObjectHistoryRef.current = false
      lastObjectsRef.current = assemblyObjects
      return
    }

    const history = objectHistoryRef.current
    history.past.push(lastObjectsRef.current)
    if (history.past.length > OBJECT_HISTORY_LIMIT) history.past.shift()
    history.future = []
    lastObjectsRef.current = assemblyObjects
  }, [assemblyObjects])

  const resetObjectHistory = useCallback(() => {
    objectHistoryRef.current = { past: [], future: [] }
    skipObjectHistoryRef.current = true
  }, [])

  const undo = useCallback(() => {
    const history = objectHistoryRef.current
    if (history.past.length === 0) return false

    const previous = history.past.pop()
    history.future.unshift(lastObjectsRef.current)
    skipObjectHistoryRef.current = true
    lastObjectsRef.current = previous
    setAssemblyObjects(previous)
    setSelectedObjectIds([])
    setSelectedComponent(null)
    return true
  }, [])

  const redo = useCallback(() => {
    const history = objectHistoryRef.current
    if (history.future.length === 0) return false

    const next = history.future.shift()
    history.past.push(lastObjectsRef.current)
    skipObjectHistoryRef.current = true
    lastObjectsRef.current = next
    setAssemblyObjects(next)
    setSelectedObjectIds([])
    setSelectedComponent(null)
    return true
  }, [])

  const markPanelNeedsDrill = useCallback((componentId) => {
    if (!componentId) return

    setChassisComponents((current) => current.map((component) => {
      if (component.id !== componentId || !hasDrilledGeometry(component)) return component
      return { ...component, drillState: 'dirty' }
    }))
  }, [])

  const createNewProject = useCallback(async (spec = {}) => {
    const requestedPresetId = spec.presetId || DEFAULT_RACK_PRESET_ID
    const preset = findRackPreset(requestedPresetId)
    const storedPresetId = requestedPresetId === 'custom' ? 'custom' : preset.id
    const dimensions = dimensionsFromNewProjectSpec({
      ...spec,
      presetId: preset.id,
    })
    const project = createProjectMeta(spec.name || preset.label)
    const panelThickness = Number(spec.panelThickness) || 3
    const nextMeta = {
      units: 'mm',
      project,
      dimensions,
      chassisSpec: {
        preset: storedPresetId,
        panels: {
          front_panel: {
            enabled: true,
            materialPreset: 'black_anodized',
            thickness: panelThickness,
          },
          back_panel: {
            enabled: true,
            materialPreset: 'black_anodized',
            thickness: panelThickness,
          },
          rackmount: {
            enabled: true,
            materialPreset: 'aluminum',
          },
          body: {
            enabled: true,
            materialPreset: 'aluminum',
          },
        },
      },
    }

    setAssemblyMeta(nextMeta)
    setChassisComponents(createGeneratedChassisComponents(dimensions, {
      presetId: storedPresetId,
      panelThickness,
    }))
    setPcbs([])
    setAssemblyObjects([])
    resetObjectHistory()
    setSelectedPcbId(null)
    setSelectedObjectIds([])
    setSelectedComponent(null)
    setTransformMode('translate')
    setPcbStatus({ state: 'idle', message: '' })
    setPersistenceStatus({ state: 'loading', message: `Creating workspace for ${project.name}...` })
    setDrillingStatus({ state: 'idle', message: '', componentId: null })
    setImportReview(null)

    try {
      const nextWorkspace = await createEmptyWorkspace(project.name)
      setWorkspace(nextWorkspace)
      await apiJson('/api/workspace/save', {
        workspaceId: nextWorkspace.id,
        payload: buildAssemblyPayload({
          assemblyMeta: nextMeta,
          chassisComponents: createGeneratedChassisComponents(dimensions, {
            presetId: storedPresetId,
            panelThickness,
          }),
          pcbs: [],
          assemblyObjects: [],
        }),
      })
      setPersistenceStatus({ state: 'loaded', message: `Created workspace for ${project.name}` })
    } catch (error) {
      setWorkspace(null)
      setPersistenceStatus({ state: 'error', message: error.message })
    }

    return nextMeta
  }, [resetObjectHistory])

  const addPcb = useCallback(async (filePath, savedTransform = {}) => {
    const nextPath = filePath.trim()
    if (!nextPath) return null

    setPcbStatus({
      state: 'loading',
      message: STEP_TYPES.has(extensionFor(nextPath)) ? 'Converting STEP...' : 'Loading...',
    })

    try {
      const resolved = await resolveModel(nextPath)
      const pcb = {
        id: savedTransform.id || pcbIdFor(nextPath),
        path: nextPath,
        ...resolved,
        color: savedTransform.color || DEFAULT_PCB_COLOR,
        transparency: normalizeTransparency(savedTransform.transparency, DEFAULT_PCB_TRANSPARENCY),
        position: normalizeTransform(savedTransform.position, [0, 0, 0]),
        rotation: normalizeTransform(savedTransform.rotation, [0, 0, 0]),
      }

      preloadModel(pcb)
      setPcbs((current) => [...current, pcb])
      setSelectedPcbId(pcb.id)
      setSelectedObjectIds([])
      setSelectedComponent({ type: 'pcb', id: pcb.id })
      setPcbStatus({ state: 'loaded', message: 'Loaded' })
      return pcb
    } catch (error) {
      setPcbStatus({ state: 'error', message: error.message })
      return null
    }
  }, [])

  const importProjectFromFiles = useCallback(async (fileList) => {
    const files = Array.from(fileList || [])
    if (files.length === 0) return
    setPcbStatus({ state: 'loading', message: 'Creating temporary workspace...' })

    try {
      const manifest = await readProjectManifest(files)
      const nextAssemblyMeta = normalizeAssemblyMeta(manifest)
      const nextWorkspace = await uploadWorkspaceFiles(
        files,
        nextAssemblyMeta.project?.name || 'Imported project',
      )
      const modelPaths = files
        .map((file) => nextWorkspace.pathForFile(file))
        .filter((filePath) => DIRECT_TYPES.has(extensionFor(filePath)))

      const recognizedChassisComponents = modelPaths
        .filter((filePath) => extensionFor(filePath) === 'stl')
        .map(createImportedChassisComponent)
        .filter(Boolean)
      const detectedImport = await detectImportedHoleObjects(files, nextWorkspace)

      const chassisComponentById = new Map(
        recognizedChassisComponents.map((component) => [component.id, component]),
      )

      detectedImport.diagnostics.forEach((diagnostic) => {
        if (
          !diagnostic?.hostId
          || chassisComponentById.has(diagnostic.hostId)
          || !diagnostic.sourcePath
        ) {
          return
        }

        const inferredComponent = createImportedChassisComponentForHost(
          diagnostic.sourcePath,
          diagnostic.hostId,
        )
        if (inferredComponent) chassisComponentById.set(inferredComponent.id, inferredComponent)
      })

      const uniqueChassisComponents = sortChassisComponents(
        Array.from(chassisComponentById.values()),
      )

      const nextPcbs = modelPaths
        .filter(isStaticPcbPath)
        .map(createStaticPcb)
        .filter(Boolean)

      nextPcbs.forEach(preloadModel)

      const nextChassis = applyManifestToChassis(
        uniqueChassisComponents.length > 0
          ? uniqueChassisComponents
          : createDefaultChassisComponents(),
        manifest,
      )
      const manifestObjects = normalizeAssemblyObjectsWithMeta(
        manifest?.objects,
        nextChassis,
        nextAssemblyMeta,
      )
      const detectedObjects = dedupeAgainstExistingObjects(detectedImport.objects, manifestObjects)
      const nextObjects = [...manifestObjects, ...detectedObjects]
      const detectedHostIds = new Set(detectedObjects.map((object) => object.hostId))
      const reviewPanels = nextChassis.map((component) => ({
        id: component.id,
        label: component.label,
        detected: detectedObjects.filter((object) => object.hostId === component.id).length,
        existing: manifestObjects.filter((object) => object.hostId === component.id).length,
      }))
      const nextChassisWithDetectedHoles = nextChassis.map((component) => (
        detectedHostIds.has(component.id) && component.drillState === 'source'
          ? { ...component, drillState: 'drilled' }
          : component
      ))

      setWorkspace(nextWorkspace)
      setAssemblyMeta(nextAssemblyMeta)
      setChassisComponents(nextChassisWithDetectedHoles)
      setPcbs(nextPcbs)
      setAssemblyObjects(nextObjects)
      resetObjectHistory()
      setSelectedPcbId(nextPcbs[0]?.id || null)
      setSelectedObjectIds([])
      setSelectedComponent(nextPcbs[0] ? { type: 'pcb', id: nextPcbs[0].id } : null)
      setPcbStatus({
        state: 'loaded',
        message: `Imported ${uniqueChassisComponents.length} chassis parts, ${nextPcbs.length} PCB files, ${nextObjects.length} objects${detectedObjects.length > 0 ? ` (${detectedObjects.length} detected holes)` : ''}`,
      })
      setPersistenceStatus({ state: 'loaded', message: 'Temporary workspace ready' })
      setImportReview({
        projectName: nextAssemblyMeta.project?.name || 'Imported project',
        totalDetected: detectedObjects.length,
        detectedObjectIds: detectedObjects.map((object) => object.id),
        diagnostics: detectedImport.diagnostics,
        panels: reviewPanels,
      })
    } catch (error) {
      setPcbStatus({ state: 'error', message: error.message })
      setPersistenceStatus({ state: 'error', message: error.message })
    }
  }, [resetObjectHistory])

  const removePcb = useCallback((id) => {
    setPcbs((current) => current.filter((pcb) => pcb.id !== id))
    setSelectedPcbId((current) => (current === id ? null : current))
    setSelectedComponent((current) => (current?.type === 'pcb' && current.id === id ? null : current))
  }, [])

  const selectPcb = useCallback((id) => {
    setSelectedPcbId(id)
    setSelectedObjectIds([])
    setSelectedComponent({ type: 'pcb', id })
  }, [])

  const addAssemblyObject = useCallback((className, hostId = DEFAULT_OBJECT_HOST_ID) => {
    const object = createAssemblyObject(className, hostId, assemblyMeta.dimensions)
    setAssemblyObjects((current) => [...current, object])
    if (object.class === 'hole') markPanelNeedsDrill(object.hostId)
    setSelectedPcbId(null)
    setSelectedObjectIds([object.id])
    setSelectedComponent({ type: 'object', id: object.id })
    return object
  }, [assemblyMeta.dimensions, markPanelNeedsDrill])

  const addAssemblyObjectGrid = useCallback((options = {}) => {
    const className = options.className || 'hole'
    const hostId = options.hostId || DEFAULT_OBJECT_HOST_ID
    const columns = Math.min(24, Math.max(1, Math.round(Number(options.columns) || 1)))
    const rows = Math.min(24, Math.max(1, Math.round(Number(options.rows) || 1)))
    const pitchX = Math.max(0, Number(options.pitchX) || 0)
    const pitchY = Math.max(0, Number(options.pitchY) || 0)
    const originX = Number(options.originX) || 0
    const originY = Number(options.originY) || 0
    const centered = options.originMode !== 'corner'
    const labelPrefix = String(options.labelPrefix || '').trim()
    const params = options.params && typeof options.params === 'object' ? options.params : null
    const objects = []

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const object = createAssemblyObject(className, hostId, assemblyMeta.dimensions)
        const offsetX = centered ? (column - (columns - 1) / 2) * pitchX : column * pitchX
        const offsetY = centered ? ((rows - 1) / 2 - row) * pitchY : -row * pitchY
        object.position = [
          object.hostId === 'back_panel' ? -(originX + offsetX) : originX + offsetX,
          originY + offsetY,
          object.position[2],
        ]
        object.label = labelPrefix
          ? `${labelPrefix} ${row + 1}-${column + 1}`
          : `${object.label} ${row + 1}-${column + 1}`
        object.source = 'grid'
        object.status = 'editable'
        if (params) object.params = { ...object.params, ...params }
        objects.push(object)
      }
    }

    setAssemblyObjects((current) => [...current, ...objects])
    if (objects.some((object) => object.class === 'hole')) markPanelNeedsDrill(hostId)
    const selectedObject = objects[objects.length - 1]
    if (selectedObject) {
      setSelectedPcbId(null)
      setSelectedObjectIds([selectedObject.id])
      setSelectedComponent({ type: 'object', id: selectedObject.id })
    }
    return objects
  }, [assemblyMeta.dimensions, markPanelNeedsDrill])

  const removeAssemblyObject = useCallback((id) => {
    const object = assemblyObjects.find((candidate) => candidate.id === id)
    setAssemblyObjects((current) => current.filter((object) => object.id !== id))
    if (object?.class === 'hole') markPanelNeedsDrill(object.hostId)
    setSelectedObjectIds((current) => {
      const next = current.filter((objectId) => objectId !== id)
      setSelectedComponent((selected) => {
        if (selected?.type !== 'object' || selected.id !== id) return selected
        const nextPrimary = next[next.length - 1] || null
        return nextPrimary ? { type: 'object', id: nextPrimary } : null
      })
      return next
    })
  }, [assemblyObjects, markPanelNeedsDrill])

  const selectAssemblyObject = useCallback((id, options = {}) => {
    setSelectedPcbId(null)
    setSelectedObjectIds((current) => {
      const additive = Boolean(options.additive)
      const preserveIfSelected = Boolean(options.preserveIfSelected)
      const next = additive
        ? current.includes(id)
          ? current.filter((objectId) => objectId !== id)
          : [...current, id]
        : preserveIfSelected && current.includes(id)
          ? [...current.filter((objectId) => objectId !== id), id]
        : [id]
      const nextPrimary = next[next.length - 1] || null
      setSelectedComponent(nextPrimary ? { type: 'object', id: nextPrimary } : null)
      return next
    })
  }, [])

  const selectAssemblyObjects = useCallback((ids, options = {}) => {
    const requested = Array.isArray(ids) ? ids : []
    const validIds = assemblyObjects
      .filter((object) => requested.includes(object.id))
      .map((object) => object.id)

    setSelectedPcbId(null)
    setSelectedObjectIds((current) => {
      const merged = options.additive ? [...current] : []
      validIds.forEach((id) => {
        if (!merged.includes(id)) merged.push(id)
      })
      const nextPrimary = merged[merged.length - 1] || null
      setSelectedComponent(nextPrimary ? { type: 'object', id: nextPrimary } : null)
      return merged
    })
  }, [assemblyObjects])

  const clearSelection = useCallback(() => {
    setSelectedPcbId(null)
    setSelectedObjectIds([])
    setSelectedComponent(null)
  }, [])

  const addClonedObjects = useCallback((sources) => {
    if (!Array.isArray(sources) || sources.length === 0) return []

    const availableHostIds = chassisComponents.map((component) => component.id)
    const pasted = sources.map((object) => clonePastedObject(object, availableHostIds))

    setAssemblyObjects((current) => [...current, ...pasted])
    pasted.forEach((object) => {
      if (object.class === 'hole') markPanelNeedsDrill(object.hostId)
    })
    setSelectedPcbId(null)
    setSelectedObjectIds(pasted.map((object) => object.id))
    setSelectedComponent({ type: 'object', id: pasted[pasted.length - 1].id })
    return pasted
  }, [chassisComponents, markPanelNeedsDrill])

  const copySelection = useCallback(() => {
    const ids = new Set(selectedObjectIds)
    const copied = assemblyObjects.filter((object) => ids.has(object.id))
    if (copied.length === 0) return []

    setClipboard(copied.map((object) => ({
      ...object,
      position: [...(object.position || [0, 0, 0])],
      rotation: [...(object.rotation || [0, 0, 0])],
      normal: [...(object.normal || [0, 0, 1])],
      material: { ...object.material },
      params: { ...object.params },
    })))
    return copied
  }, [assemblyObjects, selectedObjectIds])

  const deleteSelection = useCallback(() => {
    const ids = selectedObjectIds
    if (ids.length === 0) return []

    const idSet = new Set(ids)
    const removed = assemblyObjects.filter((object) => idSet.has(object.id))
    if (removed.length === 0) return []

    setAssemblyObjects((current) => current.filter((object) => !idSet.has(object.id)))
    removed.forEach((object) => {
      if (object.class === 'hole') markPanelNeedsDrill(object.hostId)
    })
    setSelectedObjectIds([])
    setSelectedComponent((current) => (
      current?.type === 'object' && idSet.has(current.id) ? null : current
    ))
    return removed
  }, [assemblyObjects, markPanelNeedsDrill, selectedObjectIds])

  const cutSelection = useCallback(() => {
    const copied = copySelection()
    if (copied.length > 0) deleteSelection()
    return copied
  }, [copySelection, deleteSelection])

  const pasteClipboard = useCallback(() => addClonedObjects(clipboard), [addClonedObjects, clipboard])

  const duplicateSelection = useCallback(() => {
    const ids = new Set(selectedObjectIds)
    const sources = assemblyObjects.filter((object) => ids.has(object.id))
    return addClonedObjects(sources)
  }, [addClonedObjects, assemblyObjects, selectedObjectIds])

  const mountObjectsOnHoles = useCallback((className, holeIds) => {
    const selectedHoleIds = new Set(holeIds || [])
    const holes = assemblyObjects.filter((object) => (
      selectedHoleIds.has(object.id) && object.class === 'hole'
    ))

    if (holes.length === 0) return []

    const objectClass = getAssemblyObjectClass(className)
    const mountedObjects = holes.map((hole, index) => {
      const mounted = createAssemblyObject(objectClass.id, hole.hostId, assemblyMeta.dimensions)
      return {
        ...mounted,
        label: `${objectClass.label} ${index + 1}`,
        position: [...(hole.position || mounted.position)],
        rotation: [...(hole.rotation || mounted.rotation)],
        normal: [...(hole.normal || mounted.normal)],
        source: 'mounted',
        status: 'editable',
      }
    })

    setAssemblyObjects((current) => [...current, ...mountedObjects])
    setSelectedPcbId(null)
    setSelectedObjectIds(mountedObjects.map((object) => object.id))
    setSelectedComponent({
      type: 'object',
      id: mountedObjects[mountedObjects.length - 1].id,
    })
    return mountedObjects
  }, [assemblyMeta.dimensions, assemblyObjects])

  const setSelectedComponentColor = useCallback((color) => {
    if (!isHexColor(color)) return

    setSelectedComponent((current) => {
      if (!current) return current

      if (current.type === 'object') {
        setAssemblyObjects((currentObjects) => currentObjects.map((object) => (
          object.id === current.id
            ? { ...object, material: { ...object.material, color } }
            : object
        )))

        return current
      }

      if (current.type !== 'pcb') return current

      setPcbs((currentPcbs) => currentPcbs.map((pcb) => (
        pcb.id === current.id ? { ...pcb, color } : pcb
      )))

      return current
    })
  }, [])

  const setSelectedComponentTransparency = useCallback((transparency) => {
    const nextTransparency = normalizeTransparency(transparency, 0)

    setSelectedComponent((current) => {
      if (!current) return current

      if (current.type === 'object') {
        setAssemblyObjects((currentObjects) => currentObjects.map((object) => (
          object.id === current.id ? { ...object, transparency: nextTransparency } : object
        )))

        return current
      }

      if (current.type !== 'pcb') return current

      setPcbs((currentPcbs) => currentPcbs.map((pcb) => (
        pcb.id === current.id ? { ...pcb, transparency: nextTransparency } : pcb
      )))

      return current
    })
  }, [])

  const updateChassisComponent = useCallback((id, updates) => {
    setChassisComponents((current) => current.map((component) => (
      component.id === id
        ? { ...component, ...updates }
        : component
    )))
  }, [])

  const updateChassisComponentMaterial = useCallback((id, materialUpdates) => {
    setChassisComponents((current) => current.map((component) => (
      component.id === id
        ? {
          ...component,
          material: {
            ...component.material,
            ...materialUpdates,
          },
        }
        : component
    )))
  }, [])

  const updatePcbTransform = useCallback((id, position, rotation) => {
    setPcbs((current) => current.map((pcb) => (
      pcb.id === id
        ? { ...pcb, position: [...position], rotation: [...rotation] }
        : pcb
    )))
  }, [])

  const updateAssemblyObject = useCallback((id, updates) => {
    const object = assemblyObjects.find((candidate) => candidate.id === id)
    setAssemblyObjects((current) => current.map((object) => (
      object.id === id
        ? {
          ...object,
          ...updates,
          status: object.source === 'detected' && isGeometryObjectUpdate(updates)
            ? 'edited'
            : updates.status || object.status,
          params: updates.params ? { ...object.params, ...updates.params } : object.params,
          material: updates.material ? { ...object.material, ...updates.material } : object.material,
        }
        : object
    )))
    if (object?.class === 'hole' && isGeometryObjectUpdate(updates)) {
      markPanelNeedsDrill(object.hostId)
    }
  }, [assemblyObjects, markPanelNeedsDrill])

  const moveAssemblyObjectToHost = useCallback((id, hostId) => {
    const placement = getHostPlacement(hostId, assemblyMeta.dimensions)
    const object = assemblyObjects.find((candidate) => candidate.id === id)

    setAssemblyObjects((current) => current.map((object) => (
      object.id === id
        ? {
          ...object,
          hostId,
          status: object.source === 'detected' ? 'edited' : object.status,
          position: [...placement.position],
          rotation: [...placement.rotation],
          normal: [...placement.normal],
        }
        : object
    )))
    if (object?.class === 'hole') {
      markPanelNeedsDrill(object.hostId)
      markPanelNeedsDrill(hostId)
    }
  }, [assemblyMeta.dimensions, assemblyObjects, markPanelNeedsDrill])

  const updateAssemblyObjectTransform = useCallback((id, position, rotation) => {
    const object = assemblyObjects.find((candidate) => candidate.id === id)
    if (!object) return

    const selectedIds = new Set(selectedObjectIds)
    const shouldMoveSelection = selectedIds.has(id) && selectedIds.size > 1
    const dirtyHostIds = new Set(
      assemblyObjects
        .filter((candidate) => (
          candidate.class === 'hole'
          && (
            candidate.id === id
            || (shouldMoveSelection && selectedIds.has(candidate.id) && candidate.hostId === object.hostId)
          )
        ))
        .map((candidate) => candidate.hostId),
    )

    setAssemblyObjects((current) => {
      const currentPrimary = current.find((item) => item.id === id) || object
      const constrainedPrimary = constrainObjectToPanelTransform(currentPrimary, position, rotation)
      const delta = constrainedPrimary.position.map((value, index) => (
        value - (currentPrimary.position?.[index] || 0)
      ))

      return current.map((candidate) => {
        if (candidate.id === id) {
          return {
            ...candidate,
            status: candidate.source === 'detected' ? 'edited' : candidate.status,
            ...constrainedPrimary,
          }
        }

        if (!shouldMoveSelection || !selectedIds.has(candidate.id) || candidate.hostId !== object.hostId) {
          return candidate
        }

        const nextPosition = (candidate.position || [0, 0, 0]).map((value, index) => value + delta[index])
        const constrained = constrainObjectToPanelTransform(
          candidate,
          nextPosition,
          candidate.rotation || [0, 0, 0],
        )

        return {
          ...candidate,
          status: candidate.source === 'detected' ? 'edited' : candidate.status,
          ...constrained,
        }
      })
    })
    dirtyHostIds.forEach(markPanelNeedsDrill)
  }, [assemblyObjects, markPanelNeedsDrill, selectedObjectIds])

  const toggleTransformMode = useCallback(() => {
    setTransformMode((current) => (current === 'translate' ? 'rotate' : 'translate'))
  }, [])

  const drillPanel = useCallback(async (componentId) => {
    const component = chassisComponents.find((candidate) => candidate.id === componentId)
    const holes = assemblyObjects.filter((object) => (
      object.hostId === componentId && object.class === 'hole'
    ))

    if (!component || holes.length === 0) {
      setDrillingStatus({
        state: 'error',
        message: 'Select a panel with at least one hole.',
        componentId,
      })
      return null
    }

    const sourcePath = component.sourcePath || component.path

    if (component.generated || !sourcePath) {
      setDrillingStatus({
        state: 'error',
        message: 'Generated chassis export is not wired to STL baking yet. Import an STL project to bake panels.',
        componentId,
      })
      return null
    }

    if (sourcePath.startsWith('/models/chassis/')) {
      setDrillingStatus({
        state: 'error',
        message: 'Import a project folder before baking this panel.',
        componentId,
      })
      return null
    }

    setDrillingStatus({
      state: 'loading',
      message: `Baking ${holes.length} hole${holes.length === 1 ? '' : 's'} into STL...`,
      componentId,
    })

    try {
      const response = await fetch(`${API_BASE}/api/drill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          componentPath: sourcePath,
          holes,
        }),
      })

      if (!response.ok) {
        throw new Error(await readError(response))
      }

      const payload = await response.json()
      const outputPath = payload.path || payload.outputPath
      const nextPath = outputPath
        ? versionedUrl(directModelUrl(outputPath, 'stl'))
        : payload.url
          ? versionedUrl(payload.url)
          : null

      if (!nextPath) {
        throw new Error('Drill response did not include a backend model path. Restart npm run dev.')
      }

      await assertLoadableStl(nextPath)

      setChassisComponents((current) => current.map((candidate) => (
        candidate.id === componentId
          ? {
            ...candidate,
            path: nextPath,
            sourcePath,
            drilledPath: outputPath || nextPath,
            drillState: 'drilled',
            drilledAt: new Date().toISOString(),
          }
          : candidate
      )))
      setDrillingStatus({
        state: 'loaded',
        message: payload.cached
          ? `Loaded cached STL for ${holes.length} hole${holes.length === 1 ? '' : 's'}`
          : `Baked STL with ${holes.length} hole${holes.length === 1 ? '' : 's'}`,
        componentId,
      })
      return payload
    } catch (error) {
      setDrillingStatus({
        state: 'error',
        message: error.message,
        componentId,
      })
      return null
    }
  }, [assemblyObjects, chassisComponents])

  const savePositions = useCallback(async () => {
    setPersistenceStatus({ state: 'saving', message: 'Saving...' })

    try {
      const payload = buildAssemblyPayload({
        chassisComponents,
        assemblyMeta,
        pcbs,
        assemblyObjects,
      })

      if (workspace?.id) {
        await apiJson('/api/workspace/save', {
          workspaceId: workspace.id,
          payload,
        })
      }

      await apiJson('/api/positions', payload)

      setPersistenceStatus({ state: 'saved', message: 'Saved' })
    } catch (error) {
      setPersistenceStatus({ state: 'error', message: error.message })
    }
  }, [assemblyMeta, assemblyObjects, chassisComponents, pcbs, workspace])

  const saveAsProject = useCallback(async () => {
    setPersistenceStatus({ state: 'saving', message: 'Saving project copy...' })

    try {
      let nextWorkspace = workspace
      if (!nextWorkspace?.id) {
        nextWorkspace = await createEmptyWorkspace(assemblyMeta.project?.name || 'Untitled rack project')
        setWorkspace(nextWorkspace)
      }

      const payload = buildAssemblyPayload({
        chassisComponents,
        assemblyMeta,
        pcbs,
        assemblyObjects,
      })

      const result = await apiJson('/api/workspace/save-as', {
        workspaceId: nextWorkspace.id,
        projectName: assemblyMeta.project?.name,
        payload,
      })
      setPersistenceStatus({
        state: 'saved',
        message: `Saved as ${result.publicPath || result.projectPath}`,
      })
      return result
    } catch (error) {
      setPersistenceStatus({ state: 'error', message: error.message })
      return null
    }
  }, [assemblyMeta, assemblyObjects, chassisComponents, pcbs, workspace])

  const loadSavedPositions = useCallback(async () => {
    setPersistenceStatus({ state: 'loading', message: 'Loading...' })

    try {
      const payload = await apiGetJson('/api/positions')
      const nextAssemblyMeta = payload.assemblyMeta || DEFAULT_ASSEMBLY_META
      const nextChassisComponents = mergeChassisComponents(payload.chassisComponents)
      setAssemblyMeta(nextAssemblyMeta)
      setChassisComponents(nextChassisComponents)
      setPcbs([])
      setSelectedPcbId(null)
      setSelectedObjectIds([])
      setSelectedComponent(null)
      setAssemblyObjects(normalizeAssemblyObjectsWithMeta(
        payload.assemblyObjects || payload.objects,
        nextChassisComponents,
        nextAssemblyMeta,
      ))
      resetObjectHistory()

      for (const pcb of payload.pcbs || []) {
        await addPcb(pcb.path, pcb)
      }

      const nextWorkspace = await createEmptyWorkspace(
        nextAssemblyMeta.project?.name || 'Loaded rack project',
      )
      setWorkspace(nextWorkspace)
      await apiJson('/api/workspace/save', {
        workspaceId: nextWorkspace.id,
        payload: buildAssemblyPayload({
          assemblyMeta: nextAssemblyMeta,
          chassisComponents: nextChassisComponents,
          pcbs: payload.pcbs || [],
          assemblyObjects: normalizeAssemblyObjectsWithMeta(
            payload.assemblyObjects || payload.objects,
            nextChassisComponents,
            nextAssemblyMeta,
          ),
        }),
      })

      setPersistenceStatus({ state: 'loaded', message: 'Loaded into temporary workspace' })
    } catch (error) {
      setPersistenceStatus({ state: 'error', message: error.message })
    }
  }, [addPcb, resetObjectHistory])

  const reset = useCallback(() => {
    setChassisComponents(createDefaultChassisComponents())
    setAssemblyMeta(DEFAULT_ASSEMBLY_META)
    setPcbs([])
    setAssemblyObjects([])
    resetObjectHistory()
    setSelectedPcbId(null)
    setSelectedObjectIds([])
    setSelectedComponent(null)
    setTransformMode('translate')
    setPcbStatus({ state: 'idle', message: '' })
    setPersistenceStatus({ state: 'idle', message: '' })
    setDrillingStatus({ state: 'idle', message: '', componentId: null })
    setImportReview(null)
    setWorkspace(null)
  }, [resetObjectHistory])

  const acceptImportReview = useCallback(() => {
    setImportReview(null)
  }, [])

  const removeDetectedImportHoles = useCallback(() => {
    setImportReview((currentReview) => {
      if (!currentReview) return currentReview

      const detectedIds = new Set(currentReview.detectedObjectIds)
      setAssemblyObjects((current) => current.filter((object) => !detectedIds.has(object.id)))
      setChassisComponents((current) => current.map((component) => {
        const panelReview = currentReview.panels.find((panel) => panel.id === component.id)
        if (!panelReview?.detected || component.drillState !== 'drilled') return component
        return { ...component, drillState: 'source' }
      }))
      setSelectedObjectIds((current) => current.filter((objectId) => !detectedIds.has(objectId)))
      setSelectedComponent((current) => (
        current?.type === 'object' && detectedIds.has(current.id) ? null : current
      ))
      setPcbStatus((current) => ({
        ...current,
        message: `${current.message || 'Imported project'}; removed detected holes`,
      }))
      return null
    })
  }, [])

  const refreshPath = useCallback(async (changedPath) => {
    const currentState = stateRef.current
    const matchingPcbs = currentState.pcbs.filter((pcb) => pcb.path === changedPath)

    if (matchingPcbs.length === 0) return

    try {
      const resolved = await resolveModel(changedPath)
      const nextResolved = {
        ...resolved,
        url: versionedUrl(resolved.baseUrl),
      }

      setPcbs((current) => current.map((pcb) => (
        pcb.path === changedPath
          ? { ...pcb, ...nextResolved }
          : pcb
      )))
    } catch (error) {
      setPersistenceStatus({ state: 'error', message: `Reload failed: ${error.message}` })
    }
  }, [])

  useEffect(() => {
    const events = new EventSource(`${API_BASE}/api/events`)

    events.onmessage = (message) => {
      try {
        const payload = JSON.parse(message.data)
        if (payload.path && payload.event !== 'ready') {
          refreshPath(payload.path)
        }
      } catch {
        // Ignore malformed event payloads from interrupted connections.
      }
    }

    events.onerror = () => {
      events.close()
    }

    return () => events.close()
  }, [refreshPath])

  return {
    chassisComponents,
    assemblyMeta,
    pcbs,
    assemblyObjects,
    selectedPcbId,
    selectedObjectId,
    selectedObjectIds,
    selectedComponent,
    transformMode,
    pcbStatus,
    persistenceStatus,
    drillingStatus,
    importReview,
    workspace,
    addPcb,
    createNewProject,
    addAssemblyObject,
    addAssemblyObjectGrid,
    importProjectFromFiles,
    removePcb,
    removeAssemblyObject,
    selectPcb,
    selectAssemblyObject,
    mountObjectsOnHoles,
    clearSelection,
    selectAssemblyObjects,
    copySelection,
    cutSelection,
    pasteClipboard,
    duplicateSelection,
    deleteSelection,
    undo,
    redo,
    hasClipboard: clipboard.length > 0,
    setSelectedPcbId,
    setSelectedComponentColor,
    setSelectedComponentTransparency,
    setTransformMode,
    toggleTransformMode,
    drillPanel,
    acceptImportReview,
    removeDetectedImportHoles,
    updateChassisComponent,
    updateChassisComponentMaterial,
    updatePcbTransform,
    updateAssemblyObject,
    moveAssemblyObjectToHost,
    updateAssemblyObjectTransform,
    savePositions,
    saveAsProject,
    loadSavedPositions,
    reset,
  }
}
