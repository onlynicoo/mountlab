import { Component } from 'react'
import AssemblyModel from './AssemblyModel'

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

export default function ChassisAssembly({ components }) {
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
              <AssemblyModel
                path={component.path}
                material={component.material}
                visible={component.visible}
                opacity={component.opacity}
              />
            </group>
          </ModelErrorBoundary>
        ))}
    </group>
  )
}
