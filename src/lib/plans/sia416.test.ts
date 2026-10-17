import { describe, it, expect } from 'vitest'
import { affectationParDefaut, etageSia416, surfacesSia416, type EntreeEtageSia416 } from './sia416'

describe('l’affectation d’un local par son nom', () => {
  it.each([
    ['Séjour', 'SUP'], ['Logement A, Séjour, cuisine', 'SUP'], ['Chambre parents', 'SUP'], ['Cuisine', 'SUP'],
    ['Salle de bains', 'SUP'], ['Bain', 'SUP'], ['WC & douche', 'SUP'], ['Salle d’eau', 'SUP'],
    ['Cave 3', 'SUS'], ['Buanderie', 'SUS'], ['Local à vélos', 'SUS'], ['Dépôt', 'SUS'], ['Abri PC', 'SUS'],
    ['Hall d’entrée', 'SD'], ['Couloir', 'SD'], ['Dégagement', 'SD'], ['Cage d’escalier, palier', 'SD'], ['Palier', 'SD'],
    ['Chaufferie', 'SI'], ['Local technique', 'SI'], ['Gaine technique', 'SI'],
  ] as const)('« %s » va en %s', (nom, categorie) => {
    expect(affectationParDefaut(nom)).toBe(categorie)
  })

  it('ne devine rien quand le nom ne dit rien', () => {
    expect(affectationParDefaut('Pièce 4')).toBeNull()
    expect(affectationParDefaut('')).toBeNull()
    expect(affectationParDefaut(null)).toBeNull()
  })

  it('reconnaît « chambre » sans se laisser prendre par un mot qui la contient', () => {
    expect(affectationParDefaut('Antichambres')).toBeNull()
  })
})

const rez: EntreeEtageSia416 = {
  cle: 'p#1', nom: 'Rez', multiplicateur: 1,
  emprises: [102.08], dalles: [],
  pieces: [
    { id: 'a', nom: 'Séjour', surface: 40 },
    { id: 'b', nom: 'Couloir', surface: 8 },
    { id: 'c', nom: 'Chaufferie', surface: 6 },
    { id: 'd', nom: 'Cave', surface: 10 },
    { id: 'e', nom: 'Pièce 5', surface: 4 },
  ],
}

describe('les surfaces d’un étage', () => {
  const e = etageSia416(rez)

  it('prend la SP sur l’emprise, la SN sur les pièces, et la SC par différence', () => {
    expect(e.sp).toBeCloseTo(102.08, 9)
    expect(e.sourceSp).toBe('emprise')
    expect(e.sn).toBeCloseTo(68, 9)
    expect(e.sc).toBeCloseTo(34.08, 9)
  })

  it('range la SN par catégorie, et garde à part ce qui n’est pas affecté', () => {
    expect(e.categories).toEqual({ SUP: 40, SUS: 10, SD: 8, SI: 6 })
    expect(e.su).toBe(50)
    expect(e.nonAffectee).toBe(4)
    expect(e.alertes.some((a) => a.includes('sans affectation'))).toBe(true)
  })

  it('suit le choix fait à la main plutôt que les mots-clés', () => {
    const corrige = etageSia416({ ...rez, pieces: [{ id: 'x', nom: 'WC communs', surface: 3, affectation: 'SUS' }] })
    expect(corrige.categories.SUS).toBe(3)
    expect(corrige.pieces[0]).toMatchObject({ categorie: 'SUS', parDefaut: false })
  })

  it('se rabat sur la dalle sans emprise, et le dit', () => {
    const d = etageSia416({ ...rez, emprises: [], dalles: [95] })
    expect(d.sourceSp).toBe('dalle')
    expect(d.sp).toBe(95)
    expect(d.alertes.some((a) => a.includes('dalle'))).toBe(true)
  })

  it('signale une SN plus grande que la SP', () => {
    const d = etageSia416({ ...rez, emprises: [50] })
    expect(d.alertes.some((a) => a.includes('dépasse'))).toBe(true)
  })
})

describe('le total du jeu', () => {
  it('multiplie un étage type par le nombre d’étages qu’il représente', () => {
    const type: EntreeEtageSia416 = {
      cle: 'p#2', nom: '1er au 3e', multiplicateur: 3, emprises: [220], dalles: [],
      pieces: [{ id: 'f', nom: 'Chambre', surface: 14 }, { id: 'g', nom: 'Palier', surface: 6 }],
    }
    const facade: EntreeEtageSia416 = { cle: 'p#3', nom: 'Façade sud', multiplicateur: 1, emprises: [], dalles: [], pieces: [] }
    const s = surfacesSia416([rez, type, facade])
    expect(s.etages.map((e) => e.nom)).toEqual(['Rez', '1er au 3e'])
    expect(s.total.sp).toBeCloseTo(102.08 + 660, 9)
    expect(s.total.sn).toBeCloseTo(68 + 60, 9)
    expect(s.total.sc).toBeCloseTo(102.08 + 660 - 128, 9)
    expect(s.total.categories.SUP).toBeCloseTo(40 + 42, 9)
    expect(s.total.categories.SD).toBeCloseTo(8 + 18, 9)
  })

  it('ne donne pas de SP totale quand un étage n’en a pas', () => {
    const sans: EntreeEtageSia416 = { cle: 'p#4', nom: 'Combles', multiplicateur: 1, emprises: [], dalles: [], pieces: [{ id: 'h', nom: 'Galetas', surface: 30 }] }
    const s = surfacesSia416([rez, sans])
    expect(s.total.sp).toBeNull()
    expect(s.total.sc).toBeNull()
    expect(s.total.sn).toBeCloseTo(98, 9)
    expect(s.alertes.some((a) => a.startsWith('Combles :'))).toBe(true)
  })
})
