import { Suspense, useEffect, useRef, useState, useCallback } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, useGLTF } from '@react-three/drei'
import './App.css'
import StaggeredMenu from './StaggeredMenu'
import ScrollFloat from './ScrollFloat'

const BOTTLE_EXIT_SPIN_Y = Math.PI * 1.85
const BOTTLE_EXIT_TILT_X = 0.42
const BOTTLE_EXIT_TILT_Z = -0.14
// Rest pose: upright, label toward camera (GLB default). Tweak Y if the model’s “front” differs.
const BOTTLE_REST_ROTATION = [0, 0, 0]

const TWO_PI = Math.PI * 2

/** Smallest positive radians to add to `fromYaw` so the result matches `toYaw` (mod 2π). Keeps spin direction. */
function sameDirectionYawDelta(fromYaw, toYaw) {
  let d = toYaw - fromYaw
  d = ((d % TWO_PI) + TWO_PI) % TWO_PI
  return d
}

const SETTLE_YAW_DELTA = sameDirectionYawDelta(BOTTLE_EXIT_SPIN_Y, BOTTLE_REST_ROTATION[1])
// Settle’s Y move is often much smaller than the exit sweep — scale wheel speed so spin feels as fast.
const SETTLE_SCROLL_MULT = Math.min(
  SETTLE_YAW_DELTA > 1e-6 ? BOTTLE_EXIT_SPIN_Y / SETTLE_YAW_DELTA : 1,
  48
)

function BottleModel({
  scrollProgress,
  narrowViewport,
  titleExitProgress = 0,
  bottleSettleProgress = 0
}) {
  const { scene } = useGLTF('/Tequila01.glb')
  const clamped = Math.min(Math.max(scrollProgress ?? 0, 0), 1)
  const exit = Math.min(Math.max(titleExitProgress ?? 0, 0), 1)
  const settle = Math.min(Math.max(bottleSettleProgress ?? 0, 0), 1)

  // Start low on first frame (scroll 0); only ease up toward endY as scroll progresses.
  const startY = -4.0
  const endY = -2.25
  const y = startY + (endY - startY) * clamped
  const scale = narrowViewport ? 0.14 : 0.16

  // Header exit: angled spin. After exit, settle keeps increasing Y (same direction) until aligned with rest yaw,
  // while tilts ease to upright.
  const exitEndTiltX = BOTTLE_EXIT_TILT_X
  const exitEndSpinY = BOTTLE_EXIT_SPIN_Y
  const exitEndTiltZ = BOTTLE_EXIT_TILT_Z
  const [restX, restY, restZ] = BOTTLE_REST_ROTATION
  const settleYawDelta = sameDirectionYawDelta(exitEndSpinY, restY)

  let tiltX
  let spinY
  let tiltZ
  if (exit < 1) {
    tiltX = exit * BOTTLE_EXIT_TILT_X
    spinY = exit * BOTTLE_EXIT_SPIN_Y
    tiltZ = exit * BOTTLE_EXIT_TILT_Z
  } else {
    const t = settle
    spinY = exitEndSpinY + t * settleYawDelta
    tiltX = exitEndTiltX + t * (restX - exitEndTiltX)
    tiltZ = exitEndTiltZ + t * (restZ - exitEndTiltZ)
    if (t >= 1 - 1e-6) {
      spinY = restY
      tiltX = restX
      tiltZ = restZ
    }
  }

  return (
    <group rotation={[tiltX, spinY, tiltZ]} position={[0, y, 0]} scale={scale}>
      <primitive object={scene} />
    </group>
  )
}

useGLTF.preload('/Tequila01.glb')

function BottleScene({ scrollProgress, narrowViewport, titleExitProgress, bottleSettleProgress }) {
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
        <BottleModel
          scrollProgress={scrollProgress}
          narrowViewport={narrowViewport}
          titleExitProgress={titleExitProgress}
          bottleSettleProgress={bottleSettleProgress}
        />
      </Suspense>
      <Environment preset="city" />
    </>
  )
}

function App() {
  const [scrollProgress, setScrollProgress] = useState(0)
  const [titleExitProgress, setTitleExitProgress] = useState(0)
  const [bottleSettleProgress, setBottleSettleProgress] = useState(0)
  const [narrowViewport, setNarrowViewport] = useState(false)
  const stageRef = useRef(null)
  const scrollPhaseRef = useRef({ scroll: 0, exit: 0, settle: 0 })

  const clamp01 = (n) => Math.min(Math.max(n, 0), 1)
  // Keep the bottle "initial screen" visible for a moment.
  // At `scrollProgress === 1`, both text and bottle end together.
  const floatProgress = clamp01((scrollProgress - 0.05) / 0.95)
  const heroSequenceComplete =
    scrollProgress >= 0.998 &&
    titleExitProgress >= 0.998 &&
    bottleSettleProgress >= 0.998

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
    const mq = window.matchMedia('(max-width: 700px)')
    const syncNarrow = () => setNarrowViewport(mq.matches)
    syncNarrow()
    mq.addEventListener('change', syncNarrow)
    return () => mq.removeEventListener('change', syncNarrow)
  }, [])

  const onWheel = useCallback((e) => {
    e.preventDefault()
    const delta = e.deltaY
    const scrollStep = delta * 0.0008
    // floatProgress runs 0→1 over scrollProgress 0.05→1 (span 0.95). Scale exit so
    // the same total wheel travel scrubs headline in vs out.
    const exitStep = (delta * 0.0008) / 0.95
    const settleStep = exitStep * SETTLE_SCROLL_MULT
    const s = scrollPhaseRef.current

    if (delta < 0) {
      if (s.settle > 0) {
        s.settle = Math.max(0, s.settle + settleStep)
        setBottleSettleProgress(s.settle)
        return
      }
      if (s.exit > 0) {
        s.exit = Math.max(0, s.exit + exitStep)
        if (s.exit < 1) s.settle = 0
        setTitleExitProgress(s.exit)
        setBottleSettleProgress(s.settle)
        return
      }
      s.scroll = Math.max(0, s.scroll + scrollStep)
      setScrollProgress(s.scroll)
      return
    }

    if (s.scroll < 1) {
      s.scroll = Math.min(1, s.scroll + scrollStep)
      setScrollProgress(s.scroll)
      return
    }

    if (s.exit < 1) {
      s.exit = Math.min(1, s.exit + exitStep)
      setTitleExitProgress(s.exit)
      return
    }

    if (s.settle < 1) {
      s.settle = Math.min(1, s.settle + settleStep)
      setBottleSettleProgress(s.settle)
    }
  }, [])

  useEffect(() => {
    const el = stageRef.current ?? window
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [onWheel])

  useEffect(() => {
    scrollPhaseRef.current.scroll = scrollProgress
  }, [scrollProgress])

  useEffect(() => {
    scrollPhaseRef.current.exit = titleExitProgress
  }, [titleExitProgress])

  useEffect(() => {
    scrollPhaseRef.current.settle = bottleSettleProgress
  }, [bottleSettleProgress])

  return (
    <>
      <div className="stage" ref={stageRef}>
        <StaggeredMenu
          isFixed
          position="right"
          logoUrl="/Aurero_Logo.svg"
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

        <div
          className="stage__titleUnder"
          aria-hidden={scrollProgress === 0 || titleExitProgress >= 0.99}
        >
          <div className="stage__titleInner stage__titleInner--stacked">
            <div className="stage__titleStackRow stage__titleStackRow--spread">
              <ScrollFloat
                as="div"
                progress={floatProgress}
                exitProgress={titleExitProgress}
                animationDuration={1}
                ease="back.inOut(2)"
                containerClassName="stage__titleLine stage__titleLine--edgeTrack"
                textClassName="stage__copyTitleText stage__copyTitleText--under"
                stagger={0.03}
              >
                MADE
              </ScrollFloat>
            </div>
            <div className="stage__titleStackRow stage__titleStackRow--spread" aria-hidden="true">
              <span className="stage__titleGhost stage__titleGhost--edgeTrack">
                {'RIGHT'.split('').map((ch, i) => (
                  <span key={i} className="stage__titleGhostChar">
                    {ch}
                  </span>
                ))}
              </span>
            </div>
          </div>
        </div>

        <Canvas
          camera={{ position: [0, 0, 4.2], fov: 35, near: 0.01, far: 100 }}
          className="stage__canvas"
        >
          <BottleScene
            scrollProgress={scrollProgress}
            narrowViewport={narrowViewport}
            titleExitProgress={titleExitProgress}
            bottleSettleProgress={bottleSettleProgress}
          />
        </Canvas>

        <div
          className={`stage__tagline${heroSequenceComplete ? ' stage__tagline--visible' : ''}`}
          aria-hidden={!heroSequenceComplete}
        >
          <span className="stage__taglineLine">Born of Sun.</span>
          <span className="stage__taglineLine">Poured in Gold.</span>
        </div>

        <div
          className="stage__titleFront"
          aria-hidden={scrollProgress === 0 || titleExitProgress >= 0.99}
        >
          <div className="stage__titleInner stage__titleInner--stacked">
            <div className="stage__titleStackRow stage__titleStackRow--spread" aria-hidden="true">
              <span className="stage__titleGhost stage__titleGhost--edgeTrack">
                {'MADE'.split('').map((ch, i) => (
                  <span key={i} className="stage__titleGhostChar">
                    {ch}
                  </span>
                ))}
              </span>
            </div>
            <div className="stage__titleStackRow stage__titleStackRow--spread">
              <ScrollFloat
                as="div"
                progress={floatProgress}
                exitProgress={titleExitProgress}
                animationDuration={1}
                ease="back.inOut(2)"
                containerClassName="stage__titleLine stage__titleLine--edgeTrack"
                textClassName="stage__copyTitleText stage__copyTitleText--front"
                stagger={0.03}
              >
                RIGHT
              </ScrollFloat>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default App
