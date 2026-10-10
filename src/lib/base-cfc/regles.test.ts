import { describe, it, expect } from 'vitest'
import { prixUnitaire, montant, auFranc } from './prix'
import {
  quantiteDeBase, quantiteRetenue, demandeUneSaisie, surfaceFacade, surfaceFenetres,
  conduitesEauxPluviales, storesEnToile, type DonneesBatiment,
} from './quantites'
import {
  etatDuGroupe, quantitesDuGroupe, groupesIncomplets, groupesDesReleves, compteEnNombre,
  GROUPE_EN_NOMBRE, type Groupe,
} from './alternatives'

// ============================================================ règle 1 : prix

describe('règle 1, le prix de l’état moyen', () => {
  it('rend le prix de la ligne pour les cinq autres états', () => {
    expect(prixUnitaire('bon', { prix: 8 })).toBe(8)
    expect(prixUnitaire('mauvais', { prix: 1200 })).toBe(1200)
    expect(prixUnitaire('amelioration', { prix: 310 })).toBe(310)
  })

  it('ajoute la part du prix Mauvais au prix fixe', () => {
    // A116 Carrelage de sol : 45 fixe + 20 % de 120.
    expect(prixUnitaire('moyen', { prix: 45, partPrixMauvais: 0.2 }, { prixMauvais: 120 })).toBe(69)
  })

  it('s’en tient au prix fixe quand aucune part n’est donnée', () => {
    expect(prixUnitaire('moyen', { prix: 2000, partPrixMauvais: null }, { prixMauvais: 15000 })).toBe(2000)
  })

  it('laisse le diagnostiqueur ajuster la part', () => {
    // A012 Façade en pierre : 30 % au catalogue, 50 % constatés sur place.
    expect(prixUnitaire('moyen', { prix: 0, partPrixMauvais: 0.3 }, { prixMauvais: 1200, partChoisie: 0.5 })).toBe(600)
  })

  it('accepte une part ramenée à zéro par le diagnostiqueur', () => {
    expect(prixUnitaire('moyen', { prix: 100, partPrixMauvais: 0.3 }, { prixMauvais: 1000, partChoisie: 0 })).toBe(100)
  })

  it('ne compte pas la part pour zéro quand le prix Mauvais manque', () => {
    expect(prixUnitaire('moyen', { prix: 80, partPrixMauvais: 0.3 }, { prixMauvais: null })).toBe(80)
  })

  it('distingue l’absence de prix de la gratuité', () => {
    expect(prixUnitaire('bon', { prix: null })).toBeNull()
    expect(prixUnitaire('bon', { prix: 0 })).toBe(0)
  })
})

describe('le montant d’une ligne', () => {
  it('multiplie la quantité par le prix unitaire', () => {
    expect(montant(200, 150)).toBe(30000)
  })

  it('ne produit rien quand la quantité ou le prix manque', () => {
    expect(montant(null, 150)).toBeNull()
    expect(montant(200, null)).toBeNull()
  })

  it('arrondit au franc pour l’affichage', () => {
    expect(auFranc(30000.4)).toBe(30000)
    expect(auFranc(69.5)).toBe(70)
  })
})

// ====================================================== règle 3 : quantités

const batiment = (patch: Partial<DonneesBatiment> = {}): DonneesBatiment => ({
  surfacePlancher: 1800, surfaceBatie: 450, surfaceTerrain: 800,
  surfaceFacade: 400, surfaceFenetres: 100,
  nombreLogements: 12, nombrePiecesEau: 18, nombreEtages: 4, nombreCages: 1,
  nombrePortesEntree: 2, hauteur: 11, ...patch,
})

describe('règle 3, les bases de quantité', () => {
  it('prend la donnée du bâtiment et applique le coefficient', () => {
    expect(quantiteDeBase({ baseQuantite: 'surface_plancher', coefficient: 1 }, batiment())).toBe(1800)
    expect(quantiteDeBase({ baseQuantite: 'surface_plancher', coefficient: 1.35 }, batiment())).toBe(2430)
  })

  it('compte les arbres à deux pour cent de la surface de terrain', () => {
    // A148 : surface de terrain, coefficient 0,02.
    expect(quantiteDeBase({ baseQuantite: 'surface_terrain', coefficient: 0.02 }, batiment())).toBe(16)
  })

  it('donne un forfait pour un', () => {
    expect(quantiteDeBase({ baseQuantite: 'forfait', coefficient: 1 }, batiment())).toBe(1)
  })

  it('ne calcule rien pour une saisie manuelle', () => {
    expect(quantiteDeBase({ baseQuantite: 'saisie_manuelle', coefficient: 1 }, batiment())).toBeNull()
    expect(demandeUneSaisie({ baseQuantite: 'saisie_manuelle', coefficient: 1 })).toBe(true)
  })

  it('déduit les fenêtres de la façade pour l’isolation intérieure', () => {
    // A123 : 400 de façade moins 100 de fenêtres.
    expect(quantiteDeBase({ baseQuantite: 'facade_moins_fenetres', coefficient: 1 }, batiment())).toBe(300)
  })

  it('ne rend jamais une surface négative quand la façade est toute vitrée', () => {
    const b = batiment({ surfaceFacade: 100, surfaceFenetres: 140 })
    expect(quantiteDeBase({ baseQuantite: 'facade_moins_fenetres', coefficient: 1 }, b)).toBe(0)
  })

  it('prend le parking pour les sprinklers quand il est connu', () => {
    const a = { baseQuantite: 'regle_sprinklers' as const, coefficient: 1 }
    expect(quantiteDeBase(a, batiment())).toBe(450)
    expect(quantiteDeBase(a, batiment({ surfaceParking: 1200 }))).toBe(1200)
  })

  it('compte les descentes d’eaux pluviales par palier de surface bâtie', () => {
    expect(conduitesEauxPluviales(300, 11)).toBe(44)
    expect(conduitesEauxPluviales(450, 11)).toBe(88)
    expect(conduitesEauxPluviales(1200, 11)).toBe(110)
  })

  it('place les paliers à 400 et 900 inclus', () => {
    expect(conduitesEauxPluviales(399, 10)).toBe(40)
    expect(conduitesEauxPluviales(400, 10)).toBe(80)
    expect(conduitesEauxPluviales(900, 10)).toBe(80)
    expect(conduitesEauxPluviales(901, 10)).toBe(100)
  })

  it('compte les stores par taille de logement', () => {
    // Quatre petits logements et trois grands : 4 + 6.
    expect(storesEnToile({ p2_5: 2, p3_5: 2, p4_5: 2, p5_5plus: 1 })).toBe(10)
  })

  it('ne donne pas de store aux studios', () => {
    expect(storesEnToile({ p1_5: 8 })).toBe(0)
  })

  it('ne calcule pas les stores sans la répartition', () => {
    expect(quantiteDeBase({ baseQuantite: 'regle_stores', coefficient: 1 }, batiment())).toBeNull()
  })

  it('ne calcule rien quand la donnée du bâtiment manque', () => {
    expect(quantiteDeBase({ baseQuantite: 'surface_facade', coefficient: 1 }, batiment({ surfaceFacade: null }))).toBeNull()
  })

  it('dérive la façade du périmètre, des étages et de la hauteur d’étage', () => {
    expect(surfaceFacade(90, 4, 2.7)).toBe(972)
    expect(surfaceFacade(90, null, 2.7)).toBeNull()
  })

  it('dérive les fenêtres de la façade et du taux de vitrage', () => {
    expect(surfaceFenetres(400, 0.25)).toBe(100)
  })
})

describe('la quantité retenue', () => {
  const article = { baseQuantite: 'surface_plancher' as const, coefficient: 1 }

  it('calcule tant que le diagnostiqueur n’a rien saisi', () => {
    expect(quantiteRetenue(article, batiment(), { quantite: null, manuelle: false })).toBe(1800)
  })

  it('respecte une quantité corrigée sur place', () => {
    expect(quantiteRetenue(article, batiment(), { quantite: 1650, manuelle: true })).toBe(1650)
  })

  it('n’écrase pas une correction par le calcul, même si elle vaut zéro', () => {
    expect(quantiteRetenue(article, batiment(), { quantite: 0, manuelle: true })).toBe(0)
  })
})

// ================================================== règle 2 : alternatives

const groupe = (patch: Partial<Groupe> = {}): Groupe => ({
  nom: 'Revêtement de façade',
  etapeNumero: 1,
  quantiteDuGroupe: 400,
  membres: [
    { articleId: 'A015', nom: 'Façade crépie non isolée', present: true, part: 50 },
    { articleId: 'A009', nom: 'Façade ventilée métallique', present: true, part: 50 },
    { articleId: 'A012', nom: 'Façade en pierre naturelle', present: false, part: null },
  ],
  ...patch,
})

describe('règle 2, les groupes d’alternatives', () => {
  it('partage la quantité selon les parts : le cas du brief', () => {
    const q = quantitesDuGroupe(groupe())
    expect(q.get('A015')).toBe(200)
    expect(q.get('A009')).toBe(200)
  })

  it('ne donne rien aux types non cochés : ils n’existent pas pour le devis', () => {
    expect(quantitesDuGroupe(groupe()).has('A012')).toBe(false)
  })

  it('donne tout au seul type présent, sans demander de part', () => {
    const g = groupe({
      membres: [
        { articleId: 'A015', nom: 'Façade crépie', present: true, part: null },
        { articleId: 'A009', nom: 'Façade ventilée', present: false, part: null },
      ],
    })
    expect(etatDuGroupe(g).valide).toBe(true)
    expect(quantitesDuGroupe(g).get('A015')).toBe(400)
  })

  it('accepte une répartition en trois', () => {
    const g = groupe({
      quantiteDuGroupe: 300,
      membres: [
        { articleId: 'A015', nom: 'A', present: true, part: 50 },
        { articleId: 'A009', nom: 'B', present: true, part: 30 },
        { articleId: 'A012', nom: 'C', present: true, part: 20 },
      ],
    })
    expect(etatDuGroupe(g).valide).toBe(true)
    expect([...quantitesDuGroupe(g).values()]).toEqual([150, 90, 60])
  })

  it('refuse une somme qui ne fait pas cent', () => {
    const g = groupe({ membres: [
      { articleId: 'A015', nom: 'Crépie', present: true, part: 50 },
      { articleId: 'A009', nom: 'Ventilée', present: true, part: 40 },
    ] })
    const e = etatDuGroupe(g)
    expect(e.valide).toBe(false)
    expect(e.raison).toBe('somme_differente')
    expect(e.message).toContain('90')
  })

  it('refuse une part manquante et nomme le type', () => {
    const g = groupe({ membres: [
      { articleId: 'A015', nom: 'Façade crépie non isolée', present: true, part: 50 },
      { articleId: 'A009', nom: 'Façade ventilée métallique', present: true, part: null },
    ] })
    const e = etatDuGroupe(g)
    expect(e.raison).toBe('part_manquante')
    expect(e.message).toContain('Façade ventilée métallique')
  })

  it('signale un groupe dont aucun type n’est coché', () => {
    const g = groupe({ membres: groupe().membres.map((m) => ({ ...m, present: false })) })
    expect(etatDuGroupe(g).raison).toBe('aucun_present')
  })

  it('ne donne pas de quantité quand celle du groupe manque', () => {
    expect(quantitesDuGroupe(groupe({ quantiteDuGroupe: null })).get('A015')).toBeNull()
  })

  it('tolère un centième d’écart, pas un dixième', () => {
    const parts = (a: number, b: number) => groupe({ membres: [
      { articleId: 'A015', nom: 'A', present: true, part: a },
      { articleId: 'A009', nom: 'B', present: true, part: b },
    ] })
    expect(etatDuGroupe(parts(33.33, 66.67)).valide).toBe(true)
    expect(etatDuGroupe(parts(33.3, 66.6)).valide).toBe(false)
  })
})

describe('règle 2, les portes se comptent en nombre', () => {
  const portes = (patch: Partial<Groupe> = {}): Groupe => ({
    nom: GROUPE_EN_NOMBRE,
    etapeNumero: 1,
    quantiteDuGroupe: 10,
    membres: [
      { articleId: 'A027', nom: 'Bois panneau plein', present: true, part: 7 },
      { articleId: 'A029', nom: 'Bois vitrée', present: true, part: 3 },
      { articleId: 'A031', nom: 'Métal panneau plein', present: false, part: null },
    ],
    ...patch,
  })

  it('se reconnaît à son nom', () => {
    expect(compteEnNombre(GROUPE_EN_NOMBRE)).toBe(true)
    expect(compteEnNombre('Revêtement de façade')).toBe(false)
  })

  it('prend le nombre saisi comme quantité, sans pourcentage', () => {
    const q = quantitesDuGroupe(portes(), 10)
    expect(q.get('A027')).toBe(7)
    expect(q.get('A029')).toBe(3)
  })

  it('exige que la somme fasse le nombre de portes d’entrée', () => {
    expect(etatDuGroupe(portes(), 10).valide).toBe(true)
    const e = etatDuGroupe(portes(), 12)
    expect(e.valide).toBe(false)
    expect(e.message).toContain('12 portes')
  })

  it('demande le nombre même quand un seul type est présent', () => {
    const g = portes({ membres: [{ articleId: 'A027', nom: 'Bois', present: true, part: null }] })
    expect(etatDuGroupe(g, 10).raison).toBe('part_manquante')
  })
})

describe('règle 2, les parts se comptent par étape', () => {
  const releves = [
    { articleId: 'A112', nom: 'Sol sans joints', etapeNumero: 2, groupeAlternatives: 'Revêtement de sol', present: true, part: 100 },
    { articleId: 'A116', nom: 'Carrelage', etapeNumero: 5, groupeAlternatives: 'Revêtement de sol', present: true, part: 60 },
    { articleId: 'A113', nom: 'Sol synthétique', etapeNumero: 5, groupeAlternatives: 'Revêtement de sol', present: true, part: 40 },
    { articleId: 'A100', nom: 'Peinture murs', etapeNumero: 2, groupeAlternatives: 'Finition de paroi', present: true, part: 100 },
    { articleId: 'A071', nom: 'Chauffage', etapeNumero: 4, groupeAlternatives: null, present: true, part: null },
  ]

  it('fait un groupe par couple groupe et étape', () => {
    const g = groupesDesReleves(releves, (nom, etape) => (etape === 2 ? 120 : 900))
    expect(g).toHaveLength(3)
    expect(g.map((x) => `${x.nom}@${x.etapeNumero}`)).toEqual([
      'Finition de paroi@2', 'Revêtement de sol@2', 'Revêtement de sol@5',
    ])
  })

  it('laisse de côté les articles sans groupe', () => {
    const g = groupesDesReleves(releves, () => 100)
    expect(g.some((x) => x.membres.some((m) => m.articleId === 'A071'))).toBe(false)
  })

  it('donne à chaque étape sa propre quantité', () => {
    const g = groupesDesReleves(releves, (_, etape) => (etape === 2 ? 120 : 900))
    const cage = g.find((x) => x.nom === 'Revêtement de sol' && x.etapeNumero === 2)!
    const appart = g.find((x) => x.nom === 'Revêtement de sol' && x.etapeNumero === 5)!
    expect(quantitesDuGroupe(cage).get('A112')).toBe(120)
    expect(quantitesDuGroupe(appart).get('A116')).toBe(540)
    expect(quantitesDuGroupe(appart).get('A113')).toBe(360)
  })

  it('valide une étape et refuse l’autre, séparément', () => {
    const mauvais = releves.map((r) => (r.articleId === 'A113' ? { ...r, part: 10 } : r))
    const g = groupesDesReleves(mauvais, () => 100)
    const fautifs = groupesIncomplets(g)
    expect(fautifs).toHaveLength(1)
    expect(fautifs[0].etapeNumero).toBe(5)
    expect(fautifs[0].somme).toBe(70)
  })

  it('ne dit rien quand tout est réparti', () => {
    expect(groupesIncomplets(groupesDesReleves(releves, () => 100))).toEqual([])
  })
})
