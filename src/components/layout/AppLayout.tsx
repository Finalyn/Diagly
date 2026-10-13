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
import { useMenuDeLaPage } from '@/stores/menu-lateral'
import { useEffect, useRef, useState } from 'react'

// Fond villa (tableau de bord uniquement), fondu vers la gauche et vers le bas.
// Le fondu se cale sur le cadre de l'image et non sur l'écran : calé sur
// l'écran, il finissait plus bas que l'image sur iPad, et l'image s'arrêtait
// net avant la fin du fondu.
const DASH_MASK = 'linear-gradient(to right, transparent 14%, #000 51%), linear-gradient(to bottom, #000 60%, transparent 100%)'

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
  // Les diagnostics aussi, liste et éditeur, sur toutes les plateformes : c'est
  // la liste qui défile, jamais la page.
  const pageEncastree = /^\/app\/projects\/[^/]+\/(diagnostic|rapports)$/.test(location.pathname)
    || location.pathname === '/app/integrations' || location.pathname === '/app/prestataires'
    || location.pathname === '/app/cfc' || location.pathname === '/app/projects'
    || /^\/app\/diagnostic\/[^/]+$/.test(location.pathname)
  const mainRef = useRef<HTMLDivElement>(null)
  const isMobile = useIsMobile()
  const menu = useMenuDeLaPage()
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
    // La marge de la barre d'état est portée par chaque colonne et non par
    // l'ensemble : la zone principale commence ainsi tout en haut de l'écran,
    // et l'image du tableau de bord monte sous la barre d'état au lieu de s'y
    // arrêter net.
    <div className="js-print-shell safe-sides flex h-dvh overflow-hidden bg-muted">
      {/* Colonne gauche : panneau unique (desktop) */}
      {/* Repliable (bouton de la barre du haut) ; replié d'office dans l'éditeur
          du relevé sur tablette, qui travaille un panneau à la fois. */}
      <div className={cn('js-print-hide hidden gap-3 pl-3 py-3 md:pt-[calc(var(--safe-top)+0.75rem)] w-[15rem] lg:w-[17.5rem] shrink-0', menu.visible && 'md:flex md:flex-col')}>
        {/* Dans un dossier, la barre de gauche devient la sienne. */}
        {diagProjectId && !isMobile ? <DossierSidebar projectId={diagProjectId} /> : <Sidebar />}
      </div>

      {/* Zone principale */}
      <div data-zone-principale className="js-print-column relative flex flex-1 flex-col min-w-0 overflow-hidden p-3 max-md:py-0 md:pt-[calc(var(--safe-top)+0.75rem)]">
        {onDashboard && (
          // Un cadre en haut à droite, sur 70 % de la largeur, depuis le haut de
          // l'écran jusque sous la carte « Reprendre » : le tableau de bord en
          // mesure le bas (--hauteur-image), pour que le fondu soit terminé
          // avant les cartes du dessous, sur iPad debout, couché ou grand écran.
          // « cover » remplit le cadre quelle que soit sa forme ; la villa
          // reste dans le cadre (position à 80 % de la largeur).
          <div
            className="js-print-hide pointer-events-none absolute right-0 top-0 z-0 h-[var(--hauteur-image,26rem)] w-[70%] bg-cover bg-no-repeat"
            style={{
              backgroundImage: 'url(/preview-bg.jpg)',
              backgroundPosition: '80% 20%',
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
                  // L'éditeur descend jusqu'en bas de l'écran, sous la barre du
                  // dossier : arrêté au-dessus, sa liste et sa fiche tombaient
                  // net sur une bande vide. Ce sont elles qui gardent la marge
                  // du bas (DiagnosticDetail).
                  ? 'min-h-0 overflow-hidden'
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
