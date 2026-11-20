import { afterEach, describe, expect, it, vi } from 'vitest'

const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'
// L'iPad, sous iPadOS, se présente comme un Mac.
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15'
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

/** Un navigateur : son user agent, ses points tactiles, et s'il est ouvert depuis l'écran d'accueil. */
function navigateur(userAgent: string, maxTouchPoints = 0, ecranDAccueil = false) {
  vi.stubGlobal('navigator', { userAgent, maxTouchPoints })
  vi.stubGlobal('window', { matchMedia: (q: string) => ({ matches: ecranDAccueil && q.includes('standalone') }) })
}

/** Le module, relu avec ou sans adresse sur l'App Store. */
async function charger(lienAppStore = '') {
  vi.resetModules()
  vi.doMock('@/pages/marketing/accueil/contenu', () => ({ LIEN_APP_STORE: lienAppStore }))
  return import('./appareil-web')
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.doUnmock('@/pages/marketing/accueil/contenu')
})

describe('appareil', () => {
  it('reconnaît Android, l\'iPhone et l\'iPad qui se dit Mac', async () => {
    const { appareilMobile } = await charger()
    navigateur(ANDROID)
    expect(appareilMobile()).toBe('android')
    navigateur(IPHONE)
    expect(appareilMobile()).toBe('ios')
    navigateur(MAC, 5)
    expect(appareilMobile()).toBe('ios')
  })

  it('laisse un Mac et un PC tranquilles', async () => {
    const { appareilMobile } = await charger()
    navigateur(MAC, 0)
    expect(appareilMobile()).toBeNull()
    navigateur(WINDOWS)
    expect(appareilMobile()).toBeNull()
  })
})

describe('accès à l\'app web', () => {
  it('Android : refusé dans le navigateur, ouvert depuis l\'écran d\'accueil', async () => {
    const { accesWebRefuse } = await charger()
    navigateur(ANDROID)
    expect(accesWebRefuse()).toBe('android')
    navigateur(ANDROID, 5, true)
    expect(accesWebRefuse()).toBeNull()
  })

  it('iPhone et iPad : ouvert tant que l\'app n\'a pas d\'adresse sur l\'App Store', async () => {
    const { accesWebRefuse } = await charger('')
    navigateur(IPHONE)
    expect(accesWebRefuse()).toBeNull()
    navigateur(MAC, 5)
    expect(accesWebRefuse()).toBeNull()
  })

  it('iPhone et iPad : refusé dès que l\'app est sur l\'App Store, PWA comprise', async () => {
    const { accesWebRefuse } = await charger('https://apps.apple.com/ch/app/diagly/id0000000000')
    navigateur(IPHONE)
    expect(accesWebRefuse()).toBe('ios')
    navigateur(MAC, 5, true)
    expect(accesWebRefuse()).toBe('ios')
  })

  it('l\'ordinateur garde toujours l\'app web', async () => {
    const { accesWebRefuse } = await charger('https://apps.apple.com/ch/app/diagly/id0000000000')
    navigateur(WINDOWS)
    expect(accesWebRefuse()).toBeNull()
    navigateur(MAC, 0)
    expect(accesWebRefuse()).toBeNull()
  })
})
