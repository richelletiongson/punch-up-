import { useEffect, useMemo, useRef } from 'react'
import { gsap } from 'gsap'

import './ScrollFloat.css'

/**
 * Character-based float in/out. `progress` (0..1) scrubs the entrance; after the main
 * scroll completes, `exitProgress` (0..1) scrubs a staggered exit.
 */
const ScrollFloat = ({
  children,
  progress,
  exitProgress = 0,
  as = 'h2',
  containerClassName = '',
  textClassName = '',
  animationDuration = 1,
  ease = 'back.inOut(2)',
  scrollStart,
  scrollEnd,
  scrollContainerRef,
  stagger = 0.03,
  exitEase = 'power3.in'
}) => {
  const containerRef = useRef(null)
  const timelineRef = useRef(null)

  const text = typeof children === 'string' ? children : ''
  const rangeStart = typeof scrollStart === 'number' ? scrollStart : 0
  const rangeEnd = typeof scrollEnd === 'number' ? scrollEnd : 1

  const splitText = useMemo(() => {
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

    timelineRef.current?.kill()

    const enterDur = animationDuration
    const exitDur = Math.max(0.4, animationDuration * 0.72)

    const tl = gsap.timeline({ paused: true })

    tl.fromTo(
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
        duration: enterDur,
        ease,
        opacity: 1,
        yPercent: 0,
        scaleY: 1,
        scaleX: 1,
        stagger
      }
    )

    tl.to(
      charElements,
      {
        duration: exitDur,
        ease: exitEase,
        opacity: 0,
        yPercent: -125,
        scaleY: 1.35,
        scaleX: 0.82,
        stagger,
        transformOrigin: '50% 0%'
      },
      `+=0`
    )

    tl.pause(0)
    timelineRef.current = tl
    return () => {
      timelineRef.current?.kill()
      timelineRef.current = null
    }
  }, [text, animationDuration, ease, exitEase, stagger, scrollContainerRef])

  useEffect(() => {
    const el = containerRef.current
    const tl = timelineRef.current
    if (!tl || !el) return

    const n = el.querySelectorAll('.char').length
    const staggerPad = Math.max(0, n - 1) * stagger

    const pRaw = typeof progress === 'number' ? progress : 0
    const denom = rangeEnd - rangeStart
    const p = denom > 0 ? (pRaw - rangeStart) / denom : 0
    const pr = Math.min(Math.max(p, 0), 1)

    const ep =
      typeof exitProgress === 'number'
        ? Math.min(Math.max(exitProgress, 0), 1)
        : 0

    const enterDur = animationDuration
    const exitDur = Math.max(0.4, animationDuration * 0.72)
    const enterSpan = enterDur + staggerPad
    const exitSpan = exitDur + staggerPad

    let t = 0
    if (ep > 0) {
      t = enterSpan + ep * exitSpan
    } else {
      t = pr * enterSpan
    }

    tl.time(t)
  }, [
    progress,
    exitProgress,
    rangeStart,
    rangeEnd,
    animationDuration,
    stagger
  ])

  const Element = as

  return (
    <Element ref={containerRef} className={`scroll-float ${containerClassName}`}>
      <span className={`scroll-float-text ${textClassName}`}>{splitText}</span>
    </Element>
  )
}

export default ScrollFloat
