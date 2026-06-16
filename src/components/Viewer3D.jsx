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

function ControlsBar({ onCommand }) {
  const buttons = [
    ['fit', 'Fit'],
    ['zoom_out', '- Zoom'],
    ['zoom_in', '+ Zoom'],
    ['pan_left', 'Left 1cm'],
    ['pan_right', 'Right 1cm'],
    ['view_front', 'Front'],
    ['view_back', 'Back'],
    ['view_left', 'Left side'],
    ['view_right', 'Right side'],
    ['view_top', 'Top'],
  ]

  return (
    <div className="absolute left-1/2 top-4 z-10 flex max-w-[calc(100%-2rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded border border-neutral-700 bg-neutral-950/90 p-2 shadow-2xl backdrop-blur">
      {buttons.map(([command, label]) => (
        <button
          key={command}
          type="button"
          onClick={() => onCommand(command)}
          className="rounded border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-100 transition hover:border-amber-500 hover:bg-neutral-800"
        >
          {label}
        </button>
      ))}
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

function SceneContents({
  chassisComponents,
  pcbs,
  assemblyObjects,
  selectedPcbId,
  selectedObjectId,
  transformMode,
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
    chassis: chassisComponents.map((component) => ({
      id: component.id,
      path: component.path,
      visible: component.visible,
    })),
    pcbs: pcbs.map((pcb) => ({
      id: pcb.id,
      url: pcb.url,
    })),
  }), [chassisComponents, pcbs])

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
        enabled={!transformActive}
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
        <ChassisAssembly components={chassisComponents} />
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
                selected={selectedObjectId === object.id}
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
  pcbs,
  assemblyObjects,
  selectedPcbId,
  selectedObjectId,
  transformMode,
  selectPcb,
  selectAssemblyObject,
  clearSelection,
  updatePcbTransform,
  updateAssemblyObjectTransform,
  toggleTransformMode,
}) {
  const [cameraCommand, setCameraCommand] = useState(null)
  const sendCameraCommand = useCallback((type) => {
    setCameraCommand({ type, timestamp: Date.now() })
  }, [])

  return (
    <div className="relative h-full min-h-[420px] w-full bg-[#080b0d]">
      <ControlsBar onCommand={sendCameraCommand} />
      <Canvas
        shadows
        camera={{ position: [0, 0.3, 0.8], fov: 45 }}
        gl={{ antialias: true }}
        onPointerMissed={() => clearSelection()}
      >
        <Suspense fallback={<LoadingFallback />}>
          <SceneContents
            chassisComponents={chassisComponents}
            pcbs={pcbs}
            assemblyObjects={assemblyObjects}
            selectedPcbId={selectedPcbId}
            selectedObjectId={selectedObjectId}
            transformMode={transformMode}
            selectPcb={selectPcb}
            selectAssemblyObject={selectAssemblyObject}
            clearSelection={clearSelection}
            updatePcbTransform={updatePcbTransform}
            updateAssemblyObjectTransform={updateAssemblyObjectTransform}
            toggleTransformMode={toggleTransformMode}
            cameraCommand={cameraCommand}
          />
        </Suspense>
      </Canvas>
    </div>
  )
}
