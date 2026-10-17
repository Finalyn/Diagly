/**
 * Le panneau des quantités, cœur de l'outil Métrés.
 *
 * Il sert à la fois de tableau et de palette, comme chez les logiciels de
 * métré : chaque classification (pièces, façades, fenêtres, murs…) donne son
 * total, se déplie par étage puis par forme, et chaque ligne mène à sa forme
 * sur le plan. Dans l'autre sens, une forme sélectionnée sur le plan éclaire
 * sa ligne et la déplie. L'œil masque une classification ; un appui long ou
 * Ctrl+clic l'isole. « Dessiner dans » une classification donne son type et
 * sa couleur à la prochaine forme tracée.
 *
 * Les totaux suivent le plan en direct, la forme en cours de tracé comprise.
 * Une proposition de l'IA est listée, marquée « à valider », et ne compte pas.
 *
 * La section SIA 416 suit les pièces : SP, SN et SC par étage, puis la SN
 * rangée en SUP, SUS, SD et SI d'après le nom de chaque local, que l'on
 * corrige pièce par pièce.
 *
 * Sur téléphone, le panneau se lit sans s'éditer.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle, ArrowDown01, ArrowDownAZ, ChevronDown, ChevronRight, Eye, EyeOff, Pencil, Search, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  CLASSIFICATIONS, filtrerEtTrier, quantiteLisible, trouverInstance, type ClassificationQ, type CleClassification, type EtageQ,
  type InstanceQ, type PanneauQuantites as Panneau, type QuantiteDerivee, type TriQuantites,
} from '@/lib/plans/quantites'
import {
  CATEGORIES_SIA416, MENTION_SIA416, NOMS_SIA416, type CategorieSia416, type EtageSia416, type Sia416,
} from '@/lib/plans/sia416'
import { NOMS_CONFIANCE } from '@/lib/plans/analyse-ia'

const NOMBRE = new Intl.NumberFormat('fr-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const derivees = (ds: QuantiteDerivee[]) => ds.slice(1).filter((d) => d.valeur !== 0)

export interface ActionsPanneau {
  onChoisir?: (i: InstanceQ) => void
  onMasquer?: (cle: CleClassification, isoler: boolean) => void
  onToutAfficher?: () => void
  onDessinerDans?: (cle: CleClassification) => void
  onHauteur?: (e: EtageQ, hauteur: number | null) => void
  onAffecter?: (planId: string, id: string, categorie: CategorieSia416 | null) => void
}

export function PanneauQuantites({
  panneau, sia, selection, masquees, classementActif, lectureSeule, ...actions
}: {
  panneau: Panneau
  sia: Sia416
  /** La forme sélectionnée sur le plan. */
  selection: string | null
  masquees: ReadonlySet<CleClassification>
  /** La classification dans laquelle on dessine. */
  classementActif: CleClassification | null
  lectureSeule?: boolean
} & ActionsPanneau) {
  const [recherche, setRecherche] = useState('')
  const [tri, setTri] = useState<TriQuantites>('nom')
  const [ouvertes, setOuvertes] = useState<Set<string>>(() => new Set())
  const basculer = (cle: string) => setOuvertes((s) => {
    const n = new Set(s)
    if (n.has(cle)) n.delete(cle)
    else n.add(cle)
    return n
  })
  const visibles = useMemo(() => filtrerEtTrier(panneau.classifications, recherche, tri), [panneau, recherche, tri])
  // Une recherche déplie tout ce qu'elle trouve : on cherche une pièce, pas une classification.
  const ouverte = (cle: string) => ouvertes.has(cle) || !!recherche.trim()

  // Une forme sélectionnée sur le plan : sa classification et son étage se
  // déplient, et sa ligne vient sous les yeux.
  const conteneur = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!selection) return
    const t = trouverInstance(panneau, selection)
    if (!t) return
    setOuvertes((s) => (s.has(t.classification.cle) && s.has(t.etage.cle + t.classification.cle) ? s
      : new Set([...s, t.classification.cle, t.etage.cle + t.classification.cle])))
    requestAnimationFrame(() => {
      conteneur.current?.querySelector(`[data-instance="${CSS.escape(selection)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seule une nouvelle sélection déplie ; les totaux qui bougent ne referment rien
  }, [selection])

  const vide = panneau.classifications.length === 0
  return (
    <div ref={conteneur} className="space-y-3">
      <div className="flex items-center gap-1.5">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Chercher un local, un étage…"
            aria-label="Chercher dans les quantités"
            className="h-9 w-full rounded-lg border bg-background pl-8 pr-7 text-sm outline-none focus:ring-2 focus:ring-primary pointer-coarse:h-11"
          />
          {recherche && (
            <button onClick={() => setRecherche('')} className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted" title="Effacer">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </label>
        <button
          onClick={() => setTri((t) => (t === 'nom' ? 'quantite' : 'nom'))}
          className="flex h-9 shrink-0 items-center gap-1 rounded-lg border px-2 text-xs font-medium hover:bg-muted pointer-coarse:h-11 pointer-coarse:px-3"
          title={tri === 'nom' ? 'Trié par nom : trier par quantité' : 'Trié par quantité : trier par nom'}
        >
          {tri === 'nom' ? <ArrowDownAZ className="h-4 w-4" /> : <ArrowDown01 className="h-4 w-4" />}
          {tri === 'nom' ? 'Nom' : 'Quantité'}
        </button>
      </div>

      {(panneau.aValider > 0 || panneau.sansEchelle > 0 || masquees.size > 0) && (
        <div className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {panneau.aValider > 0 && (
            <p className="flex items-start gap-1.5">
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
              {panneau.aValider} élément{panneau.aValider > 1 ? 's' : ''} à valider : hors des totaux tant qu’ils ne sont pas validés.
            </p>
          )}
          {panneau.sansEchelle > 0 && (
            <p className="flex items-start gap-1.5">
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
              {panneau.sansEchelle} forme{panneau.sansEchelle > 1 ? 's' : ''} sur des feuilles sans échelle, sans mesure.
            </p>
          )}
          {masquees.size > 0 && !lectureSeule && (
            <p className="flex items-center justify-between gap-2">
              <span>{masquees.size} classification{masquees.size > 1 ? 's' : ''} masquée{masquees.size > 1 ? 's' : ''} sur le plan.</span>
              {actions.onToutAfficher && (
                <button onClick={actions.onToutAfficher} className="shrink-0 font-semibold underline-offset-2 hover:underline">Tout afficher</button>
              )}
            </p>
          )}
        </div>
      )}

      {vide ? (
        <p className="rounded-xl border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
          Rien de mesuré pour l’instant. Validez les zones proposées, remplissez une pièce d’un clic (F) ou tracez une zone (A) :
          tout s’additionne ici, étages types multipliés.
        </p>
      ) : visibles.length === 0 ? (
        <p className="rounded-xl border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">Rien ne correspond à « {recherche} ».</p>
      ) : (
        visibles.map((c) => (
          <div key={c.cle} className="space-y-3">
            <SectionClassification
              c={c}
              ouverte={ouverte(c.cle)}
              ouvertes={ouvertes}
              recherche={!!recherche.trim()}
              onBasculer={basculer}
              masquee={masquees.has(c.cle)}
              active={classementActif === c.cle}
              selection={selection}
              lectureSeule={lectureSeule}
              actions={actions}
            />
            {c.cle === 'pieces' && !recherche.trim() && sia.etages.length > 0 && (
              <SectionSia416 sia={sia} ouverte={ouverte('sia416')} onBasculer={() => basculer('sia416')} lectureSeule={lectureSeule} onAffecter={actions.onAffecter} />
            )}
          </div>
        ))
      )}

      {/* Les classifications encore vides : on peut déjà dessiner dedans. */}
      {!lectureSeule && actions.onDessinerDans && !recherche.trim() && (
        <ClassificationsVides
          presentes={new Set(panneau.classifications.map((c) => c.cle))}
          classementActif={classementActif}
          onDessinerDans={actions.onDessinerDans}
        />
      )}
    </div>
  )
}

function ClassificationsVides({ presentes, classementActif, onDessinerDans }: {
  presentes: Set<CleClassification>
  classementActif: CleClassification | null
  onDessinerDans: (cle: CleClassification) => void
}) {
  const vides = CLASSIFICATIONS.filter((c) => !presentes.has(c.cle))
  if (!vides.length) return null
  return (
    <div className="rounded-xl border border-dashed bg-background/60 p-1.5">
      <p className="px-1.5 pb-1 pt-0.5 text-[11px] text-muted-foreground">Aucune forme encore : dessiner dans…</p>
      <div className="flex flex-wrap gap-1">
        {vides.map((c) => (
          <button
            key={c.cle}
            onClick={() => onDessinerDans(c.cle)}
            aria-pressed={classementActif === c.cle}
            className={cn('flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs transition-colors pointer-coarse:min-h-11',
              classementActif === c.cle ? 'border-foreground bg-foreground text-background' : 'bg-background hover:bg-muted')}
          >
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: c.couleur }} aria-hidden />{c.titre}
          </button>
        ))}
      </div>
    </div>
  )
}

/** L'œil : un toucher masque ou montre ; un appui long, ou Ctrl+clic, isole. */
function BoutonOeil({ masquee, onMasquer }: { masquee: boolean; onMasquer: (isoler: boolean) => void }) {
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null)
  const long = useRef(false)
  const arreter = () => { if (minuterie.current) { clearTimeout(minuterie.current); minuterie.current = null } }
  useEffect(() => arreter, [])
  return (
    <button
      onPointerDown={() => {
        long.current = false
        arreter()
        minuterie.current = setTimeout(() => { long.current = true; onMasquer(true) }, 550)
      }}
      onPointerUp={arreter}
      onPointerLeave={arreter}
      onClick={(e) => {
        if (long.current) { long.current = false; return }
        onMasquer(e.ctrlKey || e.metaKey)
      }}
      onContextMenu={(e) => e.preventDefault()}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground pointer-coarse:h-11 pointer-coarse:w-11"
      title={masquee ? 'Montrer sur le plan' : 'Masquer sur le plan (appui long ou Ctrl+clic : isoler)'}
      aria-pressed={masquee}
    >
      {masquee ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  )
}

function SectionClassification({
  c, ouverte, ouvertes, recherche, onBasculer, masquee, active, selection, lectureSeule, actions,
}: {
  c: ClassificationQ
  ouverte: boolean
  ouvertes: Set<string>
  recherche: boolean
  onBasculer: (cle: string) => void
  masquee: boolean
  active: boolean
  selection: string | null
  lectureSeule?: boolean
  actions: ActionsPanneau
}) {
  const principale = c.derivees[0]
  return (
    <section className={cn('overflow-hidden rounded-xl border bg-background', active && 'border-foreground ring-1 ring-foreground', masquee && 'opacity-60')}>
      <div className="flex items-center gap-1 py-1 pl-1 pr-1.5">
        <button
          onClick={() => onBasculer(c.cle)}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 py-1.5 text-left hover:bg-muted/60 pointer-coarse:min-h-11"
          aria-expanded={ouverte}
        >
          {ouverte ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
          <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: c.couleur }} aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[13px] font-semibold">{c.titre}</span>
              {principale && <span className="shrink-0 text-[13px] font-semibold tabular-nums">{quantiteLisible(principale.valeur, principale.unite)}</span>}
            </span>
            <span className="flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
              {derivees(c.derivees).map((d) => <span key={d.cle} className="tabular-nums">{d.libelle} {quantiteLisible(d.valeur, d.unite)}</span>)}
              {c.aValider > 0 && <span className="font-medium text-teal-700">{c.aValider} à valider</span>}
            </span>
          </span>
        </button>
        {!lectureSeule && actions.onMasquer && <BoutonOeil masquee={masquee} onMasquer={(isoler) => actions.onMasquer!(c.cle, isoler)} />}
        {!lectureSeule && actions.onDessinerDans && (
          <button
            onClick={() => actions.onDessinerDans!(c.cle)}
            aria-pressed={active}
            className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg pointer-coarse:h-11 pointer-coarse:w-11',
              active ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}
            title={active ? 'Ne plus dessiner dans cette classification' : `Dessiner dans « ${c.titre} »`}
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
      </div>
      {ouverte && (
        <ul className="border-t">
          {c.etages.map((e) => (
            <LigneEtage
              key={e.cle}
              c={c}
              e={e}
              ouverte={ouvertes.has(e.cle + c.cle) || recherche}
              onBasculer={() => onBasculer(e.cle + c.cle)}
              selection={selection}
              lectureSeule={lectureSeule}
              actions={actions}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function LigneEtage({ c, e, ouverte, onBasculer, selection, lectureSeule, actions }: {
  c: ClassificationQ
  e: EtageQ
  ouverte: boolean
  onBasculer: () => void
  selection: string | null
  lectureSeule?: boolean
  actions: ActionsPanneau
}) {
  const principale = e.derivees[0]
  return (
    <li className="border-b last:border-b-0">
      <div className="flex items-center gap-1 pr-2">
        <button onClick={onBasculer} className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 pl-6 pr-1 text-left hover:bg-muted/50 pointer-coarse:min-h-11" aria-expanded={ouverte}>
          {ouverte ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[12.5px] font-medium">
                {e.nom}{e.multiplicateur > 1 && <span className="ml-1 text-muted-foreground">× {e.multiplicateur}</span>}
              </span>
              {principale && <span className="shrink-0 text-[12.5px] tabular-nums">{quantiteLisible(principale.valeur, principale.unite)}</span>}
            </span>
            {(derivees(e.derivees).length > 0 || e.aValider > 0) && (
              <span className="flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
                {derivees(e.derivees).map((d) => <span key={d.cle} className="tabular-nums">{d.libelle} {quantiteLisible(d.valeur, d.unite)}</span>)}
                {e.aValider > 0 && <span className="text-teal-700">{e.aValider} à valider</span>}
              </span>
            )}
          </span>
        </button>
        {c.cle === 'murs' && (
          // La clé repart de la hauteur reçue : une hauteur changée ailleurs remplace la saisie.
          <ChampHauteur key={e.hauteur} e={e} lectureSeule={lectureSeule} onHauteur={actions.onHauteur} />
        )}
      </div>
      {ouverte && (
        <ul>
          {e.instances.map((i) => (
            <LigneInstance key={i.id} i={i} choisie={selection === i.id} onChoisir={lectureSeule ? undefined : actions.onChoisir} />
          ))}
        </ul>
      )}
    </li>
  )
}

/** La hauteur d'étage des murs : celle de la feuille, sinon celle du dossier, modifiable ici. */
function ChampHauteur({ e, lectureSeule, onHauteur }: { e: EtageQ; lectureSeule?: boolean; onHauteur?: (e: EtageQ, h: number | null) => void }) {
  const [valeur, setValeur] = useState(e.hauteur.toFixed(2))
  if (lectureSeule || !onHauteur) return <span className="shrink-0 text-[11px] text-muted-foreground">h {NOMBRE.format(e.hauteur)} m</span>
  const valider = () => {
    const v = Number(valeur.replace(',', '.'))
    if (Number.isFinite(v) && v >= 1 && v <= 20) { if (Math.abs(v - e.hauteur) > 1e-6) onHauteur(e, v) }
    else setValeur(e.hauteur.toFixed(2))
  }
  return (
    <label className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground" title="Hauteur d’étage, pour la surface d’une face des murs">
      h
      <input
        value={valeur}
        inputMode="decimal"
        onChange={(ev) => setValeur(ev.target.value)}
        onBlur={valider}
        onKeyDown={(ev) => { if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur() }}
        className={cn('h-7 w-14 rounded-md border bg-background px-1.5 text-right text-xs tabular-nums outline-none focus:ring-2 focus:ring-primary pointer-coarse:h-10',
          e.hauteurReglee && 'font-semibold text-foreground')}
        aria-label={`Hauteur d’étage, ${e.nom}`}
      />
      m
    </label>
  )
}

function LigneInstance({ i, choisie, onChoisir }: { i: InstanceQ; choisie: boolean; onChoisir?: (i: InstanceQ) => void }) {
  const contenu = (
    <>
      <span
        className={cn('mt-1 h-2.5 w-2.5 shrink-0 rounded-sm', i.aValider && 'border-2 border-dashed bg-transparent')}
        style={i.aValider ? { borderColor: i.couleur } : { background: i.couleur }}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className={cn('truncate text-[12.5px]', i.brouillon && 'italic')}>{i.nom}</span>
          <span className={cn('shrink-0 text-[12.5px] tabular-nums', (i.aValider || i.horsTotal) && 'text-muted-foreground line-through decoration-muted-foreground/40')}>
            {i.valeur == null ? 'sans échelle' : i.nature === 'comptage' ? '1 pce' : quantiteLisible(i.valeur, i.unite)}
          </span>
        </span>
        <span className="flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
          {i.aValider && <span className="rounded bg-teal-50 px-1 font-medium text-teal-700">à valider{i.confiance ? `, ${NOMS_CONFIANCE[i.confiance]}` : ''}</span>}
          {i.horsTotal && <span>{i.horsTotal}</span>}
          {i.brouillon && <span>en cours de tracé</span>}
          {i.derivees.map((d) => <span key={d.cle} className="tabular-nums">{d.libelle} {quantiteLisible(d.valeur, d.unite)}</span>)}
        </span>
      </span>
    </>
  )
  return (
    <li data-instance={i.id} className={cn(choisie && 'bg-sky-50')}>
      {onChoisir && !i.brouillon ? (
        <button onClick={() => onChoisir(i)} className="flex w-full items-start gap-2 py-1.5 pl-11 pr-3 text-left transition-colors hover:bg-muted/60 pointer-coarse:min-h-11" title="Montrer sur le plan">
          {contenu}
        </button>
      ) : (
        <div className="flex items-start gap-2 py-1.5 pl-11 pr-3">{contenu}</div>
      )}
    </li>
  )
}

// ---------------------------------------------------------------- SIA 416

function SectionSia416({ sia, ouverte, onBasculer, lectureSeule, onAffecter }: {
  sia: Sia416
  ouverte: boolean
  onBasculer: () => void
  lectureSeule?: boolean
  onAffecter?: (planId: string, id: string, categorie: CategorieSia416 | null) => void
}) {
  const t = sia.total
  return (
    <section className="overflow-hidden rounded-xl border bg-background" data-visite="metres-sia416">
      <button onClick={onBasculer} className="flex w-full items-center gap-2 px-2.5 py-2 text-left hover:bg-muted/60 pointer-coarse:min-h-11" aria-expanded={ouverte}>
        {ouverte ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
        <span className="flex h-3 w-3 shrink-0 items-center justify-center rounded-sm bg-slate-700 text-[7px] font-bold text-white" aria-hidden>S</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[13px] font-semibold">Surfaces SIA 416</span>
            <span className="shrink-0 text-[13px] font-semibold tabular-nums">{t.sp == null ? 'SP n.c.' : `SP ${quantiteLisible(t.sp, 'm²')}`}</span>
          </span>
          <span className="flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
            <span className="tabular-nums">SN {quantiteLisible(t.sn, 'm²')}</span>
            {t.sc != null && <span className="tabular-nums">SC {quantiteLisible(t.sc, 'm²')}</span>}
            <span className="text-amber-700">{MENTION_SIA416.toLowerCase()}</span>
          </span>
        </span>
      </button>
      {ouverte && (
        <div className="space-y-3 border-t px-3 py-2.5">
          <p className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-900">
            {MENTION_SIA416}. SP prise sur l’emprise au nu extérieur, SN sur les pièces validées, SC par différence ;
            affectation d’après le nom du local, à corriger pièce par pièce.
          </p>
          <TableauSia
            lignes={[
              { nom: 'SP', valeurs: sia.etages.map((e) => e.sp), total: t.sp },
              { nom: 'SN', valeurs: sia.etages.map((e) => e.sn), total: t.sn },
              { nom: 'SC', valeurs: sia.etages.map((e) => e.sc), total: t.sc },
              ...CATEGORIES_SIA416.map((c) => ({ nom: c, titre: NOMS_SIA416[c], valeurs: sia.etages.map((e) => e.categories[c]), total: t.categories[c] })),
              ...(t.nonAffectee > 0 ? [{ nom: 'Non aff.', titre: 'Pièces sans affectation', valeurs: sia.etages.map((e) => e.nonAffectee), total: t.nonAffectee }] : []),
            ]}
            etages={sia.etages}
          />
          {sia.alertes.length > 0 && (
            <ul className="space-y-0.5 text-[11px] text-amber-800">
              {sia.alertes.map((a) => <li key={a} className="flex gap-1"><AlertTriangle className="mt-px h-3 w-3 shrink-0" />{a}</li>)}
            </ul>
          )}
          {sia.etages.map((e) => (
            <AffectationsEtage key={e.cle} e={e} lectureSeule={lectureSeule} onAffecter={onAffecter} />
          ))}
        </div>
      )}
    </section>
  )
}

function TableauSia({ lignes, etages }: { lignes: { nom: string; titre?: string; valeurs: (number | null)[]; total: number | null }[]; etages: EtageSia416[] }) {
  const v = (x: number | null) => (x == null ? 'n.c.' : NOMBRE.format(x))
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-max text-[11px] tabular-nums">
        <thead>
          <tr className="text-muted-foreground">
            <th className="py-1 pr-2 text-left font-medium">m²</th>
            {etages.map((e) => <th key={e.cle} className="py-1 pl-2 text-right font-medium" title={e.nom}>{e.nom.length > 12 ? `${e.nom.slice(0, 11)}…` : e.nom}{e.multiplicateur > 1 ? ` ×${e.multiplicateur}` : ''}</th>)}
            <th className="py-1 pl-2 text-right font-semibold text-foreground">Total</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((l) => (
            <tr key={l.nom} className="border-t">
              <td className="py-1 pr-2 font-medium" title={l.titre}>{l.nom}</td>
              {l.valeurs.map((x, i) => <td key={i} className="py-1 pl-2 text-right">{v(x)}</td>)}
              <td className="py-1 pl-2 text-right font-semibold">{v(l.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AffectationsEtage({ e, lectureSeule, onAffecter }: {
  e: EtageSia416
  lectureSeule?: boolean
  onAffecter?: (planId: string, id: string, categorie: CategorieSia416 | null) => void
}) {
  const [ouverte, setOuverte] = useState(false)
  if (!e.pieces.length) return null
  const planId = e.cle.split('#')[0]
  return (
    <div className="rounded-lg border">
      <button onClick={() => setOuverte((o) => !o)} className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-[12px] font-medium hover:bg-muted/50 pointer-coarse:min-h-11">
        {ouverte ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        Affectation des pièces · {e.nom}
        <span className="ml-auto text-[11px] font-normal text-muted-foreground">{e.pieces.length}</span>
      </button>
      {ouverte && (
        <ul className="border-t">
          {e.pieces.map((p) => (
            <li key={p.id} className="flex items-center gap-2 border-b px-2 py-1 last:border-b-0">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px]">{p.nom}</span>
                <span className="block text-[11px] tabular-nums text-muted-foreground">{quantiteLisible(p.surface, 'm²')}</span>
              </span>
              {lectureSeule || !onAffecter ? (
                <span className="text-[11px] font-medium">{p.categorie ?? 'non affectée'}</span>
              ) : (
                <select
                  value={p.parDefaut ? '' : p.categorie ?? ''}
                  onChange={(ev) => onAffecter(planId, p.id, (ev.target.value || null) as CategorieSia416 | null)}
                  className={cn('h-8 rounded-md border bg-background px-1 text-[12px] outline-none focus:ring-2 focus:ring-primary pointer-coarse:h-11',
                    !p.categorie && 'border-amber-400 text-amber-800')}
                  aria-label={`Catégorie SIA 416, ${p.nom}`}
                  title={p.parDefaut ? 'Déduite du nom du local' : undefined}
                >
                  <option value="">{p.parDefaut && p.categorie ? `Auto (${p.categorie})` : 'À affecter'}</option>
                  {CATEGORIES_SIA416.map((c) => <option key={c} value={c}>{c}, {NOMS_SIA416[c].toLowerCase()}</option>)}
                </select>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
