import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense, useEffect, type ComponentType } from 'react'
import { Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { setMarketInfo } from '@/lib/diagnostic-auto'
import { AppLayout } from '@/components/layout/AppLayout'
import { useIsMobile } from '@/lib/use-mobile'
import { ProtectedRoute } from '@/components/ProtectedRoute'
// Entrée : chargée immédiatement pour un premier affichage rapide.
import { Soon } from '@/pages/marketing/Soon'
import { Login } from '@/pages/auth/Login'
import { OAuthCallback } from '@/pages/auth/OAuthCallback'

// Pages chargées à la demande (code-splitting) -> bundle initial léger, meilleur en 3G.
const named = <M extends Record<string, unknown>, K extends keyof M>(p: Promise<M>, k: K) =>
  p.then((m) => ({ default: m[k] as ComponentType }))

const Register = lazy(() => named(import('@/pages/auth/Register'), 'Register'))
const ForgotPassword = lazy(() => named(import('@/pages/auth/ForgotPassword'), 'ForgotPassword'))
const ResetPassword = lazy(() => named(import('@/pages/auth/ResetPassword'), 'ResetPassword'))
const Onboarding = lazy(() => named(import('@/pages/auth/Onboarding'), 'Onboarding'))
const Payment = lazy(() => named(import('@/pages/auth/Payment'), 'Payment'))
const Dashboard = lazy(() => named(import('@/pages/app/Dashboard'), 'Dashboard'))
const ProjectsList = lazy(() => named(import('@/pages/app/ProjectsList'), 'ProjectsList'))
const ProjectNew = lazy(() => named(import('@/pages/app/ProjectNew'), 'ProjectNew'))
const ProjectDetail = lazy(() => named(import('@/pages/app/ProjectDetail'), 'ProjectDetail'))
const ProjectEdit = lazy(() => named(import('@/pages/app/ProjectEdit'), 'ProjectEdit'))
const ProjectDiagnostic = lazy(() => named(import('@/pages/app/ProjectDiagnostic'), 'ProjectDiagnostic'))
const ProjectMetres = lazy(() => named(import('@/pages/app/ProjectMetres'), 'ProjectMetres'))
const ProjectPlans = lazy(() => named(import('@/pages/app/ProjectPlans'), 'ProjectPlans'))
const ProjectRapports = lazy(() => named(import('@/pages/app/ProjectRapports'), 'ProjectRapports'))
const ProjectCECB = lazy(() => named(import('@/pages/app/ProjectCECB'), 'ProjectCECB'))
const ProjectPlanning = lazy(() => named(import('@/pages/app/ProjectPlanning'), 'ProjectPlanning'))
const DiagnosticDetail = lazy(() => named(import('@/pages/app/DiagnosticDetail'), 'DiagnosticDetail'))
const DiagnosticItemDetail = lazy(() => named(import('@/pages/app/DiagnosticItemDetail'), 'DiagnosticItemDetail'))
const PlansList = lazy(() => named(import('@/pages/app/PlansList'), 'PlansList'))
const PlanViewer = lazy(() => named(import('@/pages/app/PlanViewer'), 'PlanViewer'))
const ReportDetail = lazy(() => named(import('@/pages/app/ReportDetail'), 'ReportDetail'))
const BuildingsList = lazy(() => named(import('@/pages/app/BuildingsList'), 'BuildingsList'))
const BuildingNew = lazy(() => named(import('@/pages/app/BuildingNew'), 'BuildingNew'))
const BuildingDetail = lazy(() => named(import('@/pages/app/BuildingDetail'), 'BuildingDetail'))
const ApartmentNew = lazy(() => named(import('@/pages/app/ApartmentNew'), 'ApartmentNew'))
const ApartmentDetail = lazy(() => named(import('@/pages/app/ApartmentDetail'), 'ApartmentDetail'))
const TenderDetail = lazy(() => named(import('@/pages/app/TenderDetail'), 'TenderDetail'))
const CFCManager = lazy(() => named(import('@/pages/app/CFCManager'), 'CFCManager'))
const PlanningPage = lazy(() => named(import('@/pages/app/PlanningPage'), 'PlanningPage'))
const SettingsPage = lazy(() => named(import('@/pages/app/SettingsPage'), 'SettingsPage'))
const Integrations = lazy(() => named(import('@/pages/app/Integrations'), 'Integrations'))
const TeamManagement = lazy(() => named(import('@/pages/app/TeamManagement'), 'TeamManagement'))
const JoinOrg = lazy(() => named(import('@/pages/app/JoinOrg'), 'JoinOrg'))
const Support = lazy(() => named(import('@/pages/app/Support'), 'Support'))
const SupportTicket = lazy(() => named(import('@/pages/app/SupportTicket'), 'SupportTicket'))
const NewSupportRequest = lazy(() => named(import('@/pages/app/NewSupportRequest'), 'NewSupportRequest'))
const PublicReport = lazy(() => named(import('@/pages/PublicReport'), 'PublicReport'))
const DashboardPreview = lazy(() => named(import('@/pages/DashboardPreview'), 'DashboardPreview'))

// Arrivée : liste des diagnostics sur mobile (app épurée), tableau de bord sur desktop.
function HomeRedirect() {
  const mobile = useIsMobile()
  return <Navigate to={mobile ? '/app/projects' : '/app/dashboard'} replace />
}

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-32 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  )
}

function App() {
  // Indexe les prix du catalogue sur le marché suisse (indice OFS) au démarrage.
  useEffect(() => {
    api.market.index().then(setMarketInfo).catch(() => {})
  }, [])

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public : page « bientôt disponible » (l'app reste accessible via /login) */}
          <Route path="/" element={<Soon />} />
          <Route path="/tarifs" element={<Navigate to="/" replace />} />

          {/* Raccourci : /dashboard -> app (redirige vers /login si non connecté) */}
          <Route path="/dashboard" element={<Navigate to="/app/dashboard" replace />} />

          {/* Auth */}
          {/* Rapport client public (lecture seule, sans auth) */}
          <Route path="/share/:token" element={<PublicReport />} />

          {/* Vitrine design (mockup, sans auth) */}
          <Route path="/preview" element={<DashboardPreview />} />

          <Route path="/login" element={<Login />} />
          <Route path="/oauth-callback" element={<OAuthCallback />} />
          <Route path="/register" element={<Register />} />
          <Route path="/register/payment" element={<Payment />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
          <Route path="/onboarding" element={<Onboarding />} />

          {/* App (protégée par auth) */}
          <Route path="/app" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route index element={<HomeRedirect />} />
            <Route path="dashboard" element={<Dashboard />} />

            {/* Projects */}
            <Route path="projects" element={<ProjectsList />} />
            <Route path="projects/new" element={<ProjectNew />} />
            <Route path="projects/:id" element={<ProjectDetail />} />
            <Route path="projects/:id/edit" element={<ProjectEdit />} />
            <Route path="projects/:id/diagnostic" element={<ProjectDiagnostic />} />
            <Route path="projects/:id/couts" element={<ProjectMetres />} />
            <Route path="projects/:id/variantes" element={<ProjectRapports />} />
            <Route path="projects/:id/plans" element={<ProjectPlans />} />
            <Route path="projects/:id/rapports" element={<ProjectRapports />} />
            <Route path="projects/:id/cecb" element={<ProjectCECB />} />
            <Route path="projects/:id/calendrier" element={<ProjectPlanning />} />

            {/* Diagnostic editor */}
            <Route path="diagnostic/:id" element={<DiagnosticDetail />} />
            <Route path="diagnostic/:id/item/:itemId" element={<DiagnosticItemDetail />} />

            {/* Plans */}
            <Route path="plans" element={<PlansList />} />
            <Route path="plans/:id" element={<PlanViewer />} />

            {/* Reports */}
            <Route path="reports/:id" element={<ReportDetail />} />

            {/* Buildings */}
            <Route path="buildings" element={<BuildingsList />} />
            <Route path="buildings/new" element={<BuildingNew />} />
            <Route path="buildings/:id" element={<BuildingDetail />} />
            <Route path="buildings/:id/apartments/new" element={<ApartmentNew />} />
            <Route path="buildings/:id/apartments/:aptId" element={<ApartmentDetail />} />

            {/* Tenders */}
            <Route path="tenders/:id" element={<TenderDetail />} />

            {/* Global tools */}
            <Route path="cfc" element={<CFCManager />} />
            <Route path="planning" element={<PlanningPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="integrations" element={<Integrations />} />
            <Route path="team" element={<TeamManagement />} />
            <Route path="join/:token" element={<JoinOrg />} />
            <Route path="support" element={<Support />} />
            <Route path="support/new" element={<NewSupportRequest />} />
            <Route path="support/:id" element={<SupportTicket />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
