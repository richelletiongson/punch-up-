import { Suspense, useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, Html, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import './App.css'
import StaggeredMenu from './StaggeredMenu'
import PureGoldHeading from './PureGoldHeading'
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
const TEXT_OUTRO_START = 0.28

/** Vertical panel base color (lit mesh + compact brand story panel) — light blue-grey */
const HERO_PANEL_SURFACE = '#9eb6c3'
/** Dorado side panel only */
const DORADO_PANEL_SURFACE = '#7D513D'
/** Miel center vertical panel */
const MIEL_PANEL_SURFACE = '#E99861'
/** Miel flavor panel tagline (“Golden, slow, and softly sweet.”) */
const MIEL_PANEL_TAGLINE_COLOR = '#F9BF8D'
/** Ámbar side panel only */
const AMBAR_PANEL_SURFACE = '#F4BF55'
/** Ámbar flavor panel tagline (“Deep glow, slow heat.”) */
const AMBAR_PANEL_TAGLINE_COLOR = '#FFE5B1'

/** DOM headlines; 3D panel product names use `PANEL_PRODUCT_NAME_COLOR` where white reads best. */
const HERO_TITLE_HEADLINE_COLOR = '#7D513D'
const PANEL_PRODUCT_NAME_COLOR = '#ffffff'

/** Wider rendered panel bar only; `panelHalfWorldX` stays on base scale so center-to-center gaps unchanged. */
const PANEL_MESH_WIDTH_MUL = 1.14

const HERO_BRAND_STORY_FULL =
  'Áureo is a modern tequila shaped by warmth, heritage, and the golden hours that linger longest. Crafted from blue agave and inspired by the richness of sun-soaked landscapes, each expression captures a different shade of gold. From the honeyed brightness of Miel, to the oak-warmed depth of Dorado, to the spiced amber glow of Ámbar. Rooted in tradition, refined through a modern lens, Áureo is made for slow pours, long evenings, and the art of savoring.'

const HERO_BRAND_STORY_SHORT =
  'Áureo is blue weber agave tequila shaped by warmth and craft with three expressions of gold: Miel, Dorado, and Ámbar. Rooted in tradition, refined for slow pours and long evenings.'
const MAIN_BOTTLE_START_Y = -4.0
const MAIN_BOTTLE_END_Y = -2.25
const MAIN_BOTTLE_OUTRO_DROP = 0.68

function BottleModel({
  scrollProgress,
  narrowViewport,
  titleExitProgress = 0,
  bottleSettleProgress = 0,
  textOutroProgress = 0
}) {
  const { scene } = useGLTF('/Tequila01.glb')
  const clamped = Math.min(Math.max(scrollProgress ?? 0, 0), 1)
  const exit = Math.min(Math.max(titleExitProgress ?? 0, 0), 1)
  const settle = Math.min(Math.max(bottleSettleProgress ?? 0, 0), 1)
  const outro = Math.min(Math.max(textOutroProgress ?? 0, 0), 1)

  // Start low on first frame (scroll 0); only ease up toward endY as scroll progresses.
  const startY = MAIN_BOTTLE_START_Y
  const endY = MAIN_BOTTLE_END_Y
  const baseY = startY + (endY - startY) * clamped
  const outroDrop = MAIN_BOTTLE_OUTRO_DROP
  const y = baseY - outro * outroDrop

  const baseScale = narrowViewport ? 0.14 : 0.16
  const minScaleFactor = 0.68
  const scale = baseScale * (1 - outro * (1 - minScaleFactor))

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

  // Final outro (text leaving + bottle dropping/scaling): add a spin feel similar to the
  // earlier angled rotation, but end front-facing/straight.
  if (outro > 0) {
    const spinTurns = 1
    const spin = outro * TWO_PI * spinTurns
    const tiltEnvelope = Math.sin(outro * Math.PI) // 0 -> peak -> 0
    spinY += spin
    tiltX += tiltEnvelope * BOTTLE_EXIT_TILT_X * 0.58
    tiltZ += tiltEnvelope * BOTTLE_EXIT_TILT_Z * 0.58
  }

  return (
    <group rotation={[tiltX, spinY, tiltZ]} position={[0, y, 0]} scale={scale}>
      <primitive object={scene} />
    </group>
  )
}

useGLTF.preload('/Tequila01.glb')

/** Horizontal scale factor for vertical panel mesh (shape half-width = 0.9 in local units). */
function panelWidthMul(narrowViewport, compressBottleSpacing) {
  if (narrowViewport) return 0.84
  if (compressBottleSpacing) return 0.96
  return 1
}

/** Extra world-space gap between adjacent panel centers (beyond touching half-widths). */
function interPanelGutter(narrowViewport, compressBottleSpacing) {
  if (narrowViewport) return 0.56
  if (compressBottleSpacing) return 0.5
  return 0.92
}

/** Layout half-width along X for spacing (mesh uses `sx * PANEL_MESH_WIDTH_MUL` so bars can draw wider). */
function panelHalfWorldX(reveal, narrowViewport, compressBottleSpacing) {
  const sx = (0.45 + Math.min(Math.max(reveal, 0), 1) * 1.35) * panelWidthMul(narrowViewport, compressBottleSpacing)
  return 0.9 * sx
}

function SideBottle({
  modelPath,
  side = 'left',
  label,
  subtitle,
  profile,
  textOutroProgress = 0,
  scrollProgress = 1,
  narrowViewport,
  compressBottleSpacing = false,
  panelSurfaceColor = HERO_PANEL_SURFACE,
  /** Max opacity factor at full reveal; default frosted bar when no custom panel color tuning. */
  panelOpacityMul = 0.36,
  /** Nudge base color toward swatch under scene lights (0 = off). */
  panelEmissiveIntensity = 0,
  panelRoughness = 0.62,
  titleColor = HERO_TITLE_HEADLINE_COLOR,
  taglineColor = 'var(--color-body-text)'
}) {
  const pwm = panelWidthMul(narrowViewport, compressBottleSpacing)
  const { scene } = useGLTF(modelPath)
  const instance = useMemo(() => {
    const clone = scene.clone(true)
    // Normalize each variant's local center so it sits centered in its panel.
    const box = new THREE.Box3().setFromObject(clone)
    const center = box.getCenter(new THREE.Vector3())
    clone.position.x -= center.x
    clone.position.z -= center.z
    return clone
  }, [scene])
  const panelShape = useMemo(() => {
    const w = 1.8
    const h = 4.3
    const r = 0.14
    const hw = w / 2
    const hh = h / 2
    const shape = new THREE.Shape()
    shape.moveTo(-hw, -hh)
    shape.lineTo(hw, -hh)
    shape.lineTo(hw, hh - r)
    shape.quadraticCurveTo(hw, hh, hw - r, hh)
    shape.lineTo(-hw + r, hh)
    shape.quadraticCurveTo(-hw, hh, -hw, hh - r)
    shape.lineTo(-hw, -hh)
    return shape
  }, [])
  const clamped = Math.min(Math.max(scrollProgress ?? 0, 0), 1)
  const outro = Math.min(Math.max(textOutroProgress ?? 0, 0), 1)
  const reveal = Math.min(Math.max((textOutroProgress - 0.78) / 0.22, 0), 1)
  const entranceRaw = Math.min(Math.max((reveal - 0.18) / 0.82, 0), 1)
  const entrance = entranceRaw * entranceRaw * (3 - 2 * entranceRaw)
  const dir = side === 'left' ? -1 : 1
  /** Phone + tablet: Ámbar left of Dorado left of Miel (same X stack as narrow-only before). */
  const trioStackLayout = narrowViewport || compressBottleSpacing

  const baseY = MAIN_BOTTLE_START_Y + (MAIN_BOTTLE_END_Y - MAIN_BOTTLE_START_Y) * clamped
  const targetY = baseY - outro * MAIN_BOTTLE_OUTRO_DROP
  const riseFromBottom = 4.1
  const y = targetY - (1 - entrance) * riseFromBottom
  const baseScale = narrowViewport ? 0.14 : 0.16
  const minScaleFactor = 0.68
  const scale = baseScale * minScaleFactor * 1.02
  const centerNudge = 0.16
  const gutter = interPanelGutter(narrowViewport, compressBottleSpacing)
  const hw = panelHalfWorldX(reveal, narrowViewport, compressBottleSpacing)
  const pairGap = 2 * hw + gutter

  // Distance from scene center (Miel) to Dorado / desktop Ámbar — same mag both sides = even gutters.
  const wideFromCenter = Math.max(pairGap, 5.12)
  const tightFromCenter = Math.max(pairGap * 1.04, 3.68)
  /** Mobile: one step Miel↔Dorado and Dorado↔Ámbar (same `mobileMag` = consistent spacing). */
  const mobileMag = Math.max(pairGap, 3.38)

  let panelX
  if (trioStackLayout && side === 'right') {
    const doradoPanelX = -mobileMag + centerNudge * 0.88
    const settledAmbar = doradoPanelX - mobileMag
    const slide = (1 - entrance) * (mobileMag + 2.72)
    panelX = settledAmbar - slide
  } else if (trioStackLayout && side === 'left') {
    panelX = -mobileMag + centerNudge * 0.88
  } else {
    const mag = compressBottleSpacing ? tightFromCenter : wideFromCenter
    panelX = dir * mag - dir * centerNudge
  }

  const panelSX = (0.45 + reveal * 1.35) * pwm
  const panelScaleY = 0.51 + reveal * 1.92
  const panelTopY = -2.95 + (4.3 * panelScaleY) / 2
  const bottleInwardShift = 0.34
  const bottleInwardDir = trioStackLayout && side === 'right' ? -1 : dir
  const bottleX = panelX - bottleInwardDir * bottleInwardShift
  const z = 0
  // Tequila02/03 files are slightly yawed out by default; counter-rotate per side to match center bottle.
  const yawCorrection =
    trioStackLayout && side === 'right' ? 0.24 : -dir * 0.24
  const enterSpinTurns = 0.9
  const enterSpin = (1 - entrance) * TWO_PI * enterSpinTurns

  return (
    <>
      <mesh
        position={[panelX, -2.95, -1.05]}
        scale={[panelSX * PANEL_MESH_WIDTH_MUL, panelScaleY, 1]}
        visible={reveal > 0.001}
      >
        <shapeGeometry args={[panelShape]} />
        <meshStandardMaterial
          color={panelSurfaceColor}
          transparent={reveal * panelOpacityMul < 0.998}
          opacity={reveal * panelOpacityMul}
          roughness={panelRoughness}
          metalness={0.02}
          emissive={panelSurfaceColor}
          emissiveIntensity={panelEmissiveIntensity}
        />
      </mesh>
      <Html
        position={[panelX, panelTopY - 0.8, -1.01]}
        center
        transform
        style={{
          fontFamily: 'chorine-large, sans-serif',
          fontWeight: 500,
          fontSize: narrowViewport ? '23px' : '30px',
          letterSpacing: '0.06em',
          color: titleColor,
          width: narrowViewport ? '248px' : '280px',
          maxWidth: narrowViewport ? '248px' : '280px',
          opacity: reveal > 0.35 ? 1 : 0,
          pointerEvents: 'none',
          userSelect: 'none'
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ whiteSpace: 'nowrap' }}>{label}</div>
          <div
            style={{
              marginTop: '-7px',
              fontFamily: 'avenir-lt-pro, sans-serif',
              fontWeight: 700,
              fontSize: '8px',
              letterSpacing: '0.01em',
              color: taglineColor
            }}
          >
            {subtitle}
          </div>
          <div
            style={{
              marginTop: '2px',
              fontFamily: 'avenir-lt-pro, sans-serif',
              fontWeight: 400,
              fontSize: '6px',
              letterSpacing: '0.01em',
              lineHeight: 1.2,
              whiteSpace: 'pre-line',
              width: narrowViewport ? '218px' : '220px',
              maxWidth: narrowViewport ? '218px' : '220px',
              marginLeft: 'auto',
              marginRight: 'auto',
              overflowWrap: 'normal',
              color: 'rgba(255,255,255,0.92)'
            }}
          >
            {profile}
          </div>
        </div>
      </Html>
      <group
        position={[bottleX, y, z]}
        rotation={[0, BOTTLE_REST_ROTATION[1] + yawCorrection + enterSpin, 0]}
        scale={scale}
        visible={entrance > 0.06}
      >
        <primitive object={instance} />
      </group>
    </>
  )
}

useGLTF.preload('/Tequila02.glb')
useGLTF.preload('/Tequila03.glb')

function BottleScene({
  scrollProgress,
  narrowViewport,
  compressBottleSpacing = false,
  pureGoldOffscreenBoost = false,
  titleExitProgress,
  bottleSettleProgress,
  textOutroProgress,
  sceneSlideProgress = 0
}) {
  const reveal = Math.min(Math.max((textOutroProgress - 0.78) / 0.22, 0), 1)
  const slideDistance = narrowViewport
    ? 19.25
    : compressBottleSpacing
      ? 17.5
      : pureGoldOffscreenBoost
        ? 19
        : 25.5
  const sceneSlideX = Math.min(Math.max(sceneSlideProgress, 0), 1) * slideDistance
  const pwm = panelWidthMul(narrowViewport, compressBottleSpacing)
  const centerPanelSX = (0.45 + reveal * 1.35) * pwm
  const panelScaleY = 0.51 + reveal * 1.92
  const panelTopY = -2.95 + (4.3 * panelScaleY) / 2
  const labelTitlePx = narrowViewport ? 23 : compressBottleSpacing ? 25 : 30
  const labelBoxPx = narrowViewport ? 248 : compressBottleSpacing ? 258 : 280
  const profileBoxPx = narrowViewport ? 218 : compressBottleSpacing ? 212 : 220
  const panelShape = useMemo(() => {
    const w = 1.8
    const h = 4.3
    const r = 0.14
    const hw = w / 2
    const hh = h / 2
    const shape = new THREE.Shape()
    shape.moveTo(-hw, -hh)
    shape.lineTo(hw, -hh)
    shape.lineTo(hw, hh - r)
    shape.quadraticCurveTo(hw, hh, hw - r, hh)
    shape.lineTo(-hw + r, hh)
    shape.quadraticCurveTo(-hw, hh, -hw, hh - r)
    shape.lineTo(-hw, -hh)
    return shape
  }, [])

  // Animate the camera distance based on scroll position:
  // at scrollProgress 0 → very zoomed in, at 1 → fully zoomed out.
  useFrame(({ camera }) => {
    // Scroll parallax: zooms out until it stops.
    const startZ = 4.2
    const endZ = narrowViewport ? 11.2 : compressBottleSpacing ? 10.95 : 11.25
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
      <group position={[sceneSlideX, 0, 0]}>
        <mesh
          position={[0, -2.95, -1.05]}
          scale={[centerPanelSX * PANEL_MESH_WIDTH_MUL, panelScaleY, 1]}
          visible={reveal > 0.001}
        >
          <shapeGeometry args={[panelShape]} />
          <meshStandardMaterial
            color={MIEL_PANEL_SURFACE}
            transparent={reveal * 0.92 < 0.998}
            opacity={reveal * 0.92}
            roughness={0.45}
            metalness={0.02}
            emissive={MIEL_PANEL_SURFACE}
            emissiveIntensity={0.06}
          />
        </mesh>
        <Html
          position={[0, panelTopY - 0.8, -1.01]}
          center
          transform
          style={{
            fontFamily: 'chorine-large, sans-serif',
            fontWeight: 500,
            fontSize: `${labelTitlePx}px`,
            letterSpacing: '0.06em',
            color: PANEL_PRODUCT_NAME_COLOR,
            width: `${labelBoxPx}px`,
            maxWidth: `${labelBoxPx}px`,
            opacity: reveal > 0.35 ? 1 : 0,
            pointerEvents: 'none',
            userSelect: 'none'
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ whiteSpace: 'nowrap' }}>Miel</div>
            <div
              style={{
                marginTop: '-7px',
                fontFamily: 'avenir-lt-pro, sans-serif',
                fontWeight: 700,
                fontSize: '8px',
                letterSpacing: '0.01em',
                color: MIEL_PANEL_TAGLINE_COLOR
              }}
            >
              Golden, slow, and softly sweet.
            </div>
            <div
              style={{
                marginTop: '2px',
                fontFamily: 'avenir-lt-pro, sans-serif',
                fontWeight: 400,
                fontSize: '6px',
                letterSpacing: '0.01em',
                lineHeight: 1.2,
                whiteSpace: 'pre-line',
                width: `${profileBoxPx}px`,
                maxWidth: `${profileBoxPx}px`,
                marginLeft: 'auto',
                marginRight: 'auto',
                overflowWrap: 'normal',
                color: 'rgba(255,255,255,0.92)'
              }}
            >
              {'wild honey • blood orange •\nagave'}
            </div>
          </div>
        </Html>
        <Suspense fallback={null}>
          <SideBottle
            modelPath="/Tequila02.glb"
            side="left"
            label="Dorado"
            subtitle="Aged in warmth."
            profile={'toasted vanilla •\ncaramelized agave • light oak'}
            textOutroProgress={textOutroProgress}
            scrollProgress={scrollProgress}
            narrowViewport={narrowViewport}
            compressBottleSpacing={compressBottleSpacing}
            panelSurfaceColor={DORADO_PANEL_SURFACE}
            panelOpacityMul={0.96}
            panelEmissiveIntensity={0.08}
            panelRoughness={0.45}
            titleColor={PANEL_PRODUCT_NAME_COLOR}
          />
          <SideBottle
            modelPath="/Tequila03.glb"
            side="right"
            label="Ámbar"
            subtitle="Deep glow, slow heat."
            profile="apricot • golden raisin • soft spice"
            textOutroProgress={textOutroProgress}
            scrollProgress={scrollProgress}
            narrowViewport={narrowViewport}
            compressBottleSpacing={compressBottleSpacing}
            panelSurfaceColor={AMBAR_PANEL_SURFACE}
            panelOpacityMul={0.96}
            panelEmissiveIntensity={0.08}
            panelRoughness={0.45}
            titleColor={PANEL_PRODUCT_NAME_COLOR}
            taglineColor={AMBAR_PANEL_TAGLINE_COLOR}
          />
          <BottleModel
            scrollProgress={scrollProgress}
            narrowViewport={narrowViewport}
            titleExitProgress={titleExitProgress}
            bottleSettleProgress={bottleSettleProgress}
            textOutroProgress={textOutroProgress}
          />
        </Suspense>
      </group>
      <Environment preset="city" />
    </>
  )
}

function App() {
  const [scrollProgress, setScrollProgress] = useState(0)
  const [titleExitProgress, setTitleExitProgress] = useState(0)
  const [bottleSettleProgress, setBottleSettleProgress] = useState(0)
  const [textOutroProgress, setTextOutroProgress] = useState(0)
  const [sceneSlideProgress, setSceneSlideProgress] = useState(0)
  const [narrowViewport, setNarrowViewport] = useState(false)
  /** ≤1100px: pull side bottles in + wider FOV so Ámbar stays in frame on tablets */
  const [compressBottleSpacing, setCompressBottleSpacing] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(max-width: 1100px)').matches
  })
  /** ≤1200px: tablets / small widths — stronger off-screen offset so “Pure Gold” never peeks */
  const [pureGoldOffscreenBoost, setPureGoldOffscreenBoost] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(max-width: 1200px)').matches
  })
  /** Phone / small tablet only — laptops keep full story + specs column */
  const [heroCompactLayout, setHeroCompactLayout] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(max-width: 900px)').matches
  })
  const stageRef = useRef(null)
  const scrollPhaseRef = useRef({ scroll: 0, exit: 0, settle: 0, textOutro: 0, slide: 0 })

  const clamp01 = (n) => Math.min(Math.max(n, 0), 1)
  // Keep the bottle "initial screen" visible for a moment.
  // At `scrollProgress === 1`, both text and bottle end together.
  const floatProgress = clamp01((scrollProgress - 0.05) / 0.95)
  const heroSequenceComplete =
    scrollProgress >= 0.998 &&
    titleExitProgress >= 0.998 &&
    bottleSettleProgress >= 0.998
  const textOutroEffectiveProgress = clamp01(
    (textOutroProgress - TEXT_OUTRO_START) / (1 - TEXT_OUTRO_START)
  )
  const textVisibleProgress = heroSequenceComplete ? 1 - textOutroEffectiveProgress : 0
  const textOutroOffset = textOutroEffectiveProgress * 72
  const textSlideX =
    sceneSlideProgress *
    (narrowViewport ? 1780 : compressBottleSpacing ? 1560 : pureGoldOffscreenBoost ? 1460 : 1640)
  const showPureGoldLayer = heroSequenceComplete && textOutroProgress >= 1
  /** Large screens: headline eases in only after part of the scene slide (3D clears first). */
  const pureGoldSlideHold = narrowViewport ? 0 : compressBottleSpacing ? 0.08 : 0.14
  const pureGoldT =
    sceneSlideProgress <= pureGoldSlideHold
      ? 0
      : clamp01((sceneSlideProgress - pureGoldSlideHold) / (1 - pureGoldSlideHold))
  /** Per-letter stagger uses this sub-progress so the rise starts on-screen (later on phone). */
  const pureGoldLetterAnimDelay = narrowViewport ? 0.64 : compressBottleSpacing ? 0.44 : 0.32
  const pureGoldLetterProgress =
    pureGoldT <= pureGoldLetterAnimDelay
      ? 0
      : clamp01((pureGoldT - pureGoldLetterAnimDelay) / (1 - pureGoldLetterAnimDelay))
  const pureGoldTransform = pureGoldOffscreenBoost
    ? 'translate3d(calc((1 - var(--pure-gold-t, 0)) * (-82dvw - 68%)), 0, 0)'
    : 'translate3d(calc((1 - var(--pure-gold-t, 0)) * (-52vw - 52%)), 0, 0)'

  const heroCameraSettings = useMemo(
    () => ({
      position: [0, 0, 4.2],
      fov: narrowViewport ? 43 : compressBottleSpacing ? 38 : 35,
      near: 0.01,
      far: 100
    }),
    [narrowViewport, compressBottleSpacing]
  )

  const menuItems = [
    { label: 'Home', ariaLabel: 'Go to home page', link: '/' },
    { label: 'About', ariaLabel: 'Learn about us', link: '/about' },
    { label: 'Services', ariaLabel: 'View our services', link: '/services' },
    { label: 'Contact', ariaLabel: 'Get in touch', link: '/contact' },
  ]

  useEffect(() => {
    const mq700 = window.matchMedia('(max-width: 700px)')
    const mq900 = window.matchMedia('(max-width: 900px)')
    const mq1100 = window.matchMedia('(max-width: 1100px)')
    const mq1200 = window.matchMedia('(max-width: 1200px)')
    const sync = () => {
      setNarrowViewport(mq700.matches)
      setHeroCompactLayout(mq900.matches)
      setCompressBottleSpacing(mq1100.matches)
      setPureGoldOffscreenBoost(mq1200.matches)
    }
    sync()
    mq700.addEventListener('change', sync)
    mq900.addEventListener('change', sync)
    mq1100.addEventListener('change', sync)
    mq1200.addEventListener('change', sync)
    return () => {
      mq700.removeEventListener('change', sync)
      mq900.removeEventListener('change', sync)
      mq1100.removeEventListener('change', sync)
      mq1200.removeEventListener('change', sync)
    }
  }, [])

  const onWheel = useCallback((e) => {
    e.preventDefault()
    const delta = e.deltaY
    const scrollStep = delta * 0.0008
    // floatProgress runs 0→1 over scrollProgress 0.05→1 (span 0.95). Scale exit so
    // the same total wheel travel scrubs headline in vs out.
    const exitStep = (delta * 0.0008) / 0.95
    const settleStep = exitStep * SETTLE_SCROLL_MULT
    const textOutroStep = exitStep * 0.8
    const sceneSlideStep = exitStep * 0.9
    const s = scrollPhaseRef.current

    if (delta < 0) {
      if (s.slide > 0) {
        s.slide = Math.max(0, s.slide + sceneSlideStep)
        setSceneSlideProgress(s.slide)
        return
      }
      if (s.textOutro > 0) {
        s.textOutro = Math.max(0, s.textOutro + textOutroStep)
        setTextOutroProgress(s.textOutro)
        return
      }
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
      return
    }

    if (s.textOutro < 1) {
      s.textOutro = Math.min(1, s.textOutro + textOutroStep)
      setTextOutroProgress(s.textOutro)
      return
    }

    if (s.slide < 1) {
      s.slide = Math.min(1, s.slide + sceneSlideStep)
      setSceneSlideProgress(s.slide)
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

  useEffect(() => {
    scrollPhaseRef.current.textOutro = textOutroProgress
  }, [textOutroProgress])

  useEffect(() => {
    scrollPhaseRef.current.slide = sceneSlideProgress
  }, [sceneSlideProgress])

  return (
    <>
      <div className="stage" ref={stageRef}>
        <StaggeredMenu
          isFixed
          position="right"
          logoUrl="/Aurero_Logo.svg"
          items={menuItems}
          displaySocials={false}
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

        <Canvas camera={heroCameraSettings} className="stage__canvas">
          <BottleScene
            scrollProgress={scrollProgress}
            narrowViewport={narrowViewport}
            compressBottleSpacing={compressBottleSpacing}
            pureGoldOffscreenBoost={pureGoldOffscreenBoost}
            titleExitProgress={titleExitProgress}
            bottleSettleProgress={bottleSettleProgress}
            textOutroProgress={textOutroEffectiveProgress}
            sceneSlideProgress={sceneSlideProgress}
          />
        </Canvas>

        {showPureGoldLayer ? (
          <div
            className="stage__pureGold"
            aria-hidden={sceneSlideProgress < 0.01}
          >
            <div
              className="stage__pureGoldShift"
              style={{
                '--pure-gold-t': pureGoldT,
                transform: pureGoldTransform
              }}
            >
              <div className="stage__pureGoldStack">
                <PureGoldHeading progress={pureGoldLetterProgress} />
                <a
                  className="stage__cta stage__cta--primary stage__pureGoldCta"
                  href="/shop"
                >
                  Shop now
                </a>
              </div>
            </div>
          </div>
        ) : null}

        <div
          className={`stage__heroOutro${heroSequenceComplete ? ' stage__heroOutro--visible' : ''}`}
          aria-hidden={!heroSequenceComplete}
          style={{
            opacity: textVisibleProgress,
            transform: `translate(${textSlideX}px, ${-textOutroOffset}px)`
          }}
        >
          <p className="stage__tagline">
            <span className="stage__taglineLine">Born of Sun.</span>
            <span className="stage__taglineLine">Poured in Gold.</span>
          </p>
          <div className="stage__heroBottomStack">
            <div className="stage__brandStoryWrap">
              <p className="stage__brandStory">
                {heroCompactLayout ? HERO_BRAND_STORY_SHORT : HERO_BRAND_STORY_FULL}
              </p>
            </div>
            <div className="stage__heroOutroCtas">
              <a className="stage__cta stage__cta--primary" href="/shop">
                Shop now
              </a>
              <a className="stage__cta stage__cta--ghost" href="/about">
                Learn more
              </a>
            </div>
          </div>
        </div>

        {!heroCompactLayout ? (
          <aside
            className={`stage__heroSpecs${heroSequenceComplete ? ' stage__heroSpecs--visible' : ''}`}
            aria-label="Product details"
            aria-hidden={!heroSequenceComplete}
            style={{
              opacity: textVisibleProgress,
              transform: `translate(${textSlideX}px, ${-textOutroOffset}px)`
            }}
          >
            <section className="stage__heroSpec">
              <h3 className="stage__heroSpecTitle">AGAVE</h3>
              <p className="stage__heroSpecText">100% Blue Weber</p>
            </section>
            <section className="stage__heroSpec">
              <h3 className="stage__heroSpecTitle">REGION</h3>
              <p className="stage__heroSpecText">Highlands, Jalisco</p>
            </section>
            <section className="stage__heroSpec">
              <h3 className="stage__heroSpecTitle">RESTING</h3>
              <p className="stage__heroSpecText">Oak Rested</p>
            </section>
            <section className="stage__heroSpec">
              <h3 className="stage__heroSpecTitle">EXPRESSIONS</h3>
              <ul className="stage__heroSpecList">
                <li>Miel</li>
                <li>Dorado</li>
                <li>Ámbar</li>
              </ul>
            </section>
            <section className="stage__heroSpec">
              <h3 className="stage__heroSpecTitle">FINISH</h3>
              <p className="stage__heroSpecText">Smooth / Layered / Golden</p>
            </section>
          </aside>
        ) : null}

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
