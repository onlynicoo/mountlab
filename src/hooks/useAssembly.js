import { useCallback, useEffect, useRef, useState } from 'react'
import { useGLTF } from '@react-three/drei'
import {
  CHASSIS_PART_DEFINITIONS,
  createDefaultChassisComponents,
  findChassisPartDefinition,
  materialFromPreset,
} from '../config/chassisComponents'
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
const DEFAULT_ASSEMBLY_META = { units: 'mm', dimensions: null }

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
    return payload.error || response.statusText
  } catch {
    return response.statusText
  }
}

async function resolveModel(filePath) {
  const trimmedPath = filePath.trim()
  const extension = extensionFor(trimmedPath)

  if (trimmedPath.startsWith('/')) {
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

  return {
    id: pcbIdFor(filePath),
    path: filePath,
    baseUrl: filePath,
    url: versionedUrl(filePath),
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

  return {
    id: definition.id,
    label: definition.label,
    path: filePath,
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

function normalizeDimensions(dimensions) {
  if (!dimensions || typeof dimensions !== 'object') return null

  return Object.fromEntries(
    Object.entries(dimensions)
      .map(([key, value]) => [key, Number(value)])
      .filter(([, value]) => Number.isFinite(value)),
  )
}

function normalizeAssemblyMeta(manifest) {
  return {
    units: typeof manifest?.units === 'string' ? manifest.units : 'mm',
    dimensions: normalizeDimensions(manifest?.dimensions),
  }
}

function mergeChassisComponents(savedComponents) {
  const defaults = createDefaultChassisComponents()
  if (!Array.isArray(savedComponents)) return defaults

  const baseComponents = savedComponents.length > 0 ? savedComponents : defaults
  return baseComponents.map((component) => {
    const defaultComponent = defaults.find((candidate) => candidate.id === component.id)
    return {
      ...(defaultComponent || {}),
      ...component,
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
    material: normalizeMaterial(object?.material, objectClass.material),
    transparency: normalizeTransparency(object?.transparency, DEFAULT_OBJECT_TRANSPARENCY),
    params: {
      ...objectClass.params,
      ...(object?.params || {}),
    },
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
    const fileName = basename(component.path)
    const manifestComponent = manifest.chassis[fileName] || manifest.chassis[component.id]
    if (!manifestComponent) return component

    return {
      ...component,
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

export function useAssembly() {
  const [chassisComponents, setChassisComponents] = useState(createDefaultChassisComponents)
  const [pcbs, setPcbs] = useState([])
  const [assemblyObjects, setAssemblyObjects] = useState([])
  const [assemblyMeta, setAssemblyMeta] = useState(DEFAULT_ASSEMBLY_META)
  const [selectedPcbId, setSelectedPcbId] = useState(null)
  const [selectedObjectId, setSelectedObjectId] = useState(null)
  const [selectedComponent, setSelectedComponent] = useState(null)
  const [transformMode, setTransformMode] = useState('translate')
  const [pcbStatus, setPcbStatus] = useState({ state: 'idle', message: '' })
  const [persistenceStatus, setPersistenceStatus] = useState({ state: 'idle', message: '' })
  const stateRef = useRef({ pcbs })

  useEffect(() => {
    stateRef.current = { pcbs }
  }, [pcbs])

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
    const manifest = await readProjectManifest(files)
    const nextAssemblyMeta = normalizeAssemblyMeta(manifest)

    const publicUrls = files
      .map((file) => inferPublicUrl(file.webkitRelativePath || file.name))
      .filter((filePath) => DIRECT_TYPES.has(extensionFor(filePath)))

    const nextChassisComponents = publicUrls
      .filter((filePath) => extensionFor(filePath) === 'stl')
      .map(createImportedChassisComponent)
      .filter(Boolean)

    const uniqueChassisComponents = sortChassisComponents(
      Array.from(
        new Map(nextChassisComponents.map((component) => [component.id, component])).values(),
      ),
    )

    const nextPcbs = publicUrls
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
    const nextObjects = normalizeAssemblyObjectsWithMeta(
      manifest?.objects,
      nextChassis,
      nextAssemblyMeta,
    )

    setAssemblyMeta(nextAssemblyMeta)
    setChassisComponents(nextChassis)
    setPcbs(nextPcbs)
    setAssemblyObjects(nextObjects)
    setSelectedPcbId(nextPcbs[0]?.id || null)
    setSelectedObjectId(null)
    setSelectedComponent(nextPcbs[0] ? { type: 'pcb', id: nextPcbs[0].id } : null)
    setPcbStatus({
      state: 'loaded',
      message: `Imported ${uniqueChassisComponents.length} chassis parts, ${nextPcbs.length} PCB files, ${nextObjects.length} objects`,
    })
  }, [])

  const removePcb = useCallback((id) => {
    setPcbs((current) => current.filter((pcb) => pcb.id !== id))
    setSelectedPcbId((current) => (current === id ? null : current))
    setSelectedComponent((current) => (current?.type === 'pcb' && current.id === id ? null : current))
  }, [])

  const selectPcb = useCallback((id) => {
    setSelectedPcbId(id)
    setSelectedObjectId(null)
    setSelectedComponent({ type: 'pcb', id })
  }, [])

  const addAssemblyObject = useCallback((className, hostId = DEFAULT_OBJECT_HOST_ID) => {
    const object = createAssemblyObject(className, hostId, assemblyMeta.dimensions)
    setAssemblyObjects((current) => [...current, object])
    setSelectedPcbId(null)
    setSelectedObjectId(object.id)
    setSelectedComponent({ type: 'object', id: object.id })
    return object
  }, [assemblyMeta.dimensions])

  const removeAssemblyObject = useCallback((id) => {
    setAssemblyObjects((current) => current.filter((object) => object.id !== id))
    setSelectedObjectId((current) => (current === id ? null : current))
    setSelectedComponent((current) => (current?.type === 'object' && current.id === id ? null : current))
  }, [])

  const selectAssemblyObject = useCallback((id) => {
    setSelectedPcbId(null)
    setSelectedObjectId(id)
    setSelectedComponent({ type: 'object', id })
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedPcbId(null)
    setSelectedObjectId(null)
    setSelectedComponent(null)
  }, [])

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
    setAssemblyObjects((current) => current.map((object) => (
      object.id === id
        ? {
          ...object,
          ...updates,
          params: updates.params ? { ...object.params, ...updates.params } : object.params,
          material: updates.material ? { ...object.material, ...updates.material } : object.material,
        }
        : object
    )))
  }, [])

  const moveAssemblyObjectToHost = useCallback((id, hostId) => {
    const placement = getHostPlacement(hostId, assemblyMeta.dimensions)

    setAssemblyObjects((current) => current.map((object) => (
      object.id === id
        ? {
          ...object,
          hostId,
          position: [...placement.position],
          rotation: [...placement.rotation],
          normal: [...placement.normal],
        }
        : object
    )))
  }, [assemblyMeta.dimensions])

  const updateAssemblyObjectTransform = useCallback((id, position, rotation) => {
    setAssemblyObjects((current) => current.map((object) => (
      object.id === id
        ? {
          ...object,
          ...constrainObjectToPanelTransform(object, position, rotation),
        }
        : object
    )))
  }, [])

  const toggleTransformMode = useCallback(() => {
    setTransformMode((current) => (current === 'translate' ? 'rotate' : 'translate'))
  }, [])

  const savePositions = useCallback(async () => {
    setPersistenceStatus({ state: 'saving', message: 'Saving...' })

    try {
      const payload = {
        chassisComponents,
        assemblyMeta,
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

      const response = await fetch(`${API_BASE}/api/positions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error(await readError(response))
      }

      setPersistenceStatus({ state: 'saved', message: 'Saved' })
    } catch (error) {
      setPersistenceStatus({ state: 'error', message: error.message })
    }
  }, [assemblyMeta, assemblyObjects, chassisComponents, pcbs])

  const loadSavedPositions = useCallback(async () => {
    setPersistenceStatus({ state: 'loading', message: 'Loading...' })

    try {
      const response = await fetch(`${API_BASE}/api/positions`)
      if (!response.ok) {
        throw new Error(await readError(response))
      }

      const payload = await response.json()
      const nextAssemblyMeta = payload.assemblyMeta || DEFAULT_ASSEMBLY_META
      const nextChassisComponents = mergeChassisComponents(payload.chassisComponents)
      setAssemblyMeta(nextAssemblyMeta)
      setChassisComponents(nextChassisComponents)
      setPcbs([])
      setSelectedPcbId(null)
      setSelectedObjectId(null)
      setSelectedComponent(null)
      setAssemblyObjects(normalizeAssemblyObjectsWithMeta(
        payload.assemblyObjects || payload.objects,
        nextChassisComponents,
        nextAssemblyMeta,
      ))

      for (const pcb of payload.pcbs || []) {
        await addPcb(pcb.path, pcb)
      }

      setPersistenceStatus({ state: 'loaded', message: 'Loaded' })
    } catch (error) {
      setPersistenceStatus({ state: 'error', message: error.message })
    }
  }, [addPcb])

  const reset = useCallback(() => {
    setChassisComponents(createDefaultChassisComponents())
    setAssemblyMeta(DEFAULT_ASSEMBLY_META)
    setPcbs([])
    setAssemblyObjects([])
    setSelectedPcbId(null)
    setSelectedObjectId(null)
    setSelectedComponent(null)
    setTransformMode('translate')
    setPcbStatus({ state: 'idle', message: '' })
    setPersistenceStatus({ state: 'idle', message: '' })
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
    pcbs,
    assemblyObjects,
    selectedPcbId,
    selectedObjectId,
    selectedComponent,
    transformMode,
    pcbStatus,
    persistenceStatus,
    addPcb,
    addAssemblyObject,
    importProjectFromFiles,
    removePcb,
    removeAssemblyObject,
    selectPcb,
    selectAssemblyObject,
    clearSelection,
    setSelectedPcbId,
    setSelectedComponentColor,
    setSelectedComponentTransparency,
    setTransformMode,
    toggleTransformMode,
    updateChassisComponent,
    updateChassisComponentMaterial,
    updatePcbTransform,
    updateAssemblyObject,
    moveAssemblyObjectToHost,
    updateAssemblyObjectTransform,
    savePositions,
    loadSavedPositions,
    reset,
  }
}
