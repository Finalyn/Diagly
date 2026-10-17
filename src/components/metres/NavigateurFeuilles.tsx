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
 *
 * L'échelle se lit d'un coup d'œil : vérifiée (imprimée et confirmée par une
 * cote, posée d'office), posée, à vérifier, ou incohérente quand l'échelle
 * imprimée et la cote se contredisent. Un bouton pose en un geste toutes les
 * échelles proposées qui restent, après confirmation.
 */
import { useState } from 'react'
import { AlertTriangle, Check, Loader2, Pencil, RotateCcw, Ruler, Trash2, X } from 'lucide-react'
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

const ECHELLES: Record<StatutEchelleFeuille, { libelle: string; classe: string; titre: string }> = {
  verifiee: { libelle: 'Échelle vérifiée', classe: 'bg-emerald-50 text-emerald-700', titre: 'Échelle imprimée confirmée par une cote, posée d’office' },
  posee: { libelle: 'Échelle posée', classe: 'bg-sky-50 text-sky-700', titre: 'Échelle posée à la main ou confirmée' },
  a_verifier: { libelle: 'À vérifier', classe: 'bg-amber-50 text-amber-700', titre: 'Échelle proposée, pas encore posée' },
  incoherente: { libelle: 'Incohérente', classe: 'bg-red-50 text-red-700', titre: 'L’échelle imprimée et la cote ne concordent pas : choisissez dans l’éditeur' },
  aucune: { libelle: 'Sans échelle', classe: 'bg-muted text-muted-foreground', titre: 'Ni échelle lue ni posée' },
}

const ANALYSES: Record<EtatAnalyse, string> = {
  aucune: 'bg-muted text-muted-foreground',
  en_file: 'bg-sky-50 text-sky-700',
  en_cours: 'bg-sky-50 text-sky-700',
  prete: 'bg-emerald-50 text-emerald-700',
  erreur: 'bg-red-50 text-red-700',
}

export function NavigateurFeuilles({ groupes, selection, lectureSeule, onChoisir, onAnalyser, onCorriger, echellesAPoser = 0, onPoserEchelles, onSupprimer }: {
  groupes: GroupeDeFeuilles[]
  selection: RefFeuille | null
  /** Sur téléphone : on regarde l'état des feuilles, on ne les corrige pas. */
  lectureSeule?: boolean
  onChoisir?: (f: RefFeuille) => void
  onAnalyser?: (f: RefFeuille, relance: boolean) => void
  onCorriger?: (f: RefFeuille, patch: Partial<Pick<FeuillePlan, ChampCorrigeable>>) => void
  /** Feuilles dont l'échelle proposée attend d'être posée. */
  echellesAPoser?: number
  onPoserEchelles?: () => void
  /** Retirer un document du jeu (et du dossier), toutes ses feuilles avec. */
  onSupprimer?: (plan: GroupeDeFeuilles['plan']) => void
}) {
  const [confirmer, setConfirmer] = useState(false)
  const incoherentes = groupes.reduce((s, g) => s + g.feuilles.filter((f) => f.echelle === 'incoherente').length, 0)
  return (
    <div className="space-y-4">
      {!lectureSeule && onPoserEchelles && echellesAPoser > 0 && (
        confirmer ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-950" data-visite="metres-echelles">
            <p>
              Poser l’échelle proposée sur {echellesAPoser} feuille{echellesAPoser > 1 ? 's' : ''} ? Les échelles déjà posées ne
              changent pas{incoherentes ? `, et les ${incoherentes} incohérente${incoherentes > 1 ? 's' : ''} attendent votre choix dans l’éditeur` : ''}.
            </p>
            <div className="mt-2 flex gap-1.5">
              <button
                onClick={() => { setConfirmer(false); onPoserEchelles() }}
                className="flex h-9 flex-1 items-center justify-center gap-1 rounded-lg bg-foreground font-semibold text-background hover:opacity-90 pointer-coarse:h-11"
              >
                <Check className="h-3.5 w-3.5" />Poser
              </button>
              <button onClick={() => setConfirmer(false)} className="flex h-9 flex-1 items-center justify-center rounded-lg border bg-background font-medium hover:bg-muted pointer-coarse:h-11">
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmer(true)}
            data-visite="metres-echelles"
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed px-3 py-2 text-xs font-medium transition-colors hover:bg-muted pointer-coarse:min-h-11"
          >
            <Ruler className="h-3.5 w-3.5" />Poser les échelles proposées ({echellesAPoser})
          </button>
        )
      )}
      {groupes.map((g, i) => (
        <GroupePlan
          key={g.plan.id}
          groupe={g}
          premier={i === 0}
          plusieurs={groupes.length > 1}
          selection={selection}
          lectureSeule={lectureSeule}
          onChoisir={onChoisir}
          onAnalyser={onAnalyser}
          onCorriger={onCorriger}
          onSupprimer={lectureSeule ? undefined : onSupprimer}
        />
      ))}
    </div>
  )
}

function GroupePlan({ groupe, premier, plusieurs, selection, lectureSeule, onChoisir, onAnalyser, onCorriger, onSupprimer }: {
  groupe: GroupeDeFeuilles
  /** Le premier document du jeu : sa première feuille sert de repère à la visite guidée. */
  premier: boolean
  plusieurs: boolean
  selection: RefFeuille | null
  lectureSeule?: boolean
  onChoisir?: (f: RefFeuille) => void
  onAnalyser?: (f: RefFeuille, relance: boolean) => void
  onCorriger?: (f: RefFeuille, patch: Partial<Pick<FeuillePlan, ChampCorrigeable>>) => void
  onSupprimer?: (plan: GroupeDeFeuilles['plan']) => void
}) {
  const { plan, nombre, feuilles } = groupe
  const pdf = plan.mimeType === 'application/pdf'
  // Les vignettes d'un PDF sortent toutes d'un seul décodage du document.
  const apercus = useApercusPages(plan, pdf)
  const image = useRenduPlan(pdf ? null : plan, 240)
  const vignette = (page: number) => (pdf ? apercus.pages.find((x) => x.numero === page)?.url : image.rendu?.url) ?? null

  return (
    <section>
      {/* Le nom du document, et de quoi le retirer : l'en-tête reste même
          pour un document seul dès qu'on peut le supprimer. */}
      {(plusieurs || onSupprimer) && (
        <div className="mb-1.5 flex items-center gap-1 px-1">
          <p className="min-w-0 flex-1 truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground" title={plan.name}>
            {plan.name}{nombre ? ` · ${nombre} page${nombre > 1 ? 's' : ''}` : ''}
          </p>
          {onSupprimer && (
            <button
              onClick={() => onSupprimer(plan)}
              className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 pointer-coarse:p-2.5"
              title="Supprimer ce document et ses métrés"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
      {nombre == null ? (
        <p className="flex items-center gap-2 rounded-xl border border-dashed px-3 py-3 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />Lecture du document…
        </p>
      ) : (
        <ul className="space-y-1.5">
          {feuilles.map((f, j) => (
            <CarteFeuille
              key={f.page}
              vue={f}
              repere={premier && j === 0}
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

function CarteFeuille({ vue, repere, nomDuPlan, vignette, choisie, lectureSeule, onChoisir, onAnalyser, onCorriger }: {
  vue: FeuilleVue
  /** La feuille que montre la visite guidée, avec ses pastilles. */
  repere: boolean
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
      data-visite={repere ? 'metres-feuille' : undefined}
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
          <button onClick={onChoisir} disabled={!onChoisir} className="block w-full text-left pointer-coarse:min-h-11">
            <span className="block truncate text-[13px] font-medium leading-tight" title={libelleFeuille(feuille, page, nomDuPlan)}>
              {libelleFeuille(feuille, page, nomDuPlan)}
            </span>
            <span className="block truncate text-[11px] text-muted-foreground">{description || `Page ${page}`}</span>
          </button>
          <div className="mt-1 flex flex-wrap gap-1">
            <Pastille classe={ECHELLES[echelle].classe} titre={ECHELLES[echelle].titre}>
              {echelle === 'verifiee' && <Check className="h-2.5 w-2.5" />}
              {echelle === 'incoherente' && <AlertTriangle className="h-2.5 w-2.5" />}
              {ECHELLES[echelle].libelle}
            </Pastille>
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
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground pointer-coarse:p-[15px]"
              title="Corriger le titre, le type, l’étage"
              aria-pressed={edition}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            {analysable && onAnalyser && (
              <button
                onClick={() => onAnalyser(etat === 'prete')}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground pointer-coarse:p-[15px]"
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
