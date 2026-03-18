import { Suspense, useEffect, useState } from 'react'
import { Canvas, useLoader, useFrame } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import './App.css'

function BottleModel() {
  const obj = useLoader(OBJLoader, '/bottle_thick.obj')

  return (
    <group rotation={[0, 0, 0]} position={[0.6, -1.3, 0]} scale={0.14}>
      <primitive object={obj} />
    </group>
  )
}

function BottleScene({ scrollProgress }) {
  // Animate the camera distance based on scroll position:
  // at scrollProgress 0 → very zoomed in, at 1 → fully zoomed out.
  useFrame(({ camera }) => {
    const startZ = 1.4
    const endZ = 4
    const clamped = Math.min(Math.max(scrollProgress, 0), 1)

    camera.position.z = startZ + (endZ - startZ) * clamped
    camera.position.x = 0.6
    camera.lookAt(0.6, 0, 0)
  })

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 5, 2]} intensity={1.4} />
      <directionalLight position={[-3, -4, -2]} intensity={0.5} />
      <Suspense fallback={null}>
        <BottleModel />
      </Suspense>
      <Environment preset="city" />
    </>
  )
}

function App() {
  const [scrollProgress, setScrollProgress] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY
      const maxScroll = Math.max(
        1,
        document.documentElement.scrollHeight - window.innerHeight,
      )
      const progress = Math.min(scrollY / maxScroll, 1)
      setScrollProgress(progress)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll)

    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <>
      <div className="stage">
        <Canvas
          camera={{ position: [0.6, 1.6, 1.4], fov: 40, near: 0.01, far: 100 }}
          className="stage__canvas"
        >
          <BottleScene scrollProgress={scrollProgress} />
        </Canvas>
      </div>
      {/* Spacer so there is actually something to scroll */}
      <div className="scroll-spacer" />
    </>
  )
}

export default App
