import { Outlet, useLocation, Navigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { DossierSidebar } from './DossierSidebar'
import { DossierMobileBar } from './DossierMobileBar'
import { MobileNav } from './MobileNav'
import { OfflineIndicator } from '@/components/OfflineIndicator'
import { VisiteGuidee } from '@/components/visite/VisiteGuidee'
import { useVisiteAuto } from '@/components/visite/useVisiteAuto'
import { useIsMobile } from '@/lib/use-mobile'
import { cn } from '@/lib/utils'
import { useEffect, useRef, useState } from 'react'

// Fond villa (dashboard uniquement) — fondu sur les bords gauche + bas, aucune ligne de coupure
const DASH_MASK = 'linear-gradient(to right, transparent 40%, #000 66%), linear-gradient(to bottom, #000 36%, transparent 52%)'

// Routes accessibles sur mobile (app épurée : liste, éditeur, base de données, paramètres).
// Tout le reste (dashboard, coûts, variantes, rapports, plans, parc, équipe, intégrations…)
// est réservé au desktop et redirigé vers la liste des diagnostics.
function isMobileAllowed(pathname: string): boolean {
  if (pathname === '/app' || pathname === '/app/projects' || pathname === '/app/projects/new') return true
  if (/^\/app\/projects\/[^/]+$/.test(pathname)) return true // ouverture d'un dossier -> l'éditeur
  // Les outils du dossier qui tiennent sur un téléphone ; plans et variantes restent au bureau.
  if (/^\/app\/projects\/[^/]+\/(sommaire|fiche|visite|photos|couts|cecb|rapports|diagnostic)$/.test(pathname)) return true
  if (pathname.startsWith('/app/diagnostic/')) return true    // éditeur de diagnostic + item
  if (pathname === '/app/cfc') return true                    // base de données
  if (pathname === '/app/assistant') return true              // assistant, en page plein écran
  if (pathname.startsWith('/app/settings')) return true       // paramètres
  if (pathname.startsWith('/app/join/')) return true          // acceptation d'invitation
  return false
}

export function AppLayout() {
  const location = useLocation()
  const onDashboard = location.pathname === '/app/dashboard'
  const projMatch = location.pathname.match(/^\/app\/projects\/([^/]+)(?:\/|$)/)
  const diagProjectId = projMatch && projMatch[1] !== 'new' ? projMatch[1] : null
  // L'editeur de diagnostic est un ecran de saisie plein cadre : la barre du bas
  // recouvrait la liste du catalogue sans rien apporter (le retour se fait par la
  // fleche de l'en-tete). L'assistant suit la meme regle : sa zone de saisie est
  // en bas de page, la barre flottante serait posee dessus.
  const editeurPleinEcran =
    location.pathname.startsWith('/app/diagnostic/')
    || location.pathname === '/app/projects/new'
    || location.pathname === '/app/assistant'
  // L'onglet Diagnostic d'un projet ne porte plus que l'éditeur. Celui-ci remplit
  // la hauteur restante sous la barre d'onglets et defile a l'interieur de ses
  // colonnes : la page, elle, ne bouge pas.
  // Les rapports suivent la même règle : le document défile dans sa colonne,
  // contre ses boutons d'export, et non la page entière sous les panneaux. La
  // barre de défilement se tient ainsi au bord de la feuille, là où l'on
  // regarde, et non au bord de la fenêtre.
  // Intégrations aussi : le menu reste en place, seul le panneau de la section
  // défile.
  // La base de données aussi : son en-tête et ses filtres restent en place,
  // seules la liste des articles et l'arborescence défilent.
  const pageEncastree = /^\/app\/projects\/[^/]+\/(diagnostic|rapports)$/.test(location.pathname)
    || location.pathname === '/app/integrations' || location.pathname === '/app/prestataires'
    || location.pathname === '/app/cfc'
  const mainRef = useRef<HTMLDivElement>(null)
  const isMobile = useIsMobile()
  // Téléphone : l'éditeur du relevé ne défile pas d'un bloc, il défile dans ses
  // propres colonnes, au-dessus de la barre du dossier.
  const editeurMobile = isMobile && (
    /^\/app\/diagnostic\/[^/]+$/.test(location.pathname) || /^\/app\/projects\/[^/]+\/diagnostic$/.test(location.pathname)
  )
  // Téléphone : la liste des diagnostics. Le titre, la recherche et les filtres
  // restent en place ; seule la liste défile, jusque sous la barre du bas.
  const listeMobile = isMobile && location.pathname === '/app/projects'
  // Téléphone : la barre du haut est en verre, posée sur le contenu, qui glisse
  // dessous comme dans une app iOS. Sa hauteur varie (bandeau hors-ligne,
  // retour au dossier) : on la mesure pour que la page commence sous elle.
  const enteteRef = useRef<HTMLDivElement>(null)
  const [hauteurEntete, setHauteurEntete] = useState(0)
  useEffect(() => {
    const el = enteteRef.current
    if (!el || !isMobile) return
    const observer = new ResizeObserver(() => setHauteurEntete(el.offsetHeight))
    // border-box : la marge de la barre d'état est un padding, que la mesure par
    // défaut (content-box) ne voit pas changer.
    observer.observe(el, { box: 'border-box' })
    return () => observer.disconnect()
  }, [isMobile])

  useEffect(() => {
    mainRef.current?.scrollTo(0, 0)
  }, [location.pathname])

  // Les visites qui se proposent d'elles-mêmes, une fois chacune.
  useVisiteAuto(location.pathname, !isMobile)

  // Garde mobile : toute route hors du parcours mobile redirige vers la liste des diagnostics.
  if (isMobile && !isMobileAllowed(location.pathname)) {
    return <Navigate to="/app/projects" replace />
  }

  return (
    // Sur téléphone, la marge de la barre d'état passe dans la barre du haut,
    // pour que le verre monte jusqu'en haut de l'écran.
    <div className="js-print-shell safe-sides flex h-dvh overflow-hidden bg-muted md:pt-[var(--safe-top)]">
      {/* Colonne gauche : panneau unique (desktop) */}
      <div className="js-print-hide hidden md:flex md:flex-col gap-3 pl-3 py-3 w-[15rem] lg:w-[17.5rem] shrink-0">
        {/* Dans un dossier, la barre de gauche devient la sienne. */}
        {diagProjectId && !isMobile ? <DossierSidebar projectId={diagProjectId} /> : <Sidebar />}
      </div>

      {/* Zone principale */}
      <div className="js-print-column relative flex flex-1 flex-col min-w-0 overflow-hidden p-3 max-md:py-0">
        {onDashboard && (
          <div
            className="js-print-hide pointer-events-none absolute inset-0 z-0 bg-no-repeat"
            style={{
              backgroundImage: 'url(/preview-bg.jpg)',
              backgroundSize: '70%',
              backgroundPosition: '100% 0%',
              WebkitMaskImage: DASH_MASK,
              WebkitMaskComposite: 'source-in',
              maskImage: DASH_MASK,
              maskComposite: 'intersect',
            }}
          />
        )}
        <div className={`js-print-column relative z-10 flex min-h-0 flex-1 flex-col ${onDashboard ? 'px-2 pt-1 sm:px-4 lg:px-8 lg:pt-4' : ''}`}>
          <div
            ref={enteteRef}
            className={cn('js-print-hide',
              isMobile && 'barre-verre absolute inset-x-0 top-0 z-30 -mx-3 px-3 pb-2 pt-[calc(var(--safe-top)+0.5rem)]')}
          >
            <TopBar />
            <OfflineIndicator />
            {/* Téléphone : en tête d'un outil du dossier, le retour au sommaire. */}
            {isMobile && diagProjectId && /\/(fiche|visite|photos|couts|cecb|rapports)$/.test(location.pathname) && (
              <DossierMobileBar projectId={diagProjectId} />
            )}
          </div>
          {/* L'éditeur encastré se cale sur la hauteur restante et fait défiler ses
              propres colonnes : c'est ici que la zone cesse de défiler, sinon la page
              entière glisse sous les panneaux et le catalogue sort par le bas. */}
          <main
            ref={mainRef}
            style={isMobile ? { paddingTop: hauteurEntete + (editeurMobile ? 8 : 12) } : undefined}
            className={`js-print-main flex-1 overscroll-none ${
              isMobile
                // Téléphone : la page défile sous les deux barres en verre, et
                // s'arrête au-dessus de celle du bas, barre d'accueil de l'iPhone
                // comprise. L'éditeur, lui, ne défile pas d'un bloc.
                ? editeurMobile
                  // L'éditeur s'arrête au-dessus de la barre du dossier.
                  ? 'min-h-0 overflow-hidden pb-[calc(var(--safe-bottom)+4.75rem)]'
                  : listeMobile
                    // La liste descend jusqu'en bas de l'écran, sous la barre en
                    // verre ; c'est elle qui garde la marge du bas (ProjectsList).
                    ? 'min-h-0 overflow-hidden'
                    : `overflow-y-auto ${editeurPleinEcran ? 'pb-[calc(var(--safe-bottom)+1.5rem)]' : 'pb-[calc(var(--safe-bottom)+7rem)]'}`
                : `${onDashboard ? 'mt-6 lg:mt-8 short:mt-3' : 'mt-3'} ${
                  pageEncastree ? 'min-h-0 overflow-hidden pb-3' : onDashboard ? 'min-h-0 overflow-y-auto pb-6' : 'overflow-y-auto pb-16'}`
            }`}
          >
            <Outlet />
          </main>
        </div>
      </div>

      {/* Navigation mobile : masquée dans les écrans de saisie, sauf l'éditeur du
          relevé sur téléphone, où elle devient la barre du dossier (relevé,
          sommaire) : c'est par elle qu'on atteint le reste. */}
      {(!editeurPleinEcran || /^\/app\/diagnostic\/[^/]+$/.test(location.pathname)) && (
        <div className="js-print-hide">
          <MobileNav />
        </div>
      )}

      {/* La visite guidée traverse les écrans : elle est montée ici, une fois. */}
      <VisiteGuidee />

    </div>
  )
}
