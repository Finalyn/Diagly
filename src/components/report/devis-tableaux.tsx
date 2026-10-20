/**
 * Les tableaux du devis : lignes, enveloppes, totaux, priorités.
 *
 * Composants seuls, sans les blocs qui les assemblent (devis-blocs.tsx) : un
 * fichier qui exporte à la fois des composants et des fonctions casse le
 * rafraîchissement à chaud de Vite.
 */
import { Fragment, type ReactNode } from 'react'
import { priorityTextColors } from '@/data/mock'
import { cn, formatCHF, formatPrixUnitaire } from '@/lib/utils'
import { SENS_DES_ENVELOPPES, type Cascade, type Devis, type DevisEnveloppe, type DevisLigne, type DevisPosition } from '@/lib/devis'
import type { ApiProject } from '@/lib/api-types'
import { ENVELOPPE_COURTE, TITRE_ENVELOPPE } from './constants'

const nombre = (v: number) => new Intl.NumberFormat('fr-CH', { maximumFractionDigits: 2 }).format(v)
const quantite = (l: DevisLigne) => (l.quantite != null ? `${nombre(l.quantite)}${l.unite ? ` ${l.unite}` : ''}` : '')
const pct = (v: number | null | undefined) => `${nombre(v ?? 0)} %`

// ------------------------------------------------------------------ lignes

/** Ce qui s'écrit sous la désignation : les travaux, et ce que le lecteur doit savoir du prix. */
export function SousLigne({ l }: { l: DevisLigne }) {
  return (
    <>
      {l.remarque && <div className="italic text-muted-foreground">{l.remarque}</div>}
      {l.aChiffrer && (
        <div className="font-medium text-amber-700">À chiffrer : {l.raisonAChiffrer ?? 'montant à saisir'}.</div>
      )}
      {l.indexation && (
        <div className="text-muted-foreground">
          Prix du catalogue {formatPrixUnitaire(l.indexation.prixCatalogue)} × indice de la construction {nombre(l.indexation.coeff)}.
        </div>
      )}
    </>
  )
}

export function Montant({ l }: { l: DevisLigne }) {
  if (l.aChiffrer) return <span className="font-medium text-amber-700">à chiffrer</span>
  return <>{l.montant < 0 ? `−${formatCHF(-l.montant)}` : formatCHF(l.montant)}</>
}

export function Prix({ l }: { l: DevisLigne }) {
  if (l.prixUnitaire == null) return null
  return <>{l.prixUnitaire < 0 ? `−${formatPrixUnitaire(-l.prixUnitaire)}` : formatPrixUnitaire(l.prixUnitaire)}</>
}

export function Priorite({ l }: { l: DevisLigne }) {
  if (!l.priorite) return <span className="text-muted-foreground">·</span>
  return <span className={cn('font-semibold', priorityTextColors[l.priorite])}>{l.priorite}</span>
}

export function EnTetePosition({ position, colonnes }: { position: DevisPosition; colonnes: number }) {
  return (
    <tr className="border-t bg-muted/40 font-semibold">
      <td className="py-1 font-mono">{position.code || '·'}</td>
      <td className="py-1" colSpan={colonnes - 2}>{position.label}</td>
      <td className="py-1 text-right tabular-nums">{formatCHF(position.montant)}</td>
    </tr>
  )
}

export function LignesUnique({ position }: { position: DevisPosition }) {
  return (
    <>
      <EnTetePosition position={position} colonnes={7} />
      {position.lignes.map((l) => (
        <tr key={l.cle} className="border-t align-top">
          <td className={cn('py-1 font-mono text-muted-foreground', l.rattacheA && 'pl-3')}>{l.rattacheA ? '' : l.cfcCode}</td>
          <td className={cn('py-1', l.rattacheA && 'pl-3 text-muted-foreground')}>
            {l.libelle}
            <SousLigne l={l} />
          </td>
          <td className="py-1">{ENVELOPPE_COURTE[l.enveloppe]}</td>
          <td className="py-1"><Priorite l={l} /></td>
          <td className="py-1 text-right tabular-nums">{quantite(l)}</td>
          <td className="py-1 text-right tabular-nums"><Prix l={l} /></td>
          <td className="py-1 text-right tabular-nums"><Montant l={l} /></td>
        </tr>
      ))}
    </>
  )
}

export function LignesEnveloppe({ position }: { position: DevisPosition }) {
  return (
    <>
      <EnTetePosition position={position} colonnes={6} />
      {position.lignes.map((l) => (
        <tr key={l.cle} className="border-t align-top">
          <td className={cn('py-1 font-mono text-muted-foreground', l.rattacheA && 'pl-3')}>{l.rattacheA ? '' : l.cfcCode}</td>
          <td className={cn('py-1', l.rattacheA && 'pl-3 text-muted-foreground')}>
            {l.libelle}
            <SousLigne l={l} />
          </td>
          <td className="py-1"><Priorite l={l} /></td>
          <td className="py-1 text-right tabular-nums">{quantite(l)}</td>
          <td className="py-1 text-right tabular-nums"><Prix l={l} /></td>
          <td className="py-1 text-right tabular-nums"><Montant l={l} /></td>
        </tr>
      ))}
    </>
  )
}

// ------------------------------------------------------------------- totaux

/** La cascade d'un montant HT jusqu'au TTC, ligne par ligne. */
export function DetailCascade({ cascade, project, titreHt = 'Travaux (HT)' }: { cascade: Cascade; project: Pick<ApiProject, 'honoraryPct' | 'reservePct'>; titreHt?: string }) {
  return (
    <table className="w-full">
      <tbody>
        <LigneTotal libelle={titreHt} montant={cascade.ht} fort />
        <LigneTotal libelle={`Honoraires (${pct(project.honoraryPct)} des travaux)`} montant={cascade.honoraires} />
        <LigneTotal libelle={`Réserve pour imprévus (${pct(project.reservePct)}, sur travaux et honoraires)`} montant={cascade.reserve} />
        {cascade.detailFrais.map((f) => <LigneTotal key={f.libelle} libelle={f.libelle} montant={f.montant} />)}
        <LigneTotal libelle="Sous-total" montant={cascade.sousTotal} />
        <LigneTotal libelle="TVA 8,1 %" montant={cascade.tva} />
        <tr className="border-t-2 border-foreground font-bold">
          <td className="py-1.5">Total TTC</td>
          <td className="py-1.5 text-right tabular-nums">{formatCHF(cascade.total)}</td>
        </tr>
      </tbody>
    </table>
  )
}

export function LigneTotal({ libelle, montant, fort }: { libelle: string; montant: number; fort?: boolean }) {
  return (
    <tr className={cn('border-t', fort && 'font-semibold')}>
      <td className="py-1 text-muted-foreground">{libelle}</td>
      <td className="w-32 py-1 text-right tabular-nums">{formatCHF(montant)}</td>
    </tr>
  )
}

export function AvisAChiffrer({ n }: { n: number }) {
  if (n === 0) return null
  return (
    <p className="mt-2 border-l-[3px] border-amber-500 bg-amber-50 px-3 py-1.5 text-amber-900">
      {n} ligne{n > 1 ? 's restent' : ' reste'} à chiffrer : {n > 1 ? 'elles ne sont pas comprises' : "elle n'est pas comprise"} dans ce total.
    </p>
  )
}

export function TitreEnveloppe({ e }: { e: DevisEnveloppe }) {
  return (
    <>
      <h3 className="flex flex-wrap items-baseline justify-between gap-x-4 border-b-2 border-foreground pb-1 font-bold uppercase tracking-wide">
        <span>{TITRE_ENVELOPPE[e.cle]}</span>
        <span className="tabular-nums">{formatCHF(e.ht)} HT</span>
      </h3>
      <p className="mb-2 mt-1 text-muted-foreground">{SENS_DES_ENVELOPPES[e.cle]}</p>
    </>
  )
}

export function Recapitulatif({ devis }: { devis: Devis }) {
  const presentes = devis.enveloppes.filter((e) => e.lignes.length > 0)
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b text-left text-muted-foreground">
          <th className="py-1 font-medium">Enveloppe</th>
          <th className="w-16 py-1 text-right font-medium">Lignes</th>
          <th className="w-28 py-1 text-right font-medium">Travaux HT</th>
          <th className="w-28 py-1 text-right font-medium">Total TTC</th>
          <th className="w-14 py-1 text-right font-medium">Part</th>
        </tr>
      </thead>
      <tbody>
        {presentes.map((e) => (
          <tr key={e.cle} className="border-t align-top">
            <td className="py-1">
              <span className="font-medium">{TITRE_ENVELOPPE[e.cle]}</span>
              {e.aChiffrer > 0 && <span className="ml-1.5 text-amber-700">({e.aChiffrer} à chiffrer)</span>}
            </td>
            <td className="py-1 text-right tabular-nums">{e.lignes.filter((l) => !l.rattacheA).length}</td>
            <td className="py-1 text-right tabular-nums">{formatCHF(e.ht)}</td>
            <td className="py-1 text-right font-medium tabular-nums">{formatCHF(e.cascade.total)}</td>
            <td className="py-1 text-right tabular-nums text-muted-foreground">{devis.ht > 0 ? `${Math.round(e.ht / devis.ht * 100)} %` : ''}</td>
          </tr>
        ))}
        <tr className="border-t-2 border-foreground font-bold">
          <td className="py-1.5" colSpan={2}>Total général</td>
          <td className="py-1.5 text-right tabular-nums">{formatCHF(devis.ht)}</td>
          <td className="py-1.5 text-right tabular-nums">{formatCHF(devis.cascade.total)}</td>
          <td className="py-1.5" />
        </tr>
      </tbody>
    </table>
  )
}

/** Les lignes de travaux par priorité : les mêmes compteurs que la synthèse. */
export function TableauPriorites({ devis }: { devis: Devis }) {
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b text-left text-muted-foreground">
          <th className="py-1 font-medium">Priorité</th>
          <th className="py-1 font-medium">Horizon</th>
          <th className="w-16 py-1 text-right font-medium">Lignes</th>
          <th className="w-28 py-1 text-right font-medium">Travaux HT</th>
        </tr>
      </thead>
      <tbody>
        {devis.priorites.map((p) => (
          <tr key={p.cle} className="border-t">
            <td className={cn('py-1 font-medium', p.cle !== 'NC' && priorityTextColors[p.cle])}>{p.titre}</td>
            <td className="py-1 text-muted-foreground">{p.horizon}</td>
            <td className="py-1 text-right tabular-nums">{p.lignes}</td>
            <td className="py-1 text-right tabular-nums">{formatCHF(p.ht)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function SousTitre({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cn('mb-2 font-bold uppercase tracking-wide', className)}>{children}</h3>
}

/** La répartition par enveloppe, en une ligne par enveloppe : pour la synthèse. */
export function BudgetParEnveloppe({ devis }: { devis: Devis }) {
  return (
    <table className="w-full">
      <tbody>
        {devis.enveloppes.filter((e) => e.lignes.length > 0).map((e) => (
          <Fragment key={e.cle}>
            <tr className="border-t">
              <td className="py-1">{TITRE_ENVELOPPE[e.cle]}</td>
              <td className="w-28 py-1 text-right tabular-nums">{formatCHF(e.ht)} HT</td>
              <td className="w-32 py-1 text-right font-medium tabular-nums">{formatCHF(e.cascade.total)} TTC</td>
            </tr>
          </Fragment>
        ))}
        <tr className="border-t-2 border-foreground font-bold">
          <td className="py-1.5">Total général</td>
          <td className="py-1.5 text-right tabular-nums">{formatCHF(devis.ht)} HT</td>
          <td className="py-1.5 text-right tabular-nums">{formatCHF(devis.cascade.total)} TTC</td>
        </tr>
      </tbody>
    </table>
  )
}
