import { useSyncExternalStore } from 'react'

const PLAIN = 'Pure Gold'

function clamp01(x) {
  if (!Number.isFinite(x)) return 0
  return Math.min(1, Math.max(0, x))
}

function easeOutCubic(t) {
  const u = clamp01(t)
  return 1 - (1 - u) ** 3
}

function subscribeReducedMotion(onStoreChange) {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
  mq.addEventListener('change', onStoreChange)
  return () => mq.removeEventListener('change', onStoreChange)
}

function getReducedMotionSnapshot() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function getReducedMotionServerSnapshot() {
  return false
}

/**
 * Right → left: last letter rises first.
 * `progress` must match `--pure-gold-t` / horizontal slide so motion happens while the line is on screen.
 * (Using `sceneSlideProgress` finishes the stagger off-screen before `pureGoldT` moves.)
 */
function letterRiseEm(progress, letterIndexFromLeft, letterCount) {
  if (letterCount <= 0) return 0
  const p = clamp01(progress)
  const rtlRank = letterCount - 1 - letterIndexFromLeft
  const stagger = 0.09
  const win = 0.34
  const t = clamp01((p - rtlRank * stagger) / win)
  return (1 - easeOutCubic(t)) * 1.1
}

/**
 * @param {number} progress — same as `pureGoldT` / `--pure-gold-t` (headline slide-in 0→1).
 */
export default function PureGoldHeading({ progress = 0 }) {
  const reduceMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  )

  const letterCount = [...PLAIN].filter((c) => /\S/.test(c)).length
  let letterIndex = 0

  return (
    <h2 className="stage__pureGoldHeading ml6">
      <span className="text-wrapper">
        <span className="letters">
          {[...PLAIN].map((ch, si) => {
            if (!/\S/.test(ch)) {
              return (
                <span key={si} className="stage__pureGoldSpace">
                  {ch}
                </span>
              )
            }
            const i = letterIndex++
            const y = reduceMotion ? 0 : letterRiseEm(progress, i, letterCount)
            return (
              <span
                key={si}
                className="letter"
                style={{
                  transform: `translate3d(0, ${y}em, 0)`
                }}
              >
                {ch}
              </span>
            )
          })}
        </span>
      </span>
    </h2>
  )
}
