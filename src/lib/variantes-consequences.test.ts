import { describe, it, expect } from 'vitest'
import { consequencesDe } from './variantes-consequences'
import type { ApiDiagnosticItem, ApiVariant, ApiVariantLine } from './api-types'

const ouvrage = (o: Partial<ApiDiagnosticItem>): ApiDiagnosticItem => ({
  id: 'x', diagnosticId: 'd', cfcCode: '226.2', cfcLabel: 'Isolation périphérique',
  catalogItemId: null, state: 'MOYEN', priority: 'II', notes: null, works: [], photos: [],
  area: null, unit: null, yearInstalled: null, interventionYear: null,
  estimatedCost: null, improvement: null, improvementCost: null, norms: null, normsCost: null,
  createdAt: '', updatedAt: '', ...o,
})

const ligne = (o: Partial<ApiVariantLine>): ApiVariantLine => ({
  id: 'l', variantId: 'v', replacesItemId: null, catalogItemId: null, state: null,
  cfcCode: '271', label: 'Doublage intérieur', unit: null, area: null,
  amount: '0', costManual: false, note: null, createdAt: '', updatedAt: '', ...o,
})

const variante = (lines: ApiVariantLine[]): ApiVariant => ({
  id: 'v', projectId: 'p', name: "Isolation par l'intérieur", description: null,
  displayOrder: 0, lines, createdAt: '', updatedAt: '',
})

// Diagnostic : isolation périphérique 200 000 et échafaudage 26 000.
const ISOLATION = ouvrage({ id: 'iso', cfcCode: '226.2', estimatedCost: '200000' })
const ECHAFAUDAGE = ouvrage({ id: 'ech', cfcCode: '211.1', cfcLabel: 'Échafaudages', estimatedCost: '26000' })
const BASE = [ISOLATION, ECHAFAUDAGE]

/** Montant retenu : celui enregistré sur la ligne, suffisant pour ces tests. */
const montantDe = (l: ApiVariantLine) => Number(l.amount)

describe("isolation par l'intérieur", () => {
  it("signale que l'échafaudage ne peut pas être réduit", () => {
    const c = consequencesDe(variante([
      ligne({ id: 'a', replacesItemId: 'iso', cfcCode: '271', amount: '120000' }),
      ligne({ id: 'b', replacesItemId: 'ech', cfcCode: '211.1', label: 'Échafaudage réduit', amount: '6400' }),
      ligne({ id: 'c', cfcCode: '227', label: 'Peinture extérieure', amount: '40000' }),
    ]), BASE, montantDe)

    const reduit = c.find((x) => x.nature === 'conserver')!
    expect(reduit.regle.id).toBe('iso-interieure-echafaudage')
    expect(reduit.ouvrageReduit!.montantBase).toBe(26_000)
    expect(reduit.ouvrageReduit!.montantVariante).toBe(6_400)
  })

  it('signale que la façade reste à traiter', () => {
    const c = consequencesDe(variante([
      ligne({ replacesItemId: 'iso', cfcCode: '271', amount: '120000' }),
    ]), BASE, montantDe)

    const manque = c.find((x) => x.nature === 'ajouter')!
    expect(manque.regle.id).toBe('iso-interieure-finition-facade')
    expect(manque.cfcAttendu).toBe('227')
  })

  it('se tait quand la variante garde l’échafaudage entier et prévoit la façade', () => {
    const c = consequencesDe(variante([
      ligne({ id: 'a', replacesItemId: 'iso', cfcCode: '271', amount: '120000' }),
      ligne({ id: 'c', cfcCode: '227', label: 'Peinture extérieure', amount: '40000' }),
    ]), BASE, montantDe)

    expect(c).toHaveLength(0)
  })

  it("ne dit rien d'un échafaudage laissé tel quel : ne pas y toucher, c'est le garder", () => {
    const c = consequencesDe(variante([
      ligne({ id: 'a', replacesItemId: 'iso', cfcCode: '271', amount: '120000' }),
      ligne({ id: 'c', cfcCode: '227', label: 'Peinture extérieure', amount: '40000' }),
    ]), BASE, montantDe)
    expect(c.some((x) => x.nature === 'conserver')).toBe(false)
  })

  it('accepte un échafaudage arbitré à la hausse : rien n’est perdu', () => {
    const c = consequencesDe(variante([
      ligne({ id: 'a', replacesItemId: 'iso', cfcCode: '271', amount: '120000' }),
      ligne({ id: 'b', replacesItemId: 'ech', cfcCode: '211.1', label: 'Échafaudage renforcé', amount: '31000' }),
      ligne({ id: 'c', cfcCode: '227', label: 'Peinture extérieure', amount: '40000' }),
    ]), BASE, montantDe)
    expect(c.some((x) => x.nature === 'conserver')).toBe(false)
  })

  it("ne prend pas le traitement des volets pour un traitement de façade", () => {
    // 227.3 « Traitement du bois extérieur » partage sa position avec 227 « Peinture
    // extérieure » mais ne traite que les volets : la façade reste nue.
    const avecVolets = [...BASE, ouvrage({ id: 'volets', cfcCode: '227.3', cfcLabel: 'Traitement du bois extérieur', estimatedCost: '4000' })]
    const c = consequencesDe(variante([
      ligne({ replacesItemId: 'iso', cfcCode: '271', amount: '120000' }),
    ]), avecVolets, montantDe)
    expect(c.some((x) => x.nature === 'ajouter')).toBe(true)
  })

  it('accepte un crépi de façade non isolée comme traitement', () => {
    const c = consequencesDe(variante([
      ligne({ id: 'a', replacesItemId: 'iso', cfcCode: '271', amount: '120000' }),
      ligne({ id: 'b', cfcCode: '226.1', label: 'Crépi de façade non isolée', amount: '60000' }),
    ]), BASE, montantDe)
    expect(c.some((x) => x.nature === 'ajouter')).toBe(false)
  })

  it('tient compte d’une façade déjà traitée au diagnostic et non arbitrée', () => {
    const avecPeinture = [...BASE, ouvrage({ id: 'peint', cfcCode: '227', cfcLabel: 'Peinture extérieure', estimatedCost: '4000' })]
    const c = consequencesDe(variante([
      ligne({ replacesItemId: 'iso', cfcCode: '271', amount: '120000' }),
    ]), avecPeinture, montantDe)
    expect(c.some((x) => x.nature === 'ajouter')).toBe(false)
  })

  it('redemande la façade si la variante supprime justement le traitement existant', () => {
    const avecPeinture = [...BASE, ouvrage({ id: 'peint', cfcCode: '227', cfcLabel: 'Peinture extérieure', estimatedCost: '4000' })]
    const c = consequencesDe(variante([
      ligne({ id: 'a', replacesItemId: 'iso', cfcCode: '271', amount: '120000' }),
      // On arbitre la peinture… vers autre chose que du traitement de façade.
      ligne({ id: 'b', replacesItemId: 'peint', cfcCode: '271', label: 'Reporté à l’intérieur', amount: '0' }),
    ]), avecPeinture, montantDe)
    expect(c.some((x) => x.nature === 'ajouter')).toBe(true)
  })
})

describe('autres variantes', () => {
  it('ne déclenche rien pour un arbitrage de chauffage', () => {
    const chauffage = ouvrage({ id: 'ch', cfcCode: '242.0', cfcLabel: 'Production de chaleur', estimatedCost: '40000' })
    const c = consequencesDe(variante([
      ligne({ replacesItemId: 'ch', cfcCode: '242', label: 'Chaudière à pellets', amount: '65000' }),
    ]), [chauffage], montantDe)
    expect(c).toHaveLength(0)
  })

  it('ne déclenche rien sur une variante vide', () => {
    expect(consequencesDe(variante([]), BASE, montantDe)).toHaveLength(0)
  })
})
