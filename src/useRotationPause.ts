import { useEffect, useRef } from 'react'

/** Freeze an active exercise/battle when a phone changes orientation. */
export function useRotationPause(enabled: boolean, onRotate: () => void) {
  const latest = useRef(onRotate)
  latest.current = onRotate
  useEffect(() => {
    if (!enabled) return
    let landscape = window.innerWidth > window.innerHeight
    const resize = () => {
      const next = window.innerWidth > window.innerHeight
      const phone = Math.max(window.innerWidth, window.innerHeight) <= 1100 && Math.min(window.innerWidth, window.innerHeight) <= 600
      if (next !== landscape && phone) latest.current()
      landscape = next
    }
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [enabled])
}
