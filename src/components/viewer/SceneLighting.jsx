// All lighting — no external HDR files (avoids async loading failures)
export default function SceneLighting() {
  return (
    <>
      <ambientLight intensity={0.60} />

      <directionalLight
        position={[0, 2.8, 4]}
        intensity={1.2}
        color="#fff6ea"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.5}
        shadow-camera-far={20}
        shadow-camera-left={-2.5}
        shadow-camera-right={2.5}
        shadow-camera-top={2}
        shadow-camera-bottom={-2}
      />

      <directionalLight position={[-3, 1.5, 2.5]} intensity={0.65} color="#dfe8ff" />
      <pointLight position={[2.2, -0.4, 1.8]} intensity={0.28} color="#ffffff" />

      <spotLight
        position={[1.5, 2.4, -2.2]}
        intensity={0.45}
        angle={0.5}
        penumbra={0.7}
        color="#fff1d6"
      />

      <hemisphereLight skyColor="#dae6ff" groundColor="#a69a88" intensity={0.40} />
    </>
  )
}
