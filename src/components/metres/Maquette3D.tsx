import { useEffect, useMemo, useRef, useState } from 'react'
import { Box, Loader2, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CATEGORIE } from '@/lib/base-cfc/comptages'
import type { Maquette3D } from '@/lib/plans/maquette3d'
import { COULEUR_NON_AFFECTEE, COULEURS_SIA416, NOMS_SIA416, type CategorieSia416 } from '@/lib/plans/sia416'
import type { Cible, Scene3D } from './scene3d'

/**
 * La vue 3D de l'espace Métrés : le bâtiment monté des formes validées du
 * jeu de plans (lib/plans/maquette3d.ts). Aucune IA n'y intervient : les
 * murs sont l'emprise moins les pièces, les portes et les fenêtres percent à
 * leur repère, chaque plan d'étage monte à son niveau.
 *
 * three.js ne se charge qu'à l'ouverture de la vue (scene3d.ts). On tourne
 * autour, on zoome, on ne garde que les niveaux jusqu'à un étage pour voir
 * dedans. Les couleurs suivent la catégorie SIA 416 des pièces, ou le code
 * CFC de l'ouvrage du diagnostic que l'élément mesure ; le survol dit ce
 * qu'est l'élément, et un clic l'ouvre sur son plan.
 */

/** Un ouvrage du diagnostic, tel que la vue en a besoin pour dire le CFC d'un élément. */
export interface OuvrageCfc {
  id: string
  articleId: string | null
  cfcCode: string | null
  libelle: string
}

type Couleurs = 'sia' | 'cfc'

const PALETTE = ['#0167EA', '#d99a4e', '#8b5cf6', '#0d9488', '#b45309', '#e11d48', '#10b981', '#64748b', '#f59e0b', '#7c3aed']
const MUR = '#f3f5f9'
const DALLE = '#dfe4ec'
const BOIS = '#b98a56'
const VERRE = '#8bb8f0'
const NEUTRE = '#e6eaf0'

/** Une couleur éclaircie, mêlée de blanc dans la proportion `blanc`. */
function nuance(hex: string, blanc: number) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return `#${c.map((x) => Math.round(x + (255 - x) * blanc).toString(16).padStart(2, '0')).join('')}`
}

const surface = (v: number) => `${v.toLocaleString('fr-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²`

export function Maquette3DVue({ maquette, ouvrages, onVoir }: {
  maquette: Maquette3D
  ouvrages: OuvrageCfc[]
  /** Ouvre une forme sur son plan : la pièce ou le repère touché. */
  onVoir: (planId: string, page: number, id: string) => void
}) {
  const hote = useRef<HTMLDivElement>(null)
  const scene = useRef<Scene3D | null>(null)
  const dejaMontee = useRef(false)
  const [etat, setEtat] = useState<'chargement' | 'prete' | 'impossible'>('chargement')
  const [couleurs, setCouleurs] = useState<Couleurs>('sia')
  const [jusqua, setJusqua] = useState<number | null>(null)
  const [survol, setSurvol] = useState<{ cible: Cible; x: number; y: number } | null>(null)

  // Le CFC d'un élément : l'ouvrage que la pièce mesure, ou celui des articles de la catégorie comptée.
  const cfcDe = useMemo(() => {
    const parId = new Map(ouvrages.map((o) => [o.id, o]))
    return (c: Cible): { code: string; libelle: string } | null => {
      let o: OuvrageCfc | undefined
      if (c.nature === 'piece' && c.piece.itemId) o = parId.get(c.piece.itemId)
      if (c.nature === 'ouverture') {
        const articles = CATEGORIE[c.ouverture.categorie].articles
        o = ouvrages.find((x) => x.articleId && articles.includes(x.articleId))
      }
      return o?.cfcCode ? { code: o.cfcCode, libelle: o.libelle } : null
    }
  }, [ouvrages])

  // Les codes CFC présents dans la maquette, chacun avec sa couleur.
  const codes = useMemo(() => {
    const vus = new Map<string, string>()
    for (const n of maquette.niveaux) {
      for (const piece of n.feuille.pieces) {
        const c = cfcDe({ nature: 'piece', niveau: n, piece })
        if (c) vus.set(c.code, c.libelle)
      }
      for (const ouverture of n.feuille.ouvertures) {
        const c = cfcDe({ nature: 'ouverture', niveau: n, ouverture })
        if (c) vus.set(c.code, c.libelle)
      }
    }
    return [...vus].sort((a, b) => a[0].localeCompare(b[0], 'fr', { numeric: true }))
      .map(([code, libelle], i) => ({ code, libelle, couleur: PALETTE[i % PALETTE.length] }))
  }, [maquette, cfcDe])

  const teinte = useMemo(() => (c: Cible): string => {
    if (c.nature === 'murs') return MUR
    if (c.nature === 'dalle') return DALLE
    if (couleurs === 'cfc') {
      const cfc = cfcDe(c)
      const couleur = cfc ? codes.find((x) => x.code === cfc.code)?.couleur : null
      if (c.nature === 'piece') return couleur ? nuance(couleur, 0.55) : NEUTRE
      return couleur ?? NEUTRE
    }
    if (c.nature === 'piece') return nuance(c.piece.sia ? COULEURS_SIA416[c.piece.sia] : COULEUR_NON_AFFECTEE, 0.7)
    return c.ouverture.porte ? BOIS : VERRE
  }, [couleurs, cfcDe, codes])

  // La scène lit ses rappels ici : les changer ne la remonte pas.
  const rappels = useRef({ teinte, onVoir })
  useEffect(() => {
    rappels.current = { teinte, onVoir }
    scene.current?.recolorer()
  }, [teinte, onVoir])

  useEffect(() => {
    if (!maquette.niveaux.length) return
    let annule = false
    import('./scene3d').then(({ monterScene }) => {
      if (annule || !hote.current) return
      try {
        scene.current = monterScene(hote.current, maquette, {
          teinte: (c) => rappels.current.teinte(c),
          survol: (cible, x, y) => setSurvol(cible ? { cible, x, y } : null),
          clic: (c) => {
            const [planId, page] = c.niveau.feuille.cle.split('#')
            if (c.nature === 'piece') rappels.current.onVoir(planId, Number(page), c.piece.id)
            if (c.nature === 'ouverture') rappels.current.onVoir(planId, Number(page), c.ouverture.id)
          },
        }, { animer: !dejaMontee.current })
        dejaMontee.current = true
        setEtat('prete')
      } catch {
        setEtat('impossible')
      }
    }, () => setEtat('impossible'))
    return () => {
      annule = true
      scene.current?.detruire()
      scene.current = null
    }
  }, [maquette])

  useEffect(() => { scene.current?.couper(jusqua) }, [jusqua, etat])

  if (!maquette.niveaux.length) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="max-w-md text-center">
          <Box className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">Rien à monter en 3D pour l’instant</p>
          <p className="mt-1 text-sm text-muted-foreground">
            La maquette se monte des plans d’étage dont l’échelle est posée et dont les pièces ou l’emprise sont validées.
          </p>
          {maquette.ecartees.length > 0 && <Ecartees ecartees={maquette.ecartees} className="mt-3" />}
        </div>
      </div>
    )
  }

  const bouton = (actif: boolean) => cn('rounded-md px-2.5 py-1 text-xs font-medium transition-colors pointer-coarse:min-h-10',
    actif ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')
  // Les niveaux du bas vers le haut, sans doublon d'étage type.
  const rangs = maquette.niveaux.map((n) => ({ rang: n.rang, nom: n.nom }))

  return (
    <div className="relative h-full min-h-0 bg-gradient-to-b from-muted/20 to-muted/50">
      <div ref={hote} className="absolute inset-0" />
      {etat === 'chargement' && (
        <p className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Montage de la maquette…</p>
      )}
      {etat === 'impossible' && (
        <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
          Ce navigateur ne peut pas afficher la 3D (WebGL indisponible). Le plan et le tableau restent disponibles.
        </p>
      )}

      {/* Les couleurs et les niveaux montrés. */}
      <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-wrap items-start justify-between gap-2">
        <div className="pointer-events-auto flex rounded-lg bg-muted p-0.5 shadow-sm" role="group" aria-label="Couleurs">
          <button className={bouton(couleurs === 'sia')} aria-pressed={couleurs === 'sia'} onClick={() => setCouleurs('sia')}>SIA 416</button>
          <button className={bouton(couleurs === 'cfc')} aria-pressed={couleurs === 'cfc'} onClick={() => setCouleurs('cfc')}>CFC</button>
        </div>
        {rangs.length > 1 && (
          <div className="pointer-events-auto flex max-w-full flex-wrap rounded-lg bg-muted p-0.5 shadow-sm" role="group" aria-label="Niveaux montrés">
            <button className={bouton(jusqua == null)} aria-pressed={jusqua == null} onClick={() => setJusqua(null)}>Tout</button>
            {rangs.map((n) => (
              <button key={n.rang} className={bouton(jusqua === n.rang)} aria-pressed={jusqua === n.rang} onClick={() => setJusqua(n.rang)} title={`Jusqu’au ${n.nom}`}>
                {n.nom}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* La légende des couleurs, et ce qui n'a pas pu monter. */}
      <div className="pointer-events-none absolute bottom-3 left-3 max-w-[min(26rem,calc(100%-6rem))] space-y-2">
        <div className="pointer-events-auto rounded-lg border bg-background/95 p-2.5 text-xs shadow-sm">
          {couleurs === 'sia' ? (
            <ul className="space-y-1">
              {(Object.keys(NOMS_SIA416) as CategorieSia416[]).map((c) => (
                <li key={c} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: nuance(COULEURS_SIA416[c], 0.45) }} />
                  <span className="font-medium">{c}</span><span className="truncate text-muted-foreground">{NOMS_SIA416[c]}</span>
                </li>
              ))}
            </ul>
          ) : codes.length ? (
            <ul className="space-y-1">
              {codes.map((c) => (
                <li key={c.code} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: c.couleur }} />
                  <span className="font-medium">CFC {c.code}</span><span className="truncate text-muted-foreground">{c.libelle}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">Aucun élément n’est encore relié à un ouvrage du diagnostic.</p>
          )}
          <p className="mt-2 border-t pt-2 text-[11px] text-muted-foreground">Montée des formes validées : murs déduits de l’emprise et des pièces, ouvertures à leur repère.</p>
        </div>
        {maquette.ecartees.length > 0 && <Ecartees ecartees={maquette.ecartees} className="pointer-events-auto" />}
      </div>

      <button
        onClick={() => scene.current?.recadrer()}
        className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg border bg-background px-2.5 py-1.5 text-xs font-medium shadow-sm transition-colors hover:bg-muted pointer-coarse:min-h-11"
        title="Revenir à la vue d’ensemble"
      >
        <RotateCcw className="h-3.5 w-3.5" />Recadrer
      </button>

      {survol && <Infobulle cible={survol.cible} x={survol.x} y={survol.y} cfc={cfcDe(survol.cible)} />}
    </div>
  )
}

function Infobulle({ cible: c, x, y, cfc }: { cible: Cible; x: number; y: number; cfc: { code: string; libelle: string } | null }) {
  const titre = c.nature === 'piece' ? c.piece.nom : c.nature === 'ouverture' ? c.ouverture.nom : c.nature === 'murs' ? 'Murs' : 'Dalle'
  const lignes: string[] = []
  if (c.nature === 'piece') {
    lignes.push(surface(c.piece.surface))
    lignes.push(c.piece.sia ? `${c.piece.sia} · ${NOMS_SIA416[c.piece.sia]}` : 'Catégorie SIA 416 à choisir')
  }
  if (c.nature === 'murs') lignes.push(`Hauteur d’étage ${c.niveau.feuille.hauteur.toLocaleString('fr-CH')} m`)
  const ouvrable = c.nature === 'piece' || c.nature === 'ouverture'
  return (
    <div
      className="pointer-events-none absolute z-10 w-max max-w-64 -translate-x-1/2 -translate-y-[calc(100%+14px)] rounded-lg border bg-background px-3 py-2 text-xs shadow-lg"
      style={{ left: x, top: y }}
    >
      <p className="font-semibold">{titre} <span className="font-normal text-muted-foreground">· {c.niveau.nom}</span></p>
      {lignes.map((l) => <p key={l} className="text-muted-foreground">{l}</p>)}
      {cfc && <p className="mt-0.5"><span className="font-semibold">CFC {cfc.code}</span> <span className="text-muted-foreground">{cfc.libelle}</span></p>}
      {ouvrable && <p className="mt-1 text-[11px] text-muted-foreground">Cliquer pour l’ouvrir sur son plan</p>}
    </div>
  )
}

function Ecartees({ ecartees, className }: { ecartees: Maquette3D['ecartees']; className?: string }) {
  return (
    <p className={cn('rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900', className)}>
      Pas montées : {ecartees.map((e) => `${e.nom} (${e.raison})`).join(', ')}.
    </p>
  )
}
