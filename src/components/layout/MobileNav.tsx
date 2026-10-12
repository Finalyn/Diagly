import { useEffect, useRef, useSyncExternalStore } from 'react'
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ClipboardCheck, MessageCircle, Settings, Database, LayoutGrid, ChevronLeft } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { estAppNative, estIOS } from '@/lib/plateforme'
import { useIsMobile } from '@/lib/use-mobile'
import { BarreOnglets, type BoutonNatif } from '@/lib/barre-native'

/** Un bouton de la barre : sa cible, son icône web et son symbole iOS (SF Symbols). */
interface Entree {
  id: string
  to: string | null
  label: string
  icone: LucideIcon
  symbole: string
  actif: boolean
}

/** La classe `releve-ouvert` sur <html> (posée par l'éditeur, voir index.css). */
function useReleveOuvert(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const o = new MutationObserver(cb)
      o.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
      return () => o.disconnect()
    },
    () => document.documentElement.classList.contains('releve-ouvert'),
    () => false,
  )
}

/**
 * Barre de navigation mobile « liquid glass » (réf. iOS 26).
 *
 * Hors d'un dossier, la pilule porte la navigation de l'app (Diagnostics · Base
 * de données · Paramètres), centrée. Dans un dossier, elle devient celle du
 * dossier : le relevé, et « Dossier » qui ouvre le sommaire avec tout le reste. Le bouton d'accès au reste était en haut de
 * l'éditeur, loin du pouce ; il est maintenant là où l'on navigue déjà.
 *
 * L'assistant garde son bouton rond détaché à droite. Dans un dossier, un
 * bouton rond à gauche ramène à la liste des diagnostics.
 *
 * Dans l'app iPhone, la barre est dessinée par iOS (lib/barre-native.ts) : le
 * vrai Liquid Glass d'iOS 26, que le CSS ne fait qu'imiter. Ce composant la
 * décrit, la met à jour à chaque page et suit ses touchers ; il n'affiche rien.
 */
export function MobileNav() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const releveOuvert = useReleveOuvert()
  // Le dossier en cours : par l'adresse, ou par le diagnostic ouvert dans l'éditeur
  // (même clé de cache que l'éditeur, qui l'a déjà chargé).
  const parAdresse = pathname.match(/^\/app\/projects\/([^/]+)\/(sommaire|fiche|visite|photos|couts|cecb|rapports|diagnostic)$/)?.[1]
  const diagnosticId = pathname.match(/^\/app\/diagnostic\/([^/]+)$/)?.[1]
  const diagQ = useQuery({ queryKey: ['diagnostic', diagnosticId], queryFn: () => api.diagnostics.get(diagnosticId!), enabled: !!diagnosticId })
  const projectId = parAdresse ?? diagQ.data?.diagnostic.projectId
  const dansUnDossier = !!(projectId || diagnosticId)

  // ----- Ce que porte la barre -----
  const base = projectId ? `/app/projects/${projectId}` : null
  const actifSi = (to: string) => pathname === to || pathname.startsWith(`${to}/`)
  const assistant: Entree = { id: 'assistant', to: '/app/assistant', label: 'Assistant IA', icone: MessageCircle, symbole: 'message', actif: actifSi('/app/assistant') }
  const retour: Entree | null = dansUnDossier
    ? { id: 'retour', to: '/app/projects', label: 'Tous les diagnostics', icone: ChevronLeft, symbole: 'chevron.left', actif: false }
    : null
  // Deux onglets seulement dans un dossier : le relevé, et le dossier (sommaire avec tout le reste).
  const centre: Entree[] = dansUnDossier
    ? [
        { id: 'releve', to: base && `${base}/diagnostic`, label: 'Relevé', icone: ClipboardCheck, symbole: 'checklist', actif: !!diagnosticId || pathname.endsWith('/diagnostic') },
        { id: 'dossier', to: base && `${base}/sommaire`, label: 'Dossier', icone: LayoutGrid, symbole: 'square.grid.2x2', actif: /\/(sommaire|fiche|visite|photos|couts|cecb|rapports)$/.test(pathname) },
      ]
    : [
        { id: 'diagnostics', to: '/app/projects', label: 'Diagnostics', icone: ClipboardCheck, symbole: 'checklist', actif: actifSi('/app/projects') },
        { id: 'base', to: '/app/cfc', label: 'Base de données', icone: Database, symbole: 'cylinder', actif: actifSi('/app/cfc') },
        { id: 'parametres', to: '/app/settings', label: 'Paramètres', icone: Settings, symbole: 'gearshape', actif: actifSi('/app/settings') },
      ]

  // ----- App iPhone : la barre native -----
  const natif = estAppNative && estIOS
  const cibles = useRef<Record<string, string | null>>({})
  const ciblesActuelles = JSON.stringify(Object.fromEntries([...centre, assistant, ...(retour ? [retour] : [])].map((e) => [e.id, e.to])))
  useEffect(() => { cibles.current = JSON.parse(ciblesActuelles) }, [ciblesActuelles])
  const versNatif = (e: Entree): BoutonNatif => ({ id: e.id, symbole: e.symbole, libelle: e.label })
  const description = JSON.stringify({
    gauche: retour && versNatif(retour),
    centre: centre.map(versNatif),
    droite: versNatif(assistant),
    actif: [...centre, assistant].find((e) => e.actif)?.id ?? null,
  })
  const visible = natif && isMobile && !releveOuvert

  useEffect(() => {
    if (!natif) return
    if (!visible) { void BarreOnglets.masquer().catch(() => undefined); return }
    const d = JSON.parse(description)
    void BarreOnglets.afficher({ gauche: d.gauche ?? undefined, centre: d.centre, droite: d.droite, actif: d.actif ?? undefined }).catch(() => undefined)
  }, [natif, visible, description])

  useEffect(() => {
    if (!natif) return
    const ecoute = BarreOnglets.addListener('toucher', ({ id }) => {
      const cible = cibles.current[id]
      if (cible) navigate(cible)
    })
    return () => {
      void ecoute.then((h) => h.remove())
      // La barre disparaît avec le composant (écran de saisie, déconnexion).
      void BarreOnglets.masquer().catch(() => undefined)
    }
  }, [natif, navigate])

  if (natif) return null

  // ----- Navigateur : la barre en HTML -----
  const icon = (Icon: LucideIcon, active: boolean) => (
    <>
      {active && <span className="absolute inset-0 rounded-full bg-[#DBEFFF]/80 shadow-[0_2px_10px_-2px_rgba(120,180,255,0.7)]" />}
      <Icon className={cn('relative h-[22px] w-[22px]', active ? 'text-primary' : 'text-neutral-700')} strokeWidth={active ? 2.2 : 1.8} />
    </>
  )
  const rond = 'liquid-nav pointer-events-auto flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full'
  const cls = 'relative z-10 flex h-11 w-11 items-center justify-center rounded-full transition-colors'

  const boutonAssistant = (
    <NavLink to="/app/assistant" aria-label="Assistant IA" className={rond}>
      {({ isActive }) => icon(MessageCircle, isActive)}
    </NavLink>
  )

  if (dansUnDossier) {
    return (
      <nav className="nav-dossier md:hidden fixed inset-x-0 bottom-0 z-40 pointer-events-none px-5 pb-[calc(env(safe-area-inset-bottom)+0.6rem)]">
        <div className="flex items-center gap-4">
          <Link to="/app/projects" aria-label="Tous les diagnostics" className={rond}>
            <ChevronLeft className="h-[22px] w-[22px] text-neutral-700" strokeWidth={1.8} />
          </Link>
          <div className="liquid-nav pointer-events-auto mx-auto flex items-center gap-3 overflow-hidden rounded-full px-3 py-1.5">
            {centre.map((o) => o.to
              ? <Link key={o.id} to={o.to} aria-label={o.label} aria-current={o.actif ? 'page' : undefined} className={cls}>{icon(o.icone, o.actif)}</Link>
              : <span key={o.id} aria-label={o.label} className={cn(cls, 'opacity-50')}>{icon(o.icone, false)}</span>)}
          </div>
          {boutonAssistant}
        </div>
      </nav>
    )
  }

  return (
    <nav className="md:hidden fixed inset-x-0 bottom-0 z-40 pointer-events-none px-5 pb-[calc(env(safe-area-inset-bottom)+0.6rem)]">
      <div className="flex items-center gap-4">
        {/* Navigation : les trois destinations de l'app mobile */}
        <div className="liquid-nav pointer-events-auto mx-auto flex items-center gap-3 overflow-hidden rounded-full px-3 py-1.5">
          {centre.map((o) => (
            <NavLink key={o.id} to={o.to!} aria-label={o.label} className={cls}>
              {({ isActive }) => icon(o.icone, isActive)}
            </NavLink>
          ))}
        </div>

        {/* Assistant IA : page dédiée, à portée du pouce droit */}
        {boutonAssistant}
      </div>
    </nav>
  )
}
