import { describe, it, expect } from 'vitest'
import {
  CATEGORIES_COMPTEES, categorieDeLArticle, categorieDuReleve, ceQuiChange, comptageSaisi, comptagesDuDossier,
  etatDeLaRepartition, nomCourt, phraseDuComptage, quantiteDuTypeCompte, repartitionsDuDossier, repartitionsIncompletes,
  unitesAFixerALAjout, unitesEffectives, type Comptage,
} from './comptages'

const comptage = (extra: Partial<Comptage> = {}): Comptage => ({
  categorie: 'porte_paliere', nombre: 6, surface: null, source: 'plans', detail: '2 par palier × 3 étages = 6',
  pages: ['F1 p. 2'], confiance: 'haute', valide: false, majLe: '2026-10-16T08:00:00.000Z', ...extra,
})

describe('le rattachement d’un article à sa catégorie', () => {
  it('se fait par l’identifiant des articles de la base', () => {
    expect(categorieDeLArticle({ id: 'A134', nom: 'Portes palières en bois', uniteEntretien: 'pce' })).toBe('porte_paliere')
    expect(categorieDeLArticle({ id: 'A030', nom: 'Porte extérieure en bois, vitrée (2 vantaux)' })).toBe('porte_entree')
    expect(categorieDeLArticle({ id: 'A021', nom: 'Fenêtres en matière synthétique', uniteEntretien: 'm2' })).toBe('fenetre')
    expect(categorieDeLArticle({ id: 'A047', nom: 'Lanterneaux / vitrages (toiture plate)' })).toBe('fenetre_toit')
    expect(categorieDeLArticle({ id: 'A005', nom: 'Balcons en béton' })).toBe('balcon')
    expect(categorieDeLArticle({ id: 'A086', nom: 'Agencement de cuisine' })).toBe('cuisine')
    expect(categorieDeLArticle({ id: 'A081', nom: 'Appareils sanitaires courants' })).toBe('appareil_sanitaire')
    expect(categorieDeLArticle({ id: 'A124', nom: 'Portes intérieures en métal' })).toBe('porte_interieure')
  })

  it('rattache par le nom un article ajouté plus tard au classeur', () => {
    expect(categorieDeLArticle({ id: 'A999', nom: 'Portes palières en métal', uniteEntretien: 'pce' })).toBe('porte_paliere')
    expect(categorieDeLArticle({ id: 'A998', nom: 'PORTES PALIERES coupe-feu' })).toBe('porte_paliere')
    expect(categorieDeLArticle({ id: 'A997', nom: 'Fenêtres en bois-aluminium', uniteEntretien: 'm2' })).toBe('fenetre')
    expect(categorieDeLArticle({ id: 'A996', nom: 'Portes-fenêtres coulissantes', uniteEntretien: 'm2' })).toBe('fenetre')
    expect(categorieDeLArticle({ id: 'A995', nom: 'Porte d’entrée d’immeuble en métal' })).toBe('porte_entree')
  })

  it('ne confond pas une fenêtre de toit avec une fenêtre, ni un vitrage intérieur avec une vitrine', () => {
    expect(categorieDeLArticle({ id: 'A990', nom: 'Fenêtres de toit (toiture inclinée)', uniteEntretien: 'pce' })).toBe('fenetre_toit')
    expect(categorieDeLArticle({ id: 'A130', nom: 'Vitrages intérieurs en métal', uniteEntretien: 'm2' })).toBeNull()
    expect(categorieDeLArticle({ id: 'A085', nom: 'Isolation des conduites sanitaires', uniteEntretien: 'm2' })).toBeNull()
  })

  it('écarte un article dont l’unité ne se compte pas', () => {
    expect(categorieDeLArticle({ id: 'A993', nom: 'Balcons, étanchéité', uniteEntretien: 'm2' })).toBeNull()
    expect(categorieDeLArticle({ id: 'A992', nom: 'Portes palières, peinture', uniteEntretien: 'forfait' })).toBeNull()
  })

  it('range un relevé par son article, ou par son libellé quand la base ne le connaît plus', () => {
    const articles = [{ id: 'A134', nom: 'Portes palières en bois', uniteEntretien: 'pce' }]
    expect(categorieDuReleve({ articleId: 'A134', cfcLabel: 'peu importe' }, articles)).toBe('porte_paliere')
    expect(categorieDuReleve({ articleId: null, cfcLabel: 'Balcons en béton' }, articles)).toBe('balcon')
  })
})

describe('les noms courts', () => {
  it('retirent ce que les types d’une catégorie partagent', () => {
    expect(nomCourt('Portes palières en bois', 'porte_paliere')).toBe('en bois')
    expect(nomCourt('Porte extérieure en métal, vitrée (1 vantail)', 'porte_entree')).toBe('en métal, vitrée (1 vantail)')
    expect(nomCourt('Fenêtres en bois-métal', 'fenetre')).toBe('en bois-métal')
    expect(nomCourt('Appareils sanitaires spéciaux', 'appareil_sanitaire')).toBe('spéciaux')
  })

  it('gardent le nom entier quand il ne reste rien', () => {
    expect(nomCourt('Vitrines', 'fenetre')).toBe('Vitrines')
    expect(nomCourt('Agencement de cuisine', 'cuisine')).toBe('Agencement de cuisine')
  })
})

describe('la quantité d’un type compté', () => {
  it('à la pièce, ce sont ses unités', () => {
    expect(quantiteDuTypeCompte(6, 2, { nombre: 6 }, 'pce')).toBe(2)
    expect(quantiteDuTypeCompte(undefined, 2, { nombre: 6 }, 'pce')).toBe(2)
  })

  it('au mètre carré, sa part de la surface au prorata du nombre', () => {
    // 4 fenêtres sur 24, sur 96 m² : 16 m².
    expect(quantiteDuTypeCompte(96, 4, { nombre: 24 }, 'm²')).toBe(16)
    expect(quantiteDuTypeCompte(100, 1, { nombre: 3 }, 'm2')).toBe(33.33)
    expect(quantiteDuTypeCompte(null, 4, { nombre: 24 }, 'm²')).toBeUndefined()
    expect(quantiteDuTypeCompte(96, 0, { nombre: 0 }, 'm²')).toBe(0)
  })

  it('aucune quantité tant que le nombre du type n’est pas connu', () => {
    expect(quantiteDuTypeCompte(6, null, { nombre: 6 }, 'pce')).toBeUndefined()
  })

  it('seul et sans nombre, un type prend tout ; à deux, chacun doit être précisé', () => {
    expect(unitesEffectives(null, 1, { nombre: 6 })).toBe(6)
    expect(unitesEffectives(null, 2, { nombre: 6 })).toBeNull()
    expect(unitesEffectives(2, 2, { nombre: 6 })).toBe(2)
  })

  it('le type déjà là garde ce qu’il avait quand un deuxième arrive, le nouveau arrive sans nombre', () => {
    expect(unitesAFixerALAjout([], { nombre: 6 })).toEqual([])
    expect(unitesAFixerALAjout([{ id: 'a', unites: null }], { nombre: 6 })).toEqual([{ id: 'a', unites: 6 }])
    expect(unitesAFixerALAjout([{ id: 'a', unites: 4 }], { nombre: 6 })).toEqual([])
    expect(unitesAFixerALAjout([{ id: 'a' }, { id: 'b' }], { nombre: 6 })).toEqual([])
  })
})

describe('l’état de la répartition', () => {
  it('complète : chaque type a son nombre et la somme fait le compte', () => {
    const e = etatDeLaRepartition(comptage(), [
      { id: 'a', nom: 'Portes palières en bois', unites: 2 },
      { id: 'b', nom: 'Portes palières en métal', unites: 4 },
    ])
    expect(e.complet).toBe(true)
    expect(e.phrase).toBe('Portes palières : 6 réparties sur 6 comptées')
    expect(e.detail).toBe('Réparties : 2 en bois, 4 en métal')
  })

  it('un type seul et sans nombre prend tout, sans rien demander', () => {
    const e = etatDeLaRepartition(comptage(), [{ id: 'a', nom: 'Portes palières en bois', unites: null }])
    expect(e.complet).toBe(true)
    expect(e.types[0].effectives).toBe(6)
    expect(e.detail).toBe('Réparties : 6 en bois')
  })

  it('incomplète : il en reste à préciser', () => {
    const e = etatDeLaRepartition(comptage(), [
      { id: 'a', nom: 'Portes palières en bois', unites: 2 },
      { id: 'b', nom: 'Portes palières en métal', unites: 3 },
    ])
    expect(e.complet).toBe(false)
    expect(e.raison).toBe('somme')
    expect(e.reste).toBe(1)
    expect(e.phrase).toBe('Portes palières : 5 réparties sur 6 comptées')
    expect(e.detail).toBe('2 en bois · 3 en métal · 1 à préciser')
  })

  it('incomplète : un type sans nombre', () => {
    const e = etatDeLaRepartition(comptage(), [
      { id: 'a', nom: 'Portes palières en bois', unites: 6 },
      { id: 'b', nom: 'Portes palières en métal', unites: null },
    ])
    expect(e.raison).toBe('unites-manquantes')
    expect(e.phrase).toBe('Portes palières : 6 réparties sur 6 comptées, 1 type à préciser')
    expect(e.detail).toBe('6 en bois · 1 type sans nombre')
  })

  it('incomplète : plus de répartis que de comptés', () => {
    const e = etatDeLaRepartition(comptage({ categorie: 'balcon', nombre: 4 }), [
      { id: 'a', nom: 'Balcons en béton', unites: 5 },
    ])
    expect(e.complet).toBe(false)
    expect(e.phrase).toBe('Balcons : 5 répartis sur 4 comptés')
    expect(e.detail).toBe('5 en béton · 1 de trop')
  })

  it('sans type relevé : rien n’est chiffré de travers, le rapport n’est pas bloqué', () => {
    const e = etatDeLaRepartition(comptage(), [])
    expect(e.raison).toBe('aucun-type')
    expect(e.detail).toBe('Aucun type relevé : à préciser pendant la visite')
    expect(repartitionsIncompletes([e])).toEqual([])
  })

  it('du dossier : une par catégorie comptée, les autres catégories n’y sont pas', () => {
    const articles = [
      { id: 'A134', nom: 'Portes palières en bois', uniteEntretien: 'pce' },
      { id: 'A005', nom: 'Balcons en béton', uniteEntretien: 'pce' },
    ]
    const etats = repartitionsDuDossier(
      { porte_paliere: comptage() },
      [
        { id: 'r1', articleId: 'A134', cfcLabel: 'Portes palières en bois', unites: 2 },
        { id: 'r2', articleId: null, cfcLabel: 'Portes palières en métal', unites: 3 },
        { id: 'r3', articleId: 'A005', cfcLabel: 'Balcons en béton' },
      ],
      articles,
    )
    expect(etats).toHaveLength(1)
    expect(etats[0].types.map((t) => t.id)).toEqual(['r1', 'r2'])
    expect(repartitionsIncompletes(etats).map((e) => e.phrase)).toEqual(['Portes palières : 5 réparties sur 6 comptées'])
  })
})

describe('les comptages du dossier', () => {
  it('se relisent sans rien supposer du JSON stocké', () => {
    const lus = comptagesDuDossier({
      porte_paliere: comptage(),
      balcon: { nombre: -2, source: 'plans' },
      cuisine: { nombre: 2.5 },
      ascenseur: { nombre: 1 },
      fenetre: { nombre: 24, surface: 40, source: 'inconnue', valide: 'oui' },
    })
    expect(Object.keys(lus)).toEqual(['porte_paliere', 'fenetre'])
    expect(lus.fenetre).toMatchObject({ nombre: 24, surface: 40, source: 'saisie', valide: false, pages: [] })
    expect(comptagesDuDossier(null)).toEqual({})
    expect(comptagesDuDossier([1])).toEqual({})
  })

  it('confirmés tels quels, gardent leur source ; corrigés, deviennent une saisie sans le calcul de l’IA', () => {
    const lu = comptage()
    expect(comptageSaisi('porte_paliere', 6, lu)).toMatchObject({ source: 'plans', valide: true, detail: lu.detail })
    expect(comptageSaisi('porte_paliere', 8, lu)).toMatchObject({ source: 'saisie', valide: true, detail: null, pages: [], nombre: 8 })
    expect(comptageSaisi('balcon', 3, null, 12).surface).toBeNull()
  })

  it('disent d’où vient la quantité', () => {
    expect(phraseDuComptage(comptage())).toBe('6 portes palières comptées sur les plans')
    expect(phraseDuComptage(comptage({ categorie: 'balcon', nombre: 1, source: 'saisie' }))).toBe('1 balcon compté au dossier')
    expect(phraseDuComptage(comptage({ categorie: 'fenetre', nombre: 24, surface: 40.5, source: 'analyse' })))
      .toBe('24 fenêtres comptées sur le plan analysé, 40,5 m²')
  })

  it('disent ce qu’un nouveau jeu remplace', () => {
    const avant = { porte_paliere: comptage(), balcon: comptage({ categorie: 'balcon', nombre: 4 }) }
    const apres = { porte_paliere: comptage({ nombre: 8, source: 'analyse' }), balcon: comptage({ categorie: 'balcon', nombre: 4 }) }
    expect(ceQuiChange(avant, apres)).toEqual(['Portes palières : 6 (lu sur les plans) remplacé par 8'])
  })

  it('couvrent les huit catégories prévues, dans l’ordre de la visite', () => {
    expect(CATEGORIES_COMPTEES.map((c) => c.cle)).toEqual([
      'porte_entree', 'porte_paliere', 'porte_interieure', 'fenetre', 'fenetre_toit', 'balcon', 'cuisine', 'appareil_sanitaire',
    ])
  })
})
