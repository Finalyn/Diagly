// Types partagés entre frontend et API. Doivent rester en phase avec server/prisma/schema.prisma.

export type UserRole = 'DT' | 'REGIE' | 'ARCHITECT' | 'PARTICULIER' | 'ADMIN'

export type BuildingType =
  | 'LOGEMENT' | 'VILLA' | 'CHALET' | 'SCOLAIRE' | 'BUREAU'
  | 'ADMINISTRATIF' | 'INDUSTRIEL' | 'HOTEL' | 'COMMERCIAL' | 'AUTRE'

export type RoofType = 'PLATE' | 'PENTE' | 'MIXTE'

export type ProjectStatus =
  | 'NON_PLANIFIE' | 'PLANIFIE' | 'EN_COURS' | 'EN_REVUE' | 'TERMINE' | 'ARCHIVE'

export type DiagnosticStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED'
export type ElementState = 'TRES_BON' | 'BON' | 'MOYEN' | 'MAUVAIS'
export type Priority = 'I' | 'II' | 'III'
export type AggregationMode = 'TOTAL' | 'PER_BUILDING'

export interface ApiOperation {
  id: string
  ownerId: string
  name: string
  clientName: string | null
  aggregationMode: AggregationMode
  status: ProjectStatus
  createdAt: string
  updatedAt: string
  _count?: { projects: number }
}

export interface ApiUser {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  role: UserRole
  companyName: string | null
  phone: string | null
  twoFactorEnabled?: boolean
  preferences?: UserPreferences
  createdAt: string
  updatedAt: string
}

export interface UserPreferences {
  company?: { name?: string; address?: string; postalCode?: string; city?: string; canton?: string; vatNumber?: string; iban?: string; logo?: string; accentColor?: string }
  defaults?: { honoraryPct?: number; reservePct?: number; vatPct?: number; unit?: 'm' | 'cm' | 'mm' }
  notifications?: { emailDiagnostic?: boolean; calendarReminders?: boolean; weeklyDigest?: boolean; priorityAlerts?: boolean }
  /** Modèles d'export enregistrés (mapping de colonnes) + modèle par défaut. */
  exportTemplates?: ExportTemplate[]
  exportDefaultTemplateId?: string
}

// ---- Export structuré (mapping de colonnes) — miroir de server/src/lib/export-template.ts ----
export interface ExportColumn { key: string; label: string; active: boolean }
export interface ExportSheet { id: 'building' | 'items' | 'workplan'; title: string; columns: ExportColumn[] }
export interface ExportTemplate { id: string; name: string; sheets: ExportSheet[] }
export type ExportFormat = 'json' | 'csv' | 'xlsx'

// ---- Scénarios de rénovation — miroir de server/src/lib/diagnostic-export.ts ----
export interface ExportVariant {
  id: 'maintenance' | 'renovation' | 'energetique'
  name: string
  scope: string
  envelopes: string[]
  energyFocus: boolean
  ht: number; honoraires: number; reserve: number; sousTotal: number; tva: number; total: number
}
export interface DiagnosticExportPayload {
  meta: { generatedAt: string; author: string | null; diagnosticDate: string | null; baseYear: number; status: string | null }
  building: { name: string; egid: string | null; egrid: string | null; city: string; canton: string }
  costs: { htRepair: number; htImprovement: number; htNorms: number; ht: number; honoraryPct: number; reservePct: number; tvaPct: number; total: number; byPriority: { priority: string; total: number; count: number }[] }
  energy: { classEnvelope: string | null; classGlobal: string | null }
  variants: ExportVariant[]
  workPlan: { egid: string | null; cfcCode: string; label: string; interventionYear: number; amount: number; priority: string | null }[]
  items: unknown[]
}

export interface ApiProject {
  id: string
  ownerId: string
  operationId: string | null
  name: string
  address: string
  postalCode: string | null
  city: string
  canton: string
  parcelNumber: string | null
  buildingType: BuildingType
  roofType: RoofType | null
  yearBuilt: number | null
  renovationYear: number | null
  nbApartments: number | null
  nbFloors: number | null
  floorHeight: number | null
  nbStaircases: number | null
  floorArea: number | null
  builtArea: number | null
  facadeArea: number | null
  terrainArea: number | null
  perimeter: number | null
  windowPct: number
  honoraryPct: number
  reservePct: number
  status: ProjectStatus
  totalBudget: string | null
  // Données énergétiques importées d'un certificat
  sre: number | null
  energyConsumptionHeat: number | null
  energyConsumptionElec: number | null
  energyAgent: string | null
  energyClassEnvelope: string | null
  energyClassGlobal: string | null
  energyRefYear: number | null
  energySource: string | null
  energyCertDate: string | null
  energyData: CecbEnergyData | null
  // Enrichissement géographique (geo.admin)
  east: number | null
  north: number | null
  egid: string | null
  egrid: string | null
  geoSource: string | null
  geoFetchedAt: string | null
  /** Absent des listes (payload allégé), présent sur la fiche d'un diagnostic. */
  geoData?: GeoData | null
  shareToken?: string | null
  sharedAt?: string | null
  createdAt: string
  updatedAt: string
}

/** Mesures d'amélioration + méta stockées en JSON sur le bâtiment. */
export interface CecbEnergyData {
  measures?: { label: string; priority?: string }[]
  confidence?: 'high' | 'medium' | 'low' | null
  [k: string]: unknown
}

/** Contraintes & données géographiques publiques (geo.admin) attachées au bâtiment. */
export interface GeoData {
  parcelNumber?: string
  footprintArea?: number          // emprise au sol (m²)
  volume?: number                 // volume bâti GWR (m³)
  restrictions?: { theme: string; legend: string }[]  // toutes les restrictions légales RDPPF
  affectation?: string            // zone d'affectation harmonisée (fédéral, catégorie)
  affectationDetail?: string      // affectation précise cantonale (RDPPF/ÖREB)
  affectations?: string[]         // toutes les affectations légales de la parcelle
  noise?: string                  // degré de sensibilité au bruit (RDPPF)
  radonPct?: number               // probabilité radon (%)
  heritage?: { isos?: string; isosCategory?: string; unesco?: string; bln?: string }
  seismic?: string                // classe de sol sismique (SIA 261)
  hazardsMapUrl?: string          // lien carte des dangers naturels (geo.admin)
}

/** Résultat d'extraction d'un certificat énergétique (avant validation humaine). */
export interface CecbExtraction {
  isCertificate?: boolean
  sre?: number | null
  consumptionHeat?: number | null
  consumptionElec?: number | null
  energyAgent?: string | null
  classEnvelope?: string | null
  classGlobal?: string | null
  refYear?: number | null
  measures?: { label: string; priority?: string }[]
  confidence?: 'high' | 'medium' | 'low' | null
}

// ---- Partage client (lecture seule) ----
export interface CompanyBrand {
  name: string | null; address: string | null; postalCode: string | null
  city: string | null; canton: string | null; vatNumber: string | null
  logo: string | null; accentColor: string | null
}
export interface PublicReportProject {
  name: string; address: string; postalCode: string | null; city: string; canton: string
  parcelNumber: string | null; buildingType: BuildingType
  yearBuilt: number | null; renovationYear: number | null
  nbApartments: number | null; nbFloors: number | null
}
export interface PublicReportItem {
  id: string; cfcCode: string; cfcLabel: string; state: ElementState; priority: Priority
  works: string[]; estimatedCost: string | null; photos: string[]
}
export interface PublicReportCosts {
  ht: number; honoraires: number; reserve: number; sousTotal: number; tva: number; total: number
  byPriority: { p: Priority; total: number; count: number }[]
}
export interface PublicReport {
  project: PublicReportProject
  diagnostic: { visitDate: string | null; status: DiagnosticStatus } | null
  items: PublicReportItem[]
  costs: PublicReportCosts
  company: CompanyBrand | null
}

export interface ApiDiagnostic {
  id: string
  projectId: string
  visitDate: string | null
  status: DiagnosticStatus
  notes: string | null
  createdAt: string
  updatedAt: string
  _count?: { items: number }
}

export interface ApiDiagnosticItem {
  id: string
  diagnosticId: string
  cfcCode: string
  cfcLabel: string
  catalogItemId: number | null
  state: ElementState | null
  priority: Priority | null
  notes: string | null
  works: string[]
  photos: string[]
  area: number | null
  /** true = quantité reprise à la main : elle ne suit plus les corrections du dossier. */
  quantityManual?: boolean
  /** true = coût forcé à la main : il ne suit plus le catalogue. */
  costManual?: boolean
  unit: string | null
  yearInstalled: number | null
  /** Année d'intervention planifiée (plan de travaux). null = déduite de la priorité à l'export. */
  interventionYear: number | null
  estimatedCost: string | null
  // Enveloppes distinctes (null = non retenue)
  improvement: string | null
  improvementCost: string | null
  norms: string | null
  normsCost: string | null
  createdAt: string
  updatedAt: string
}

export interface ApiCatalogItem {
  id: number
  displayOrder: number
  category: string | null
  categoryCfc: string | null
  description: string
  cfcCode: string | null
  workTbe: string | null
  workBon: string | null
  workMoyen: string | null
  workMauvais: string | null
  workImprovement: string | null
  workNorms: string | null
  descTbe: string | null
  descBon: string | null
  descMoyen: string | null
  descMauvais: string | null
  unit: string | null
  quantityFormula: string | null
  priceTbe: string | null
  priceBon: string | null
  priceMoyen: string | null
  priceMauvais: string | null
  priceImprovement: string | null
  priceNorms: string | null
  scaffoldingNote: string | null
}

export interface ApiCfcEntry {
  code: string
  label: string
  level: number
  parentCode: string | null
  stateTbe: string | null
  stateBon: string | null
  stateMoyen: string | null
  stateMauvais: string | null
  improvement: string | null
  normsUpgrade: string | null
}

export interface PlanPoint { x: number; y: number }
export type PlanAnnotationType = 'measure' | 'arrow' | 'note' | 'hatch' | 'draw'
export interface PlanAnnotation {
  id: string
  type: PlanAnnotationType
  points: PlanPoint[]
  text?: string
  color?: string
}

export interface ApiPlan {
  id: string
  projectId: string
  name: string
  fileName: string
  /** Chemin signé du fichier (jeton d'accès à durée limitée), fourni par le serveur. */
  fileUrl: string
  mimeType: string
  size: number
  scalePxPerM: number | null
  annotations: PlanAnnotation[]
  createdAt: string
  updatedAt?: string
}

// ---- Atelier multi-plans (board) ----
export interface BoardLayer {
  id: string
  planId: string
  x: number
  y: number
  scale: number
  opacity: number
  tint?: string | null
}
export interface BoardData {
  layers?: BoardLayer[]
  annotations?: PlanAnnotation[]
  bgColor?: string
  scalePxPerM?: number | null
}
export interface ApiBoard {
  id: string
  projectId: string
  name: string
  data: BoardData
  createdAt: string
  updatedAt: string
}

// ---- Calendrier ----
export type EventCategory = 'VISITE' | 'REUNION' | 'TRAVAUX' | 'ECHEANCE' | 'APPEL' | 'AUTRE'
export interface ApiEvent {
  id: string
  userId: string
  projectId: string | null
  title: string
  category: EventCategory
  color: string | null
  location: string | null
  notes: string | null
  allDay: boolean
  startAt: string
  endAt: string | null
  createdAt: string
  updatedAt: string
}

// ---- Guide IA terrain (analyse de photo) ----
export type GuideConfidence = 'high' | 'medium' | 'low'
export interface GuideAnalysis {
  element?: string
  cfc?: { code?: string; label?: string; confidence?: GuideConfidence; known?: boolean }
  matchesSelected?: boolean | null
  state?: ElementState
  stateReason?: string
  priority?: Priority
  note?: string
  needMorePhoto?: boolean
  morePhotoReason?: string
  confidence?: GuideConfidence
}

export interface RecentDiagnosticItem {
  id: string
  cfcCode: string
  cfcLabel: string
  state: ElementState
  priority: Priority
  estimatedCost: string | null
  updatedAt: string
  projectId: string
  projectName: string
}

// ---- Clés d'API (API REST publique v1) ----
export interface ApiKey {
  id: string
  name: string
  keyPrefix: string
  scopes: string[]
  lastUsedAt: string | null
  revokedAt: string | null
  createdAt: string
}
export interface ApiKeyCreated {
  id: string
  name: string
  keyPrefix: string
  /** Secret complet — affiché une seule fois, jamais restocké. */
  key: string
  createdAt: string
}

// ---- Webhooks ----
export type WebhookEventType = 'diagnostic.finalise' | 'rapport.genere' | 'element.modifie' | 'plan_travaux.mis_a_jour'
export interface WebhookEndpoint {
  id: string
  url: string
  secret: string
  events: string[]
  active: boolean
  description: string | null
  createdAt: string
  updatedAt: string
}
export interface WebhookDelivery {
  id: string
  endpointId: string
  eventType: string
  status: 'PENDING' | 'DELIVERED' | 'FAILED'
  attempts: number
  responseStatus: number | null
  error: string | null
  nextAttemptAt: string
  deliveredAt: string | null
  createdAt: string
}

// ---- Organisations / équipe ----
export type OrgRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'
export interface Organization {
  id: string; name: string; slug: string; ownerId: string
  createdAt: string; updatedAt: string; _count?: { members: number }
}
export interface OrgMember {
  id: string; email: string; firstName: string | null; lastName: string | null; orgRole: OrgRole | null
}
export interface OrgInvitation {
  id: string; email: string; role: OrgRole; expiresAt: string; createdAt: string; token: string
}

// ---- Support ----
export type SupportStatus = 'OPEN' | 'ANSWERED' | 'CLOSED'
export interface SupportMessage {
  id: string; authorName: string; isSupport: boolean; body: string; attachments: string[]; createdAt: string
}
export interface SupportTicket {
  id: string; subject: string; category: string | null; status: SupportStatus
  createdAt: string; updatedAt?: string
  messageCount?: number; lastMessage?: string; lastIsSupport?: boolean
}
export interface SupportTicketDetail {
  id: string; subject: string; category: string | null; status: SupportStatus
  email: string; createdAt: string; updatedAt: string; messages: SupportMessage[]
}

export interface AuthResponse {
  user: ApiUser
  accessToken: string
  refreshToken: string
}
