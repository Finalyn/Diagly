import { describe, it, expect } from 'vitest'
import {
  cle, normaliserUnite, normaliserBase, normaliserPrix, normaliserPart,
  normaliserTexte, aucunTravail, normaliserOuiNon, normaliserCode, ErreurBase,
} from './normaliser'

describe('cle', () => {
  it('efface accents, casse et ponctuation', () => {
    expect(cle('Nombre de pièces d’eau')).toBe('nombre de pieces d eau')
    expect(cle('Surface de façade − surface de fenêtres')).toBe('surface de facade surface de fenetres')
  })
})

describe('normaliserUnite', () => {
  it('reconnaît les quatre unités du classeur', () => {
    expect(normaliserUnite('m²').unite).toBe('m2')
    expect(normaliserUnite('ml').unite).toBe('ml')
    expect(normaliserUnite('pce').unite).toBe('pce')
    expect(normaliserUnite('forfait').unite).toBe('forfait')
  })

  it('garde la liste fermée à quatre : « pce (par logement) » est une pce précisée', () => {
    expect(normaliserUnite('pce (par logement)')).toEqual({ unite: 'pce', indication: 'par logement' })
  })

  it('refuse une unité inconnue plutôt que de deviner', () => {
    expect(() => normaliserUnite('m3')).toThrow(ErreurBase)
    expect(() => normaliserUnite('')).toThrow(/vide/)
  })

  it('dit quel champ et quelle valeur posent problème', () => {
    try { normaliserUnite('kg', 'Unité entretien') } catch (e) {
      expect((e as ErreurBase).champ).toBe('Unité entretien')
      expect((e as Error).message).toContain('"kg"')
    }
  })
})

describe('normaliserBase', () => {
  it('traduit les bases nommées', () => {
    expect(normaliserBase('Surface de plancher (SP)').base).toBe('surface_plancher')
    expect(normaliserBase('Nombre de portes d’entrée').base).toBe('nombre_portes_entree')
    expect(normaliserBase('Forfait').base).toBe('forfait')
    expect(normaliserBase('Surface de façade − surface de fenêtres').base).toBe('facade_moins_fenetres')
  })

  it('garde la précision entre parenthèses comme indication', () => {
    expect(normaliserBase('Saisie manuelle (périmètre)')).toEqual({ base: 'saisie_manuelle', indication: 'périmètre' })
    expect(normaliserBase('Forfait (par ascenseur)')).toEqual({ base: 'forfait', indication: 'par ascenseur' })
  })

  it('reconnaît les trois règles écrites en toutes lettres', () => {
    expect(normaliserBase('Règle EP : 4 / 8 / 10 × hauteur selon surface bâtie (<400 / 400–900 / >900 m²)').base)
      .toBe('regle_eaux_pluviales')
    expect(normaliserBase('Logements : 1 pce par logement de 2,5 à 3,5 pièces, 2 pce par logement de 4,5 à 5,5 pièces').base)
      .toBe('regle_stores')
    expect(normaliserBase('Surface bâtie (ou surface de parking si connue)').base).toBe('regle_sprinklers')
  })

  it('ne confond pas la règle sprinklers avec la surface bâtie simple', () => {
    expect(normaliserBase('Surface bâtie').base).toBe('surface_batie')
  })

  it('garde le texte de la règle comme indication', () => {
    expect(normaliserBase('Règle EP : 4 / 8 / 10 × hauteur selon surface bâtie').indication).toContain('Règle EP')
  })

  it('refuse une base inconnue', () => {
    expect(() => normaliserBase('Au pifomètre')).toThrow(ErreurBase)
    expect(() => normaliserBase('')).toThrow(/vide/)
  })
})

describe('normaliserPrix', () => {
  it('accepte un nombre, un texte numérique, une apostrophe suisse', () => {
    expect(normaliserPrix(1200)).toBe(1200)
    expect(normaliserPrix('1200')).toBe(1200)
    expect(normaliserPrix("1'250")).toBe(1250)
    expect(normaliserPrix('45.5')).toBe(45.5)
    expect(normaliserPrix('45,5')).toBe(45.5)
  })

  it('rend null pour une cellule vide : pas de travail chiffré', () => {
    expect(normaliserPrix(null)).toBeNull()
    expect(normaliserPrix(undefined)).toBeNull()
    expect(normaliserPrix('')).toBeNull()
    expect(normaliserPrix('   ')).toBeNull()
  })

  it('accepte zéro, qui n’est pas rien', () => {
    expect(normaliserPrix(0)).toBe(0)
  })

  it('refuse un prix négatif ou illisible', () => {
    expect(() => normaliserPrix(-10)).toThrow(ErreurBase)
    expect(() => normaliserPrix('à voir')).toThrow(ErreurBase)
  })
})

describe('normaliserPart', () => {
  it('lit une fraction comme une fraction', () => {
    expect(normaliserPart(0.3)).toBe(0.3)
  })

  it('lit un pourcentage comme une fraction', () => {
    expect(normaliserPart(30)).toBe(0.3)
    expect(normaliserPart('30 %')).toBe(0.3)
  })

  it('laisse 1 valoir la totalité, pas un pourcent', () => {
    expect(normaliserPart(1)).toBe(1)
  })

  it('rend null quand la part n’est pas renseignée', () => {
    expect(normaliserPart(null)).toBeNull()
    expect(normaliserPart('')).toBeNull()
  })

  it('refuse une part hors bornes', () => {
    expect(() => normaliserPart(150)).toThrow(ErreurBase)
    expect(() => normaliserPart(-0.2)).toThrow(ErreurBase)
  })
})

describe('textes', () => {
  it('rend null pour une cellule vide', () => {
    expect(normaliserTexte('  ')).toBeNull()
    expect(normaliserTexte(null)).toBeNull()
  })

  it('reconnaît « Néant », quelle que soit la casse ou l’accent', () => {
    expect(aucunTravail('Néant')).toBe(true)
    expect(aucunTravail('neant')).toBe(true)
    expect(aucunTravail('Remise à neuf')).toBe(false)
    expect(aucunTravail(null)).toBe(false)
  })
})

describe('normaliserOuiNon', () => {
  it('lit Oui et Non', () => {
    expect(normaliserOuiNon('Oui')).toBe(true)
    expect(normaliserOuiNon('non')).toBe(false)
  })

  it('refuse tout le reste : il n’y a pas de peut-être', () => {
    expect(() => normaliserOuiNon('parfois')).toThrow(ErreurBase)
    expect(() => normaliserOuiNon('')).toThrow(ErreurBase)
  })
})

describe('normaliserCode', () => {
  it('garde le code en texte, zéro final compris', () => {
    expect(normaliserCode('221.0')).toBe('221.0')
    expect(normaliserCode('221')).toBe('221')
    expect(normaliserCode(' 242.0 ')).toBe('242.0')
  })

  it('refuse un code lu comme un nombre : le zéro final serait déjà perdu', () => {
    expect(() => normaliserCode(221)).toThrow(/nombre/)
  })

  it('refuse un code mal formé', () => {
    expect(() => normaliserCode('CFC 221')).toThrow(ErreurBase)
    expect(() => normaliserCode('')).toThrow(ErreurBase)
  })
})
