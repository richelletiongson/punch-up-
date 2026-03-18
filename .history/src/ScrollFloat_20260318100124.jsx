import { useEffect, useMemo, useRef } from 'react'
import { gsap } from 'gsap'

import './ScrollFloat.css'

/**
 * Character-based "float in" animation.
 *
 * This project doesn't currently use GSAP ScrollTrigger, so `progress` (0..1)
 * directly drives the tween. If you later reintroduce real scrolling, you can
 * wire `progress` to ScrollTrigger's callback instead.
 */
const ScrollFloat = ({
  children,
  progress,
  as = 'h2',
  containerClassName = '',
  textClassName = '',
  animationDuration = 1,
  ease = 'back.inOut(2)',
  scrollStart, // accepted for API parity with the provided snippet
  scrollEnd, // accepted for API parity with the provided snippet
  scrollContainerRef, // accepted for API parity with the provided snippet
  stagger = 0.03
}) => {
  const containerRef = useRef(null)
  const tweenRef = useRef(null)

  const text = typeof children === 'string' ? children : ''
  const rangeStart = typeof scrollStart === 'number' ? scrollStart : 0
  const rangeEnd = typeof scrollEnd === 'number' ? scrollEnd : 1

  const splitText = useMemo(() => {
    // Use normal spaces (not NBSP) so long copy can wrap.
    return text.split('').map((char, index) => (
      <span className="char" key={index}>
        {char === ' ' ? ' ' : char}
      </span>
    ))
  }, [text])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const charElements = el.querySelectorAll('.char')
    if (!charElements.length) return

    tweenRef.current?.kill()

    const tween = gsap.fromTo(
      charElements,
      {
        willChange: 'opacity, transform',
        opacity: 0,
        yPercent: 120,
        scaleY: 2.3,
        scaleX: 0.7,
        transformOrigin: '50% 0%'
      },
      {
        duration: animationDuration,
        ease,
        opacity: 1,
        yPercent: 0,
        scaleY: 1,
        scaleX: 1,
        stagger,
        // We'll drive this tween's progress manually.
        paused: true
      }
    )

    // Ensure we're exactly at the "start" state.
    tween.progress(0)

    tweenRef.current = tween
    return () => {
      tweenRef.current?.kill()
      tweenRef.current = null
    }
  }, [text, animationDuration, ease, stagger, scrollContainerRef])

  useEffect(() => {
    const tween = tweenRef.current
    if (!tween) return
    const pRaw = typeof progress === 'number' ? progress : 0
    const denom = rangeEnd - rangeStart
    const p =
      denom > 0 ? (pRaw - rangeStart) / denom : 0
    tween.progress(Math.min(Math.max(p, 0), 1))
  }, [progress, rangeStart, rangeEnd])

  const Element = as

  return (
    <Element ref={containerRef} className={`scroll-float ${containerClassName}`}>
      <span className={`scroll-float-text ${textClassName}`}>{splitText}</span>
    </Element>
  )
}

export default ScrollFloat

