import { useState } from 'react'

export type GuideMode = 'off' | 'ask' | 'always'
const KEY = 'diagly.guideMode'

/** Mode du guide IA terrain, persiste en localStorage. 'ask' par defaut. */
export function useGuideMode(): [GuideMode, (m: GuideMode) => void] {
  const [mode, setMode] = useState<GuideMode>(() => {
    try {
      const v = localStorage.getItem(KEY)
      if (v === 'off' || v === 'ask' || v === 'always') return v
    } catch { /* ignore */ }
    return 'ask'
  })
  const set = (m: GuideMode) => {
    setMode(m)
    try { localStorage.setItem(KEY, m) } catch { /* ignore */ }
  }
  return [mode, set]
}

export const GUIDE_MODE_LABELS: Record<GuideMode, string> = {
  off: 'Sans guide',
  ask: 'À la demande',
  always: 'Toujours',
}
