/**
 * L'analyse du plan par l'IA, dans l'outil Plan : la fenêtre qui la lance,
 * la confirmation de l'échelle, la liste des zones à valider.
 *
 * Le parcours tient en trois temps. On choisit la page ou toutes les pages,
 * l'IA les lit pendant une à trois minutes. Elle propose ensuite l'échelle de
 * chaque page, avec d'où elle vient (« 1:100 au cartouche, vérifiée sur la
 * cote 12,40 m ») : rien n'est posé sans confirmation, et une échelle déjà
 * posée à la main n'est remplacée que si on le coche. Enfin les zones
 * proposées attendent, en pointillé, d'être validées une à une ou d'un coup :
 * jusque-là, elles ne comptent dans aucun métré.
 */
import { useEffect, useState } from 'react'
import { AlertTriangle, Check, ChevronDown, ChevronUp, Link2, Loader2, Magnet, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ComptageAnalyse, PlanAnnotation } from '@/lib/api-types'
import {
  COULEUR_PROPOSITION, COULEURS_CATEGORIE, NOMS_CONFIANCE, NOMS_TYPES_PAGE, NOMS_TYPES_ZONE, type EchelleDePage,
} from '@/lib/plans/analyse-ia'
import { CATEGORIE, NOMBRE_MAX, ceQuiChange, type CategorieComptee, type Comptages } from '@/lib/base-cfc/comptages'
import { ecartRelatif, fr, type StatutEchelle } from '@/lib/plans/echelle-exacte'
import { MAX_PAGES_ANALYSE, type EtatAnalyse } from './analyse'

/** Le logo de Diagly, en marque seule : c'est lui qui signale ce que fait l'IA. */
export function MarqueDiagly({ className }: { className?: string }) {
  return <img src="/diagly-mark.svg" alt="" aria-hidden className={cn('shrink-0', className)} />
}

// ---------------------------------------------------------------- lancement

export function FenetreAnalyse({ etat, pageCourante, nombrePages, estPdf, onLancer, onArreter, onFermer }: {
  etat: EtatAnalyse
  pageCourante: number
  nombrePages: number
  estPdf: boolean
  onLancer: (pages: number[]) => void
  onArreter: () => void
  onFermer: () => void
}) {
  const [toutes, setToutes] = useState(false)
  const plusieurs = estPdf && nombrePages > 1
  const lot = Math.min(nombrePages, MAX_PAGES_ANALYSE)
  const enCours = etat.etape === 'preparation' || etat.etape === 'analyse'

  // Le temps écoulé se lit pendant l'analyse : une minute sans signe de vie inquiète.
  const [maintenant, setMaintenant] = useState(() => Date.now())
  useEffect(() => {
    if (etat.etape !== 'analyse') return
    const t = setInterval(() => setMaintenant(Date.now()), 1000)
    return () => clearInterval(t)
  }, [etat.etape])
  const secondes = etat.etape === 'analyse' ? Math.max(0, Math.round((maintenant - etat.debut) / 1000)) : 0

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 pb-[calc(var(--safe-bottom)+1rem)] pl-[calc(var(--safe-left)+1rem)] pr-[calc(var(--safe-right)+1rem)] pt-[calc(var(--safe-top)+1rem)]" onClick={enCours ? undefined : onFermer}>
      <div className="w-full max-w-md rounded-2xl border bg-background p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-2.5">
          <MarqueDiagly className="h-6 w-6" />
          <h3 className="text-lg font-semibold">Analyser avec l’IA</h3>
        </div>

        {etat.etape === 'non-configuree' ? (
          <p className="text-sm text-muted-foreground">L’analyse par l’IA n’est pas disponible sur ce serveur.</p>
        ) : enCours ? (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              {etat.etape === 'preparation'
                ? `Préparation des pages (${etat.fait}/${etat.total}) : rendu et lecture du dessin vectoriel…`
                : `L’IA lit ${etat.pages > 1 ? `les ${etat.pages} pages` : 'la page'}… ${secondes} s`}
            </p>
            <p className="text-xs text-muted-foreground">
              Une à trois minutes. Vous pouvez fermer cette fenêtre et continuer à travailler sur le plan :
              les zones arriveront d’elles-mêmes.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              L’IA lit la page, propose l’échelle et dessine les zones à métrer : façades, fenêtres, portes,
              toiture, emprise. Elle compte aussi les portes, fenêtres, balcons et appareils sanitaires, étages
              identiques compris. Rien ne compte dans le métré tant que vous ne l’avez pas validé.
            </p>
            {plusieurs && (
              <div className="space-y-1.5">
                <ChoixPages actif={!toutes} onClick={() => setToutes(false)} titre={`Cette page (page ${pageCourante})`} />
                <ChoixPages
                  actif={toutes}
                  onClick={() => setToutes(true)}
                  titre={nombrePages > MAX_PAGES_ANALYSE ? `Les ${lot} premières pages` : `Toutes les pages (${nombrePages})`}
                  detail="Chaque page reçoit sa propre échelle."
                />
              </div>
            )}
            {etat.etape === 'erreur' && (
              <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{etat.message}
              </p>
            )}
          </div>
        )}

        <div className="mt-4 flex gap-2">
          {enCours ? (
            <>
              <button onClick={onArreter} className="h-11 flex-1 rounded-lg border text-sm font-medium transition-colors hover:bg-muted">Arrêter</button>
              <button onClick={onFermer} className="h-11 flex-1 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">Continuer à travailler</button>
            </>
          ) : (
            <>
              <button onClick={onFermer} className="h-11 flex-1 rounded-lg border text-sm font-medium transition-colors hover:bg-muted">Fermer</button>
              {etat.etape !== 'non-configuree' && (
                <button
                  onClick={() => onLancer(toutes ? Array.from({ length: lot }, (_, i) => i + 1) : [pageCourante])}
                  className="h-11 flex-1 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                >
                  {etat.etape === 'erreur' ? 'Relancer l’analyse' : 'Lancer l’analyse'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ChoixPages({ actif, onClick, titre, detail }: { actif: boolean; onClick: () => void; titre: string; detail?: string }) {
  return (
    <button
      onClick={onClick}
      className={cn('flex w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors',
        actif ? 'border-foreground bg-muted/60' : 'hover:bg-muted/40')}
    >
      <span className={cn('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border', actif && 'border-foreground')}>
        {actif && <span className="h-2 w-2 rounded-full bg-foreground" />}
      </span>
      <span>
        <span className="block text-sm font-medium">{titre}</span>
        {detail && <span className="block text-xs text-muted-foreground">{detail}</span>}
      </span>
    </button>
  )
}

// ---------------------------------------------------------------- échelle

const STATUTS: Record<StatutEchelle, { libelle: string; classe: string }> = {
  verifiee: { libelle: 'Exacte, vérifiée', classe: 'bg-emerald-50 text-emerald-700' },
  'non-verifiee': { libelle: 'Exacte, non vérifiée', classe: 'bg-amber-50 text-amber-700' },
  approximative: { libelle: 'Approximative', classe: 'bg-amber-50 text-amber-700' },
  conflit: { libelle: 'À trancher', classe: 'bg-red-50 text-red-700' },
  aucune: { libelle: 'Aucune', classe: 'bg-muted text-muted-foreground' },
}

type Source = 'imprimee' | 'cote'

/** L'échelle retenue pour une page selon la source choisie. */
function valeur(e: EchelleDePage, source: Source | null): number | null {
  if (source === 'imprimee') return e.imprimee?.pxParM ?? null
  if (source === 'cote') return e.cote?.pxParM ?? null
  return null
}

/**
 * Confirmer l'échelle des pages analysées.
 *
 * Chaque page dit d'où vient son échelle. Sont cochées d'avance celles qu'on
 * appliquerait sans hésiter ; une page déjà étalonnée à la main ne l'est
 * jamais, et une page où l'échelle imprimée contredit la cote attend qu'on
 * choisisse laquelle croire.
 */
export function ConfirmationEchelles({ echelles, actuelle, onPoser, onFermer }: {
  echelles: EchelleDePage[]
  /** L'échelle déjà posée sur une page, ou null. */
  actuelle: (page: number) => number | null
  onPoser: (choix: Record<number, number>) => void
  onFermer: () => void
}) {
  const [choix, setChoix] = useState<Record<number, { coche: boolean; source: Source | null }>>(() => Object.fromEntries(
    echelles.map((e) => {
      const source: Source | null = e.statut === 'verifiee' || e.statut === 'non-verifiee' ? 'imprimee' : e.statut === 'approximative' ? 'cote' : null
      return [e.page, { coche: source !== null && actuelle(e.page) == null, source }]
    }),
  ))
  const retenues = echelles
    .map((e) => ({ e, c: choix[e.page] }))
    .filter(({ e, c }) => c?.coche && valeur(e, c.source) != null)

  const poser = () => onPoser(Object.fromEntries(retenues.map(({ e, c }) => [e.page, valeur(e, c.source)!])))

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 pb-[calc(var(--safe-bottom)+1rem)] pl-[calc(var(--safe-left)+1rem)] pr-[calc(var(--safe-right)+1rem)] pt-[calc(var(--safe-top)+1rem)]" onClick={onFermer}>
      <div className="flex max-h-full w-full max-w-xl flex-col rounded-2xl border bg-background p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center gap-2.5">
          <MarqueDiagly className="h-6 w-6" />
          <h3 className="text-lg font-semibold">Échelle proposée</h3>
        </div>
        <p className="mb-3 text-sm text-muted-foreground">
          Vérifiez d’où vient chaque échelle avant de la poser. Une échelle déjà posée n’est remplacée que si vous la cochez.
        </p>

        <div className="-mx-1 min-h-0 flex-1 space-y-2 overflow-y-auto px-1 py-1">
          {echelles.map((e) => {
            const c = choix[e.page] ?? { coche: false, source: null }
            const deja = actuelle(e.page)
            const retenue = valeur(e, c.source)
            const disponible = e.imprimee || e.cote
            const basculer = () => setChoix((t) => ({ ...t, [e.page]: { ...c, coche: !c.coche && retenue != null } }))
            return (
              <div key={e.page} className={cn('rounded-xl border p-3', c.coche && 'border-foreground')}>
                <div className="flex items-start gap-3">
                  <button
                    onClick={basculer}
                    disabled={!disponible || retenue == null}
                    aria-pressed={c.coche}
                    title={c.coche ? 'Ne pas poser cette échelle' : 'Poser cette échelle'}
                    className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors disabled:opacity-40',
                      c.coche ? 'border-foreground bg-foreground text-background' : 'hover:bg-muted')}
                  >
                    {c.coche && <Check className="h-3.5 w-3.5" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
                      <span>Page {e.page}</span>
                      <span className="text-muted-foreground">· {NOMS_TYPES_PAGE[e.type]}{e.titre ? ` · ${e.titre}` : ''}</span>
                      <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', STATUTS[e.statut].classe)}>{STATUTS[e.statut].libelle}</span>
                    </p>
                    <p className="mt-1 text-sm">{e.resume}</p>
                    {e.cote && !e.cote.aimantee && e.imprimee == null && (
                      <p className="mt-1 text-xs text-amber-700">Extrémités de la cote placées à l’œil : vérifiez la mesure.</p>
                    )}

                    {e.statut === 'conflit' && e.imprimee && e.cote && (
                      <div className="mt-2 space-y-1.5">
                        <OptionSource
                          actif={c.source === 'imprimee'}
                          onClick={() => setChoix((t) => ({ ...t, [e.page]: { coche: true, source: 'imprimee' } }))}
                          titre={`Croire le cartouche : 1:${e.imprimee.denominateur}`}
                        />
                        <OptionSource
                          actif={c.source === 'cote'}
                          onClick={() => setChoix((t) => ({ ...t, [e.page]: { coche: true, source: 'cote' } }))}
                          titre={`Croire la cote ${fr(e.cote.longueurM)} m : environ 1:${Math.round(e.imprimee.denominateur * (e.imprimee.pxParM / e.cote.pxParM))}`}
                        />
                      </div>
                    )}

                    {deja != null && (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        Cette page a déjà une échelle
                        {retenue != null ? ` (écart ${fr(ecartRelatif(retenue, deja) * 100, 1)} % avec la proposition)` : ''}.
                        {' '}Cochez pour la remplacer.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-4 flex gap-2">
          <button onClick={onFermer} className="h-11 flex-1 rounded-lg border text-sm font-medium transition-colors hover:bg-muted">Ne rien poser</button>
          <button
            onClick={poser}
            disabled={retenues.length === 0}
            className="h-11 flex-1 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {retenues.length > 1 ? `Poser l’échelle sur ${retenues.length} pages` : 'Poser l’échelle'}
          </button>
        </div>
      </div>
    </div>
  )
}

function OptionSource({ actif, onClick, titre }: { actif: boolean; onClick: () => void; titre: string }) {
  return (
    <button
      onClick={onClick}
      className={cn('flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-sm transition-colors',
        actif ? 'border-foreground bg-muted/60' : 'hover:bg-muted/40')}
    >
      <span className={cn('flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border', actif && 'border-foreground')}>
        {actif && <span className="h-1.5 w-1.5 rounded-full bg-foreground" />}
      </span>
      {titre}
    </button>
  )
}

// ---------------------------------------------------------------- zones à valider

export interface BilanFacade { brute: number; ouvertures: number; nette: number; nombreOuvertures: number }

/**
 * Les zones proposées sur la page, en liste.
 *
 * Chaque ligne dit ce que la zone mesure, à quel ouvrage elle se rapporterait,
 * si elle s'est accrochée au dessin et si ses cotes imprimées la confirment :
 * de quoi valider d'un coup ce qui est sûr, et regarder de près le reste.
 */
export function ListePropositions({
  zones, selection, mesure, ecartCotes, lie, bilan, autresPages, ecartees, remarques, tronque, sansGeometrie, etalonne,
  masqueeSurMobile, onChoisir, onValider, onValiderTout, onSupprimer, onSupprimerTout, onOuvrage, onAllerPage,
}: {
  zones: PlanAnnotation[]
  selection: string | null
  mesure: (a: PlanAnnotation) => string | null
  ecartCotes: (a: PlanAnnotation) => number | null
  lie: (a: PlanAnnotation) => string | null
  bilan: BilanFacade | null
  autresPages: { page: number; nombre: number }[]
  ecartees: { libelle: string | null; raison: string }[]
  remarques: string | null
  tronque: boolean
  sansGeometrie: boolean
  etalonne: boolean
  masqueeSurMobile: boolean
  onChoisir: (id: string) => void
  onValider: (id: string) => void
  onValiderTout: () => void
  onSupprimer: (id: string) => void
  onSupprimerTout: () => void
  onOuvrage: (id: string) => void
  onAllerPage: (page: number) => void
}) {
  const [ouverte, setOuverte] = useState(true)
  const [voirEcartees, setVoirEcartees] = useState(false)
  const sansOuvrage = zones.filter((z) => !z.itemId).length

  return (
    <div
      data-habillage
      className={cn('pointer-events-auto flex max-h-full w-full flex-col overflow-hidden rounded-xl border bg-background/95 shadow-lg backdrop-blur sm:w-80',
        masqueeSurMobile && 'hidden sm:flex')}
    >
      <div className="border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <MarqueDiagly className="h-4 w-4" />
          <p className="min-w-0 flex-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Zones à valider</p>
          <button onClick={() => setOuverte((o) => !o)} className="rounded p-1 text-muted-foreground hover:bg-muted" title={ouverte ? 'Replier' : 'Déplier'}>
            {ouverte ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          {zones.length} sur cette page
          {sansOuvrage > 0 && <span className="text-amber-600"> · {sansOuvrage} sans ouvrage</span>}
        </p>
        {zones.length > 0 && (
          <div className="mt-2 flex gap-1.5">
            <button onClick={onValiderTout} className="flex-1 rounded-lg bg-foreground px-2.5 py-1.5 text-xs font-semibold text-background transition-opacity hover:opacity-90">
              Tout valider
            </button>
            <button onClick={onSupprimerTout} className="rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted">
              Tout retirer
            </button>
          </div>
        )}
      </div>

      {ouverte && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {!etalonne && zones.length > 0 && (
            <p className="border-b bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Page sans échelle : les mesures s’afficheront une fois l’échelle posée.
            </p>
          )}
          {sansGeometrie && (
            <p className="border-b px-3 py-2 text-xs text-muted-foreground">
              Ce document n’a pas de dessin vectoriel lisible (scan ou image) : les zones sont placées à l’œil, vérifiez-les.
            </p>
          )}
          <ul>
            {zones.map((z) => {
              const p = z.proposition!
              const quantite = mesure(z)
              const ecart = ecartCotes(z)
              const nom = lie(z)
              return (
                <li key={z.id} className={cn('border-b last:border-b-0', z.id === selection && 'bg-muted')}>
                  <button onClick={() => onChoisir(z.id)} className="flex w-full items-start gap-2 px-3 pb-1 pt-2 text-left transition-colors hover:bg-muted/60" title="Afficher et modifier cette zone">
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-sm border-2 border-dashed" style={{ borderColor: COULEUR_PROPOSITION }} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-medium">{p.libelle}</span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums">{quantite ?? 'n.c.'}</span>
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {NOMS_TYPES_ZONE[p.type]} · {NOMS_CONFIANCE[p.confiance]}
                        {p.aimantee
                          ? <span className="text-emerald-700"> · <Magnet className="inline h-3 w-3" /> aimantée</span>
                          : <span className="text-amber-700"> · non aimantée{p.sommetsAimantes > 0 ? ` (${p.sommetsAimantes}/${z.points.length})` : ''}</span>}
                      </span>
                      {p.valeurCotee != null && (
                        <span className={cn('block text-xs', ecart != null && ecart > 0.03 ? 'text-amber-700' : 'text-muted-foreground')}>
                          Cotes : {p.cotes ? `${p.cotes} = ` : ''}{fr(p.valeurCotee)} {z.type === 'hatch' ? 'm²' : 'm'}
                          {ecart != null && (ecart > 0.03 ? ` · écart ${fr(ecart * 100, 1)} %` : ' · concorde')}
                        </span>
                      )}
                      <span className={cn('block truncate text-xs', nom ? 'text-muted-foreground' : 'text-amber-600')}>
                        <Link2 className="mr-1 inline h-3 w-3" />{nom ?? 'Aucun ouvrage suggéré'}
                      </span>
                      {p.remarque && <span className="block text-xs italic text-muted-foreground">{p.remarque}</span>}
                    </span>
                  </button>
                  <div className="flex gap-1 px-3 pb-2 pl-[1.85rem]">
                    <button onClick={() => onValider(z.id)} className="inline-flex items-center gap-1 rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background hover:opacity-90">
                      <Check className="h-3 w-3" />Valider
                    </button>
                    <button onClick={() => onOuvrage(z.id)} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted">
                      <Link2 className="h-3 w-3" />Ouvrage
                    </button>
                    <button onClick={() => onSupprimer(z.id)} className="ml-auto rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Retirer cette proposition">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>

          {bilan && (
            <div className="border-t bg-muted/40 px-3 py-2 text-xs">
              <p className="mb-1 font-medium">Bilan de la façade (zones proposées)</p>
              <p className="flex justify-between tabular-nums"><span>Façade brute</span><span>{fr(bilan.brute)} m²</span></p>
              <p className="flex justify-between tabular-nums"><span>{bilan.nombreOuvertures} ouverture{bilan.nombreOuvertures > 1 ? 's' : ''}</span><span>− {fr(bilan.ouvertures)} m²</span></p>
              <p className="flex justify-between font-semibold tabular-nums"><span>Façade nette</span><span>{fr(bilan.nette)} m²</span></p>
            </div>
          )}

          {autresPages.length > 0 && (
            <div className="border-t px-3 py-2 text-xs">
              <p className="mb-1 text-muted-foreground">Sur les autres pages</p>
              <div className="flex flex-wrap gap-1">
                {autresPages.map((a) => (
                  <button key={a.page} onClick={() => onAllerPage(a.page)} className="rounded-md border px-2 py-0.5 hover:bg-muted">
                    Page {a.page} · {a.nombre}
                  </button>
                ))}
              </div>
            </div>
          )}

          {(ecartees.length > 0 || tronque || remarques) && (
            <div className="border-t px-3 py-2 text-xs text-muted-foreground">
              {tronque && <p className="text-amber-700">La réponse de l’IA a été coupée : il peut manquer des zones.</p>}
              {remarques && <p className="italic">{remarques}</p>}
              {ecartees.length > 0 && (
                <>
                  <button onClick={() => setVoirEcartees((v) => !v)} className="mt-0.5 underline-offset-2 hover:underline">
                    {ecartees.length} proposition{ecartees.length > 1 ? 's' : ''} écartée{ecartees.length > 1 ? 's' : ''} à la vérification
                  </button>
                  {voirEcartees && (
                    <ul className="mt-1 space-y-0.5">
                      {ecartees.map((e, i) => <li key={i}>{e.libelle ? `${e.libelle} : ` : ''}{e.raison}</li>)}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Petit rappel quand l'analyse tourne et que sa fenêtre a été fermée. */
export function AnalyseEnFond({ onOuvrir }: { onOuvrir: () => void }) {
  return (
    <button
      onClick={onOuvrir}
      data-habillage
      className="pointer-events-auto flex items-center gap-2 rounded-full border bg-background/95 px-3 py-1.5 text-xs shadow-sm backdrop-blur"
    >
      <Loader2 className="h-3.5 w-3.5 animate-spin" />Analyse en cours…
    </button>
  )
}

// ---------------------------------------------------------------- éléments comptés

/** Les repères d'une catégorie sur la page : combien, et combien attendent d'être regardés. */
export interface ReperesDeCategorie { categorie: CategorieComptee; total: number; aValider: number }

/**
 * Ce que l'IA a compté : les repères posés sur la page, et les totaux du
 * bâtiment par catégorie, à reporter au dossier.
 *
 * Les deux ne se confondent pas. Les repères montrent où l'IA a vu chaque
 * porte sur cette feuille ; le total, lui, multiplie un plan d'étage type
 * par le nombre d'étages qu'il représente, et c'est lui qui part au dossier.
 * Chaque total se corrige avant le report, et le report dit ce qu'il
 * remplace : un compte relu à la main ne disparaît pas sans qu'on l'ait vu.
 */
export function ElementsDeLAnalyse({
  reperes, comptages, existants, nomDuPlan, enCours, masqueeSurMobile, onValiderReperes, onRetirerReperes, onReporter,
}: {
  reperes: ReperesDeCategorie[]
  comptages: ComptageAnalyse[]
  /** Les comptages déjà au dossier. */
  existants: Comptages
  nomDuPlan: string
  enCours: boolean
  masqueeSurMobile: boolean
  onValiderReperes: () => void
  onRetirerReperes: () => void
  onReporter: (comptages: Comptages) => Promise<void>
}) {
  const [ouverte, setOuverte] = useState(true)
  const [nombres, setNombres] = useState<Record<string, string>>(() => Object.fromEntries(comptages.map((c) => [c.categorie, String(c.nombre)])))
  const [remplacements, setRemplacements] = useState<string[] | null>(null)
  const [reporte, setReporte] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const aValider = reperes.reduce((s, r) => s + r.aValider, 0)
  const surLaPage = reperes.reduce((s, r) => s + r.total, 0)

  /** Les totaux tels que corrigés, en comptages du dossier. */
  const construire = (): Comptages => {
    // Le nom du plan sans son extension, assez court pour tenir dans le repère de page.
    const sansExtension = nomDuPlan.replace(/\.[a-z0-9]{2,4}$/i, '')
    const plan = sansExtension.length > 28 ? `${sansExtension.slice(0, 27)}…` : sansExtension
    const nouveaux: Comptages = {}
    for (const c of comptages) {
      const brut = (nombres[c.categorie] ?? '').trim()
      const n = Number(brut)
      if (!brut || !Number.isInteger(n) || n < 0 || n > NOMBRE_MAX) continue
      const corrige = n !== c.nombre
      nouveaux[c.categorie] = {
        categorie: c.categorie,
        nombre: n,
        surface: CATEGORIE[c.categorie].unite === 'm2' && !corrige ? c.surface : null,
        source: 'analyse',
        detail: corrige ? `Corrigé à ${n} ; l’IA en comptait ${c.nombre}${c.detail ? ` (${c.detail})` : ''}` : c.detail,
        pages: c.pages.map((p) => `${plan}, p. ${p}`),
        confiance: corrige ? null : c.confiance,
        valide: true,
        majLe: new Date().toISOString(),
      }
    }
    return nouveaux
  }

  const reporter = async (confirme: boolean) => {
    setErreur(null)
    const nouveaux = construire()
    if (Object.keys(nouveaux).length === 0) { setErreur('Aucun nombre valable à reporter.'); return }
    const change = ceQuiChange(existants, nouveaux)
    if (change.length > 0 && !confirme) { setRemplacements(change); return }
    try {
      await onReporter(nouveaux)
      setRemplacements(null)
      setReporte(true)
    } catch {
      setErreur('Le report au dossier a échoué. Réessayez.')
    }
  }

  return (
    <div
      data-habillage
      className={cn('pointer-events-auto flex max-h-full w-full flex-col overflow-hidden rounded-xl border bg-background/95 shadow-lg backdrop-blur sm:w-80',
        masqueeSurMobile && 'hidden sm:flex')}
    >
      <div className="border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <MarqueDiagly className="h-4 w-4" />
          <p className="min-w-0 flex-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Éléments comptés</p>
          <button onClick={() => setOuverte((o) => !o)} className="rounded p-1 text-muted-foreground hover:bg-muted" title={ouverte ? 'Replier' : 'Déplier'}>
            {ouverte ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
        {surLaPage > 0 && (
          <p className="text-xs text-muted-foreground">
            {surLaPage} repère{surLaPage > 1 ? 's' : ''} sur cette page
            {aValider > 0 && <span className="text-amber-600"> · {aValider} à valider</span>}
          </p>
        )}
      </div>

      {ouverte && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {reperes.length > 0 && (
            <div className="border-b px-3 py-2">
              <ul className="space-y-0.5 text-xs">
                {reperes.map((r) => (
                  <li key={r.categorie} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: COULEURS_CATEGORIE[r.categorie] }} aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{CATEGORIE[r.categorie].libelle}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{r.total}</span>
                  </li>
                ))}
              </ul>
              {aValider > 0 && (
                <div className="mt-2 flex gap-1.5">
                  <button onClick={onValiderReperes} className="flex-1 rounded-lg bg-foreground px-2.5 py-1.5 text-xs font-semibold text-background transition-opacity hover:opacity-90">
                    Valider les repères
                  </button>
                  <button onClick={onRetirerReperes} className="rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted">
                    Retirer
                  </button>
                </div>
              )}
            </div>
          )}

          {comptages.length > 0 && (
            <div className="px-3 py-2">
              <p className="mb-1.5 text-xs text-muted-foreground">
                Totaux du bâtiment, étages identiques compris. Corrigez-les au besoin, puis reportez-les au dossier : ils y donnent la quantité des ouvrages comptés.
              </p>
              <ul className="space-y-2">
                {comptages.map((c) => {
                  const existant = existants[c.categorie]
                  return (
                    <li key={c.categorie} className="rounded-lg border px-2.5 py-2">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: COULEURS_CATEGORIE[c.categorie] }} aria-hidden />
                        <span className="min-w-0 flex-1 text-sm font-medium leading-tight">{CATEGORIE[c.categorie].libelle}</span>
                        <input
                          type="number" inputMode="numeric" min={0} max={NOMBRE_MAX} step={1}
                          value={nombres[c.categorie] ?? ''}
                          onChange={(e) => { setNombres((t) => ({ ...t, [c.categorie]: e.target.value })); setReporte(false); setRemplacements(null) }}
                          aria-label={`Nombre de ${CATEGORIE[c.categorie].pluriel}`}
                          className="h-10 w-16 rounded-md border bg-background px-2 text-right text-sm tabular-nums outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                      {c.detail && <p className="mt-1 text-xs">{c.detail}</p>}
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {[
                          c.pages.length ? `page${c.pages.length > 1 ? 's' : ''} ${c.pages.join(', ')}` : null,
                          NOMS_CONFIANCE[c.confiance],
                          c.surface != null ? `${fr(c.surface)} m²` : null,
                        ].filter(Boolean).join(' · ')}
                      </p>
                      {existant && (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">Au dossier : {existant.nombre}</p>
                      )}
                    </li>
                  )
                })}
              </ul>

              {remplacements ? (
                <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900">
                  <p className="font-medium">Ce report remplace :</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4">
                    {remplacements.map((r) => <li key={r}>{r}</li>)}
                  </ul>
                  <div className="mt-2 flex gap-1.5">
                    <button onClick={() => void reporter(true)} disabled={enCours} className="flex-1 rounded-lg bg-foreground px-2.5 py-1.5 text-xs font-semibold text-background hover:opacity-90 disabled:opacity-50">
                      Remplacer
                    </button>
                    <button onClick={() => setRemplacements(null)} className="rounded-lg border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-muted">
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => void reporter(false)}
                  disabled={enCours}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {enCours ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Reporter au dossier
                </button>
              )}
              {reporte && !enCours && (
                <p className="mt-1.5 text-xs text-emerald-700">Reporté au dossier : les quantités des relevés concernés suivent.</p>
              )}
              {erreur && <p className="mt-1.5 text-xs text-red-700">{erreur}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
