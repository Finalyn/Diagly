/**
 * Conséquences induites d'un arbitrage de variante.
 *
 * Une variante n'est pas une substitution isolée. Changer de technique ne supprime
 * pas les raisons pour lesquelles les autres ouvrages étaient au devis :
 *
 *  — isoler par l'intérieur ne supprime pas l'échafaudage. On ne touche plus la
 *    façade par l'extérieur pour l'isoler, mais on y intervient encore (fenêtres,
 *    ferblanterie, finition), et l'accès coûte le même prix ;
 *  — isoler par l'intérieur laisse la façade sans traitement. L'isolation
 *    périphérique apportait son crépi de finition ; l'enlever du devis sans
 *    remettre un crépi ou une peinture revient à livrer une façade nue.
 *
 * Sans ce garde-fou, une variante paraît moins chère qu'elle ne l'est — et c'est
 * l'erreur la plus coûteuse qu'un outil de variante puisse produire, puisqu'elle
 * oriente la décision.
 *
 * Les règles ci-dessous sont un point de départ, à compléter par le bureau : elles
 * sont déclaratives et se lisent comme un tableau.
 */
import { cfcPositionCode } from './cfc'
import type { ApiDiagnosticItem, ApiVariant, ApiVariantLine } from './api-types'

/**
 * Un ouvrage du diagnostic qui doit rester entier, ou un travail qui doit s'ajouter,
 * lorsqu'un arbitrage donné est fait.
 */
export interface RegleConsequence {
  id: string
  /** Positions CFC (3 chiffres) de l'ouvrage remplacé qui arment la règle. */
  remplace: string[]
  /** Positions CFC (3 chiffres) de la solution retenue qui arment la règle. */
  par: string[]
  effet:
    | {
        /** L'ouvrage de ces positions ne doit pas être réduit par la variante. */
        type: 'conserver'
        cfc: string[]
      }
    | {
        /**
         * Un travail doit figurer dans la variante.
         *
         * `accepte` liste les codes CFC exacts qui satisfont la règle, et non une
         * position à 3 chiffres : « 227.3 Traitement du bois extérieur » (les volets)
         * ne traite pas la façade, alors qu'il partage sa position avec « 227
         * Peinture extérieure ». Rapprocher à la position laisserait passer l'oubli.
         */
        type: 'ajouter'
        cfc: string
        accepte: string[]
        libelle: string
      }
  titre: string
  raison: string
}

export const REGLES: RegleConsequence[] = [
  {
    id: 'iso-interieure-echafaudage',
    remplace: ['226', '215', '216'], // isolation périphérique, façades ventilées, pierre
    par: ['271', '282'],             // doublage, revêtement de paroi intérieur
    effet: { type: 'conserver', cfc: ['211'] },
    titre: "L'échafaudage reste nécessaire en totalité",
    raison:
      "Isoler par l'intérieur ne supprime pas l'intervention sur la façade : fenêtres, "
      + "ferblanterie et finition s'atteignent toujours par l'extérieur. L'accès coûte le "
      + 'même prix, quelle que soit la technique d’isolation retenue.',
  },
  {
    id: 'iso-interieure-finition-facade',
    remplace: ['226', '215', '216'],
    par: ['271', '282'],
    effet: {
      type: 'ajouter',
      cfc: '227',
      // Une peinture extérieure, ou un crépi de façade non isolée : les deux
      // remettent une finition sur le mur qu'on n'habille plus par l'extérieur.
      accepte: ['227', '226.1'],
      libelle: 'Traitement de la façade (crépi ou peinture extérieure)',
    },
    titre: 'La façade reste à traiter',
    raison:
      "L'isolation périphérique apportait son crépi de finition. En la retirant du devis "
      + 'sans remettre un crépi ou une peinture, on livre une façade nue : le traitement '
      + 'extérieur doit être reporté dans la variante.',
  },
]

export type NatureConsequence = 'conserver' | 'ajouter'

export interface Consequence {
  regle: RegleConsequence
  nature: NatureConsequence
  /** Pour « conserver » : l'ouvrage réduit à tort, et de combien. */
  ouvrageReduit?: { item: ApiDiagnosticItem; montantBase: number; montantVariante: number }
  /** Pour « ajouter » : la position CFC attendue. */
  cfcAttendu?: string
}

const num = (v: string | number | null | undefined) =>
  v == null ? 0 : typeof v === 'number' ? v : Number(v)

const positionDe = (code: string | null | undefined) => cfcPositionCode(code) ?? ''

/** Montant total d'un ouvrage : réparation + amélioration + remise aux normes. */
function montantOuvrage(it: ApiDiagnosticItem): number {
  return num(it.estimatedCost) + num(it.improvementCost) + num(it.normsCost)
}

/** La règle est-elle armée par au moins un arbitrage de cette variante ? */
function regleArmee(regle: RegleConsequence, lignes: ApiVariantLine[], items: Map<string, ApiDiagnosticItem>): boolean {
  return lignes.some((l) => {
    if (!l.replacesItemId) return false
    const remplace = items.get(l.replacesItemId)
    if (!remplace) return false
    return regle.remplace.includes(positionDe(remplace.cfcCode))
      && regle.par.includes(positionDe(l.cfcCode))
  })
}

/**
 * Conséquences non satisfaites d'une variante.
 *
 * On ne renvoie que ce qui manque : une variante qui a déjà gardé son échafaudage
 * entier et prévu la finition de façade ne déclenche aucun avertissement.
 */
export function consequencesDe(
  variant: ApiVariant,
  items: ApiDiagnosticItem[],
  /** Montant retenu par la variante pour chaque ligne, rechiffré. */
  montantDeLaLigne: (ligne: ApiVariantLine) => number,
): Consequence[] {
  const parId = new Map(items.map((it) => [it.id, it]))
  const trouvees: Consequence[] = []

  for (const regle of REGLES) {
    if (!regleArmee(regle, variant.lines, parId)) continue

    if (regle.effet.type === 'conserver') {
      // L'ouvrage d'accès est-il réduit par la variante ? Une ligne qui le remplace
      // par un montant inférieur revient à faire l'économie d'un accès dont on a
      // toujours besoin.
      for (const ligne of variant.lines) {
        const remplace = ligne.replacesItemId ? parId.get(ligne.replacesItemId) : undefined
        if (!remplace || !regle.effet.cfc.includes(positionDe(remplace.cfcCode))) continue
        const montantBase = montantOuvrage(remplace)
        const montantVariante = montantDeLaLigne(ligne)
        if (montantVariante < montantBase) {
          trouvees.push({ regle, nature: 'conserver', ouvrageReduit: { item: remplace, montantBase, montantVariante } })
        }
      }
    } else {
      const accepte = regle.effet.accepte
      const convient = (code: string | null | undefined) => accepte.includes((code ?? '').trim())
      // Le travail induit figure-t-il déjà, dans la variante…
      const dejaPrevu = variant.lines.some((l) => convient(l.cfcCode))
        // …ou au diagnostic, sans que la variante l'en retire ?
        || items.some((it) => convient(it.cfcCode)
          && !variant.lines.some((l) => l.replacesItemId === it.id))
      if (!dejaPrevu) {
        trouvees.push({ regle, nature: 'ajouter', cfcAttendu: regle.effet.cfc })
      }
    }
  }

  return trouvees
}
