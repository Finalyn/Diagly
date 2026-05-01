import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { Landing } from '@/pages/marketing/Landing'
import { Pricing } from '@/pages/marketing/Pricing'
import { Login } from '@/pages/auth/Login'
import { Register } from '@/pages/auth/Register'
import { ForgotPassword } from '@/pages/auth/ForgotPassword'
import { ResetPassword } from '@/pages/auth/ResetPassword'
import { Onboarding } from '@/pages/auth/Onboarding'
import { Payment } from '@/pages/auth/Payment'
import { Dashboard } from '@/pages/app/Dashboard'
import { ProjectsList } from '@/pages/app/ProjectsList'
import { ProjectNew } from '@/pages/app/ProjectNew'
import { ProjectDetail } from '@/pages/app/ProjectDetail'
import { ProjectEdit } from '@/pages/app/ProjectEdit'
import { ProjectDiagnostic } from '@/pages/app/ProjectDiagnostic'
import { ProjectMetres } from '@/pages/app/ProjectMetres'
import { ProjectPlans } from '@/pages/app/ProjectPlans'
import { ProjectRapports } from '@/pages/app/ProjectRapports'
import { ProjectCECB } from '@/pages/app/ProjectCECB'
import { ProjectPlanning } from '@/pages/app/ProjectPlanning'
import { DiagnosticDetail } from '@/pages/app/DiagnosticDetail'
import { DiagnosticItemDetail } from '@/pages/app/DiagnosticItemDetail'
import { PlansList } from '@/pages/app/PlansList'
import { PlanViewer } from '@/pages/app/PlanViewer'
import { ReportDetail } from '@/pages/app/ReportDetail'
import { BuildingsList } from '@/pages/app/BuildingsList'
import { BuildingNew } from '@/pages/app/BuildingNew'
import { BuildingDetail } from '@/pages/app/BuildingDetail'
import { ApartmentNew } from '@/pages/app/ApartmentNew'
import { ApartmentDetail } from '@/pages/app/ApartmentDetail'
import { TenderDetail } from '@/pages/app/TenderDetail'
import { CFCManager } from '@/pages/app/CFCManager'
import { PlanningPage } from '@/pages/app/PlanningPage'
import { SettingsPage } from '@/pages/app/SettingsPage'

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        {/* Marketing */}
        <Route path="/" element={<Landing />} />
        <Route path="/tarifs" element={<Pricing />} />

        {/* Auth */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/register/payment" element={<Payment />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/onboarding" element={<Onboarding />} />

        {/* App */}
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<Navigate to="/app/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />

          {/* Projects */}
          <Route path="projects" element={<ProjectsList />} />
          <Route path="projects/new" element={<ProjectNew />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="projects/:id/edit" element={<ProjectEdit />} />
          <Route path="projects/:id/diagnostic" element={<ProjectDiagnostic />} />
          <Route path="projects/:id/couts" element={<ProjectMetres />} />
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
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
