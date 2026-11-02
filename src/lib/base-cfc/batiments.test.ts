import { describe, it, expect } from 'vitest'
import { donneesDuBatiment } from './batiment'
import { batimentsDuDossier, cumulerLesBatiments, nomDuBatiment } from './batiments'
import type { ApiBatiment } from '../api-types'

const bat = (o: Partial<ApiBatiment>): ApiBatiment => ({ id: 'b', ...o })

// Champrilly 16-18-20 : trois entrées d'une même barre, mitoyennes.
const CHAMPRILLY = [
  bat({ id: 'b1', adresse: 'Avenue de Champrilly 16', floorArea: 687, builtArea: 173, nbFloors: 3, nbApartments: 7, nbStaircases: 1 }),
  bat({ id: 'b2', adresse: 'Avenue de Champrilly 18', floorArea: 720, builtArea: 180, nbFloors: 3, nbApartments: 8, nbStaircases: 1 }),
  bat({ id: 'b3', adresse: 'Avenue de Champrilly 20', floorArea: 687, builtArea: 166, nbFloors: 4, nbApartments: 6, nbStaircases: 1 }),
]

describe('cumul des bâtiments', () => {
  it('additionne ce qui est extensif', () => {
    const c = cumulerLesBatiments(CHAMPRILLY)
    expect(c.nombre).toBe(3)
    expect(c.floorArea).toBe(2094)
    expect(c.builtArea).toBe(519)
    expect(c.nbApartments).toBe(21)
    expect(c.nbStaircases).toBe(3)
  })

  it('prend la hauteur du bâtiment le plus haut, jamais la somme', () => {
    // Trois immeubles de trois étages ne font pas un immeuble de neuf : c'est la
    // partie la plus haute qui fixe l'échafaudage.
    expect(cumulerLesBatiments(CHAMPRILLY).nbFloors).toBe(4)
  })

  it('cumule les typologies de logements', () => {
    const c = cumulerLesBatiments([
      bat({ id: 'a', apartmentTypes: { '3.5': 4, '4.5': 3 } }),
      bat({ id: 'b', apartmentTypes: { '3.5': 2, '2.5': 5 } }),
    ])
    expect(c.apartmentTypes).toEqual({ '3.5': 6, '4.5': 3, '2.5': 5 })
  })

  it('ne rend rien plutôt que zéro quand aucun bâtiment ne renseigne le champ', () => {
    // Zéro mètre carré est une affirmation, l'absence est une question.
    const c = cumulerLesBatiments([bat({ id: 'a', adresse: 'Rue du Test 1' })])
    expect(c.floorArea).toBeNull()
    expect(c.nbApartments).toBeNull()
  })

  it('écarte les bâtiments vides et garde ceux qui disent quelque chose', () => {
    expect(batimentsDuDossier([bat({ id: 'a' }), bat({ id: 'b', adresse: 'Rue 2' })])).toHaveLength(1)
    expect(batimentsDuDossier([bat({ id: 'a' })])).toBeNull()
    expect(batimentsDuDossier(null)).toBeNull()
    expect(batimentsDuDossier('trois')).toBeNull()
  })

  it('nomme un bâtiment par son adresse, ou par son rang', () => {
    expect(nomDuBatiment(CHAMPRILLY[1], 1)).toBe('Avenue de Champrilly 18')
    expect(nomDuBatiment(bat({ id: 'x', floorArea: 100 }), 2)).toBe('Bâtiment 3')
  })
})

describe('la fiche du dossier avec plusieurs bâtiments', () => {
  const FICHE = { perimeter: 101, floorHeight: 2.7, windowPct: 20, terrainArea: 2400 }

  it('sert au devis les surfaces cumulées', () => {
    const d = donneesDuBatiment({ ...FICHE, batiments: CHAMPRILLY })
    expect(d.surfacePlancher).toBe(2094)
    expect(d.surfaceBatie).toBe(519)
    expect(d.nombreLogements).toBe(21)
    expect(d.nombreCages).toBe(3)
    expect(d.nombrePortesEntree).toBe(3)
    expect(d.nombrePiecesEau).toBe(42)
  })

  it("n'additionne pas le périmètre : il se mesure sur le bloc", () => {
    // Trois entrées mitoyennes : additionner leurs périmètres compterait les
    // pignons mitoyens, qui ne reçoivent ni crépi ni échafaudage.
    const d = donneesDuBatiment({ ...FICHE, batiments: CHAMPRILLY })
    // 101 ml × 4 étages × 2,7 m
    expect(d.surfaceFacade).toBeCloseTo(1090.8, 1)
  })

  it('laisse la surface de terrain au dossier : une parcelle ne se multiplie pas', () => {
    expect(donneesDuBatiment({ ...FICHE, batiments: CHAMPRILLY }).surfaceTerrain).toBe(2400)
  })

  it('préfère une façade relevée au calcul par le périmètre', () => {
    const d = donneesDuBatiment({
      ...FICHE, batiments: CHAMPRILLY, facadeArea: 980,
      sources: { facadeArea: { source: 'plans', valeur: 980, majLe: '' } },
    })
    expect(d.surfaceFacade).toBe(980)
  })

  it('ne change rien à un dossier qui ne déclare aucun bâtiment', () => {
    const seul = { ...FICHE, floorArea: 687, builtArea: 173, nbFloors: 3, nbApartments: 7, nbStaircases: 1 }
    const avant = donneesDuBatiment(seul)
    const apres = donneesDuBatiment({ ...seul, batiments: [] })
    expect(apres).toEqual(avant)
    expect(avant.surfacePlancher).toBe(687)
  })

  it('fait passer les bâtiments avant les champs de la fiche', () => {
    // La fiche garde les valeurs d'un seul bâtiment, saisies avant la bascule :
    // elles ne doivent plus servir dès que les bâtiments sont décrits.
    const d = donneesDuBatiment({ ...FICHE, floorArea: 687, nbApartments: 7, batiments: CHAMPRILLY })
    expect(d.surfacePlancher).toBe(2094)
    expect(d.nombreLogements).toBe(21)
  })
})
