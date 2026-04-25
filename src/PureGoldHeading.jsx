import { useEffect, useRef } from 'react'
import anime from 'animejs'

/**
 * “Pure Gold” with ML6-style staggered letter rise + looped fade (anime.js).
 */
export default function PureGoldHeading() {
  const rootRef = useRef(null)
  const lettersRef = useRef(null)
  const timelineRef = useRef(null)

  useEffect(() => {
    const root = rootRef.current
    const letters = lettersRef.current
    if (!root || !letters) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }

    const raw = letters.textContent ?? ''
    letters.innerHTML = raw.replace(/\S/g, "<span class='letter'>$&</span>")

    const timeline = anime
      .timeline({ loop: true })
      .add({
        targets: root.querySelectorAll('.letter'),
        translateY: ['1.1em', 0],
        translateZ: 0,
        duration: 750,
        delay: (_el, i) => 50 * i
      })
      .add({
        targets: root,
        opacity: 0,
        duration: 1000,
        easing: 'easeOutExpo',
        delay: 1000
      })

    timelineRef.current = timeline

    return () => {
      timeline.pause()
      if (root) {
        anime.remove(root.querySelectorAll('.letter'))
      }
      letters.textContent = raw
      root.style.opacity = ''
      timelineRef.current = null
    }
  }, [])

  return (
    <h2 ref={rootRef} className="stage__pureGoldHeading ml6">
      <span className="text-wrapper">
        <span ref={lettersRef} className="letters">
          Pure Gold
        </span>
      </span>
    </h2>
  )
}
