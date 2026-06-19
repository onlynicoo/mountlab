import { useCallback, useMemo, useRef, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { TransformControls } from '@react-three/drei'
import * as THREE from 'three'

function opacityFromTransparency(transparency) {
  const number = Number(transparency)
  const normalized = Number.isFinite(number) ? Math.min(100, Math.max(0, number)) : 0
  return 1 - (normalized / 100)
}

function constrainedToPanel(position, rotation, object) {
  const nextPosition = position.clone()
  const nextRotation = rotation.clone()
  const normal = object.normal || [0, 0, 1]
  const basePosition = object.position || [0, 0, 0]
  const baseRotation = object.rotation || [0, 0, 0]

  const dominantAxis = normal
    .map((value) => Math.abs(value))
    .reduce((bestIndex, value, index, values) => (
      value > values[bestIndex] ? index : bestIndex
    ), 0)

  nextPosition.setComponent(dominantAxis, basePosition[dominantAxis] || 0)

  if (dominantAxis === 2) {
    nextRotation.x = baseRotation[0] || 0
    nextRotation.y = baseRotation[1] || 0
  }

  if (dominantAxis === 1) {
    nextRotation.x = baseRotation[0] || 0
    nextRotation.z = baseRotation[2] || 0
  }

  if (dominantAxis === 0) {
    nextRotation.y = baseRotation[1] || 0
    nextRotation.z = baseRotation[2] || 0
  }

  return { position: nextPosition, rotation: nextRotation }
}

function freeRotationAxisName(object) {
  const normal = object.normal || [0, 0, 1]
  const dominantAxis = normal
    .map((value) => Math.abs(value))
    .reduce((bestIndex, value, index, values) => (
      value > values[bestIndex] ? index : bestIndex
    ), 0)
  return ['x', 'y', 'z'][dominantAxis]
}

function holeGuideColors(guideState, selected, hovered) {
  if (selected || hovered) return { ring: '#35ff9a', fill: '#02140b' }
  if (guideState === 'dirty') return { ring: '#f59e0b', fill: '#1f1300' }
  if (guideState === 'applied') return { ring: '#60a5fa', fill: '#020617' }
  return { ring: '#d1d5db', fill: '#020202' }
}

function ParametricObjectMesh({ object, selected, hovered, guideState }) {
  const opacity = opacityFromTransparency(object.transparency)
  const material = useMemo(() => {
    const nextMaterial = new THREE.MeshStandardMaterial({
      color: object.material?.color || '#111111',
      metalness: object.material?.metalness ?? 0.2,
      roughness: object.material?.roughness ?? 0.6,
      transparent: opacity < 1,
      opacity,
      depthWrite: opacity >= 1,
    })

    if (selected || hovered) {
      nextMaterial.emissive = new THREE.Color('#35ff9a')
      nextMaterial.emissiveIntensity = 0.18
    }

    return nextMaterial
  }, [hovered, object.material, opacity, selected])

  const diameter = Math.max(Number(object.params?.diameter) || 10, 0.1)
  const depth = Math.max(Number(object.params?.depth) || 3, 0.1)
  const skirtDiameter = Math.max(Number(object.params?.skirtDiameter) || diameter * 1.16, diameter)
  const pointerLength = Math.max(Number(object.params?.pointerLength) || diameter * 0.44, 0.1)
  const pointerColor = object.params?.pointerColor || '#f4f1de'
  const width = Math.max(Number(object.params?.width) || diameter, 0.1)
  const height = Math.max(Number(object.params?.height) || diameter, 0.1)

  if (object.class === 'knob') {
    return (
      <group>
        <mesh
          material={material}
          castShadow
          receiveShadow
          position={[0, 0, 0.5]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[skirtDiameter / 2, skirtDiameter / 2, 1, 72]} />
        </mesh>
        <mesh
          material={material}
          castShadow
          receiveShadow
          position={[0, 0, 1 + depth / 2]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[diameter / 2, diameter / 2, depth, 96]} />
        </mesh>
        <mesh position={[0, pointerLength * 0.22, depth + 1.08]} castShadow>
          <boxGeometry args={[Math.max(diameter * 0.08, 0.7), pointerLength, 0.36]} />
          <meshStandardMaterial color={pointerColor} roughness={0.3} metalness={0.05} />
        </mesh>
        <mesh position={[0, 0, depth + 1.24]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[Math.max(diameter * 0.08, 0.7), Math.max(diameter * 0.08, 0.7), 0.28, 24]} />
          <meshStandardMaterial color={pointerColor} roughness={0.3} metalness={0.05} />
        </mesh>
      </group>
    )
  }

  if (object.class === 'generic') {
    return (
      <mesh material={material} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
      </mesh>
    )
  }

  const colors = holeGuideColors(guideState, selected, hovered)

  return (
    <group>
      <mesh position={[0, 0, 0.08]} renderOrder={20}>
        <circleGeometry args={[diameter / 2, 64]} />
        <meshStandardMaterial
          color={colors.fill}
          roughness={0.82}
          metalness={0.05}
          transparent
          opacity={guideState === 'applied' ? 0.28 : 0.48}
          polygonOffset
          polygonOffsetFactor={-8}
          polygonOffsetUnits={-8}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, 0, 0.12]} renderOrder={21}>
        <torusGeometry args={[diameter / 2, Math.max(diameter * 0.035, 0.2), 12, 64]} />
        <meshStandardMaterial
          color={colors.ring}
          roughness={0.35}
          metalness={0.2}
        />
      </mesh>
    </group>
  )
}

function AssemblyObjectContent({
  object,
  selected,
  hovered,
  onSelect,
  onHover,
  onPanelDragStart,
  onPanelDragMove,
  onPanelDragEnd,
  groupRef,
  guideState,
}) {
  if (!object.visible) return null

  return (
    <group
      ref={groupRef}
      position={object.position}
      rotation={object.rotation}
      onClick={(event) => {
        event.stopPropagation()
      }}
      onPointerDown={(event) => {
        // Alt+drag is reserved for the viewport marquee selection.
        if (event.altKey) return
        event.stopPropagation()
        const transformModifier = event.ctrlKey || event.metaKey || event.shiftKey
        onSelect(object.id, {
          additive: transformModifier && !selected,
          preserveIfSelected: selected || transformModifier,
          shiftKey: event.shiftKey,
          metaKey: event.metaKey,
          ctrlKey: event.ctrlKey,
          nativeEvent: event.nativeEvent,
        })
        onPanelDragStart(event)
      }}
      onPointerMove={(event) => {
        onPanelDragMove(event)
      }}
      onPointerOver={(event) => {
        event.stopPropagation()
        onHover(true)
      }}
      onPointerOut={(event) => {
        event.stopPropagation()
        onHover(false)
      }}
      onPointerUp={(event) => {
        onPanelDragEnd(event)
      }}
      onPointerCancel={(event) => {
        onPanelDragEnd(event)
      }}
    >
      <ParametricObjectMesh
        object={object}
        selected={selected}
        hovered={hovered}
        guideState={guideState}
      />
    </group>
  )
}

export default function AssemblyObject({
  object,
  selected,
  active = selected,
  mode,
  onSelect,
  onPositionChange,
  onTransformActiveChange,
  guideState = 'draft',
}) {
  const groupRef = useRef()
  const dragStateRef = useRef(null)
  const [controlTarget, setControlTarget] = useState(null)
  const [hovered, setHovered] = useState(false)
  const { gl } = useThree()

  const setObjectGroup = useCallback((node) => {
    groupRef.current = node
    setControlTarget(node)
  }, [])

  const commitTransform = () => {
    if (!groupRef.current) return

    const { position, rotation } = groupRef.current
    const constrained = constrainedToPanel(position, rotation, object)
    groupRef.current.position.copy(constrained.position)
    groupRef.current.rotation.copy(constrained.rotation)

    onPositionChange(
      object.id,
      [constrained.position.x, constrained.position.y, constrained.position.z],
      [constrained.rotation.x, constrained.rotation.y, constrained.rotation.z],
    )
  }

  const dragMode = (event) => {
    if (event.ctrlKey || event.metaKey) return 'translate'
    if (event.shiftKey) return 'rotate'
    return null
  }

  const intersectPanelPlane = (event) => {
    if (!groupRef.current) return null

    const parent = groupRef.current.parent
    const normal = new THREE.Vector3(...(object.normal || [0, 0, 1])).normalize()
    const worldNormal = normal.clone().transformDirection(parent.matrixWorld)
    const planePosition = dragStateRef.current?.startPosition || groupRef.current.position
    const worldPoint = new THREE.Vector3(
      planePosition.x,
      planePosition.y,
      planePosition.z,
    )
    parent.localToWorld(worldPoint)

    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(worldNormal, worldPoint)
    const hit = new THREE.Vector3()
    if (!event.ray.intersectPlane(plane, hit)) return null

    return parent.worldToLocal(hit)
  }

  const startPanelDrag = (event) => {
    // Plain drag (no modifier) leaves the camera free to orbit; transforms are
    // explicit: Ctrl/Cmd+drag = move, Shift+drag = rotate.
    if (!groupRef.current || event.button !== 0 || event.altKey) return

    const mode = dragMode(event)
    if (!mode) return

    const axisName = freeRotationAxisName(object)
    const startHit = intersectPanelPlane({
      ...event,
      ray: event.ray,
    }) || groupRef.current.position.clone()

    dragStateRef.current = {
      pointerId: event.pointerId,
      mode,
      moved: false,
      axisName,
      startClientX: event.nativeEvent?.clientX ?? 0,
      startAngle: groupRef.current.rotation[axisName],
      startPosition: groupRef.current.position.clone(),
      dragOffset: groupRef.current.position.clone().sub(startHit),
    }
    event.target.setPointerCapture?.(event.pointerId)
    gl.domElement.style.cursor = mode === 'rotate' ? 'ew-resize' : 'grabbing'
    onTransformActiveChange(true)
  }

  const movePanelDrag = (event) => {
    const drag = dragStateRef.current
    if (!drag || !groupRef.current) return
    event.stopPropagation()
    drag.moved = true

    if (drag.mode === 'rotate') {
      const clientX = event.nativeEvent?.clientX ?? drag.startClientX
      groupRef.current.rotation[drag.axisName] = drag.startAngle + (clientX - drag.startClientX) * 0.01
      commitTransform()
      return
    }

    const nextPosition = intersectPanelPlane(event)
    if (!nextPosition) return

    nextPosition.add(drag.dragOffset)

    const constrained = constrainedToPanel(
      nextPosition,
      groupRef.current.rotation,
      {
        ...object,
        position: [
          drag.startPosition.x,
          drag.startPosition.y,
          drag.startPosition.z,
        ],
      },
    )

    groupRef.current.position.copy(constrained.position)
    groupRef.current.rotation.copy(constrained.rotation)
    commitTransform()
  }

  const endPanelDrag = (event) => {
    const drag = dragStateRef.current
    if (!drag) return

    event.stopPropagation()
    event.target.releasePointerCapture?.(drag.pointerId)
    dragStateRef.current = null
    gl.domElement.style.cursor = ''
    onTransformActiveChange(false)
    if (drag.moved) commitTransform()
  }

  const content = (
    <AssemblyObjectContent
      object={object}
      selected={selected}
      hovered={hovered}
      onSelect={onSelect}
      onHover={setHovered}
      onPanelDragStart={startPanelDrag}
      onPanelDragMove={movePanelDrag}
      onPanelDragEnd={endPanelDrag}
      groupRef={setObjectGroup}
      guideState={guideState}
    />
  )

  return (
    <>
      {content}
      {active && controlTarget && (
        <TransformControls
          object={controlTarget}
          mode={mode}
          onMouseDown={(event) => event.stopPropagation()}
          onMouseUp={() => {
            onTransformActiveChange(false)
            commitTransform()
          }}
          onObjectChange={commitTransform}
          onDraggingChanged={(event) => {
            onTransformActiveChange(event.value)
            if (!event.value) commitTransform()
          }}
        />
      )}
    </>
  )
}
