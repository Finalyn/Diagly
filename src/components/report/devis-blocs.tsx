/**
 * Le chapitre du devis, en blocs pour la mise en pages A4.
 *
 * L'ordre est celui que demande l'arbitrage d'un propriétaire :
 *
 *  1. le devis unique : toutes les lignes dans un même tableau, classées par
 *     code CFC, chacune avec son enveloppe et sa priorité, et le total général ;
 *  2. une page par enveloppe (postes de chantier, réparation, mise aux normes,
 *     amélioration), chacune avec ses lignes et son total HT et TTC ;
 *  3. le récapitulatif : les enveloppes côte à côte, puis les priorités.
 *
 * Tout vient du même calcul (lib/devis.ts) : les pages par enveloppe et le
 * récapitulatif sont des sous-ensembles du devis unique, et leurs totaux
 * retombent sur le total général. La synthèse du rapport lit les mêmes
 * compteurs.
 */
import type { ReactNode } from 'react'
import { cn, formatCHF } from '@/lib/utils'
import { ENVELOPPES, type Devis } from '@/lib/devis'
import type { ApiProject } from '@/lib/api-types'
import type { BlocDocument } from './PagesA4'
import { TITRE_ENVELOPPE } from './constants'
import {
  AvisAChiffrer, DetailCascade, LignesEnveloppe, LignesUnique, Recapitulatif, SousTitre, TableauPriorites, TitreEnveloppe,
} from './devis-tableaux'

// --------------------------------------------------------------- colonnes
// Largeurs imposées : sans elles, les morceaux d'un même tableau ne
// s'alignent plus d'une page à l'autre.

const COLONNES_UNIQUE = (
  <>
    <col style={{ width: '14mm' }} />
    <col />
    <col style={{ width: '21mm' }} />
    <col style={{ width: '10mm' }} />
    <col style={{ width: '20mm' }} />
    <col style={{ width: '20mm' }} />
    <col style={{ width: '24mm' }} />
  </>
)

const ENTETE_UNIQUE = (
  <thead>
    <tr className="text-left text-muted-foreground">
      <th className="py-1 font-medium">CFC</th>
      <th className="py-1 font-medium">Désignation</th>
      <th className="py-1 font-medium">Enveloppe</th>
      <th className="py-1 font-medium">Prio.</th>
      <th className="py-1 text-right font-medium">Quantité</th>
      <th className="py-1 text-right font-medium">Prix unit.</th>
      <th className="py-1 text-right font-medium">Montant HT</th>
    </tr>
  </thead>
)

const COLONNES_ENVELOPPE = (
  <>
    <col style={{ width: '14mm' }} />
    <col />
    <col style={{ width: '10mm' }} />
    <col style={{ width: '22mm' }} />
    <col style={{ width: '22mm' }} />
    <col style={{ width: '26mm' }} />
  </>
)

const ENTETE_ENVELOPPE = (
  <thead>
    <tr className="text-left text-muted-foreground">
      <th className="py-1 font-medium">CFC</th>
      <th className="py-1 font-medium">Désignation</th>
      <th className="py-1 font-medium">Prio.</th>
      <th className="py-1 text-right font-medium">Quantité</th>
      <th className="py-1 text-right font-medium">Prix unit.</th>
      <th className="py-1 text-right font-medium">Montant HT</th>
    </tr>
  </thead>
)


// ------------------------------------------------------------------- blocs

/**
 * Les blocs du chapitre, à la suite de son titre.
 *
 * `prefixe` distingue les clés quand le devis est rendu deux fois sur la
 * même page (rapport complet et extrait ne cohabitent pas, mais la mesure se
 * fait par clé).
 */
export function blocsDuDevis(devis: Devis, project: ApiProject, prefixe = 'devis'): BlocDocument[] {
  const out: BlocDocument[] = []
  const bloc = (cle: string, noeud: ReactNode, o: { nouvellePage?: boolean; avecSuivant?: boolean } = {}) =>
    out.push({ type: 'bloc', cle: `${prefixe}-${cle}`, noeud, ...o })

  bloc('intro', (
    <p className="mb-3 text-muted-foreground">
      Le devis rassemble toutes les lignes dans un même tableau, classées par code CFC. Chaque
      ligne porte son enveloppe (poste de chantier, réparation, mise aux normes ou amélioration)
      et sa priorité, sa quantité, son prix unitaire et son montant : quantité × prix unitaire =
      montant, à l'arrondi près. Les pages suivantes reprennent ces mêmes lignes enveloppe par
      enveloppe, puis le récapitulatif.
    </p>
  ))

  if (devis.lignes.length === 0) {
    bloc('vide', (
      <p className="text-muted-foreground">
        Aucun coût chiffré pour l'instant. Les montants apparaissent dès qu'un état est saisi sur les ouvrages relevés.
      </p>
    ))
    return out
  }

  // 1. Le devis unique.
  for (const pos of devis.positions) {
    out.push({
      type: 'lignes', cle: `${prefixe}-u-${pos.code || 'nc'}`, tableauId: `${prefixe}-unique`,
      colonnes: COLONNES_UNIQUE, entete: ENTETE_UNIQUE, lignes: <LignesUnique position={pos} />,
    })
  }
  out.push({
    type: 'lignes', cle: `${prefixe}-u-total`, tableauId: `${prefixe}-unique`,
    colonnes: COLONNES_UNIQUE, entete: ENTETE_UNIQUE,
    lignes: (
      <tr className="border-t-2 border-foreground font-bold">
        <td className="py-1.5" colSpan={6}>Total général des travaux (HT)</td>
        <td className="py-1.5 text-right tabular-nums">{formatCHF(devis.ht)}</td>
      </tr>
    ),
  })
  bloc('u-cascade', (
    <div className="mt-4 max-w-[110mm]">
      <SousTitre>Coût total de l'opération</SousTitre>
      <DetailCascade cascade={devis.cascade} project={project} />
      <p className="pt-2 text-muted-foreground">
        Fourchette à ±15 % : de {formatCHF(devis.cascade.total * 0.85)} à {formatCHF(devis.cascade.total * 1.15)} TTC.
      </p>
      <AvisAChiffrer n={devis.aChiffrer.length} />
    </div>
  ))

  // 2. Une page par enveloppe.
  for (const cle of ENVELOPPES) {
    const e = devis.enveloppes.find((x) => x.cle === cle)!
    if (e.lignes.length === 0) continue
    const id = `${prefixe}-e-${ENVELOPPES.indexOf(cle)}`
    bloc(`e-${ENVELOPPES.indexOf(cle)}-titre`, <TitreEnveloppe e={e} />, { nouvellePage: true, avecSuivant: true })
    for (const pos of e.positions) {
      out.push({
        type: 'lignes', cle: `${id}-${pos.code || 'nc'}`, tableauId: id,
        colonnes: COLONNES_ENVELOPPE, entete: ENTETE_ENVELOPPE, lignes: <LignesEnveloppe position={pos} />,
      })
    }
    const brut = e.lignes.filter((l) => l.montant > 0).reduce((s, l) => s + l.montant, 0)
    const deduit = e.lignes.filter((l) => l.montant < 0).reduce((s, l) => s - l.montant, 0)
    out.push({
      type: 'lignes', cle: `${id}-total`, tableauId: id, colonnes: COLONNES_ENVELOPPE, entete: ENTETE_ENVELOPPE,
      lignes: (
        <>
          {deduit > 0 && (
            <>
              <tr className="border-t-2">
                <td className="py-1" colSpan={5}>Améliorations, montant brut</td>
                <td className="py-1 text-right tabular-nums">{formatCHF(brut)}</td>
              </tr>
              <tr className="text-muted-foreground">
                <td className="py-1" colSpan={5}>Réparations qu'elles rendent inutiles</td>
                <td className="py-1 text-right tabular-nums">−{formatCHF(deduit)}</td>
              </tr>
            </>
          )}
          <tr className={cn('font-semibold', deduit > 0 ? 'border-t' : 'border-t-2')}>
            <td className="py-1" colSpan={5}>Total {TITRE_ENVELOPPE[cle].toLowerCase()}{deduit > 0 ? ', montant net' : ''} (HT)</td>
            <td className="py-1 text-right tabular-nums">{formatCHF(e.ht)}</td>
          </tr>
          <tr className="text-muted-foreground">
            <td className="py-0.5" colSpan={5}>Total TTC (honoraires, réserve, frais et TVA compris)</td>
            <td className="py-0.5 text-right tabular-nums">{formatCHF(e.cascade.total)}</td>
          </tr>
        </>
      ),
    })
    if (e.aChiffrer > 0) bloc(`e-${ENVELOPPES.indexOf(cle)}-avis`, <AvisAChiffrer n={e.aChiffrer} />)
  }

  // 3. Le récapitulatif.
  bloc('recap-titre', <SousTitre>Récapitulatif des enveloppes</SousTitre>, { nouvellePage: true, avecSuivant: true })
  bloc('recap', (
    <>
      <Recapitulatif devis={devis} />
      <p className="mt-2 text-muted-foreground">
        Les enveloppes sont des parts du même devis : leur somme est le total général. Les
        réparations et les mises aux normes s'imposent ; les améliorations se décident
        séparément, et leur montant est net des réparations qu'elles rendent inutiles.
      </p>
    </>
  ))
  bloc('recap-prio-titre', <SousTitre className="mt-6">Lignes de travaux par priorité</SousTitre>, { avecSuivant: true })
  bloc('recap-prio', (
    <>
      <TableauPriorites devis={devis} />
      <p className="mt-2 text-muted-foreground">
        Les postes de chantier ne portent pas de priorité propre : ils accompagnent les travaux engagés.
      </p>
    </>
  ))
  bloc('recap-total', (
    <div className="mt-6 max-w-[110mm]">
      <SousTitre>Coût total de l'opération</SousTitre>
      <DetailCascade cascade={devis.cascade} project={project} />
      <AvisAChiffrer n={devis.aChiffrer.length} />
    </div>
  ))

  return out
}

