/**
 * La vue tableau de l'espace de travail des Métrés.
 *
 * Toutes les formes métrées du jeu dans une seule grille, une ligne par
 * forme : sa feuille, son étage, son local, sa classification, sa quantité et
 * ce qu'on en tire, l'ouvrage CFC qui la reçoit, sa catégorie SIA 416, d'où
 * elle vient, la confiance de l'IA et si elle a été validée. On regroupe par
 * classification, étage, ouvrage ou feuille ; chaque groupe porte ses
 * sous-totaux et le pied du tableau le total général, étages identiques
 * multipliés, comme le panneau des quantités (lib/plans/tableau.ts).
 *
 * Tout y est relié au plan : une ligne touchée ouvre sa feuille et y cadre sa
 * forme ; un nom, une catégorie, un ouvrage ou une validation changés ici
 * s'écrivent sur la forme, par la même file que le panneau, et l'éditeur les
 * retrouve. Plusieurs lignes cochées se valident, se rattachent ou se
 * suppriment d'un geste.
 *
 * La première colonne (le local) et l'en-tête restent en place quand on fait
 * défiler : sur iPad, le tableau glisse sous le doigt sans perdre la ligne
 * qu'on lit. Sur téléphone, les mêmes lignes s'empilent en cartes, à lire.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle, ArrowDown, ArrowUp, Check, ChevronDown, ChevronRight, ChevronsUpDown, Crosshair, Link2, Loader2, Pencil, Search, Trash2, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ChoixOuvrage } from '@/components/plans/ChoixOuvrage'
import { CLASSIFICATIONS, quantiteLisible, type CleClassification, type PanneauQuantites as Panneau, type QuantiteDerivee } from '@/lib/plans/quantites'
import { CATEGORIES_SIA416, MENTION_SIA416, NOMS_SIA416, type CategorieSia416, type Sia416 } from '@/lib/plans/sia416'
import { NOMS_CONFIANCE } from '@/lib/plans/analyse-ia'
import {
  NOMS_PROVENANCE, REGROUPEMENTS, TRI_NATUREL, libelleDeLaFeuille, vueDuTableau, type ColonneTri, type EtatTableau, type GroupeTableau,
  type LigneTableau, type Regroupement, type TotalClassification, type VueTableau,
} from '@/lib/plans/tableau'

/** Ce que le tableau demande à l'espace de travail : montrer une forme, l'écrire. */
export interface ActionsTableau {
  onVoir: (l: LigneTableau) => void
  onRenommer: (l: LigneTableau, nom: string) => Promise<void>
  onSia416: (l: LigneTableau, categorie: CategorieSia416 | null) => Promise<void>
  onRattacher: (lignes: LigneTableau[], itemId: string | null) => Promise<void>
  onValider: (lignes: LigneTableau[]) => Promise<void>
  onSupprimer: (lignes: LigneTableau[]) => Promise<void>
}

/** Les autres dérivées, comme le panneau : la première est la quantité principale, les nulles se taisent. */
const autres = (ds: QuantiteDerivee[]) => ds.slice(1).filter((d) => d.valeur !== 0)
const enClair = (ds: QuantiteDerivee[]) => ds.map((d) => `${d.libelle} ${quantiteLisible(d.valeur, d.unite)}`).join(' · ')

const COLONNES: { cle: ColonneTri | null; titre: string; classe: string; droite?: boolean; aide?: string }[] = [
  { cle: 'feuille', titre: 'Feuille', classe: 'min-w-[11rem] max-w-[15rem]' },
  { cle: 'etage', titre: 'Étage', classe: 'min-w-[8rem]' },
  { cle: 'classification', titre: 'Classification', classe: 'min-w-[9rem]' },
  { cle: 'quantite', titre: 'Quantité', classe: 'min-w-[7.5rem]', droite: true, aide: 'Pour la forme seule, un étage ; les sous-totaux comptent les étages identiques' },
  { cle: null, titre: 'Dérivées', classe: 'min-w-[11rem]', aide: 'Plinthes, ouvertures et surface nette, face de mur' },
  { cle: 'ouvrage', titre: 'Ouvrage CFC', classe: 'min-w-[14rem]' },
  { cle: 'sia416', titre: 'SIA 416', classe: 'min-w-[8rem]' },
  { cle: 'provenance', titre: 'Provenance', classe: 'min-w-[7.5rem]' },
  { cle: 'confiance', titre: 'Confiance', classe: 'min-w-[7rem]' },
  { cle: 'statut', titre: 'Statut', classe: 'min-w-[10rem]' },
]
const NOMBRE_COLONNES = COLONNES.length + 1

/** Le tri suivant d'une colonne : croissant, décroissant, puis l'ordre du jeu. La quantité commence par la plus grande. */
function triSuivant(actuel: EtatTableau['tri'], colonne: ColonneTri): EtatTableau['tri'] {
  const premier = colonne === 'quantite' ? 'desc' : 'asc'
  if (actuel.colonne !== colonne) return { colonne, sens: premier }
  if (actuel.sens === premier) return { colonne, sens: premier === 'asc' ? 'desc' : 'asc' }
  return TRI_NATUREL
}

const champ = 'h-9 rounded-lg border bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-primary pointer-coarse:h-11'

export function TableauMetres({
  projectId, panneau, lignes, regroupement, onRegroupement, feuille, onToutLeJeu, etat, onEtat, choisie, actions,
}: {
  projectId: string
  panneau: Panneau
  lignes: LigneTableau[]
  regroupement: Regroupement
  onRegroupement: (r: Regroupement) => void
  /** La feuille choisie dans le navigateur, qui filtre le tableau ; null pour tout le jeu. */
  feuille: { planId: string; page: number; libelle: string } | null
  onToutLeJeu: () => void
  etat: EtatTableau
  onEtat: (maj: (e: EtatTableau) => EtatTableau) => void
  /** La dernière forme sélectionnée sur le plan : sa ligne s'éclaire au retour. */
  choisie: string | null
  actions: ActionsTableau
}) {
  const vue = useMemo(() => vueDuTableau(panneau, lignes, {
    filtres: { recherche: etat.recherche, statut: etat.statut, classification: etat.classification, feuille },
    regroupement,
    tri: etat.tri,
  }), [panneau, lignes, etat.recherche, etat.statut, etat.classification, etat.tri, feuille, regroupement])

  // Une action ne vise que des lignes affichées : une ligne cochée puis
  // masquée par un filtre ne se supprime pas à l'insu de qui la cherche.
  const visibles = useMemo(() => vue.groupes.flatMap((g) => g.lignes), [vue])
  const cochees = useMemo(() => visibles.filter((l) => etat.selection.has(l.cle)), [visibles, etat.selection])
  const cocher = (cles: string[], oui: boolean) => onEtat((e) => {
    const s = new Set(e.selection)
    for (const k of cles) {
      if (oui) s.add(k)
      else s.delete(k)
    }
    return { ...e, selection: s }
  })
  const toutDecocher = () => onEtat((e) => ({ ...e, selection: new Set() }))

  const [enCours, setEnCours] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [confirmerSuppression, setConfirmerSuppression] = useState(false)
  const [rattacher, setRattacher] = useState<LigneTableau[] | null>(null)
  const [renomme, setRenomme] = useState<{ cle: string; valeur: string } | null>(null)

  /** Une écriture : le message d'erreur reste à l'écran, l'état du tableau suit la forme. */
  const ecrire = async (libelle: string, f: () => Promise<void>) => {
    setEnCours(libelle)
    setErreur(null)
    try {
      await f()
    } catch (e) {
      setErreur(`${libelle} : l’enregistrement a échoué (${(e as Error)?.message || 'erreur inconnue'}). Réessayez.`)
    } finally {
      setEnCours(null)
    }
  }

  // Au retour du plan, la ligne de la forme qu'on y avait choisie vient sous les yeux.
  const conteneur = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!choisie) return
    conteneur.current?.querySelector(`[data-forme="${CSS.escape(choisie)}"]`)?.scrollIntoView({ block: 'center' })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seulement à l'ouverture du tableau
  }, [])

  const aValiderCochees = cochees.filter((l) => l.statut === 'a_valider')
  const rattachablesCochees = cochees.filter((l) => l.rattachable)
  const toutesCochees = visibles.length > 0 && cochees.length === visibles.length

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* Recherche, regroupement, filtres. */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2">
        <label className="relative min-w-[12rem] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={etat.recherche}
            onChange={(e) => onEtat((x) => ({ ...x, recherche: e.target.value }))}
            placeholder="Local, feuille, CFC…"
            aria-label="Chercher dans le tableau"
            className={cn(champ, 'w-full pl-8 pr-7')}
          />
          {etat.recherche && (
            <button onClick={() => onEtat((x) => ({ ...x, recherche: '' }))} className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted" title="Effacer">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Regrouper par
          <select value={regroupement} onChange={(e) => onRegroupement(e.target.value as Regroupement)} className={cn(champ, 'text-foreground')} aria-label="Regrouper par">
            {REGROUPEMENTS.map((r) => <option key={r.cle} value={r.cle}>{r.libelle}</option>)}
          </select>
        </label>
        <div className="flex rounded-lg bg-muted p-0.5" role="group" aria-label="Statut">
          {([['tous', 'Tout'], ['a_valider', 'À valider'], ['valide', 'Validé']] as const).map(([cle, libelle]) => (
            <button
              key={cle}
              onClick={() => onEtat((x) => ({ ...x, statut: cle }))}
              aria-pressed={etat.statut === cle}
              className={cn('rounded-md px-2.5 py-1 text-xs font-medium transition-colors pointer-coarse:min-h-11 pointer-coarse:px-3',
                etat.statut === cle ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
            >
              {libelle}
            </button>
          ))}
        </div>
        <select
          value={etat.classification ?? ''}
          onChange={(e) => onEtat((x) => ({ ...x, classification: (e.target.value || null) as CleClassification | null }))}
          className={champ}
          aria-label="Classification"
        >
          <option value="">Toutes les classifications</option>
          {CLASSIFICATIONS.filter((c) => lignes.some((l) => l.classification === c.cle)).map((c) => <option key={c.cle} value={c.cle}>{c.titre}</option>)}
        </select>
        {feuille && (
          <span className="flex max-w-[16rem] items-center gap-1 rounded-full bg-sky-50 py-1 pl-2.5 pr-1 text-xs font-medium text-sky-900">
            <span className="truncate">Feuille {feuille.libelle}</span>
            <button onClick={onToutLeJeu} className="flex shrink-0 items-center rounded-full p-0.5 hover:bg-sky-100 pointer-coarse:p-2" title="Tout le jeu" aria-label="Revenir à tout le jeu">
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        )}
        <p className="ml-auto text-xs text-muted-foreground">
          {vue.nombre} forme{vue.nombre > 1 ? 's' : ''}
          {vue.aValider > 0 && <span className="text-teal-700"> · {vue.aValider} à valider, hors totaux</span>}
        </p>
      </div>

      {/* Les lignes cochées : un geste pour toutes. */}
      {cochees.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-sky-50 px-3 py-2 text-sm text-sky-950" role="toolbar" aria-label="Lignes sélectionnées">
          {confirmerSuppression ? (
            <>
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
              <span className="font-medium">Supprimer {cochees.length} forme{cochees.length > 1 ? 's' : ''} des plans ? Elles disparaissent aussi des totaux.</span>
              <button
                onClick={() => { setConfirmerSuppression(false); void ecrire('Suppression', async () => { await actions.onSupprimer(cochees); toutDecocher() }) }}
                className="flex h-9 items-center gap-1.5 rounded-lg bg-red-600 px-3 text-sm font-semibold text-white hover:bg-red-700 pointer-coarse:h-11"
              >
                <Trash2 className="h-4 w-4" />Supprimer
              </button>
              <button onClick={() => setConfirmerSuppression(false)} className="h-9 rounded-lg border bg-background px-3 text-sm font-medium hover:bg-muted pointer-coarse:h-11">Annuler</button>
            </>
          ) : (
            <>
              <span className="font-medium">{cochees.length} sélectionnée{cochees.length > 1 ? 's' : ''}</span>
              <button
                onClick={() => void ecrire('Validation', () => actions.onValider(aValiderCochees))}
                disabled={!aValiderCochees.length || !!enCours}
                className="flex h-9 items-center gap-1.5 rounded-lg bg-foreground px-3 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-40 pointer-coarse:h-11"
              >
                <Check className="h-4 w-4" />Valider{aValiderCochees.length ? ` (${aValiderCochees.length})` : ''}
              </button>
              <button
                onClick={() => setRattacher(rattachablesCochees)}
                disabled={!rattachablesCochees.length || !!enCours}
                className="flex h-9 items-center gap-1.5 rounded-lg border bg-background px-3 text-sm font-medium hover:bg-muted disabled:opacity-40 pointer-coarse:h-11"
                title={rattachablesCochees.length < cochees.length ? 'Les repères comptés ne se rattachent pas à un ouvrage : ils vont aux comptages du dossier' : undefined}
              >
                <Link2 className="h-4 w-4" />Rattacher à un ouvrage{rattachablesCochees.length < cochees.length ? ` (${rattachablesCochees.length})` : ''}
              </button>
              <button
                onClick={() => setConfirmerSuppression(true)}
                disabled={!!enCours}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-background px-3 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-40 pointer-coarse:h-11"
              >
                <Trash2 className="h-4 w-4" />Supprimer
              </button>
              <button onClick={toutDecocher} className="h-9 rounded-lg px-2.5 text-sm font-medium text-sky-900 hover:bg-sky-100 pointer-coarse:h-11">Tout désélectionner</button>
            </>
          )}
          {enCours && <span className="flex items-center gap-1.5 text-xs"><Loader2 className="h-3.5 w-3.5 animate-spin" />{enCours}…</span>}
        </div>
      )}
      {erreur && (
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <p>{erreur}</p>
          <button onClick={() => setErreur(null)} className="shrink-0 rounded p-0.5 hover:bg-red-100" title="Fermer"><X className="h-4 w-4" /></button>
        </div>
      )}

      <div ref={conteneur} className="min-h-0 flex-1 overflow-auto overscroll-contain pb-[var(--safe-bottom)]">
        {lignes.length === 0 ? (
          <p className="m-4 rounded-xl border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
            Rien de mesuré pour l’instant. Les zones proposées par l’IA, celles que vous tracez et les éléments comptés s’affichent ici, une ligne par forme.
          </p>
        ) : vue.nombre === 0 ? (
          <p className="m-4 rounded-xl border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">Aucune forme ne correspond à ces filtres.</p>
        ) : (
          <table className="w-max min-w-full border-separate border-spacing-0 text-[13px]" aria-label="Tableau des métrés">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-30 min-w-[17rem] max-w-[20rem] border-b border-r bg-muted px-1 text-left">
                  <div className="flex items-center">
                    <Coche
                      etat={toutesCochees ? 'oui' : cochees.length ? 'partiel' : 'non'}
                      onChange={(oui) => cocher(visibles.map((l) => l.cle), oui)}
                      libelle="Tout sélectionner"
                    />
                    <EnteteTri titre="Local / libellé" colonne="nom" tri={etat.tri} onTri={(c) => onEtat((x) => ({ ...x, tri: triSuivant(x.tri, c) }))} />
                  </div>
                </th>
                {COLONNES.map((c) => (
                  <th key={c.titre} className={cn('sticky top-0 z-20 border-b bg-muted px-3 text-left', c.classe, c.droite && 'text-right')} title={c.aide}>
                    {c.cle
                      ? <EnteteTri titre={c.titre} colonne={c.cle} tri={etat.tri} droite={c.droite} onTri={(k) => onEtat((x) => ({ ...x, tri: triSuivant(x.tri, k) }))} />
                      : <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{c.titre}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vue.groupes.map((g) => (
                <Groupe
                  key={g.cle}
                  g={g}
                  regroupement={regroupement}
                  replie={etat.replies.has(g.cle)}
                  onReplier={() => onEtat((x) => {
                    const r = new Set(x.replies)
                    if (r.has(g.cle)) r.delete(g.cle)
                    else r.add(g.cle)
                    return { ...x, replies: r }
                  })}
                  selection={etat.selection}
                  onCocher={cocher}
                  choisie={choisie}
                  renomme={renomme}
                  onRenomme={setRenomme}
                  enCours={!!enCours}
                  actions={{
                    ...actions,
                    onRenommer: (l, nom) => ecrire('Nom', () => actions.onRenommer(l, nom)),
                    onSia416: (l, c) => ecrire('SIA 416', () => actions.onSia416(l, c)),
                    onValider: (ls) => ecrire('Validation', () => actions.onValider(ls)),
                  }}
                  onRattacher={(l) => setRattacher([l])}
                />
              ))}
            </tbody>
            <PiedDuTableau vue={vue} />
          </table>
        )}
      </div>

      {rattacher && rattacher.length > 0 && (
        <ChoixOuvrage
          projectId={projectId}
          nature={rattacher.find((l) => l.nature !== 'comptage')?.nature === 'longueur' ? 'longueur' : 'surface'}
          // Un seul ouvrage pour toutes : c'est lui qu'on montre choisi.
          choisi={rattacher.every((l) => l.ouvrage?.id === rattacher[0].ouvrage?.id) ? rattacher[0].ouvrage?.id ?? null : null}
          onChoisir={(itemId) => {
            const visees = rattacher
            setRattacher(null)
            void ecrire('Rattachement', () => actions.onRattacher(visees, itemId))
          }}
          onFermer={() => setRattacher(null)}
        />
      )}
    </div>
  )
}

/** Une case à cocher de 44 px au doigt, avec son état partiel. */
function Coche({ etat, onChange, libelle }: { etat: 'oui' | 'non' | 'partiel'; onChange: (oui: boolean) => void; libelle: string }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { if (ref.current) ref.current.indeterminate = etat === 'partiel' }, [etat])
  return (
    <label className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center pointer-coarse:h-11 pointer-coarse:w-11" title={libelle}>
      <input
        ref={ref}
        type="checkbox"
        checked={etat === 'oui'}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={libelle}
        className="h-4 w-4 cursor-pointer accent-foreground pointer-coarse:h-5 pointer-coarse:w-5"
      />
    </label>
  )
}

function EnteteTri({ titre, colonne, tri, droite, onTri }: {
  titre: string; colonne: ColonneTri; tri: EtatTableau['tri']; droite?: boolean; onTri: (c: ColonneTri) => void
}) {
  const actif = tri.colonne === colonne
  const Icone = !actif ? ChevronsUpDown : tri.sens === 'asc' ? ArrowUp : ArrowDown
  return (
    <button
      onClick={() => onTri(colonne)}
      aria-sort={actif ? (tri.sens === 'asc' ? 'ascending' : 'descending') : undefined}
      className={cn('flex min-h-9 w-full items-center gap-1 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition-colors pointer-coarse:min-h-11',
        droite && 'justify-end', actif ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')}
      title={`Trier par ${titre.toLowerCase()}`}
    >
      {titre}
      <Icone className={cn('h-3.5 w-3.5 shrink-0', !actif && 'opacity-40')} />
    </button>
  )
}

const cellule = 'h-10 border-b px-3 align-middle whitespace-nowrap pointer-coarse:h-12'
const premiere = 'sticky left-0 z-10 border-b border-r px-1 align-middle'

function Groupe({ g, regroupement, replie, onReplier, selection, onCocher, choisie, renomme, onRenomme, enCours, actions, onRattacher }: {
  g: GroupeTableau
  regroupement: Regroupement
  replie: boolean
  onReplier: () => void
  selection: ReadonlySet<string>
  onCocher: (cles: string[], oui: boolean) => void
  choisie: string | null
  renomme: { cle: string; valeur: string } | null
  onRenomme: (r: { cle: string; valeur: string } | null) => void
  enCours: boolean
  actions: ActionsTableau
  onRattacher: (l: LigneTableau) => void
}) {
  const cochees = g.lignes.filter((l) => selection.has(l.cle)).length
  const unSeulTotal = regroupement === 'classification' || g.totaux.length === 1
  return (
    <>
      <tr>
        <td colSpan={NOMBRE_COLONNES} className="border-b bg-muted/60 p-0">
          {/* Collé à gauche : le titre du groupe reste lisible quand le tableau défile. */}
          <div className="sticky left-0 flex w-max max-w-[100vw] items-center gap-1 px-1 py-1">
            <Coche
              etat={cochees === g.lignes.length ? 'oui' : cochees ? 'partiel' : 'non'}
              onChange={(oui) => onCocher(g.lignes.map((l) => l.cle), oui)}
              libelle={`Sélectionner ${g.titre}`}
            />
            <button onClick={onReplier} aria-expanded={!replie} className="flex min-h-9 items-center gap-2 rounded-lg px-1.5 text-left hover:bg-muted pointer-coarse:min-h-11">
              {replie ? <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
              {g.couleur && <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: g.couleur }} aria-hidden />}
              <span className="text-[13px] font-semibold">{g.titre}</span>
              {g.detail && <span className="text-xs text-muted-foreground">{g.detail}</span>}
              <span className="text-xs text-muted-foreground">· {g.lignes.length} forme{g.lignes.length > 1 ? 's' : ''}</span>
              {g.aValider > 0 && <span className="rounded-full bg-teal-50 px-1.5 text-[11px] font-medium text-teal-700">{g.aValider} à valider</span>}
              {/* Replié, le groupe garde son total sous les yeux. */}
              {replie && unSeulTotal && g.totaux[0]?.derivees[0] && (
                <span className="ml-2 text-[13px] font-semibold tabular-nums">{quantiteLisible(g.totaux[0].derivees[0].valeur, g.totaux[0].derivees[0].unite)}</span>
              )}
            </button>
          </div>
        </td>
      </tr>
      {!replie && g.lignes.map((l) => (
        <Ligne
          key={l.cle}
          l={l}
          cochee={selection.has(l.cle)}
          onCocher={(oui) => onCocher([l.cle], oui)}
          choisie={choisie === l.id}
          renomme={renomme?.cle === l.cle ? renomme.valeur : null}
          onRenomme={(v) => onRenomme(v == null ? null : { cle: l.cle, valeur: v })}
          enCours={enCours}
          actions={actions}
          onRattacher={() => onRattacher(l)}
        />
      ))}
      {!replie && g.totaux.map((t) => (
        <LigneTotal key={t.cle} t={t} titre={unSeulTotal && regroupement === 'classification' ? 'Sous-total' : `Sous-total · ${t.titre}`} />
      ))}
    </>
  )
}

function Ligne({ l, cochee, onCocher, choisie, renomme, onRenomme, enCours, actions, onRattacher }: {
  l: LigneTableau
  cochee: boolean
  onCocher: (oui: boolean) => void
  choisie: boolean
  renomme: string | null
  onRenomme: (v: string | null) => void
  enCours: boolean
  actions: ActionsTableau
  onRattacher: () => void
}) {
  const aValider = l.statut === 'a_valider'
  const fond = cochee ? 'bg-sky-50' : choisie ? 'bg-amber-50' : 'bg-background group-hover/ligne:bg-muted'
  const renommable = l.nature !== 'comptage'
  const terminer = (garder: boolean) => {
    const v = renomme?.trim() ?? ''
    onRenomme(null)
    if (garder && v && v !== l.nom) void actions.onRenommer(l, v)
  }
  return (
    <tr
      data-ligne={l.cle}
      data-forme={l.id}
      onClick={(e) => {
        // Toucher la ligne ouvre la forme sur le plan ; les commandes de la ligne gardent leur rôle.
        if ((e.target as HTMLElement).closest('button, input, select, label, a, textarea')) return
        actions.onVoir(l)
      }}
      className="group/ligne cursor-pointer hover:bg-muted/50"
      title="Voir sur le plan"
    >
      <td className={cn(premiere, fond, choisie && 'shadow-[inset_3px_0_0_#f59e0b]')}>
        <div className="flex min-w-[16.5rem] max-w-[20rem] items-center gap-1">
          <Coche etat={cochee ? 'oui' : 'non'} onChange={onCocher} libelle={`Sélectionner ${l.nom}`} />
          <span
            className={cn('h-3 w-3 shrink-0 rounded-sm', aValider && 'border-2 border-dashed bg-transparent')}
            style={aValider ? { borderColor: l.couleur } : { background: l.couleur }}
            aria-hidden
          />
          {renomme != null ? (
            <input
              autoFocus
              value={renomme}
              onChange={(e) => onRenomme(e.target.value)}
              onBlur={() => terminer(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') terminer(true)
                else if (e.key === 'Escape') terminer(false)
              }}
              maxLength={80}
              aria-label={`Nom de ${l.nom}`}
              className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-[13px] outline-none focus:ring-2 focus:ring-primary pointer-coarse:h-10"
            />
          ) : (
            <span className={cn('min-w-0 flex-1 truncate pl-1 font-medium', aValider && 'text-muted-foreground')} title={l.nom}>{l.nom}</span>
          )}
          {renommable && renomme == null && (
            <button
              onClick={() => onRenomme(l.nom)}
              disabled={enCours}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-60 hover:bg-muted hover:text-foreground hover:opacity-100 pointer-coarse:h-11 pointer-coarse:w-11 pointer-coarse:opacity-100"
              title="Renommer"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={() => actions.onVoir(l)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground pointer-coarse:h-11 pointer-coarse:w-11"
            title="Voir sur le plan"
            aria-label={`Voir ${l.nom} sur le plan`}
          >
            <Crosshair className="h-4 w-4" />
          </button>
        </div>
      </td>
      <td className={cn(cellule, 'max-w-[15rem]', cochee && 'bg-sky-50')}>
        <span className="flex min-w-0 items-baseline gap-1.5">
          {l.feuille.numero && <span className="shrink-0 font-semibold tabular-nums">{l.feuille.numero}</span>}
          <span className="truncate text-muted-foreground" title={l.feuille.titre}>{l.feuille.titre}</span>
        </span>
      </td>
      <td className={cn(cellule, cochee && 'bg-sky-50')}>
        {l.etage}{l.multiplicateur > 1 && <span className="ml-1 text-muted-foreground">× {l.multiplicateur}</span>}
      </td>
      <td className={cn(cellule, cochee && 'bg-sky-50')}>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: l.couleur }} aria-hidden />
          {l.titreClassification}
        </span>
      </td>
      <td className={cn(cellule, 'text-right tabular-nums', cochee && 'bg-sky-50')}>
        <span className={cn((aValider || l.horsTotal) && 'text-muted-foreground line-through decoration-muted-foreground/40')}>
          {l.quantite == null ? 'sans échelle' : l.nature === 'comptage' ? '1 pce' : quantiteLisible(l.quantite, l.unite)}
        </span>
      </td>
      <td className={cn(cellule, 'text-xs text-muted-foreground tabular-nums', cochee && 'bg-sky-50')}>
        {l.derivees.length ? enClair(l.derivees) : <span className="opacity-50">–</span>}
      </td>
      <td className={cn(cellule, 'max-w-[16rem]', cochee && 'bg-sky-50')}>
        {!l.rattachable ? (
          <span className="text-xs text-muted-foreground" title="Un repère compté va aux comptages du dossier">Comptages du dossier</span>
        ) : (
          <button
            onClick={onRattacher}
            disabled={enCours}
            className={cn('flex min-h-8 max-w-full items-center gap-1.5 rounded-lg border px-2 text-left text-xs transition-colors hover:bg-muted pointer-coarse:min-h-11',
              !l.ouvrage && 'border-dashed text-muted-foreground')}
            title={l.ouvrage ? `${l.ouvrage.cfcCode ?? ''} ${l.ouvrage.libelle} : changer d’ouvrage` : 'Rattacher à un ouvrage'}
          >
            <Link2 className="h-3.5 w-3.5 shrink-0" />
            {l.ouvrage ? (
              <span className="min-w-0 truncate">
                {l.ouvrage.cfcCode && <span className="mr-1 font-mono font-semibold">{l.ouvrage.cfcCode}</span>}
                {l.ouvrage.libelle}
              </span>
            ) : 'Rattacher…'}
          </button>
        )}
      </td>
      <td className={cn(cellule, cochee && 'bg-sky-50')}>
        {l.sia416 ? (
          <select
            value={l.sia416.parDefaut ? '' : l.sia416.categorie ?? ''}
            onChange={(e) => void actions.onSia416(l, (e.target.value || null) as CategorieSia416 | null)}
            disabled={enCours}
            className={cn('h-8 rounded-md border bg-background px-1 text-xs outline-none focus:ring-2 focus:ring-primary pointer-coarse:h-11',
              !l.sia416.categorie && 'border-amber-400 text-amber-800')}
            aria-label={`Catégorie SIA 416, ${l.nom}`}
            title={l.sia416.parDefaut ? 'Déduite du nom du local' : undefined}
          >
            <option value="">{l.sia416.parDefaut && l.sia416.categorie ? `Auto (${l.sia416.categorie})` : 'À affecter'}</option>
            {CATEGORIES_SIA416.map((c) => <option key={c} value={c}>{c}, {NOMS_SIA416[c].toLowerCase()}</option>)}
          </select>
        ) : <span className="text-muted-foreground opacity-50">–</span>}
      </td>
      <td className={cn(cellule, 'text-xs', cochee && 'bg-sky-50')} title={l.provenanceDetail}>
        <span className={cn('rounded-full px-2 py-0.5 font-medium',
          l.provenance === 'ia_aimantee' ? 'bg-emerald-50 text-emerald-800' : l.provenance === 'ia' ? 'bg-violet-50 text-violet-800'
            : l.provenance === 'symbole' ? 'bg-amber-50 text-amber-800' : 'bg-muted text-foreground')}
        >
          {NOMS_PROVENANCE[l.provenance]}
        </span>
      </td>
      <td className={cn(cellule, 'text-xs', cochee && 'bg-sky-50')}>
        {l.confiance ? (
          <span className="flex items-center gap-1.5">
            <span className={cn('h-2 w-2 rounded-full', l.confiance === 'haute' ? 'bg-emerald-500' : l.confiance === 'moyenne' ? 'bg-amber-500' : 'bg-red-500')} aria-hidden />
            {NOMS_CONFIANCE[l.confiance].replace('confiance ', '')}
          </span>
        ) : <span className="text-muted-foreground opacity-50">–</span>}
      </td>
      <td className={cn(cellule, cochee && 'bg-sky-50')}>
        {aValider ? (
          <span className="flex items-center gap-1.5">
            <span className="rounded-full border border-dashed border-teal-400 bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-800">À valider</span>
            <button
              onClick={() => void actions.onValider([l])}
              disabled={enCours}
              className="flex h-8 items-center gap-1 rounded-lg bg-foreground px-2 text-xs font-semibold text-background hover:opacity-90 disabled:opacity-40 pointer-coarse:h-11 pointer-coarse:px-3"
              title="Valider : elle entre dans les totaux"
            >
              <Check className="h-3.5 w-3.5" />Valider
            </button>
          </span>
        ) : (
          <span className="flex flex-col">
            <span className="flex items-center gap-1 text-xs font-medium text-emerald-700"><Check className="h-3.5 w-3.5" />Validé</span>
            {l.horsTotal && <span className="text-[11px] text-muted-foreground">hors total, {l.horsTotal}</span>}
          </span>
        )}
      </td>
    </tr>
  )
}

/** Un total : la quantité principale sous la colonne des quantités, le reste à côté. */
function LigneTotal({ t, titre, fort }: { t: TotalClassification; titre: string; fort?: boolean }) {
  const principale = t.derivees[0]
  return (
    <tr className={cn(fort ? 'font-semibold' : 'font-medium')}>
      <td className={cn(premiere, 'bg-muted px-3 py-2')}>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: t.couleur }} aria-hidden />
          <span className="truncate">{titre}</span>
        </span>
      </td>
      <td colSpan={3} className={cn(cellule, 'bg-muted/50 text-xs text-muted-foreground')}>
        {t.nombre} forme{t.nombre > 1 ? 's' : ''}{t.aValider > 0 ? `, dont ${t.aValider} à valider hors total` : ''}
      </td>
      <td className={cn(cellule, 'bg-muted/50 text-right tabular-nums')}>{principale ? quantiteLisible(principale.valeur, principale.unite) : ''}</td>
      <td colSpan={COLONNES.length - 4} className={cn(cellule, 'bg-muted/50 text-xs tabular-nums text-muted-foreground')}>
        {enClair(autres(t.derivees))}
      </td>
    </tr>
  )
}

function PiedDuTableau({ vue }: { vue: VueTableau }) {
  return (
    <tfoot>
      <tr>
        <td colSpan={NOMBRE_COLONNES} className="border-b border-t-2 border-t-foreground/20 bg-background p-0">
          <p className="sticky left-0 w-max px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Total général{vue.groupes.length > 1 ? ' des lignes affichées' : ''}, étages identiques compris
          </p>
        </td>
      </tr>
      {vue.totaux.map((t) => <LigneTotal key={t.cle} t={t} titre={t.titre} fort />)}
      {vue.sia && <LigneSia sia={vue.sia} />}
    </tfoot>
  )
}

function LigneSia({ sia }: { sia: Sia416 }) {
  const t = sia.total
  return (
    <tr className="font-medium">
      <td className={cn(premiere, 'bg-muted px-3 py-2')}>
        <span className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 shrink-0 items-center justify-center rounded-sm bg-slate-700 text-[6px] font-bold text-white" aria-hidden>S</span>
          Surfaces SIA 416
        </span>
      </td>
      <td colSpan={3} className={cn(cellule, 'bg-muted/50 text-xs text-amber-700')}>{MENTION_SIA416}</td>
      <td className={cn(cellule, 'bg-muted/50 text-right tabular-nums')}>{t.sp == null ? 'SP n.c.' : `SP ${quantiteLisible(t.sp, 'm²')}`}</td>
      <td colSpan={COLONNES.length - 4} className={cn(cellule, 'bg-muted/50 text-xs tabular-nums text-muted-foreground')}>
        {[
          `SN ${quantiteLisible(t.sn, 'm²')}`,
          t.sc != null ? `SC ${quantiteLisible(t.sc, 'm²')}` : null,
          ...CATEGORIES_SIA416.map((c) => `${c} ${quantiteLisible(t.categories[c], 'm²')}`),
          t.nonAffectee > 0 ? `non affectées ${quantiteLisible(t.nonAffectee, 'm²')}` : null,
        ].filter(Boolean).join(' · ')}
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------- téléphone

/**
 * Sur téléphone, le tableau se lit en cartes empilées, regroupées comme on
 * l'a choisi : pas de défilement de côté, pas d'édition. On corrige sur iPad
 * ou à l'ordinateur.
 */
export function CartesTableau({ panneau, lignes, regroupement, onRegroupement, etat, onEtat }: {
  panneau: Panneau
  lignes: LigneTableau[]
  regroupement: Regroupement
  onRegroupement: (r: Regroupement) => void
  etat: EtatTableau
  onEtat: (maj: (e: EtatTableau) => EtatTableau) => void
}) {
  const vue = useMemo(() => vueDuTableau(panneau, lignes, {
    filtres: { recherche: etat.recherche, statut: etat.statut, classification: null, feuille: null },
    regroupement,
    tri: etat.tri,
  }), [panneau, lignes, etat.recherche, etat.statut, etat.tri, regroupement])

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={etat.recherche}
            onChange={(e) => onEtat((x) => ({ ...x, recherche: e.target.value }))}
            placeholder="Local, feuille, CFC…"
            aria-label="Chercher dans le tableau"
            className="h-11 w-full rounded-xl border bg-background pl-9 pr-3 text-base outline-none focus:ring-2 focus:ring-primary"
          />
        </label>
        <div className="flex gap-2">
          <select value={regroupement} onChange={(e) => onRegroupement(e.target.value as Regroupement)} className="h-11 min-w-0 flex-1 rounded-xl border bg-background px-2 text-sm" aria-label="Regrouper par">
            {REGROUPEMENTS.map((r) => <option key={r.cle} value={r.cle}>Par {r.libelle.toLowerCase()}</option>)}
          </select>
          <select
            value={etat.statut}
            onChange={(e) => onEtat((x) => ({ ...x, statut: e.target.value as EtatTableau['statut'] }))}
            className="h-11 min-w-0 flex-1 rounded-xl border bg-background px-2 text-sm"
            aria-label="Statut"
          >
            <option value="tous">Tout</option>
            <option value="a_valider">À valider</option>
            <option value="valide">Validé</option>
          </select>
        </div>
      </div>

      {lignes.length === 0 ? (
        <p className="rounded-xl border border-dashed px-3 py-8 text-center text-xs text-muted-foreground">Rien de mesuré pour l’instant.</p>
      ) : vue.nombre === 0 ? (
        <p className="rounded-xl border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">Aucune forme ne correspond.</p>
      ) : (
        vue.groupes.map((g) => (
          <section key={g.cle} className="overflow-hidden rounded-xl border bg-background">
            <div className="border-b bg-muted/50 px-3 py-2">
              <p className="flex items-center gap-2 text-[13px] font-semibold">
                {g.couleur && <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: g.couleur }} aria-hidden />}
                <span className="min-w-0 flex-1 truncate">{g.titre}</span>
                <span className="shrink-0 text-xs font-normal text-muted-foreground">{g.lignes.length}</span>
              </p>
              {g.detail && <p className="text-[11px] text-muted-foreground">{g.detail}</p>}
              <ul className="mt-1 space-y-0.5">
                {g.totaux.map((t) => (
                  <li key={t.cle} className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="truncate text-muted-foreground">{regroupement === 'classification' ? 'Sous-total' : t.titre}</span>
                    <span className="shrink-0 font-semibold tabular-nums">{t.derivees[0] ? quantiteLisible(t.derivees[0].valeur, t.derivees[0].unite) : ''}</span>
                  </li>
                ))}
              </ul>
            </div>
            <ul>
              {g.lignes.map((l) => <CarteLigne key={l.cle} l={l} />)}
            </ul>
          </section>
        ))
      )}

      {vue.nombre > 0 && (
        <section className="rounded-xl border bg-background px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Total général, étages identiques compris</p>
          <ul className="mt-1.5 space-y-1">
            {vue.totaux.map((t) => (
              <li key={t.cle} className="text-xs">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5 font-medium">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: t.couleur }} aria-hidden />
                    <span className="truncate">{t.titre}</span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">{t.derivees[0] ? quantiteLisible(t.derivees[0].valeur, t.derivees[0].unite) : ''}</span>
                </span>
                {autres(t.derivees).length > 0 && <span className="block text-[11px] tabular-nums text-muted-foreground">{enClair(autres(t.derivees))}</span>}
              </li>
            ))}
            {vue.sia && (
              <li className="text-xs">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">Surfaces SIA 416</span>
                  <span className="shrink-0 font-semibold tabular-nums">{vue.sia.total.sp == null ? 'SP n.c.' : `SP ${quantiteLisible(vue.sia.total.sp, 'm²')}`}</span>
                </span>
                <span className="block text-[11px] tabular-nums text-muted-foreground">SN {quantiteLisible(vue.sia.total.sn, 'm²')} · {MENTION_SIA416.toLowerCase()}</span>
              </li>
            )}
          </ul>
          {vue.aValider > 0 && <p className="mt-2 text-[11px] text-teal-700">{vue.aValider} élément{vue.aValider > 1 ? 's' : ''} à valider, hors totaux.</p>}
        </section>
      )}
    </div>
  )
}

function CarteLigne({ l }: { l: LigneTableau }) {
  const aValider = l.statut === 'a_valider'
  return (
    <li className="border-b px-3 py-2 last:border-b-0">
      <p className="flex items-baseline gap-2">
        <span
          className={cn('mt-0.5 h-2.5 w-2.5 shrink-0 self-start rounded-sm', aValider && 'border-2 border-dashed bg-transparent')}
          style={aValider ? { borderColor: l.couleur } : { background: l.couleur }}
          aria-hidden
        />
        <span className={cn('min-w-0 flex-1 truncate text-[13px] font-medium', aValider && 'text-muted-foreground')}>{l.nom}</span>
        <span className={cn('shrink-0 text-[13px] tabular-nums', (aValider || l.horsTotal) && 'text-muted-foreground line-through decoration-muted-foreground/40')}>
          {l.quantite == null ? 'sans échelle' : l.nature === 'comptage' ? '1 pce' : quantiteLisible(l.quantite, l.unite)}
        </span>
      </p>
      <p className="mt-0.5 truncate pl-[1.125rem] text-[11px] text-muted-foreground">
        {[libelleDeLaFeuille(l.feuille), l.multiplicateur > 1 ? `${l.etage} × ${l.multiplicateur}` : l.etage, l.titreClassification].join(' · ')}
      </p>
      <p className="mt-1 flex flex-wrap gap-1 pl-[1.125rem] text-[11px]">
        {aValider
          ? <span className="rounded-full border border-dashed border-teal-400 bg-teal-50 px-1.5 font-medium text-teal-800">À valider{l.confiance ? `, ${NOMS_CONFIANCE[l.confiance]}` : ''}</span>
          : <span className="rounded-full bg-emerald-50 px-1.5 font-medium text-emerald-800">Validé{l.horsTotal ? `, hors total (${l.horsTotal})` : ''}</span>}
        <span className="rounded-full bg-muted px-1.5">{NOMS_PROVENANCE[l.provenance]}</span>
        {l.ouvrage && <span className="max-w-full truncate rounded-full bg-sky-50 px-1.5 text-sky-900">{[l.ouvrage.cfcCode, l.ouvrage.libelle].filter(Boolean).join(' ')}</span>}
        {l.sia416?.categorie && <span className="rounded-full bg-slate-100 px-1.5">{l.sia416.categorie}{l.sia416.parDefaut ? ' (auto)' : ''}</span>}
      </p>
      {l.derivees.length > 0 && <p className="mt-0.5 pl-[1.125rem] text-[11px] tabular-nums text-muted-foreground">{enClair(l.derivees)}</p>}
    </li>
  )
}
