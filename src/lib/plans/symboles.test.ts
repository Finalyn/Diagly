import { describe, it, expect } from 'vitest'
import { chercherSymbole, gabaritDansLeCadre, variantes } from './symboles'
import { FACADE_SUD, OUVERTURES_FACADE, PLAN_ETAGE_TYPE, geometrieDePdf, pdfEtageType, pdfFacade, versCanevas, type PlanDeTest } from './plans-de-test'
import { IndexGeometrie } from './geometrie-vectorielle'

/** Le cadre, en pixels du canevas, d'un rectangle donné en mètres du bâtiment (y vers le haut). */
function cadre(plan: PlanDeTest, x1: number, y1: number, x2: number, y2: number) {
  const a = versCanevas(plan, x1, y2)
  const b = versCanevas(plan, x2, y1)
  return { x: a.x, y: a.y, largeur: b.x - a.x, hauteur: b.y - a.y }
}

describe('le gabarit d’un symbole', () => {
  it('ne garde que les traits entièrement dans le cadre', () => {
    const geo = { segments: new Float64Array([0, 0, 10, 0, 10, 0, 10, 10, 0, 0, 10, 10, 0, 0, 50, 0]), nombre: 4, tronquee: false }
    const g = gabaritDansLeCadre(geo, { x: -1, y: -1, largeur: 12, hauteur: 12 })!
    expect(g.segments.length / 4).toBe(3)
    expect(gabaritDansLeCadre(geo, { x: -1, y: -1, largeur: 2, hauteur: 2 })).toBeNull()
  })

  it('a huit variantes, moins celles qu’une symétrie rend identiques', () => {
    const carre = { segments: [-5, -5, 5, -5, 5, -5, 5, 5, 5, 5, -5, 5, -5, 5, -5, -5], largeur: 10, hauteur: 10 }
    expect(variantes(carre)).toHaveLength(1)
    const equerre = { segments: [0, 0, 10, 0, 0, 0, 0, 4, 10, 0, 10, 1], largeur: 10, hauteur: 4 }
    expect(variantes(equerre)).toHaveLength(8)
  })
})

describe('la recherche sur la façade de test', () => {
  it('retrouve les quatorze fenêtres de la façade à partir d’une seule', async () => {
    const g = await geometrieDePdf(pdfFacade(), 1, 1600, { courbes: true })
    const premiere = OUVERTURES_FACADE[0]
    const c = cadre(FACADE_SUD, premiere.x - 0.08, premiere.y - 0.03, premiere.x + premiere.largeur + 0.08, premiere.y + premiere.hauteur + 0.03)
    const gabarit = gabaritDansLeCadre(g.geo, c)!
    expect(gabarit).not.toBeNull()
    const trouvees = chercherSymbole(g.index, gabarit)
    expect(trouvees).toHaveLength(14)
    // Chaque occurrence tombe au centre d'une fenêtre dessinée.
    const centres = OUVERTURES_FACADE.filter((o) => o.type === 'fenetre').map((o) => versCanevas(FACADE_SUD, o.x + o.largeur / 2, o.y + o.hauteur / 2))
    for (const t of trouvees) expect(Math.min(...centres.map((p) => Math.hypot(p.x - t.x, p.y - t.y)))).toBeLessThan(2)
  })

  it('reconnaît une porte qui s’ouvre dans l’autre sens', async () => {
    const g = await geometrieDePdf(pdfEtageType(), 1, 1600, { courbes: true })
    // La porte de la première chambre du logement A : 0,80 m, dans la cloison y = 6,00.
    const gabarit = gabaritDansLeCadre(g.geo, cadre(PLAN_ETAGE_TYPE, 1.97, 6.1, 2.83, 6.95))!
    expect(gabarit).not.toBeNull()
    const trouvees = chercherSymbole(new IndexGeometrie(g.geo), gabarit)
    // Elle-même, et sa jumelle en miroir dans le logement B, ouverte de l'autre côté.
    expect(trouvees.length).toBeGreaterThanOrEqual(2)
    const miroir = versCanevas(PLAN_ETAGE_TYPE, 20 - 2.4, 6.5)
    expect(trouvees.some((t) => Math.hypot(t.x - miroir.x, t.y - miroir.y) < 12)).toBe(true)
  })
})
