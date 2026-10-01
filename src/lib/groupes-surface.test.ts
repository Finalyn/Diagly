import { describe, it, expect } from 'vitest'
import {
  groupesDuReleve, groupesIncomplets, partEffective, partALAjout,
  quantiteDuType, phraseDuGroupe,
  type ArticleDuGroupe, type ReleveDuGroupe,
} from './groupes-surface'

const FACADE = 'Revêtement de façade'
const SOL = 'Revêtements de sol'

const catalogue: ArticleDuGroupe[] = [
  { id: 1, surfaceGroup: FACADE },
  { id: 2, surfaceGroup: FACADE },
  { id: 3, surfaceGroup: FACADE },
  { id: 10, surfaceGroup: SOL },
  { id: 11, surfaceGroup: SOL },
  { id: 90, surfaceGroup: null },
]

const releve = (id: string, catalogItemId: number, sharePct?: number | null): ReleveDuGroupe =>
  ({ id, cfcLabel: `ouvrage ${id}`, catalogItemId, sharePct })

describe('un seul type dans le groupe', () => {
  it('prend toute la surface sans rien demander', () => {
    // Une façade qui n'a qu'un revêtement n'a pas de répartition à décider :
    // exiger « 100 % » serait une case à cocher pour rien.
    const g = groupesDuReleve([releve('a', 1)], catalogue)
    expect(g).toHaveLength(1)
    expect(g[0].complet).toBe(true)
    expect(partEffective(g[0].membres[0], 1)).toBe(100)
  })
})

describe('plusieurs types dans le groupe', () => {
  it('attend une part pour chacun', () => {
    const g = groupesDuReleve([releve('a', 1), releve('b', 2)], catalogue)
    expect(g[0].complet).toBe(false)
    expect(g[0].raison).toBe('parts-manquantes')
    expect(g[0].sansPart).toBe(2)
  })

  it('tient quand les parts font 100', () => {
    const g = groupesDuReleve([releve('a', 1, 70), releve('b', 2, 30)], catalogue)
    expect(g[0].complet).toBe(true)
    expect(g[0].total).toBe(100)
    expect(g[0].raison).toBeNull()
  })

  it('refuse quand elles font autre chose', () => {
    // C'est le cas qui chiffrait cinq façades entières.
    const g = groupesDuReleve([releve('a', 1, 100), releve('b', 2, 100)], catalogue)
    expect(g[0].complet).toBe(false)
    expect(g[0].raison).toBe('somme')
    expect(g[0].total).toBe(200)
  })

  it('tolère un centième de point, qui vient d’un arrondi', () => {
    const g = groupesDuReleve([releve('a', 1, 33.33), releve('b', 2, 33.33), releve('c', 3, 33.34)], catalogue)
    expect(g[0].complet).toBe(true)
  })

  it('refuse une part manquante même quand les autres font déjà 100', () => {
    const g = groupesDuReleve([releve('a', 1, 100), releve('b', 2)], catalogue)
    expect(g[0].complet).toBe(false)
    expect(g[0].raison).toBe('parts-manquantes')
  })
})

describe('plusieurs groupes', () => {
  const g = groupesDuReleve([
    releve('a', 1, 60), releve('b', 2, 40),
    releve('c', 10, 50), releve('d', 11, 30),
    releve('z', 90),
  ], catalogue)

  it('range chaque relevé dans le sien', () => {
    expect(g.map((x) => x.nom)).toEqual([FACADE, SOL])
    expect(g[0].membres.map((m) => m.id)).toEqual(['a', 'b'])
  })

  it('laisse dehors les ouvrages qui ne sont pas alternatifs', () => {
    // Une chaudière n'est pas un revêtement : elle n'a pas de part à prendre.
    expect(g.flatMap((x) => x.membres).map((m) => m.id)).not.toContain('z')
  })

  it('ne signale que ceux qui bloquent', () => {
    const mauvais = groupesIncomplets(g)
    expect(mauvais.map((x) => x.nom)).toEqual([SOL])
  })
})

describe('quantité d’un type', () => {
  it('est la part de celle du groupe', () => {
    // 1 276 m² de façade dont 60 % en bardage : 766 m².
    expect(quantiteDuType(1276, 60)).toBe(766)
    expect(quantiteDuType(1276, 100)).toBe(1276)
  })

  it('n’existe pas tant que la part n’est pas répartie', () => {
    // Mieux vaut pas de quantité qu'une quantité fausse qui se chiffrerait.
    expect(quantiteDuType(1276, null)).toBeUndefined()
  })

  it('n’existe pas sans quantité de groupe', () => {
    expect(quantiteDuType(undefined, 60)).toBeUndefined()
  })
})

describe('part proposée à l’ajout', () => {
  it('donne tout au premier type relevé', () => {
    expect(partALAjout(0)).toBe(100)
  })

  it('ne propose rien aux suivants', () => {
    // Une répartition inventée passerait dans le devis sans être regardée.
    expect(partALAjout(1)).toBeNull()
    expect(partALAjout(4)).toBeNull()
  })
})

describe('ce que l’alerte dit', () => {
  const dit = (releves: ReleveDuGroupe[]) => phraseDuGroupe(groupesDuReleve(releves, catalogue)[0])

  it('nomme le groupe et ce qui manque', () => {
    expect(dit([releve('a', 1), releve('b', 2)])).toContain('2 types sans part')
  })

  it('donne le total quand il est faux', () => {
    expect(dit([releve('a', 1, 100), releve('b', 2, 100)])).toContain('200 % au lieu de 100 %')
  })

  it('reste neutre quand tout va bien', () => {
    expect(dit([releve('a', 1, 60), releve('b', 2, 40)])).toContain('réparti sur 2 types')
  })
})
