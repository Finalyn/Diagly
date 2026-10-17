import { describe, it, expect } from 'vitest'
import {
  ameliorer, appliquer, assemblerPdf, coinsParDefaut, detecterFeuille, estConvexe, homographie, nomDuScan, ordonnerCoins, placement,
  proposerFormat, rapportDeLaFeuille, rectangle, redresser, seuilOtsu, tailleRedressee, type Point, type Quad,
} from './scan'

const proche = (p: Point, q: Point, tolerance: number) => {
  expect(Math.abs(p.x - q.x)).toBeLessThanOrEqual(tolerance)
  expect(Math.abs(p.y - q.y)).toBeLessThanOrEqual(tolerance)
}

/**
 * Une feuille de l × h mètres photographiée par un appareil de focale f (en
 * pixels), tournée selon trois angles, à une distance donnée : ses coins sur
 * la photo, comme les donnerait un téléphone tenu de biais.
 */
function photographier(l: number, h: number, angles: [number, number, number], distance: number, f: number, L: number, H: number): Quad {
  const [ax, ay, az] = angles.map((a) => (a * Math.PI) / 180)
  const rx = [[1, 0, 0], [0, Math.cos(ax), -Math.sin(ax)], [0, Math.sin(ax), Math.cos(ax)]]
  const ry = [[Math.cos(ay), 0, Math.sin(ay)], [0, 1, 0], [-Math.sin(ay), 0, Math.cos(ay)]]
  const rz = [[Math.cos(az), -Math.sin(az), 0], [Math.sin(az), Math.cos(az), 0], [0, 0, 1]]
  const mul = (a: number[][], b: number[][]) => a.map((ligne) => b[0].map((_, j) => ligne.reduce((s, v, k) => s + v * b[k][j], 0)))
  const r = mul(rz, mul(ry, rx))
  const coins: [number, number][] = [[-l / 2, -h / 2], [l / 2, -h / 2], [l / 2, h / 2], [-l / 2, h / 2]]
  return coins.map(([x, y]) => {
    const X = r[0][0] * x + r[0][1] * y + 0.02
    const Y = r[1][0] * x + r[1][1] * y - 0.01
    const Z = r[2][0] * x + r[2][1] * y + distance
    return { x: (f * X) / Z + L / 2, y: (f * Y) / Z + H / 2 }
  }) as Quad
}

describe('l’homographie', () => {
  const de = rectangle(400, 300)
  const vers: Quad = [{ x: 31, y: 52 }, { x: 377, y: 18 }, { x: 402, y: 290 }, { x: 12, y: 260 }]
  const m = homographie(de, vers)!

  it('envoie chaque coin sur son coin', () => {
    de.forEach((p, i) => proche(appliquer(m, p), vers[i], 1e-6))
  })

  it('se défait par l’homographie inverse', () => {
    const retour = homographie(vers, de)!
    const p = { x: 123, y: 77 }
    proche(appliquer(retour, appliquer(m, p)), p, 1e-6)
  })

  it('refuse des points alignés', () => {
    expect(homographie(de, [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }])).toBeNull()
  })
})

describe('les coins', () => {
  it('se remettent dans l’ordre quand on en tire un par-dessus son voisin', () => {
    const q = ordonnerCoins([{ x: 300, y: 10 }, { x: 10, y: 20 }, { x: 20, y: 200 }, { x: 290, y: 210 }])
    expect(q).toEqual([{ x: 10, y: 20 }, { x: 300, y: 10 }, { x: 290, y: 210 }, { x: 20, y: 200 }])
    expect(estConvexe(q)).toBe(true)
    expect(estConvexe([q[0], q[2], q[1], q[3]])).toBe(false)
  })

  it('se proposent en retrait des bords quand rien n’est détecté', () => {
    expect(coinsParDefaut(1000, 500)[0]).toEqual({ x: 40, y: 20 })
  })
})

describe('les proportions de la feuille', () => {
  const L = 4032, H = 3024, f = 3000

  it('retrouvent celles d’une feuille A3 photographiée de biais, à 1 % près', () => {
    for (const angles of [[28, 14, 6], [-20, 25, -12], [35, -10, 3]] as [number, number, number][]) {
      const coins = photographier(0.42, 0.297, angles, 0.75, f, L, H)
      expect(Math.abs(rapportDeLaFeuille(coins, L, H) / (420 / 297) - 1)).toBeLessThan(0.01)
    }
    const debout = photographier(0.297, 0.42, [22, 12, 4], 0.8, f, L, H)
    expect(Math.abs(rapportDeLaFeuille(debout, L, H) / (297 / 420) - 1)).toBeLessThan(0.01)
  })

  it('valent celles des côtés pour une feuille vue de face', () => {
    const coins = photographier(0.42, 0.297, [0, 0, 0], 0.7, f, L, H)
    expect(rapportDeLaFeuille(coins, L, H)).toBeCloseTo(420 / 297, 4)
  })

  it('font proposer l’orientation, et disent si la feuille est au format A', () => {
    expect(proposerFormat(1.41)).toMatchObject({ orientation: 'paysage', conforme: true })
    expect(proposerFormat(0.708)).toMatchObject({ orientation: 'portrait', conforme: true })
    expect(proposerFormat(1.29).conforme).toBe(false)
  })

  it('donnent la taille de la feuille redressée à la résolution de la photo, sans dépasser la limite', () => {
    const coins: Quad = [{ x: 100, y: 100 }, { x: 3100, y: 160 }, { x: 3000, y: 2200 }, { x: 140, y: 2150 }]
    const t = tailleRedressee(coins, Math.SQRT2)
    // Le haut, le côté le plus long sur la photo, garde sa longueur.
    expect(t.largeur).toBe(Math.round(Math.hypot(3000, 60)))
    expect(t.hauteur).toBe(Math.round(Math.hypot(3000, 60) / Math.SQRT2))
    const petite = tailleRedressee(coins, Math.SQRT2, 1_000_000)
    expect(petite.largeur * petite.hauteur).toBeLessThanOrEqual(1_000_000 + petite.largeur + petite.hauteur)
  })
})

describe('la page du PDF', () => {
  it('couvre une feuille A3 paysage bord à bord quand l’image en a les proportions', () => {
    expect(placement(4200, 2970, 'A3', 'paysage')).toMatchObject({ largeur: 420, hauteur: 297, x: 0, y: 0, l: 420, h: 297, pleinePage: true })
  })

  it('loge sans la déformer une image qui n’en a pas les proportions', () => {
    const p = placement(4000, 3000, 'A3', 'paysage')
    expect(p.pleinePage).toBe(false)
    expect(p.h).toBeCloseTo(297, 6)
    expect(p.l).toBeCloseTo(396, 6)
    expect(p.x).toBeCloseTo(12, 6)
  })

  it('porte le nom du jour', () => {
    expect(nomDuScan(new Date(2026, 9, 17))).toBe('Scan du 17.10.2026.pdf')
  })
})

/** Un JPEG blanc de 8 × 6 pixels. */
const JPEG = Uint8Array.from(atob(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAAGAAgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD9U6KKKAP/2Q==',
), (c) => c.charCodeAt(0))

describe('l’assemblage', () => {
  it('met toutes les pages dans un seul PDF, chacune à la taille réelle de sa feuille', async () => {
    const pdf = await assemblerPdf([
      { jpeg: JPEG, largeurPx: 4200, hauteurPx: 2970, format: 'A3', orientation: 'paysage' },
      { jpeg: JPEG, largeurPx: 210, hauteurPx: 297, format: 'A4', orientation: 'portrait' },
    ])
    const texte = new TextDecoder('latin1').decode(pdf)
    expect(texte.startsWith('%PDF-')).toBe(true)
    // 420 × 297 mm et 210 × 297 mm, en points.
    const boites = [...texte.matchAll(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/g)].map((m) => [Number(m[1]), Number(m[2])])
    expect(boites).toHaveLength(2)
    expect(boites[0][0]).toBeCloseTo(420 * 72 / 25.4, 2)
    expect(boites[0][1]).toBeCloseTo(297 * 72 / 25.4, 2)
    expect(boites[1][0]).toBeCloseTo(210 * 72 / 25.4, 2)
    expect(boites[1][1]).toBeCloseTo(297 * 72 / 25.4, 2)
    expect(texte.match(/\/Type \/Page\b/g)).toHaveLength(2)
    expect(texte).toContain('/DCTDecode')
  })

  it('refuse un scan sans page', async () => {
    await expect(assemblerPdf([])).rejects.toThrow()
  })
})

/** Une photo de synthèse : un fond sombre et bruité, une feuille claire de biais, des traits dessus. */
function photoDeSynthese(L: number, H: number, coins: Quad | null): Uint8Array {
  const gris = new Uint8Array(L * H)
  let graine = 7
  const bruit = () => { graine = (graine * 1103515245 + 12345) % 2147483648; return (graine / 2147483648 - 0.5) * 16 }
  const dedans = (x: number, y: number, q: Quad) => {
    let c = false
    for (let i = 0, j = 3; i < 4; j = i++) {
      if ((q[i].y > y) !== (q[j].y > y) && x < ((q[j].x - q[i].x) * (y - q[i].y)) / (q[j].y - q[i].y) + q[i].x) c = !c
    }
    return c
  }
  // Le cadre du dessin, à quelques pixels du bord de la feuille, et un mur au milieu.
  const inv = coins && homographie(coins, rectangle(1, 1))
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < L; x++) {
      let v = 60 + bruit()
      if (coins && inv && dedans(x + 0.5, y + 0.5, coins)) {
        v = 215 + bruit()
        const p = appliquer(inv, { x: x + 0.5, y: y + 0.5 })
        const cadre = (Math.abs(p.x - 0.03) < 0.004 || Math.abs(p.x - 0.97) < 0.004 || Math.abs(p.y - 0.04) < 0.005 || Math.abs(p.y - 0.96) < 0.005)
          && p.x > 0.025 && p.x < 0.975 && p.y > 0.035 && p.y < 0.965
        if (cadre || (Math.abs(p.x - 0.5) < 0.006 && p.y > 0.2 && p.y < 0.8)) v = 40
      }
      gris[y * L + x] = Math.max(0, Math.min(255, Math.round(v)))
    }
  }
  return gris
}

describe('la détection de la feuille', () => {
  it('trouve les coins d’une feuille de biais sur un fond sombre, au pixel près', () => {
    const L = 360, H = 270
    const coins: Quad = [{ x: 52.3, y: 41.8 }, { x: 318.6, y: 28.4 }, { x: 331.2, y: 236.9 }, { x: 36.7, y: 224.1 }]
    const trouves = detecterFeuille({ largeur: L, hauteur: H, gris: photoDeSynthese(L, H, coins) })
    expect(trouves).not.toBeNull()
    trouves!.forEach((p, i) => proche(p, coins[i], 1.5))
  })

  it('ne propose rien sur une image sans contraste', () => {
    const gris = new Uint8Array(200 * 150).fill(128)
    expect(detecterFeuille({ largeur: 200, hauteur: 150, gris })).toBeNull()
    expect(seuilOtsu(gris).separation).toBe(0)
  })

  it('ne propose rien quand la feuille déborde du cadre', () => {
    const L = 300, H = 200
    const coins: Quad = [{ x: -20, y: -15 }, { x: 330, y: -10 }, { x: 320, y: 230 }, { x: -10, y: 220 }]
    expect(detecterFeuille({ largeur: L, hauteur: H, gris: photoDeSynthese(L, H, coins) })).toBeNull()
  })
})

describe('le redressement', () => {
  /** Une image où chaque pixel dit où il est : rouge = x, vert = y. */
  const source = (L: number, H: number) => {
    const data = new Uint8ClampedArray(L * H * 4)
    for (let y = 0; y < H; y++) for (let x = 0; x < L; x++) {
      const o = (y * L + x) * 4
      data[o] = x; data[o + 1] = y; data[o + 2] = 0; data[o + 3] = 255
    }
    return { largeur: L, hauteur: H, data }
  }

  it('recopie un cadre droit tel quel', () => {
    const s = source(100, 100)
    const r = redresser(s, [{ x: 20, y: 10 }, { x: 80, y: 10 }, { x: 80, y: 70 }, { x: 20, y: 70 }], 60, 60)
    expect([r[0], r[1]]).toEqual([20, 10])
    const o = (59 * 60 + 59) * 4
    expect([r[o], r[o + 1]]).toEqual([79, 69])
  })

  it('remet droite une feuille photographiée couchée', () => {
    const s = source(100, 100)
    // La feuille tournée d'un quart de tour : son haut-gauche est en bas à gauche de la photo.
    const r = redresser(s, [{ x: 10, y: 90 }, { x: 10, y: 10 }, { x: 90, y: 10 }, { x: 90, y: 90 }], 80, 80)
    expect([r[0], r[1]]).toEqual([10, 89])
    const o = (0 * 80 + 79) * 4
    expect([r[o], r[o + 1]]).toEqual([10, 10])
  })
})

describe('l’amélioration d’un plan photographié', () => {
  // Un papier éclairé de travers (de 140 à 230), un trait fin gris et un trait épais noir.
  const L = 240, H = 120
  const photo = () => {
    const data = new Uint8ClampedArray(L * H * 4)
    for (let y = 0; y < H; y++) for (let x = 0; x < L; x++) {
      const papier = 140 + (90 * x) / L
      let v = papier
      if (x === 60 || x === 180) v = papier * 0.55
      if (y >= 50 && y < 56) v = papier * 0.12
      const o = (y * L + x) * 4
      data[o] = v; data[o + 1] = v * 0.97; data[o + 2] = v * 0.9; data[o + 3] = 255
    }
    return data
  }

  it('rend le papier blanc partout, ombre comprise, sans perdre les traits fins', () => {
    const d = photo()
    ameliorer(d, L, H, 'noir_blanc')
    const px = (x: number, y: number) => d[(y * L + x) * 4]
    for (const x of [5, 100, 230]) expect(px(x, 20)).toBeGreaterThanOrEqual(245)
    // Le trait fin reste un gris, nettement plus sombre que le papier, ni effacé ni noirci.
    for (const x of [60, 180]) {
      expect(px(x, 20)).toBeLessThan(200)
      expect(px(x, 20)).toBeGreaterThan(20)
    }
    expect(px(120, 52)).toBeLessThan(30)
    expect(d[(20 * L + 100) * 4 + 1]).toBe(px(100, 20))
  })

  it('en couleur, blanchit le papier et garde les traits', () => {
    const d = photo()
    ameliorer(d, L, H, 'couleur')
    const o = (20 * L + 200) * 4
    expect(Math.min(d[o], d[o + 1], d[o + 2])).toBeGreaterThanOrEqual(240)
    expect(d[(52 * L + 200) * 4]).toBeLessThan(40)
  })
})
