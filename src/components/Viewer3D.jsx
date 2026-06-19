import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import {
  ContactShadows,
  Environment,
  OrbitControls,
} from '@react-three/drei'
import * as THREE from 'three'
import ChassisAssembly from './ChassisAssembly'
import DraggablePCB from './DraggablePCB'
import AssemblyObject from './AssemblyObject'
import { ASSEMBLY_OBJECT_CLASSES } from '../config/assemblyObjects'

function LoadingFallback() {
  return (
    <mesh>
      <boxGeometry args={[0.08, 0.08, 0.08]} />
      <meshStandardMaterial color="#c9920a" wireframe />
    </mesh>
  )
}

const VIEW_DIRECTIONS = {
  front: new THREE.Vector3(0, 0, 1),
  back: new THREE.Vector3(0, 0, -1),
  left: new THREE.Vector3(-1, 0, 0),
  right: new THREE.Vector3(1, 0, 0),
  top: new THREE.Vector3(0, 1, 0),
}

function EyeIcon({ visible }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    >
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.5" />
      {!visible && <path d="M4 20 20 4" />}
    </svg>
  )
}

function TriangleIcon({ expanded }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className={`h-3 w-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
      fill="currentColor"
    >
      <path d="M6 3.75 11 8l-5 4.25V3.75Z" />
    </svg>
  )
}

function VisibilityToggle({ visible, label, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={`${visible ? 'Hide' : 'Show'} ${label}`}
      aria-label={`${visible ? 'Hide' : 'Show'} ${label}`}
      aria-pressed={visible}
      className={`grid h-7 w-7 shrink-0 place-items-center rounded border transition ${
        visible
          ? 'border-emerald-600/70 bg-emerald-950/60 text-emerald-200 hover:border-emerald-400'
          : 'border-neutral-700 bg-neutral-950 text-neutral-500 hover:border-neutral-500 hover:text-neutral-200'
      }`}
    >
      <EyeIcon visible={visible} />
    </button>
  )
}

function objectTypeLabel(type) {
  if (!type) return ''
  return type.slice(0, 1).toUpperCase()
}

function objectClassLabel(objectClass) {
  return objectClass.id === 'generic' ? 'Generic Component' : objectClass.label
}

function panelStatus(component, children) {
  if (component.drillState === 'dirty') return { label: 'Needs bake', className: 'bg-amber-950/70 text-amber-200' }
  if (component.drillState === 'drilled') return { label: 'Imported', className: 'bg-sky-950/70 text-sky-200' }
  if (component.drillState === 'generated') return { label: 'Generated', className: 'bg-neutral-900 text-neutral-400' }
  if (children.some((object) => object.source === 'detected')) {
    return { label: 'Detected', className: 'bg-emerald-950/70 text-emerald-200' }
  }
  return { label: 'Source', className: 'bg-neutral-900 text-neutral-500' }
}

function objectStatus(object) {
  if (object.status === 'edited') return { label: 'Edited', className: 'bg-amber-950/70 text-amber-200' }
  if (object.source === 'detected') return { label: 'Detected', className: 'bg-emerald-950/70 text-emerald-200' }
  return null
}

function SceneVisibilityPalette({
  chassisComponents,
  assemblyObjects,
  selectedObjectIds = [],
  activeHostId,
  addAssemblyObject,
  updateChassisComponent,
  updateAssemblyObject,
  selectAssemblyObject,
  selectHost,
}) {
  const [collapsedPanels, setCollapsedPanels] = useState({})
  const [openAddMenuId, setOpenAddMenuId] = useState(null)
  const objectsByHost = useMemo(() => {
    const grouped = new Map()
    assemblyObjects.forEach((object) => {
      const current = grouped.get(object.hostId) || []
      current.push(object)
      grouped.set(object.hostId, current)
    })
    return grouped
  }, [assemblyObjects])

  const togglePanel = (componentId) => {
    setCollapsedPanels((current) => ({
      ...current,
      [componentId]: !current[componentId],
    }))
  }

  return (
    <div className="absolute bottom-4 left-4 z-10 w-[246px] max-w-[calc(100%-2rem)] rounded border border-neutral-700 bg-neutral-950/90 p-2 text-neutral-100 shadow-2xl backdrop-blur">
      <div className="mb-1 flex items-center justify-between gap-2 px-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
          Visibility
        </p>
        <span className="text-[10px] text-neutral-600">
          {chassisComponents.length + assemblyObjects.length}
        </span>
      </div>

      <div className="max-h-[34vh] space-y-1 overflow-y-auto pr-1">
        {chassisComponents.map((component) => {
          const children = objectsByHost.get(component.id) || []
          const expanded = !collapsedPanels[component.id]
          const addMenuOpen = openAddMenuId === component.id
          const active = activeHostId === component.id
          const status = panelStatus(component, children)

          return (
            <div key={component.id}>
              <div className={`relative flex h-8 items-center gap-1 rounded px-1 transition ${
                active ? 'bg-amber-950/35' : 'hover:bg-neutral-900/80'
              }`}
              >
                <button
                  type="button"
                  onClick={() => togglePanel(component.id)}
                  className={`grid h-6 w-5 shrink-0 place-items-center rounded text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-200 ${
                    children.length === 0 ? 'opacity-30' : ''
                  }`}
                  aria-label={`${expanded ? 'Collapse' : 'Expand'} ${component.label}`}
                  aria-expanded={expanded}
                  disabled={children.length === 0}
                >
                  <TriangleIcon expanded={expanded} />
                </button>
                <VisibilityToggle
                  visible={component.visible}
                  label={component.label}
                  onToggle={() => updateChassisComponent(component.id, {
                    visible: !component.visible,
                  })}
                />
                <button
                  type="button"
                  onClick={() => selectHost(component.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className={`block truncate text-xs ${
                    active ? 'text-amber-100' : 'text-neutral-200'
                  }`}
                  >
                    {component.label}
                  </span>
                </button>
                {children.length > 0 && (
                  <span className="rounded bg-neutral-900 px-1.5 py-0.5 text-[10px] text-neutral-500">
                    {children.length}
                  </span>
                )}
                <span className={`hidden rounded px-1.5 py-0.5 text-[10px] sm:inline ${status.className}`}>
                  {status.label}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    selectHost(component.id)
                    setOpenAddMenuId(addMenuOpen ? null : component.id)
                  }}
                  title={`Add component to ${component.label}`}
                  aria-label={`Add component to ${component.label}`}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded border border-neutral-700 bg-neutral-900 text-sm font-semibold leading-none text-neutral-200 transition hover:border-amber-500 hover:bg-neutral-800 hover:text-amber-200"
                >
                  +
                </button>

                {addMenuOpen && (
                  <div className="absolute right-0 top-8 z-30 w-36 overflow-hidden rounded border border-neutral-700 bg-neutral-950 shadow-2xl">
                    {ASSEMBLY_OBJECT_CLASSES.map((objectClass) => (
                      <button
                        key={objectClass.id}
                        type="button"
                        onClick={() => {
                          selectHost(component.id)
                          addAssemblyObject(objectClass.id, component.id)
                          setCollapsedPanels((current) => ({
                            ...current,
                            [component.id]: false,
                          }))
                          setOpenAddMenuId(null)
                        }}
                        className="block w-full px-3 py-2 text-left text-xs text-neutral-200 transition hover:bg-neutral-800 hover:text-amber-200"
                      >
                        {objectClassLabel(objectClass)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {expanded && children.length > 0 && (
                <div className="ml-[17px] mt-1 space-y-1 border-l border-neutral-800 pl-2">
                  {children.map((object) => {
                    const status = objectStatus(object)

                    return (
                      <div
                        key={object.id}
                        className={`flex h-8 items-center gap-2 rounded px-1 transition ${
                          selectedObjectIds.includes(object.id)
                            ? 'bg-amber-950/40'
                            : 'hover:bg-neutral-900/80'
                        }`}
                      >
                        <VisibilityToggle
                          visible={object.visible}
                          label={object.label}
                          onToggle={() => updateAssemblyObject(object.id, {
                            visible: !object.visible,
                          })}
                        />
                        <button
                          type="button"
                          onClick={(event) => selectAssemblyObject(object.id, event)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <span className="block truncate text-xs text-neutral-200">
                            {object.label}
                          </span>
                        </button>
                        {status && (
                          <span className={`rounded px-1.5 py-0.5 text-[10px] ${status.className}`}>
                            {status.label}
                          </span>
                        )}
                        <span
                          className="grid h-5 w-5 shrink-0 place-items-center rounded bg-neutral-900 text-[10px] uppercase text-neutral-500"
                          title={object.class}
                        >
                          {objectTypeLabel(object.class)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function getBox(object) {
  const box = new THREE.Box3().setFromObject(object)
  if (box.isEmpty()) return null
  return box
}

function centimeterStepForObject(object) {
  const box = getBox(object)
  if (!box) return 0.01

  const size = new THREE.Vector3()
  box.getSize(size)
  const maxSize = Math.max(size.x, size.y, size.z)

  return maxSize > 10 ? 10 : 0.01
}

function fitCameraToObject(camera, controls, object, directionOverride = null) {
  const box = getBox(object)
  if (!box) return

  const center = new THREE.Vector3()
  const size = new THREE.Vector3()
  box.getCenter(center)
  box.getSize(size)

  const maxSize = Math.max(size.x, size.y, size.z)
  const radius = Math.max(maxSize * 0.5, 0.01)
  const fov = THREE.MathUtils.degToRad(camera.fov)
  const fitDistance = Math.max(radius / Math.sin(fov / 2), radius * 2.4)
  const direction = directionOverride
    ? directionOverride.clone().normalize()
    : camera.position.clone().sub(controls?.target || center).normalize()

  if (direction.lengthSq() === 0) {
    direction.set(0, 0.35, 1).normalize()
  }

  camera.position.copy(center).add(direction.multiplyScalar(fitDistance * 1.15))
  camera.near = Math.max(fitDistance / 1000, 0.001)
  camera.far = fitDistance * 1000
  camera.updateProjectionMatrix()

  if (controls) {
    controls.target.copy(center)
    controls.minDistance = Math.max(fitDistance * 0.04, 0.001)
    controls.maxDistance = fitDistance * 12
    controls.update()
  }
}

function CameraRig({ command, contentRef, fitSignature }) {
  const { camera, controls } = useThree()

  const fitCurrentView = useCallback((direction = null) => {
    if (!contentRef.current) return
    fitCameraToObject(camera, controls, contentRef.current, direction)
  }, [camera, contentRef, controls])

  useEffect(() => {
    const frame = requestAnimationFrame(() => fitCurrentView())
    return () => cancelAnimationFrame(frame)
  }, [fitCurrentView, fitSignature])

  useEffect(() => {
    if (!command) return

    if (command.type === 'fit') {
      fitCurrentView()
      return
    }

    if (command.type.startsWith('view_')) {
      const viewName = command.type.replace('view_', '')
      fitCurrentView(VIEW_DIRECTIONS[viewName])
      return
    }

    if (!controls) return

    const target = controls.target
    const cameraToTarget = camera.position.clone().sub(target)

    if (command.type === 'zoom_in' || command.type === 'zoom_out') {
      const factor = command.type === 'zoom_in' ? 0.8 : 1.25
      camera.position.copy(target).add(cameraToTarget.multiplyScalar(factor))
      controls.update()
      return
    }

    if (command.type === 'pan_left' || command.type === 'pan_right') {
      const step = contentRef.current ? centimeterStepForObject(contentRef.current) : 0.01
      const distance = command.type === 'pan_right' ? step : -step
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).normalize()
      const delta = right.multiplyScalar(distance)
      camera.position.add(delta)
      target.add(delta)
      controls.update()
    }
  }, [camera, command, contentRef, controls, fitCurrentView])

  return null
}

function ViewportRefBridge({ cameraRef, glRef }) {
  const { camera, gl } = useThree()

  useEffect(() => {
    cameraRef.current = camera
    glRef.current = gl
  }, [camera, gl, cameraRef, glRef])

  return null
}

function SceneContents({
  chassisComponents,
  assemblyMeta,
  pcbs,
  assemblyObjects,
  selectedPcbId,
  selectedObjectId,
  selectedObjectIds = [],
  transformMode,
  disableOrbit = false,
  selectPcb,
  selectAssemblyObject,
  clearSelection,
  updatePcbTransform,
  updateAssemblyObjectTransform,
  toggleTransformMode,
  cameraCommand,
}) {
  const [transformActive, setTransformActive] = useState(false)
  const contentRef = useRef()
  const fitSignature = useMemo(() => JSON.stringify({
    dimensions: assemblyMeta?.dimensions || null,
    chassis: chassisComponents.map((component) => ({
      id: component.id,
      path: component.path,
      visible: component.visible,
    })),
    pcbs: pcbs.map((pcb) => ({
      id: pcb.id,
      url: pcb.url,
    })),
  }), [assemblyMeta, chassisComponents, pcbs])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        clearSelection()
      }

      if (event.key.toLowerCase() === 'r') {
        toggleTransformMode()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [clearSelection, toggleTransformMode])

  return (
    <>
      <Environment preset="studio" />
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[2, 4, 2]}
        intensity={1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <ContactShadows position={[0, -0.01, 0]} opacity={0.4} scale={2} blur={2} />
      <OrbitControls
        makeDefault
        enabled={!transformActive && !disableOrbit}
        enableDamping
        dampingFactor={0.08}
        enablePan
        screenSpacePanning
        mouseButtons={{
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.PAN,
          RIGHT: THREE.MOUSE.PAN,
        }}
        minDistance={0.05}
        maxDistance={1000}
      />
      <CameraRig
        command={cameraCommand}
        contentRef={contentRef}
        fitSignature={fitSignature}
      />

      <group ref={contentRef}>
        <ChassisAssembly
          components={chassisComponents}
          dimensions={assemblyMeta?.dimensions}
        />
        {assemblyObjects.map((object) => {
          const hostComponent = chassisComponents.find((component) => component.id === object.hostId)
          return (
            <group
              key={object.id}
              position={hostComponent?.position || [0, 0, 0]}
              rotation={hostComponent?.rotation || [0, 0, 0]}
            >
              <AssemblyObject
                object={object}
                guideState={
                  object.class !== 'hole'
                    ? 'draft'
                    : hostComponent?.drillState === 'dirty'
                      ? 'dirty'
                      : hostComponent?.drillState === 'drilled'
                        ? 'applied'
                        : 'draft'
                }
                selected={selectedObjectIds.includes(object.id)}
                active={selectedObjectId === object.id}
                mode={transformMode}
                onSelect={selectAssemblyObject}
                onPositionChange={updateAssemblyObjectTransform}
                onTransformActiveChange={setTransformActive}
              />
            </group>
          )
        })}
        {pcbs.map((pcb) => (
          <DraggablePCB
            key={pcb.id}
            pcb={pcb}
            selected={selectedPcbId === pcb.id}
            mode={transformMode}
            onSelect={selectPcb}
            onPositionChange={updatePcbTransform}
            onTransformActiveChange={setTransformActive}
          />
        ))}
      </group>
    </>
  )
}

export default function Viewer3D({
  chassisComponents,
  assemblyMeta,
  pcbs,
  assemblyObjects,
  selectedPcbId,
  selectedObjectId,
  selectedObjectIds = [],
  activeHostId,
  transformMode,
  selectPcb,
  selectAssemblyObject,
  selectAssemblyObjects,
  selectHost,
  clearSelection,
  updatePcbTransform,
  updateAssemblyObjectTransform,
  addAssemblyObject,
  updateChassisComponent,
  updateAssemblyObject,
  toggleTransformMode,
  externalCameraCommand = null,
}) {
  const dimensions = assemblyMeta?.dimensions
  const projectName = assemblyMeta?.project?.name

  const cameraRef = useRef()
  const glRef = useRef()
  const marqueeStartRef = useRef(null)
  const marqueeActiveRef = useRef(false)
  const [marquee, setMarquee] = useState(null)
  const [altActive, setAltActive] = useState(false)

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Alt') setAltActive(true)
    }
    const onKeyUp = (event) => {
      if (event.key === 'Alt') setAltActive(false)
    }
    const onBlur = () => setAltActive(false)

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  const beginMarquee = (event) => {
    if (event.button !== 0 || !event.altKey) return
    const canvas = glRef.current?.domElement
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    marqueeStartRef.current = { x, y, rect, additive: event.shiftKey }
    marqueeActiveRef.current = true
    setMarquee({ x0: x, y0: y, x1: x, y1: y })
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const moveMarquee = (event) => {
    const start = marqueeStartRef.current
    if (!start) return
    setMarquee({
      x0: start.x,
      y0: start.y,
      x1: event.clientX - start.rect.left,
      y1: event.clientY - start.rect.top,
    })
  }

  const endMarquee = (event) => {
    const start = marqueeStartRef.current
    if (!start) return
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    marqueeStartRef.current = null
    setMarquee(null)

    const { rect } = start
    const x1 = event.clientX - rect.left
    const y1 = event.clientY - rect.top
    const minX = Math.min(start.x, x1)
    const maxX = Math.max(start.x, x1)
    const minY = Math.min(start.y, y1)
    const maxY = Math.max(start.y, y1)
    const camera = cameraRef.current
    const dragged = (maxX - minX) > 3 || (maxY - minY) > 3

    if (camera && dragged) {
      const point = new THREE.Vector3()
      const matched = assemblyObjects.filter((object) => {
        if (object.visible === false) return false
        const host = chassisComponents.find((component) => component.id === object.hostId)
        point.set(...(object.position || [0, 0, 0]))
        if (host) {
          point.applyEuler(new THREE.Euler(...(host.rotation || [0, 0, 0])))
          point.add(new THREE.Vector3(...(host.position || [0, 0, 0])))
        }
        point.project(camera)
        if (point.z < -1 || point.z > 1) return false
        const screenX = (point.x * 0.5 + 0.5) * rect.width
        const screenY = (-point.y * 0.5 + 0.5) * rect.height
        return screenX >= minX && screenX <= maxX && screenY >= minY && screenY <= maxY
      }).map((object) => object.id)

      if (matched.length > 0) {
        selectAssemblyObjects?.(matched, { additive: start.additive })
      } else if (!start.additive) {
        clearSelection()
      }
    }

    // Keep the flag set until after the Canvas onPointerMissed fires so a
    // marquee drag does not also clear the freshly made selection.
    setTimeout(() => {
      marqueeActiveRef.current = false
    }, 0)
  }

  const disableOrbit = altActive || Boolean(marquee)

  return (
    <div
      className={`relative h-full min-h-[420px] w-full bg-[#080b0d] ${altActive ? 'cursor-crosshair' : ''}`}
      onPointerDown={beginMarquee}
      onPointerMove={moveMarquee}
      onPointerUp={endMarquee}
      onPointerCancel={endMarquee}
    >
      {dimensions && (
        <div className="absolute right-4 bottom-4 z-10 w-[236px] rounded border border-neutral-700 bg-neutral-950/90 p-3 text-neutral-100 shadow-2xl backdrop-blur">
          <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-500">
            {projectName || 'Rack chassis'}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            <span className="text-neutral-500">Width</span>
            <span className="text-right text-neutral-200">{dimensions.width} mm</span>
            <span className="text-neutral-500">Height</span>
            <span className="text-right text-neutral-200">{dimensions.height} mm</span>
            <span className="text-neutral-500">Depth</span>
            <span className="text-right text-neutral-200">{dimensions.depth} mm</span>
            <span className="text-neutral-500">Rack</span>
            <span className="text-right text-neutral-200">{dimensions.rack_units || '-'}U</span>
          </div>
        </div>
      )}
      <SceneVisibilityPalette
        chassisComponents={chassisComponents}
        assemblyObjects={assemblyObjects}
        selectedObjectIds={selectedObjectIds}
        activeHostId={activeHostId}
        updateChassisComponent={updateChassisComponent}
        updateAssemblyObject={updateAssemblyObject}
        selectAssemblyObject={selectAssemblyObject}
        selectHost={selectHost}
        addAssemblyObject={addAssemblyObject}
      />
      {marquee && (
        <div
          className="pointer-events-none absolute z-20 rounded-sm border border-amber-400/80 bg-amber-400/10"
          style={{
            left: Math.min(marquee.x0, marquee.x1),
            top: Math.min(marquee.y0, marquee.y1),
            width: Math.abs(marquee.x1 - marquee.x0),
            height: Math.abs(marquee.y1 - marquee.y0),
          }}
        />
      )}
      <Canvas
        shadows
        camera={{ position: [0, 0.3, 0.8], fov: 45 }}
        gl={{ antialias: true }}
        onPointerMissed={() => {
          if (!marqueeActiveRef.current) clearSelection()
        }}
      >
        <ViewportRefBridge cameraRef={cameraRef} glRef={glRef} />
        <Suspense fallback={<LoadingFallback />}>
          <SceneContents
            chassisComponents={chassisComponents}
            assemblyMeta={assemblyMeta}
            pcbs={pcbs}
            assemblyObjects={assemblyObjects}
            selectedPcbId={selectedPcbId}
            selectedObjectId={selectedObjectId}
            selectedObjectIds={selectedObjectIds}
            transformMode={transformMode}
            disableOrbit={disableOrbit}
            selectPcb={selectPcb}
            selectAssemblyObject={selectAssemblyObject}
            clearSelection={clearSelection}
            updatePcbTransform={updatePcbTransform}
            updateAssemblyObjectTransform={updateAssemblyObjectTransform}
            toggleTransformMode={toggleTransformMode}
            cameraCommand={externalCameraCommand}
          />
        </Suspense>
      </Canvas>
    </div>
  )
}
