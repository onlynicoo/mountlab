import { useLayoutEffect, useMemo, useRef } from 'react'
import { useLoader } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'

const DEFAULT_CHASSIS_COLOR = '#4a90d9'
const DEFAULT_PCB_COLOR = '#1a7a4a'

function opacityFromTransparency(transparency, fallback) {
  const number = Number(transparency)
  const normalized = Number.isFinite(number) ? Math.min(100, Math.max(0, number)) : fallback
  return 1 - (normalized / 100)
}

function createChassisMaterial(color = DEFAULT_CHASSIS_COLOR, transparency = 65) {
  const opacity = opacityFromTransparency(transparency, 65)

  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.55,
    metalness: 0.18,
    transparent: opacity < 1,
    opacity,
    depthWrite: opacity >= 1,
  })
}

function createPcbMaterial(color = DEFAULT_PCB_COLOR, transparency = 0) {
  const opacity = opacityFromTransparency(transparency, 0)

  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.62,
    metalness: 0.08,
    transparent: opacity < 1,
    opacity,
    depthWrite: opacity >= 1,
  })
}

function applyTransparency(material, transparency, fallback) {
  const opacity = opacityFromTransparency(transparency, fallback)
  material.transparent = opacity < 1
  material.opacity = opacity
  material.depthWrite = opacity >= 1
}

function cloneMaterial(material, role, highlighted, color, transparency) {
  if (role === 'chassis') {
    return createChassisMaterial(color, transparency)
  }

  const clonedMaterial = material?.clone ? material.clone() : createPcbMaterial(color, transparency)
  if ('color' in clonedMaterial) {
    clonedMaterial.color = new THREE.Color(color || DEFAULT_PCB_COLOR)
  }
  applyTransparency(clonedMaterial, transparency, 0)
  if (highlighted && 'emissive' in clonedMaterial) {
    clonedMaterial.emissive = new THREE.Color('#35ff9a')
    clonedMaterial.emissiveIntensity = 0.22
  }
  return clonedMaterial
}

function CenteredObject({ object, role, highlighted, color, transparency }) {
  const groupRef = useRef()
  const clonedObject = useMemo(() => {
    const clone = object.clone(true)

    clone.traverse((child) => {
      if (!child.isMesh) return

      child.castShadow = true
      child.receiveShadow = true
      child.material = Array.isArray(child.material)
        ? child.material.map((material) => cloneMaterial(
          material,
          role,
          highlighted,
          color,
          transparency,
        ))
        : cloneMaterial(child.material, role, highlighted, color, transparency)
    })

    const box = new THREE.Box3().setFromObject(clone)
    const center = new THREE.Vector3()
    if (!box.isEmpty()) {
      box.getCenter(center)
      clone.position.sub(center)
    }

    return clone
  }, [color, highlighted, object, role, transparency])

  useLayoutEffect(() => {
    return () => {
      clonedObject.traverse((child) => {
        if (child.isMesh && child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((material) => material.dispose?.())
          } else {
            child.material.dispose?.()
          }
        }
      })
    }
  }, [clonedObject])

  return (
    <group ref={groupRef}>
      <primitive object={clonedObject} />
    </group>
  )
}

function GltfModel({ url, role, highlighted, color, transparency }) {
  const gltf = useGLTF(url)
  return (
    <CenteredObject
      object={gltf.scene}
      role={role}
      highlighted={highlighted}
      color={color}
      transparency={transparency}
    />
  )
}

function StlModel({ url, role, highlighted, color, transparency }) {
  const geometry = useLoader(STLLoader, url)
  const centeredGeometry = useMemo(() => {
    const clone = geometry.clone()
    clone.computeVertexNormals()
    clone.center()
    return clone
  }, [geometry])
  const material = useMemo(() => {
    if (role === 'chassis') return createChassisMaterial(color, transparency)

    const nextMaterial = createPcbMaterial(color, transparency)
    if (highlighted) {
      nextMaterial.emissive = new THREE.Color('#35ff9a')
      nextMaterial.emissiveIntensity = 0.22
    }
    return nextMaterial
  }, [color, highlighted, role, transparency])

  useLayoutEffect(() => {
    return () => {
      centeredGeometry.dispose()
      material.dispose()
    }
  }, [centeredGeometry, material])

  return (
    <mesh geometry={centeredGeometry} material={material} castShadow receiveShadow />
  )
}

export default function ModelLoader({
  url,
  type,
  role = 'pcb',
  highlighted = false,
  color,
  transparency,
}) {
  if (!url) return null

  if (type === 'stl') {
    return (
      <StlModel
        url={url}
        role={role}
        highlighted={highlighted}
        color={color}
        transparency={transparency}
      />
    )
  }

  return (
    <GltfModel
      url={url}
      role={role}
      highlighted={highlighted}
      color={color}
      transparency={transparency}
    />
  )
}
