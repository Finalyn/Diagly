import { Outlet, useLocation, Navigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { DiagnosticTabs } from './DiagnosticTabs'
import { MobileNav } from './MobileNav'
import { OfflineIndicator } from '@/components/OfflineIndicator'
import { AssistantWidget } from '@/components/AssistantWidget'
import { useIsMobile } from '@/lib/use-mobile'
import { useEffect, useRef, useState } from 'react'

// Fond villa (dashboard uniquement) — fondu sur les bords gauche + bas, aucune ligne de coupure
const DASH_MASK = 'linear-gradient(to right, transparent 40%, #000 66%), linear-gradient(to bottom, #000 36%, transparent 52%)'

// Routes accessibles sur mobile (app épurée : liste, éditeur, base de données, paramètres).
// Tout le reste (dashboard, coûts, variantes, rapports, plans, parc, équipe, intégrations…)
// est réservé au desktop et redirigé vers la liste des diagnostics.
function isMobileAllowed(pathname: string): boolean {
  if (pathname === '/app' || pathname === '/app/projects' || pathname === '/app/projects/new') return true
  if (/^\/app\/projects\/[^/]+$/.test(pathname)) return true // fiche projet -> redirige vers l'éditeur
  if (pathname.startsWith('/app/diagnostic/')) return true    // éditeur de diagnostic + item
  if (pathname === '/app/cfc') return true                    // base de données
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
  // fleche de l'en-tete).
  const editeurPleinEcran =
    location.pathname.startsWith('/app/diagnostic/') || location.pathname === '/app/projects/new'
  const mainRef = useRef<HTMLDivElement>(null)
  const [assistantOpen, setAssistantOpen] = useState(false)
  const isMobile = useIsMobile()

  useEffect(() => {
    mainRef.current?.scrollTo(0, 0)
  }, [location.pathname])

  // Garde mobile : toute route hors du parcours mobile redirige vers la liste des diagnostics.
  if (isMobile && !isMobileAllowed(location.pathname)) {
    return <Navigate to="/app/projects" replace />
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-muted">
      {/* Colonne gauche : panneau unique (desktop) */}
      <div className="hidden lg:flex lg:flex-col gap-3 pl-3 py-3 w-[17.5rem] shrink-0">
        <Sidebar onOpenAssistant={() => setAssistantOpen(true)} />
      </div>

      {/* Zone principale */}
      <div className="relative flex flex-1 flex-col min-w-0 overflow-hidden p-3">
        {onDashboard && (
          <div
            className="pointer-events-none absolute inset-0 z-0 bg-no-repeat"
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
        <div className={`relative z-10 flex min-h-0 flex-1 flex-col ${onDashboard ? 'px-2 pt-1 sm:px-4 lg:px-8 lg:pt-4' : ''}`}>
          <TopBar />
          <OfflineIndicator />
          {diagProjectId && !isMobile && <DiagnosticTabs projectId={diagProjectId} />}
          <main
            ref={mainRef}
            className={`flex-1 overflow-y-auto overscroll-none lg:pb-16 ${editeurPleinEcran ? 'pb-6' : 'pb-24'} ${onDashboard ? 'mt-6 lg:mt-8' : 'mt-3'}`}
          >
            <Outlet />
          </main>
        </div>
      </div>

      {/* Navigation mobile épurée (masquée dans l'éditeur) */}
      {!editeurPleinEcran && (
        <MobileNav onToggleAssistant={() => setAssistantOpen((o) => !o)} assistantOpen={assistantOpen} />
      )}

      <AssistantWidget open={assistantOpen} onOpenChange={setAssistantOpen} />
    </div>
  )
}
