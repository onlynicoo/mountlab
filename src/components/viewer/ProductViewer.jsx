import { Canvas } from '@react-three/fiber'
import { ContactShadows } from '@react-three/drei'
import { Suspense } from 'react'
import SceneLighting from './SceneLighting'
import CameraSetup from './CameraSetup'
import PreampModel from './PreampModel'

function LoadingFallback() {
  return (
    <mesh>
      <boxGeometry args={[0.5, 0.1, 0.1]} />
      <meshStandardMaterial color="#c9920a" wireframe />
    </mesh>
  )
}

export default function ProductViewer({
  frontPanelColor,
  rearPanelColor,
  getKnobColor,
  autoRotate,
}) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        minHeight: '400px',
        position: 'relative',
        background: 'radial-gradient(circle at 50% 8%, #ffffff 0%, #eef1f5 52%, #c0cad9 100%)',
      }}
    >
      <Canvas
        dpr={[1, 2]}
        shadows
        camera={{ position: [0, 0.008, 0.80], fov: 27 }}
        gl={{ antialias: true, alpha: true }}
        style={{ position: 'absolute', inset: 0, background: 'transparent' }}
      >
        <Suspense fallback={<LoadingFallback />}>
          <SceneLighting />
          <CameraSetup autoRotate={autoRotate} />

          {/* Ground shadow */}
          <ContactShadows
            position={[0, -0.14, 0]}
            opacity={0.4}
            scale={5}
            blur={2.2}
            far={0.9}
          />

          <PreampModel
            frontPanelColor={frontPanelColor}
            rearPanelColor={rearPanelColor}
            getKnobColor={getKnobColor}
          />
        </Suspense>
      </Canvas>
    </div>
  )
}
