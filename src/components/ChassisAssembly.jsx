import { Component } from 'react'
import AssemblyModel from './AssemblyModel'

const DEFAULT_DIMENSIONS = {
  width: 482.6,
  height: 88.9,
  depth: 200,
}

function materialProps(component) {
  const material = component.material || {}
  const opacity = Number(component.opacity)
  const resolvedOpacity = Number.isFinite(opacity) ? Math.min(1, Math.max(0, opacity)) : 1

  return {
    color: material.color || '#8a9db5',
    metalness: material.metalness ?? 0.5,
    roughness: material.roughness ?? 0.4,
    transparent: resolvedOpacity < 1,
    opacity: resolvedOpacity,
    depthWrite: resolvedOpacity >= 1,
  }
}

function dimensionsForComponent(component, dimensions) {
  return component.generated?.dimensions || dimensions || DEFAULT_DIMENSIONS
}

function GeneratedChassisPart({ component, dimensions }) {
  const resolvedDimensions = dimensionsForComponent(component, dimensions)
  const width = Number(resolvedDimensions.width) || DEFAULT_DIMENSIONS.width
  const height = Number(resolvedDimensions.height) || DEFAULT_DIMENSIONS.height
  const depth = Number(resolvedDimensions.depth) || DEFAULT_DIMENSIONS.depth
  const panelThickness = Number(component.generated?.panelThickness) || 3
  const bodyWidth = Math.max(width - 40, width * 0.84)
  const bodyHeight = Math.max(height - 6, height * 0.88)
  const bodyDepth = Math.max(depth - panelThickness * 2, 1)
  const rackEarWidth = Math.max(Math.min(width * 0.045, 22), 12)
  const rackEarHeight = height
  const kind = component.generated?.kind || component.id
  const commonMaterial = materialProps(component)

  if (kind === 'front_panel') {
    return (
      <mesh
        position={[0, 0, depth / 2]}
        castShadow
        receiveShadow
        raycast={() => null}
      >
        <boxGeometry args={[width, height, panelThickness]} />
        <meshStandardMaterial {...commonMaterial} />
      </mesh>
    )
  }

  if (kind === 'back_panel') {
    return (
      <mesh
        position={[0, 0, -depth / 2]}
        castShadow
        receiveShadow
        raycast={() => null}
      >
        <boxGeometry args={[bodyWidth, bodyHeight, panelThickness]} />
        <meshStandardMaterial {...commonMaterial} />
      </mesh>
    )
  }

  if (kind === 'rackmount') {
    return (
      <group>
        {[-1, 1].map((side) => (
          <mesh
            key={side}
            position={[side * (width / 2 - rackEarWidth / 2), 0, depth / 2 + panelThickness * 0.42]}
            castShadow
            receiveShadow
            raycast={() => null}
          >
            <boxGeometry args={[rackEarWidth, rackEarHeight, panelThickness * 1.4]} />
            <meshStandardMaterial {...commonMaterial} />
          </mesh>
        ))}
      </group>
    )
  }

  return (
    <group>
      <mesh
        position={[0, 0, 0]}
        castShadow
        receiveShadow
        raycast={() => null}
      >
        <boxGeometry args={[bodyWidth, bodyHeight, bodyDepth]} />
        <meshStandardMaterial {...commonMaterial} />
      </mesh>
    </group>
  )
}

class ModelErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidUpdate(previousProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false })
    }
  }

  render() {
    if (this.state.hasError) return null
    return this.props.children
  }
}

export default function ChassisAssembly({ components, dimensions }) {
  return (
    <group
      name="chassis"
      onPointerDown={(event) => event.stopPropagation()}
    >
      {components
        .filter((component) => component.visible)
        .map((component) => (
          <ModelErrorBoundary
            key={`${component.id}:${component.path}`}
            resetKey={component.path}
          >
            <group
              name={`chassis-${component.id}`}
              position={component.position || [0, 0, 0]}
              rotation={component.rotation || [0, 0, 0]}
            >
              {component.generated || !component.path ? (
                <GeneratedChassisPart component={component} dimensions={dimensions} />
              ) : (
                <AssemblyModel
                  path={component.path}
                  material={component.material}
                  visible={component.visible}
                  opacity={component.opacity}
                />
              )}
            </group>
          </ModelErrorBoundary>
        ))}
    </group>
  )
}
