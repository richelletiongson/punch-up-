import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas, useLoader, useFrame } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import './App.css'
import StaggeredMenu from './StaggeredMenu'
import ScrollFloat from './ScrollFloat'

function BottleModel({ scrollProgress }) {
  const obj = useLoader(OBJLoader, '/bottle_thick.obj')
  const clamped = Math.min(Math.max(scrollProgress ?? 0, 0), 1)

  // Start lower so the bottom is cropped, then rise into full view as it zooms out.
  const startY = -4.0
  const endY = -2.7
  const y = startY + (endY - startY) * clamped

  return (
    <group rotation={[0, 0, 0]} position={[0, y, 0]} scale={0.16}>
      <primitive object={obj} />
    </group>
  )
}

function BottleScene({ scrollProgress }) {
  // Animate the camera distance based on scroll position:
  // at scrollProgress 0 → very zoomed in, at 1 → fully zoomed out.
  useFrame(({ camera }) => {
    // Scroll parallax: zooms out until it stops.
    const startZ = 4.2
    const endZ = 10.5
    const clamped = Math.min(Math.max(scrollProgress, 0), 1)

    const z = startZ + (endZ - startZ) * clamped
    // Keep bottle centered while zooming.
    camera.position.set(0, 0.0, z)
    camera.lookAt(0, 0.0, 0)
  })

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 5, 2]} intensity={1.4} />
      <directionalLight position={[-3, -4, -2]} intensity={0.5} />
      <Suspense fallback={null}>
        <BottleModel scrollProgress={scrollProgress} />
      </Suspense>
      <Environment preset="city" />
    </>
  )
}

function App() {
  const [scrollProgress, setScrollProgress] = useState(0)
  const stageRef = useRef(null)

  const clamp01 = (n) => Math.min(Math.max(n, 0), 1)
  // Keep the bottle "initial screen" visible for a moment.
  // At `scrollProgress === 1`, both text and bottle end together.
  const floatProgress = clamp01((scrollProgress - 0.05) / 0.95)
  const buttonsProgress = clamp01((scrollProgress - 0.12) / 0.88)

  const menuItems = [
    { label: 'Home', ariaLabel: 'Go to home page', link: '/' },
    { label: 'About', ariaLabel: 'Learn about us', link: '/about' },
    { label: 'Services', ariaLabel: 'View our services', link: '/services' },
    { label: 'Contact', ariaLabel: 'Get in touch', link: '/contact' },
  ]

  const socialItems = [
    { label: 'Twitter', link: 'https://twitter.com' },
    { label: 'GitHub', link: 'https://github.com' },
    { label: 'LinkedIn', link: 'https://linkedin.com' },
  ]

  useEffect(() => {
    const el = stageRef.current ?? window

    const onWheel = (e) => {
      // Prevent actual page scroll; use wheel to drive zoom progress.
      e.preventDefault()

      // Trackpads can send large/small deltas; normalize a bit.
      const delta = e.deltaY
      const step = delta * 0.0008

      setScrollProgress((p) => {
        const next = p + step
        if (next < 0) return 0
        if (next > 1) return 1
        return next
      })
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  return (
    <>
      <div className="stage" ref={stageRef}>
        <StaggeredMenu
          isFixed
          position="right"
          items={menuItems}
          socialItems={socialItems}
          displaySocials
          displayItemNumbering={true}
          menuButtonColor="#ffffff"
          openMenuButtonColor="#fff"
          changeMenuColorOnOpen={true}
          colors={['var(--brandy-l2)', 'var(--harvest-orange)']}
          accentColor="var(--harvest-orange)"
          onMenuOpen={() => console.log('Menu opened')}
          onMenuClose={() => console.log('Menu closed')}
        />

        <div className="stage__titleBack" aria-hidden={scrollProgress === 0}>
          <ScrollFloat
            as="h2"
            progress={floatProgress}
            animationDuration={1}
            ease="back.inOut(2)"
            containerClassName="stage__copyTitle"
            textClassName="stage__copyTitleText"
            stagger={0.03}
          >
            MADE RIGHT.
          </ScrollFloat>
        </div>

        <Canvas
          camera={{ position: [0, 0, 4.2], fov: 35, near: 0.01, far: 100 }}
          className="stage__canvas"
        >
          <BottleScene scrollProgress={scrollProgress} />
        </Canvas>

        <div className="stage__copy" aria-hidden={scrollProgress === 0}>
          <div className="stage__copyInner">
            <ScrollFloat
              as="p"
              progress={floatProgress}
              animationDuration={1}
              ease="back.inOut(2)"
              containerClassName="stage__copyBody"
              textClassName="stage__copyBodyText"
              stagger={0.01}
            >
              100% blue agave tequila, crafted traditionally and finished with a sharper point of view.
            </ScrollFloat>

            <div
              className="stage__copyButtons"
              style={{
                opacity: buttonsProgress,
                transform: `translateY(${(1 - buttonsProgress) * 14}px) scale(${0.98 + 0.02 * buttonsProgress})`,
              }}
            >
              <button className="stage__btn stage__btn--ghost" type="button">
                Learn more
              </button>
              <button className="stage__btn stage__btn--solid" type="button">
                Shop now
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default App
