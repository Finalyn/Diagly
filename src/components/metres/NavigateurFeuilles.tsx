/**
 * Le navigateur des feuilles de l'outil Métrés, à gauche de l'espace de travail.
 *
 * Toutes les pages de tous les plans du dossier, dans l'ordre du dépôt : la
 * vignette, le numéro et le titre lus au cartouche, le type de vue, l'étage
 * et son multiplicateur, puis trois pastilles qui disent où en est chaque
 * feuille : son échelle (posée, à vérifier, absente), son analyse (en file,
 * en cours, analysée, en erreur) et ce qui y attend d'être validé. C'est
 * aussi là qu'on corrige ce que l'IA a lu (titre, type, étage, étages
 * identiques) et qu'on relance une feuille, et jamais ailleurs : relancer
 * coûte une analyse, le geste doit être délibéré.
 */
import { useState } from 'react'
import { AlertTriangle, Check, Loader2, Pencil, RotateCcw, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ApiPlan, ChampCorrigeable, FeuillePlan, TypePageAnalysee } from '@/lib/api-types'
import { useApercusPages, useRenduPlan } from '@/components/plans/rendu'
import { MarqueDiagly } from '@/components/plans/AnalyseIA'
import {
  NOMS_STATUTS, NOMS_VUES, libelleFeuille, multiplicateur, type EtatAnalyse, type RefFeuille, type StatutEchelleFeuille,
} from '@/lib/plans/feuilles'

/** Une feuille telle que le navigateur la montre. */
export interface FeuilleVue extends RefFeuille {
  feuille: FeuillePlan
  etat: EtatAnalyse
  echelle: StatutEchelleFeuille
  aValider: number
}

export interface GroupeDeFeuilles {
  plan: ApiPlan
  /** Nombre de pages, null le temps de lire le document. */
  nombre: number | null
  feuilles: FeuilleVue[]
}

const ECHELLES: Record<StatutEchelleFeuille, { libelle: string; classe: string }> = {
  posee: { libelle: 'Échelle posée', classe: 'bg-emerald-50 text-emerald-700' },
  a_verifier: { libelle: 'Échelle à vérifier', classe: 'bg-amber-50 text-amber-700' },
  aucune: { libelle: 'Sans échelle', classe: 'bg-muted text-muted-foreground' },
}

const ANALYSES: Record<EtatAnalyse, string> = {
  aucune: 'bg-muted text-muted-foreground',
  en_file: 'bg-sky-50 text-sky-700',
  en_cours: 'bg-sky-50 text-sky-700',
  prete: 'bg-emerald-50 text-emerald-700',
  erreur: 'bg-red-50 text-red-700',
}

export function NavigateurFeuilles({ groupes, selection, lectureSeule, onChoisir, onAnalyser, onCorriger }: {
  groupes: GroupeDeFeuilles[]
  selection: RefFeuille | null
  /** Sur téléphone : on regarde l'état des feuilles, on ne les corrige pas. */
  lectureSeule?: boolean
  onChoisir?: (f: RefFeuille) => void
  onAnalyser?: (f: RefFeuille, relance: boolean) => void
  onCorriger?: (f: RefFeuille, patch: Partial<Pick<FeuillePlan, ChampCorrigeable>>) => void
}) {
  return (
    <div className="space-y-4">
      {groupes.map((g) => (
        <GroupePlan
          key={g.plan.id}
          groupe={g}
          plusieurs={groupes.length > 1}
          selection={selection}
          lectureSeule={lectureSeule}
          onChoisir={onChoisir}
          onAnalyser={onAnalyser}
          onCorriger={onCorriger}
        />
      ))}
    </div>
  )
}

function GroupePlan({ groupe, plusieurs, selection, lectureSeule, onChoisir, onAnalyser, onCorriger }: {
  groupe: GroupeDeFeuilles
  plusieurs: boolean
  selection: RefFeuille | null
  lectureSeule?: boolean
  onChoisir?: (f: RefFeuille) => void
  onAnalyser?: (f: RefFeuille, relance: boolean) => void
  onCorriger?: (f: RefFeuille, patch: Partial<Pick<FeuillePlan, ChampCorrigeable>>) => void
}) {
  const { plan, nombre, feuilles } = groupe
  const pdf = plan.mimeType === 'application/pdf'
  // Les vignettes d'un PDF sortent toutes d'un seul décodage du document.
  const apercus = useApercusPages(plan, pdf)
  const image = useRenduPlan(pdf ? null : plan, 240)
  const vignette = (page: number) => (pdf ? apercus.pages.find((x) => x.numero === page)?.url : image.rendu?.url) ?? null

  return (
    <section>
      {plusieurs && (
        <p className="mb-1.5 truncate px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground" title={plan.name}>
          {plan.name}{nombre ? ` · ${nombre} page${nombre > 1 ? 's' : ''}` : ''}
        </p>
      )}
      {nombre == null ? (
        <p className="flex items-center gap-2 rounded-xl border border-dashed px-3 py-3 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />Lecture du document…
        </p>
      ) : (
        <ul className="space-y-1.5">
          {feuilles.map((f) => (
            <CarteFeuille
              key={f.page}
              vue={f}
              nomDuPlan={plan.name}
              vignette={vignette(f.page)}
              choisie={selection?.planId === f.planId && selection.page === f.page}
              lectureSeule={lectureSeule}
              onChoisir={onChoisir && (() => onChoisir(f))}
              onAnalyser={onAnalyser && ((relance) => onAnalyser(f, relance))}
              onCorriger={onCorriger && ((patch) => onCorriger(f, patch))}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function CarteFeuille({ vue, nomDuPlan, vignette, choisie, lectureSeule, onChoisir, onAnalyser, onCorriger }: {
  vue: FeuilleVue
  nomDuPlan: string
  vignette: string | null
  choisie: boolean
  lectureSeule?: boolean
  onChoisir?: () => void
  onAnalyser?: (relance: boolean) => void
  onCorriger?: (patch: Partial<Pick<FeuillePlan, ChampCorrigeable>>) => void
}) {
  const [edition, setEdition] = useState(false)
  const { feuille, etat, echelle, aValider, page } = vue
  const mult = multiplicateur(feuille)
  const description = [
    feuille.type ? NOMS_VUES[feuille.type] : null,
    feuille.niveau?.trim() || null,
    mult > 1 ? `× ${mult} étages` : null,
  ].filter(Boolean).join(' · ')
  const analysable = etat === 'aucune' || etat === 'erreur' || etat === 'prete'

  return (
    <li
      className={cn('rounded-xl border bg-background transition-colors',
        choisie ? 'border-foreground ring-1 ring-foreground' : 'hover:border-foreground/30')}
    >
      <div className="flex items-start gap-2.5 p-2">
        <button
          onClick={onChoisir}
          disabled={!onChoisir}
          className="h-12 w-16 shrink-0 overflow-hidden rounded-md border bg-white"
          title="Ouvrir cette feuille"
        >
          {vignette
            ? <img src={vignette} alt="" className="h-full w-full object-contain" />
            : <span className="flex h-full items-center justify-center"><Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /></span>}
        </button>
        <div className="min-w-0 flex-1">
          <button onClick={onChoisir} disabled={!onChoisir} className="block w-full text-left">
            <span className="block truncate text-[13px] font-medium leading-tight" title={libelleFeuille(feuille, page, nomDuPlan)}>
              {libelleFeuille(feuille, page, nomDuPlan)}
            </span>
            <span className="block truncate text-[11px] text-muted-foreground">{description || `Page ${page}`}</span>
          </button>
          <div className="mt-1 flex flex-wrap gap-1">
            <Pastille classe={ECHELLES[echelle].classe}>{ECHELLES[echelle].libelle}</Pastille>
            <Pastille classe={ANALYSES[etat]} titre={etat === 'erreur' ? feuille.analyse?.message ?? undefined : undefined}>
              {etat === 'en_cours' && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
              {etat === 'erreur' && <AlertTriangle className="h-2.5 w-2.5" />}
              {NOMS_STATUTS[etat]}
            </Pastille>
            {aValider > 0 && <Pastille classe="bg-teal-50 text-teal-700">{aValider} à valider</Pastille>}
          </div>
        </div>
        {!lectureSeule && (
          <div className="flex shrink-0 flex-col gap-0.5">
            <button
              onClick={() => setEdition((e) => !e)}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Corriger le titre, le type, l’étage"
              aria-pressed={edition}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            {analysable && onAnalyser && (
              <button
                onClick={() => onAnalyser(etat === 'prete')}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title={etat === 'prete' ? 'Relancer l’analyse de cette feuille' : 'Analyser cette feuille'}
              >
                {etat === 'prete' ? <RotateCcw className="h-3.5 w-3.5" /> : <MarqueDiagly className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>
        )}
      </div>
      {edition && onCorriger && (
        <EditionFeuille
          feuille={feuille}
          onAnnuler={() => setEdition(false)}
          onEnregistrer={(patch) => { onCorriger(patch); setEdition(false) }}
        />
      )}
    </li>
  )
}

function Pastille({ classe, titre, children }: { classe: string; titre?: string; children: React.ReactNode }) {
  return (
    <span title={titre} className={cn('inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none', classe)}>
      {children}
    </span>
  )
}

/**
 * Corriger ce que l'IA a lu d'une feuille. Seuls les champs changés partent :
 * ce sont eux qu'une nouvelle analyse ne touchera plus.
 */
function EditionFeuille({ feuille, onAnnuler, onEnregistrer }: {
  feuille: FeuillePlan
  onAnnuler: () => void
  onEnregistrer: (patch: Partial<Pick<FeuillePlan, ChampCorrigeable>>) => void
}) {
  const [titre, setTitre] = useState(feuille.titre ?? '')
  const [type, setType] = useState<TypePageAnalysee | ''>(feuille.type ?? '')
  const [niveau, setNiveau] = useState(feuille.niveau ?? '')
  const [etages, setEtages] = useState(String(multiplicateur(feuille)))
  const nombre = Number(etages)
  const etagesValide = Number.isInteger(nombre) && nombre >= 1 && nombre <= 60

  const enregistrer = () => {
    const patch: Partial<Pick<FeuillePlan, ChampCorrigeable>> = {}
    if (titre.trim() !== (feuille.titre ?? '')) patch.titre = titre.trim() || null
    if (type !== (feuille.type ?? '')) patch.type = type || null
    if (niveau.trim() !== (feuille.niveau ?? '')) patch.niveau = niveau.trim() || null
    if (etagesValide && nombre !== multiplicateur(feuille)) patch.etagesIdentiques = nombre
    if (Object.keys(patch).length) onEnregistrer(patch)
    else onAnnuler()
  }

  const champ = 'h-9 w-full rounded-md border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-primary'
  return (
    <div className="space-y-2 border-t px-2.5 pb-2.5 pt-2">
      <label className="block text-[11px] text-muted-foreground">
        Titre
        <input value={titre} onChange={(e) => setTitre(e.target.value)} maxLength={120} className={cn(champ, 'mt-0.5')} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-[11px] text-muted-foreground">
          Vue
          <select value={type} onChange={(e) => setType(e.target.value as TypePageAnalysee | '')} className={cn(champ, 'mt-0.5')}>
            <option value="">Non précisée</option>
            {(Object.keys(NOMS_VUES) as TypePageAnalysee[]).map((t) => <option key={t} value={t}>{NOMS_VUES[t]}</option>)}
          </select>
        </label>
        <label className="block text-[11px] text-muted-foreground">
          Étage
          <input value={niveau} onChange={(e) => setNiveau(e.target.value)} maxLength={40} placeholder="Rez, 1er…" className={cn(champ, 'mt-0.5')} />
        </label>
      </div>
      <label className="block text-[11px] text-muted-foreground">
        Étages identiques représentés
        <input
          type="number" inputMode="numeric" min={1} max={60} step={1} value={etages}
          onChange={(e) => setEtages(e.target.value)}
          className={cn(champ, 'mt-0.5', !etagesValide && 'border-red-400')}
        />
      </label>
      <div className="flex gap-1.5">
        <button onClick={onAnnuler} className="flex h-8 flex-1 items-center justify-center gap-1 rounded-md border text-xs font-medium hover:bg-muted">
          <X className="h-3.5 w-3.5" />Annuler
        </button>
        <button
          onClick={enregistrer}
          disabled={!etagesValide}
          className="flex h-8 flex-1 items-center justify-center gap-1 rounded-md bg-foreground text-xs font-semibold text-background hover:opacity-90 disabled:opacity-40"
        >
          <Check className="h-3.5 w-3.5" />Enregistrer
        </button>
      </div>
    </div>
  )
}
