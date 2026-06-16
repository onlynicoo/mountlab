import { OrbitControls } from '@react-three/drei'

export default function CameraSetup({ autoRotate }) {
  return (
    <OrbitControls
      enablePan={false}
      enableDamping
      dampingFactor={0.07}
      target={[0, -0.004, 0]}
      minPolarAngle={Math.PI / 2.7}
      maxPolarAngle={Math.PI / 1.8}
      minDistance={0.55}
      maxDistance={1.25}
      autoRotate={autoRotate}
      autoRotateSpeed={0.4}
    />
  )
}
