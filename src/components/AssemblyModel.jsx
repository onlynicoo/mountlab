import { useLayoutEffect } from 'react'
import { useLoader } from '@react-three/fiber'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'

function normalizeOpacity(opacity) {
  const number = Number(opacity)
  if (!Number.isFinite(number)) return 1
  return Math.min(1, Math.max(0, number))
}

export default function AssemblyModel({ path, material, visible, opacity = 1 }) {
  const geometry = useLoader(STLLoader, path)
  const resolvedOpacity = normalizeOpacity(opacity)

  useLayoutEffect(() => {
    geometry.computeBoundingBox()
    geometry.computeVertexNormals()
  }, [geometry])

  return (
    <mesh
      geometry={geometry}
      visible={visible}
      castShadow
      receiveShadow
      raycast={() => null}
    >
      <meshStandardMaterial
        color={material.color}
        metalness={material.metalness}
        roughness={material.roughness}
        transparent={resolvedOpacity < 1}
        opacity={resolvedOpacity}
        depthWrite={resolvedOpacity >= 1}
      />
    </mesh>
  )
}
