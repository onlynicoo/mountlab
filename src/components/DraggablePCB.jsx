import { useRef, useState } from 'react'
import { TransformControls } from '@react-three/drei'
import ModelLoader from './ModelLoader'

function PcbContent({
  pcb,
  selected,
  hovered,
  onSelect,
  onHover,
  onTransformChange,
  groupRef,
}) {
  return (
    <group
      ref={groupRef}
      position={pcb.position}
      rotation={pcb.rotation}
      onClick={(event) => {
        event.stopPropagation()
        onSelect(pcb.id)
      }}
      onPointerOver={(event) => {
        event.stopPropagation()
        onHover(true)
      }}
      onPointerOut={(event) => {
        event.stopPropagation()
        onHover(false)
      }}
      onPointerUp={() => onTransformChange()}
    >
      <ModelLoader
        url={pcb.url}
        type={pcb.type}
        role="pcb"
        highlighted={selected || hovered}
        color={pcb.color}
        transparency={pcb.transparency}
      />
    </group>
  )
}

export default function DraggablePCB({
  pcb,
  selected,
  mode,
  onSelect,
  onPositionChange,
  onTransformActiveChange,
}) {
  const groupRef = useRef()
  const [hovered, setHovered] = useState(false)

  const commitTransform = () => {
    if (!groupRef.current) return

    const { position, rotation } = groupRef.current
    onPositionChange(
      pcb.id,
      [position.x, position.y, position.z],
      [rotation.x, rotation.y, rotation.z],
    )
  }

  const content = (
    <PcbContent
      pcb={pcb}
      selected={selected}
      hovered={hovered}
      onSelect={onSelect}
      onHover={setHovered}
      onTransformChange={commitTransform}
      groupRef={groupRef}
    />
  )

  if (!selected) return content

  return (
    <TransformControls
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
    >
      {content}
    </TransformControls>
  )
}
