import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom'
import { lazy, Suspense, useEffect, type ComponentType } from 'react'
import { Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { setMarketInfo } from '@/lib/diagnostic-auto'
import { AppLayout } from '@/components/layout/AppLayout'
import { useIsMobile } from '@/lib/use-mobile'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { estAppNative } from '@/lib/plateforme'
import { masquerEcranDeLancement } from '@/lib/natif'
import { FiletDeSecurite } from '@/components/FiletDeSecurite'
import { rechargerUneFois } from '@/lib/rechargement'
// Entrée : chargée immédiatement pour un premier affichage rapide.
import { Soon } from '@/pages/marketing/Soon'
import { Login } from '@/pages/auth/Login'
import { OAuthCallback } from '@/pages/auth/OAuthCallback'

// Pages chargées à la demande (code-splitting) -> bundle initial léger, meilleur en 3G.
const named = <M extends Record<string, unknown>, K extends keyof M>(p: Promise<M>, k: K) =>
  p.then((m) => ({ default: m[k] as ComponentType })).catch((err) => rechargerUneFois(err))

const Register = lazy(() => named(import('@/pages/auth/Register'), 'Register'))
const ForgotPassword = lazy(() => named(import('@/pages/auth/ForgotPassword'), 'ForgotPassword'))
const ResetPassword = lazy(() => named(import('@/pages/auth/ResetPassword'), 'ResetPassword'))
const Onboarding = lazy(() => named(import('@/pages/auth/Onboarding'), 'Onboarding'))
const Payment = lazy(() => named(import('@/pages/auth/Payment'), 'Payment'))
const Dashboard = lazy(() => named(import('@/pages/app/Dashboard'), 'Dashboard'))
const ProjectsList = lazy(() => named(import('@/pages/app/ProjectsList'), 'ProjectsList'))
const ProjectNew = lazy(() => named(import('@/pages/app/ProjectNew'), 'ProjectNew'))
const ProjectDetail = lazy(() => named(import('@/pages/app/ProjectDetail'), 'ProjectDetail'))
const OuvertureDossier = lazy(() => named(import('@/pages/app/ProjectDetail'), 'OuvertureDossier'))
const ProjectEdit = lazy(() => named(import('@/pages/app/ProjectEdit'), 'ProjectEdit'))
const ProjectDiagnostic = lazy(() => named(import('@/pages/app/ProjectDiagnostic'), 'ProjectDiagnostic'))
const ProjectMetres = lazy(() => named(import('@/pages/app/ProjectMetres'), 'ProjectMetres'))
const ProjectPhotos = lazy(() => named(import('@/pages/app/ProjectPhotos'), 'ProjectPhotos'))
// La vitrine embarque Leaflet et ses captures : chargee a la demande, elle ne
// pese pas sur le paquet que tout utilisateur de l'application telecharge.
const Landing = lazy(() => named(import('@/pages/marketing/Landing'), 'Landing'))
const LandingV2 = lazy(() => named(import('@/pages/marketing/LandingV2'), 'LandingV2'))
const LandingV3 = lazy(() => named(import('@/pages/marketing/LandingV3'), 'LandingV3'))
const ProjectRapports = lazy(() => named(import('@/pages/app/ProjectRapports'), 'ProjectRapports'))
const ProjectVariantes = lazy(() => named(import('@/pages/app/ProjectVariantes'), 'ProjectVariantes'))
const ProjectCECB = lazy(() => named(import('@/pages/app/ProjectCECB'), 'ProjectCECB'))
const ProjectPlanning = lazy(() => named(import('@/pages/app/ProjectPlanning'), 'ProjectPlanning'))
const ProjectVisite = lazy(() => named(import('@/pages/app/ProjectVisite'), 'ProjectVisite'))
const DossierMobile = lazy(() => named(import('@/pages/app/DossierMobile'), 'DossierMobile'))
const AssistantPage = lazy(() => named(import('@/pages/app/AssistantPage'), 'AssistantPage'))
const DiagnosticDetail = lazy(() => named(import('@/pages/app/DiagnosticDetail'), 'DiagnosticDetail'))
const DiagnosticItemDetail = lazy(() => named(import('@/pages/app/DiagnosticItemDetail'), 'DiagnosticItemDetail'))
const Metres = lazy(() => named(import('@/pages/app/Metres'), 'Metres'))
const EspaceMetres = lazy(() => named(import('@/pages/app/EspaceMetres'), 'EspaceMetres'))
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
const Partenaires = lazy(() => named(import('@/pages/app/Partenaires'), 'Partenaires'))
const JoinOrg = lazy(() => named(import('@/pages/app/JoinOrg'), 'JoinOrg'))
const Support = lazy(() => named(import('@/pages/app/Support'), 'Support'))
const SupportTicket = lazy(() => named(import('@/pages/app/SupportTicket'), 'SupportTicket'))
const NewSupportRequest = lazy(() => named(import('@/pages/app/NewSupportRequest'), 'NewSupportRequest'))
const SupportArticle = lazy(() => named(import('@/pages/app/SupportArticle'), 'SupportArticle'))
const SupportTutoriel = lazy(() => named(import('@/pages/app/SupportTutoriel'), 'SupportTutoriel'))
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
  // App iPhone/iPad : l'écran de lancement s'efface quand le routeur est monté,
  // la page arrive juste derrière (le front est embarqué, rien à télécharger).
  useEffect(() => { requestAnimationFrame(() => masquerEcranDeLancement()) }, [])

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <FiletDeSecurite>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Racine : la vitrine est publiée. La page « bientôt disponible »
              garde son adresse, elle sert encore à fermer le site le temps
              d'une intervention sans toucher au routage. */}
          {/* L'app iPhone/iPad n'a pas de vitrine : elle s'ouvre sur le travail
              (ou sur la connexion, que ProtectedRoute impose au besoin). */}
          <Route path="/" element={estAppNative ? <Navigate to="/app" replace /> : <LandingV3 />} />
          <Route path="/bientot" element={<Soon />} />
          {/* Les deux versions précédentes restent accessibles le temps de la
              comparaison. Elles ne sont liées depuis nulle part. */}
          <Route path="/landing" element={<Landing />} />
          <Route path="/landing-2" element={<LandingV2 />} />
          <Route path="/landing-3" element={<Navigate to="/" replace />} />
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
          {/* Pas de paiement dans l'app : l'App Store l'interdit hors de ses achats intégrés. */}
          <Route path="/register/payment" element={estAppNative ? <Navigate to="/app" replace /> : <Payment />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
          <Route path="/onboarding" element={<Onboarding />} />

          {/* L'espace de travail des Métrés prend tout l'écran, comme un logiciel
              de métré : il a sa propre barre, et le téléphone y a sa version
              de lecture (voir EspaceMetres). */}
          <Route path="/app/metres/:projectId" element={<ProtectedRoute><EspaceMetres /></ProtectedRoute>} />

          {/* App (protégée par auth) */}
          <Route path="/app" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route index element={<HomeRedirect />} />
            <Route path="dashboard" element={<Dashboard />} />

            {/* Projects */}
            <Route path="projects" element={<ProjectsList />} />
            <Route path="projects/new" element={<ProjectNew />} />
            {/* Ouvrir un dossier mène au relevé (sur téléphone, la fiche bascule déjà vers l'éditeur). */}
            <Route path="projects/:id" element={<OuvertureDossier />} />
            <Route path="projects/:id/fiche" element={<ProjectDetail />} />
            <Route path="projects/:id/edit" element={<ProjectEdit />} />
            <Route path="projects/:id/diagnostic" element={<ProjectDiagnostic />} />
            <Route path="projects/:id/couts" element={<ProjectMetres />} />
            <Route path="projects/:id/variantes" element={<ProjectVariantes />} />
            <Route path="projects/:id/plans" element={<VersMetres />} />
            <Route path="projects/:id/photos" element={<ProjectPhotos />} />
            <Route path="projects/:id/rapports" element={<ProjectRapports />} />
            <Route path="projects/:id/cecb" element={<ProjectCECB />} />
            <Route path="projects/:id/calendrier" element={<ProjectPlanning />} />
            <Route path="projects/:id/visite" element={<ProjectVisite />} />
            {/* Le sommaire du dossier sur téléphone (sur ordinateur, la barre de gauche en tient lieu). */}
            <Route path="projects/:id/sommaire" element={<DossierMobile />} />

            {/* Assistant : page plein écran, le parcours mobile n'ouvre pas de fenêtre */}
            <Route path="assistant" element={<AssistantPage />} />

            {/* Diagnostic editor */}
            <Route path="diagnostic/:id" element={<DiagnosticDetail />} />
            <Route path="diagnostic/:id/item/:itemId" element={<DiagnosticItemDetail />} />

            {/* Métrés : déposer un jeu de plans, retrouver ses métrés. Les
                anciennes adresses des plans, restées « bientôt disponibles »,
                y mènent. */}
            <Route path="metres" element={<Metres />} />
            <Route path="plans" element={<Navigate to="/app/metres" replace />} />
            <Route path="plans/:id" element={<Navigate to="/app/metres" replace />} />

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
            <Route path="prestataires" element={<Partenaires />} />
            {/* L'équipe vit désormais dans les Paramètres ; l'ancienne adresse y mène. */}
            <Route path="team" element={<Navigate to="/app/settings?s=membres" replace />} />
            <Route path="join/:token" element={<JoinOrg />} />
            <Route path="support" element={<Support />} />
            <Route path="support/new" element={<NewSupportRequest />} />
            <Route path="support/doc/:slug" element={<SupportArticle />} />
            <Route path="support/tuto/:slug" element={<SupportTutoriel />} />
            <Route path="support/:id" element={<SupportTicket />} />
          </Route>
        </Routes>
      </Suspense>
      </FiletDeSecurite>
    </BrowserRouter>
  )
}

export default App

/**
 * L'outil Plan du dossier est devenu Métrés : les anciens liens (favoris,
 * notifications, mails) y mènent, avec l'état qu'ils transportaient.
 */
function VersMetres() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  return <Navigate to={`/app/metres/${id}`} replace state={location.state} />
}
