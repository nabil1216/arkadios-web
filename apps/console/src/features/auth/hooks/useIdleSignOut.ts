import { useEffect } from 'react'
import { signOut } from '../api/auth'

/** Sign staff out after `idleMinutes` without a click or key press (demo: 30). */
export function useIdleSignOut(idleMinutes: number) {
  useEffect(() => {
    let lastActive = Date.now()
    let lastTouch = 0
    const touch = () => {
      const now = Date.now()
      if (now - lastTouch < 10_000) return
      lastTouch = now
      lastActive = now
    }
    const events = ['click', 'keydown'] as const
    events.forEach((e) => document.addEventListener(e, touch, true))
    const timer = setInterval(() => {
      if (Date.now() - lastActive > idleMinutes * 60_000) void signOut('idle')
    }, 30_000)
    return () => {
      events.forEach((e) => document.removeEventListener(e, touch, true))
      clearInterval(timer)
    }
  }, [idleMinutes])
}
