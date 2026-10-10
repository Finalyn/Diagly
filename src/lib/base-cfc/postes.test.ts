import { describe, it, expect } from 'vitest'
import {
  cageAEchafauder, echafaudageDeLOption, plusUrgente, postesAutomatiques, surfaceEchafaudee,
  type ReleveDuDevis,
} from './postes'
import type { PosteBase } from './assembler'

/** Les quatre postes, tels qu'ils sont lus dans postes_automatiques. */
const POSTES: PosteBase[] = [
  {
    cfcCode: '121', libelle: 'Protection des ouvrages existants', declencheur: 'toujours',
    unite: 'forfait', prix: 5000, regleQuantite: 'forfait', remarque: null,
  },
  {
    cfcCode: '211.1', libelle: 'Échafaudage de façade', declencheur: 'echafaudage_facade',
    unite: 'm2', prix: 35, regleQuantite: 'surface_echafaudee',
    remarque: 'Quantité = surface des façades concernées.',
  },
  {
    cfcCode: '285.0', libelle: 'Échafaudage cage d’escalier (communs)', declencheur: 'communs_mauvais',
    unite: 'forfait', prix: 5000, regleQuantite: 'par_cage_escalier', remarque: 'Parties communes uniquement.',
  },
  {
    cfcCode: '287', libelle: 'Nettoyage complet du bâtiment', declencheur: 'toujours',
    unite: 'm2', prix: 10, regleQuantite: 'surface_plancher', remarque: null,
  },
]

const releve = (p: Partial<ReleveDuDevis>): ReleveDuDevis => ({
  articleId: 'A015', nom: 'Façade crépie non isolée', etapeNumero: 1, echafaudage: true,
  baseQuantite: 'surface_facade', domaineRapport: 'Extérieur', etat: 'mauvais',
  quantite: 400, montant: 100_000, priorite: 'II', ...p,
})

const BATIMENT = { surfacePlancher: 1200, surfaceFacade: 400, nombreCages: 2 }

describe('la priorité la plus urgente', () => {
  it('retient I devant II et III', () => {
    expect(plusUrgente(['III', 'I', 'II'])).toBe('I')
    expect(plusUrgente(['III', 'II'])).toBe('II')
  })

  it('ne rend rien quand aucune priorité n’est arbitrée', () => {
    expect(plusUrgente([null, null])).toBeNull()
    expect(plusUrgente([])).toBeNull()
  })
})

describe('règle 7, la surface à échafauder', () => {
  it('ne compte rien sans ouvrage qui en demande', () => {
    const s = surfaceEchafaudee([releve({ echafaudage: false })], 400)
    expect(s.declencheurs).toEqual([])
    expect(s.quantite).toBeNull()
  })

  it('ne compte rien pour un ouvrage sans travaux chiffrés', () => {
    expect(surfaceEchafaudee([releve({ montant: 0 }), releve({ montant: null })], 400).declencheurs).toEqual([])
  })

  it('ne compte pas deux fois la même façade', () => {
    // La façade est à moitié crépie, à moitié ventilée, et les deux moitiés
    // sont à refaire : l'échafaudage couvre 400 m², pas 800.
    const s = surfaceEchafaudee([
      releve({ articleId: 'A015', quantite: 200 }),
      releve({ articleId: 'A009', nom: 'Façade ventilée métallique', quantite: 200 }),
    ], 400)
    expect(s.quantite).toBe(400)
    expect(s.declencheurs).toHaveLength(2)
  })

  it('n’échafaude que la part travaillée quand une seule moitié est à refaire', () => {
    expect(surfaceEchafaudee([releve({ quantite: 200 })], 400).quantite).toBe(200)
  })

  it('ne compte pas les fenêtres en plus de la façade qui les porte', () => {
    const s = surfaceEchafaudee([
      releve({ quantite: 400 }),
      releve({ articleId: 'A019', nom: 'Fenêtres en bois', baseQuantite: 'surface_fenetres', quantite: 80 }),
    ], 400)
    expect(s.quantite).toBe(400)
  })

  it('prend la façade entière quand la toiture est concernée', () => {
    // Un échafaudage de toiture fait le tour du bâtiment.
    const s = surfaceEchafaudee([
      releve({ articleId: 'A045', nom: 'Étanchéité de toiture plate', etapeNumero: 3, baseQuantite: 'surface_batie', quantite: 300 }),
    ], 400)
    expect(s.quantite).toBe(400)
    expect(s.facadeEntiere).toBe(true)
  })

  it('retient la priorité la plus urgente des ouvrages concernés', () => {
    const s = surfaceEchafaudee([
      releve({ quantite: 200, priorite: 'III' }),
      releve({ articleId: 'A016', nom: 'Peinture extérieure', quantite: 200, priorite: 'I' }),
    ], 400)
    expect(s.priorite).toBe('I')
  })

  it('laisse la quantité en attente quand la surface de façade manque', () => {
    const s = surfaceEchafaudee([releve({})], null)
    expect(s.quantite).toBeNull()
    expect(s.declencheurs).toHaveLength(1)
  })
})

describe('règle 7, l’échafaudage de cage d’escalier', () => {
  const mur = releve({
    articleId: 'A100', nom: 'Peinture intérieure – murs', etapeNumero: 2, echafaudage: false,
    baseQuantite: 'surface_plancher', domaineRapport: 'Intérieur – murs', etat: 'mauvais',
  })

  it('se déclenche sur un mur des communs en fin de vie', () => {
    expect(cageAEchafauder([mur])?.articleId).toBe('A100')
  })

  it('se déclenche sur un plafond des communs en fin de vie', () => {
    const plafond = releve({ ...mur, articleId: 'A104', domaineRapport: 'Intérieur – plafonds' })
    expect(cageAEchafauder([plafond])).not.toBeNull()
  })

  it('ne se déclenche pas pour un mur d’appartement', () => {
    expect(cageAEchafauder([releve({ ...mur, etapeNumero: 5 })])).toBeNull()
  })

  it('ne se déclenche pas pour un mur des communs en état moyen', () => {
    expect(cageAEchafauder([releve({ ...mur, etat: 'moyen' })])).toBeNull()
  })

  it('ne se déclenche pas pour un sol de cage en fin de vie', () => {
    expect(cageAEchafauder([releve({ ...mur, domaineRapport: 'Intérieur – sols' })])).toBeNull()
  })
})

describe('règle 7, les quatre postes du devis', () => {
  it('compte toujours la protection et le nettoyage', () => {
    const l = postesAutomatiques([], POSTES, BATIMENT)
    expect(l.map((x) => x.cfcCode)).toEqual(['121', '287'])
    expect(l[0].montant).toBe(5000)
    expect(l[1]).toMatchObject({ quantite: 1200, prixUnitaire: 10, montant: 12_000 })
  })

  it('lit les prix dans la table, jamais en dur', () => {
    const augmentes = POSTES.map((p) => (p.cfcCode === '287' ? { ...p, prix: 12 } : p))
    const l = postesAutomatiques([], augmentes, BATIMENT)
    expect(l.find((x) => x.cfcCode === '287')?.montant).toBe(14_400)
  })

  it('ajoute l’échafaudage de façade au prix du poste', () => {
    const l = postesAutomatiques([releve({ quantite: 400 })], POSTES, BATIMENT)
    const ech = l.find((x) => x.cfcCode === '211.1')
    expect(ech).toMatchObject({ quantite: 400, prixUnitaire: 35, montant: 14_000, priorite: 'II' })
    expect(ech?.remarque).toContain('Façade crépie non isolée')
  })

  it('n’ajoute pas d’échafaudage de façade sans ouvrage concerné', () => {
    const l = postesAutomatiques([releve({ echafaudage: false })], POSTES, BATIMENT)
    expect(l.find((x) => x.cfcCode === '211.1')).toBeUndefined()
  })

  it('compte l’échafaudage de cage par cage d’escalier', () => {
    const mur = releve({
      articleId: 'A100', nom: 'Peinture intérieure – murs', etapeNumero: 2, echafaudage: false,
      domaineRapport: 'Intérieur – murs', etat: 'mauvais', priorite: 'I',
    })
    const l = postesAutomatiques([mur], POSTES, BATIMENT)
    expect(l.find((x) => x.cfcCode === '285.0')).toMatchObject({ quantite: 2, montant: 10_000, priorite: 'I' })
  })

  it('rend une ligne à compléter plutôt que de taire un poste', () => {
    // Surface de plancher inconnue : le nettoyage reste au devis, sans montant.
    const l = postesAutomatiques([], POSTES, { ...BATIMENT, surfacePlancher: null })
    expect(l.find((x) => x.cfcCode === '287')).toMatchObject({ quantite: null, montant: null })
  })

  it('range les postes dans l’ordre de leur code CFC', () => {
    const mur = releve({
      articleId: 'A100', nom: 'Peinture intérieure – murs', etapeNumero: 2, echafaudage: false,
      domaineRapport: 'Intérieur – murs', etat: 'mauvais',
    })
    const l = postesAutomatiques([releve({}), mur], POSTES, BATIMENT)
    expect(l.map((x) => x.cfcCode)).toEqual(['121', '211.1', '285.0', '287'])
  })

  it('n’invente pas un poste absent de la table', () => {
    expect(postesAutomatiques([releve({})], [POSTES[0]], BATIMENT).map((x) => x.cfcCode)).toEqual(['121'])
  })
})

describe('règle 8, l’échafaudage des options', () => {
  const poste = POSTES[1]
  const option = { articleId: 'A015', nom: 'Isolation périphérique crépie', echafaudage: true, quantite: 400 }

  it('ajoute l’échafaudage au tableau des options', () => {
    const e = echafaudageDeLOption(option, poste, false)
    expect(e).toMatchObject({ aCompter: true, quantite: 400, montant: 14_000 })
    expect(e?.mention).toContain('35')
  })

  it('ne le compte pas deux fois quand le devis principal le porte déjà', () => {
    const e = echafaudageDeLOption(option, poste, true)
    expect(e?.aCompter).toBe(false)
    expect(e?.montant).toBeNull()
    expect(e?.mention).toBe('Échafaudage déjà compté au devis principal.')
  })

  it('se tait pour une option qui ne demande pas d’échafaudage', () => {
    expect(echafaudageDeLOption({ ...option, echafaudage: false }, poste, false)).toBeNull()
  })

  it('se tait quand le poste n’est pas dans la table', () => {
    expect(echafaudageDeLOption(option, undefined, false)).toBeNull()
  })

  it('laisse le montant en attente quand la surface de l’option manque', () => {
    expect(echafaudageDeLOption({ ...option, quantite: null }, poste, false)?.montant).toBeNull()
  })
})
