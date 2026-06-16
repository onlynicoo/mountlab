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

function ParametricObjectMesh({ object, selected, hovered }) {
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
  const width = Math.max(Number(object.params?.width) || diameter, 0.1)
  const height = Math.max(Number(object.params?.height) || diameter, 0.1)

  if (object.class === 'knob') {
    return (
      <group>
        <mesh material={material} castShadow receiveShadow rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[diameter / 2, diameter / 2, depth, 48]} />
        </mesh>
        <mesh position={[0, 0, depth / 2 + 0.4]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[diameter * 0.08, diameter * 0.08, 0.8, 24]} />
          <meshStandardMaterial color="#f4f1de" roughness={0.45} metalness={0.1} />
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

  return (
    <group>
      <mesh position={[0, 0, 0.08]} renderOrder={20}>
        <circleGeometry args={[diameter / 2, 64]} />
        <meshStandardMaterial
          color="#020202"
          roughness={0.82}
          metalness={0.05}
          polygonOffset
          polygonOffsetFactor={-8}
          polygonOffsetUnits={-8}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, 0, 0.12]} renderOrder={21}>
        <torusGeometry args={[diameter / 2, Math.max(diameter * 0.035, 0.2), 12, 64]} />
        <meshStandardMaterial
          color={selected || hovered ? '#35ff9a' : '#d1d5db'}
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
  onTransformChange,
  onPanelDragStart,
  onPanelDragMove,
  onPanelDragEnd,
  groupRef,
}) {
  if (!object.visible) return null

  return (
    <group
      ref={groupRef}
      position={object.position}
      rotation={object.rotation}
      onClick={(event) => {
        event.stopPropagation()
        onSelect(object.id)
      }}
      onPointerDown={(event) => {
        event.stopPropagation()
        onSelect(object.id)
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
        onTransformChange()
      }}
      onPointerCancel={(event) => {
        onPanelDragEnd(event)
        onTransformChange()
      }}
    >
      <ParametricObjectMesh object={object} selected={selected} hovered={hovered} />
    </group>
  )
}

export default function AssemblyObject({
  object,
  selected,
  mode,
  onSelect,
  onPositionChange,
  onTransformActiveChange,
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
    if (!groupRef.current || event.button !== 0) return

    const startHit = intersectPanelPlane({
      ...event,
      ray: event.ray,
    }) || groupRef.current.position.clone()

    dragStateRef.current = {
      pointerId: event.pointerId,
      startPosition: groupRef.current.position.clone(),
      dragOffset: groupRef.current.position.clone().sub(startHit),
    }
    event.target.setPointerCapture?.(event.pointerId)
    gl.domElement.style.cursor = 'grabbing'
    onTransformActiveChange(true)
  }

  const movePanelDrag = (event) => {
    if (!dragStateRef.current || !groupRef.current) return
    event.stopPropagation()

    const nextPosition = intersectPanelPlane(event)
    if (!nextPosition) return

    nextPosition.add(dragStateRef.current.dragOffset)

    const constrained = constrainedToPanel(
      nextPosition,
      groupRef.current.rotation,
      {
        ...object,
        position: [
          dragStateRef.current.startPosition.x,
          dragStateRef.current.startPosition.y,
          dragStateRef.current.startPosition.z,
        ],
      },
    )

    groupRef.current.position.copy(constrained.position)
    groupRef.current.rotation.copy(constrained.rotation)
    commitTransform()
  }

  const endPanelDrag = (event) => {
    if (!dragStateRef.current) return

    event.stopPropagation()
    event.target.releasePointerCapture?.(dragStateRef.current.pointerId)
    dragStateRef.current = null
    gl.domElement.style.cursor = ''
    onTransformActiveChange(false)
    commitTransform()
  }

  const content = (
    <AssemblyObjectContent
      object={object}
      selected={selected}
      hovered={hovered}
      onSelect={onSelect}
      onHover={setHovered}
      onTransformChange={commitTransform}
      onPanelDragStart={startPanelDrag}
      onPanelDragMove={movePanelDrag}
      onPanelDragEnd={endPanelDrag}
      groupRef={setObjectGroup}
    />
  )

  return (
    <>
      {content}
      {selected && controlTarget && (
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
