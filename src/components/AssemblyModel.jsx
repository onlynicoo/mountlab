import { useLayoutEffect } from 'react'
import { useLoader } from '@react-three/fiber'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { API_BASE, projectFileUrl } from '../config/apiBase'

function normalizeOpacity(opacity) {
  const number = Number(opacity)
  if (!Number.isFinite(number)) return 1
  return Math.min(1, Math.max(0, number))
}

export default function AssemblyModel({ path, material, visible, opacity = 1 }) {
  const modelPath = path?.startsWith('/') && !path.startsWith('/projects/') && !path.startsWith('/models/')
    ? `${API_BASE}/api/model?${new URLSearchParams({ path, type: 'stl' }).toString()}`
    : projectFileUrl(path)
  const geometry = useLoader(STLLoader, modelPath)
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
