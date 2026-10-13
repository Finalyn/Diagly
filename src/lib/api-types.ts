import type { MarqueDuDossier } from './marque'
import type { BaseQuantite, EtatArticle, Unite } from './base-cfc/normaliser'

// Types partagés entre frontend et API. Doivent rester en phase avec server/prisma/schema.prisma.

import type { Localisation } from './localisation'

export type { Localisation }

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
  /** TOTP (application) ou EMAIL ; null sur un compte activé avant l'email (application). */
  twoFactorMethod?: 'TOTP' | 'EMAIL' | null
  preferences?: UserPreferences
  createdAt: string
  updatedAt: string
}

export interface UserPreferences {
  // `null` = champ explicitement vidé. `undefined` disparaîtrait de la requête JSON
  // et le serveur, qui fusionne, garderait l'ancienne valeur.
  company?: {
    name?: string; address?: string; postalCode?: string; city?: string; canton?: string
    vatNumber?: string; iban?: string; logo?: string | null; accentColor?: string
    /** Coordonnées : elles paraissent en tête du rapport partagé. */
    phone?: string; email?: string; web?: string
  }
  /** Coordonnées de facturation, quand elles diffèrent de celles de l'entreprise. */
  billing?: {
    memeAdresse?: boolean
    destinataire?: string; email?: string; reference?: string
    address?: string; postalCode?: string; city?: string; canton?: string
  }
  defaults?: { honoraryPct?: number; reservePct?: number; vatPct?: number; unit?: 'm' | 'cm' | 'mm' }
  notifications?: { emailDiagnostic?: boolean; calendarReminders?: boolean; weeklyDigest?: boolean; priorityAlerts?: boolean; relances?: boolean }
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
  /** Logements déjà rénovés : ils appellent moins de travaux. */
  renovatedApartments?: number | null
  /** Répartition par typologie, ex. { '2.5': 4, '3.5': 6 }. */
  apartmentTypes?: Record<string, number> | null
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
  /**
   * Apparence propre à ce dossier : logo, couleur, raison sociale, auteur.
   * null = celle des réglages. Un rapport se personnalise pour un client sans
   * changer les autres.
   */
  reportBranding?: MarqueDuDossier | null
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
  /** Coordonnées imprimées sous la raison sociale, sur le rapport partagé. */
  phone: string | null; email: string | null; web: string | null
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
  /**
   * Article de la base CFC v3, et étape de visite où il a été relevé.
   *
   * Les deux ensemble identifient le relevé : la peinture des murs relevée dans
   * la cage d'escalier et dans les appartements fait deux relevés indépendants.
   * null sur les relevés d'avant la bascule, et sur ceux dont l'article n'a pas
   * de repreneur dans la base v3 : ils restent visibles par leur catalogItemId.
   */
  articleId?: string | null
  etapeNumero?: number | null
  /** Communs / logements pour les ouvrages intérieurs ; null pour tous les autres. */
  localisation?: Localisation | null
  state: ElementState | null
  priority: Priority | null
  notes: string | null
  works: string[]
  photos: string[]
  area: number | null
  /** true = quantité reprise à la main : elle ne suit plus les corrections du dossier. */
  quantityManual?: boolean
  /**
   * Part de la surface du groupe qui revient à ce type, en pourcent.
   *
   * Une façade peut être en bardage sur 60 % et en crépi sur 40 % : chaque type
   * ne reçoit alors que sa part, au lieu de la façade entière. null = ouvrage
   * sans groupe, ou part pas encore répartie.
   */
  sharePct?: number | null
  /** true = coût forcé à la main : il ne suit plus le catalogue. */
  costManual?: boolean
  /** Coefficient marché appliqué au coût de cette ligne, pour pouvoir la réindexer. */
  costIndex?: number | null
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
  /**
   * Groupe de surface : les types alternatifs d'une même surface le partagent.
   * null = ouvrage non alternatif, qui prend sa quantité entière.
   */
  surfaceGroup?: string | null
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
/**
 * Ce qu'on pose sur un plan.
 *
 * `reference` n'est pas un tracé mais un calque : un autre plan du dossier,
 * posé en transparence par-dessus celui-ci pour comparer deux états. `pages`
 * n'en est pas un non plus : c'est l'échelle propre à chaque page d'un PDF.
 *
 * Les deux vivent avec les annotations parce qu'ils appartiennent au plan au même
 * titre qu'elles, et qu'un document stocké en un seul bloc JSON se relit d'une
 * pièce. Les composants qui dessinent doivent donc les ignorer explicitement.
 */
export type PlanAnnotationType = 'measure' | 'arrow' | 'note' | 'hatch' | 'draw' | 'reference' | 'pages'
export interface PlanAnnotation {
  id: string
  type: PlanAnnotationType
  points: PlanPoint[]
  /**
   * Page du PDF sur laquelle l'annotation est posée. Absent = la première, ce
   * qui garde leur place aux annotations tracées avant que les pages ne soient
   * distinguées.
   */
  page?: number
  text?: string
  color?: string
  /**
   * Ouvrage du diagnostic que cette zone (ou ce trait) mesure.
   *
   * Une surface relevée sur le plan vaut mieux qu'une surface déduite du
   * périmètre et du nombre d'étages : le lien permet de reporter la quantité
   * exacte sur l'ouvrage, au lieu de laisser la mesure s'arrêter à l'écran.
   */
  itemId?: string | null

  // ---- Calque de référence (type `reference`) ----
  /** Plan du dossier posé en transparence. `points[0]` donne son coin haut-gauche. */
  planId?: string
  /**
   * Page du plan de référence, quand c'est un PDF de plusieurs feuilles.
   * Distinct de `page`, qui dit sur quelle page du plan courant l'élément est posé.
   */
  planPage?: number
  /** Opacité du calque, de 0 à 1. */
  opacity?: number
  /** Facteur d'échelle du calque, pour recaler deux plans de tirages différents. */
  scale?: number
  /** Teinte appliquée au calque, pour le distinguer du plan du dessous. */
  tint?: string | null

  // ---- Échelles par page (type `pages`) ----
  /**
   * Pixels par mètre, page par page, pour un PDF dont les feuilles n'ont pas
   * toutes le même format. L'échelle du plan reste le repli pour les pages
   * absentes de cette table.
   */
  pageScales?: Record<string, number>
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
  /**
   * La photo ne permet pas d'évaluer l'élément : hors sujet, capture d'écran,
   * inexploitable, ou autre élément que le CFC choisi. Le serveur ne renvoie
   * alors aucun état ni aucune note. Absent des réponses d'un serveur plus ancien.
   */
  photoInutilisable?: boolean
  /** Ce qui cloche, en une phrase. */
  raisonInutilisable?: string | null
  /** Les photos en cause, numérotées à partir de 1 dans l'ordre où elles ont été envoyées. */
  photosAEcarter?: number[]
  state?: ElementState | null
  stateReason?: string | null
  priority?: Priority | null
  note?: string | null
  needMorePhoto?: boolean
  morePhotoReason?: string
  confidence?: GuideConfidence
}

// ---- Assistant : questions à choix ----
export interface OptionQuestionAssistant {
  libelle: string
  description: string
  /** Marquée « (recommandé) » par le modèle ; le serveur la place alors en premier. */
  recommande?: boolean
}

/**
 * Une question à choix posée par l'assistant (outil `poser_question`).
 * Le serveur l'a validée : 2 à 4 options aux libellés distincts, une étiquette
 * de 12 caractères au plus.
 */
export interface QuestionAssistant {
  question: string
  etiquette: string
  options: OptionQuestionAssistant[]
  choixMultiple: boolean
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

// ---- Démarrer un diagnostic depuis un fichier (lecture IA) ----
export interface BatimentLu {
  nom?: string | null; adresse?: string | null; npa?: string | null; localite?: string | null; canton?: string | null
  egid?: string | null; anneeConstruction?: number | null; anneeRenovation?: number | null
  type?: BuildingType | null; nbLogements?: number | null; nbEtages?: number | null; nbCages?: number | null
  surfacePlancher?: number | null; surfaceBatie?: number | null; surfaceTerrain?: number | null; perimetre?: number | null
}
/** Élément trouvé dans un document, rapproché (ou non) d'un article de la base. */
export interface ElementLu {
  source: string
  articleId: string | null
  etapeNumero: number | null
  etat: ElementState | null
  remarque: string | null
  annee: number | null
}
export interface LectureDocument {
  estUnBatiment: boolean
  batiment: BatimentLu
  elements: ElementLu[]
  resume: string | null
  confiance: 'high' | 'medium' | 'low' | null
}
export interface EnergieLue {
  sre?: number | null; consumptionHeat?: number | null; consumptionElec?: number | null; energyAgent?: string | null
  classEnvelope?: string | null; classGlobal?: string | null; refYear?: number | null; dateCertificat?: string | null
}
export interface MesureLue { label: string; priorite: string | null; articleId: string | null; etapeNumero: number | null }
export interface LectureCecb {
  estUnCertificat: boolean
  batiment: BatimentLu
  energie: EnergieLue
  mesures: MesureLue[]
  confiance: 'high' | 'medium' | 'low' | null
}

// ---- Organisation de la visite ----
export type VisitContactRole = 'GERANCE' | 'PROPRIETAIRE' | 'CONCIERGE' | 'LOCATAIRE' | 'ENTREPRISE' | 'AUTRE'
export interface VisitContact {
  id: string
  projectId: string
  role: VisitContactRole
  name: string
  company: string | null
  email: string | null
  phone: string | null
  /** Logement ou étage, pour un locataire. */
  unit: string | null
  notes: string | null
  createdAt: string
}
export interface VisitPlan {
  /** Rendez-vous (ISO). null = pas encore fixé. */
  startAt?: string | null
  durationMin?: number
  meetingPoint?: string | null
  /** Interlocuteur qui ouvre les locaux. */
  openerContactId?: string | null
  notes?: string | null
  /** Créneaux à proposer, avant que la date soit fixée. */
  creneaux?: { startAt: string }[]
  /** Préparation : clé d'élément → coché. */
  checklist?: Record<string, boolean>
  eventId?: string | null
}
export type VisitMailStatus = 'ENVOYE' | 'ECHEC' | 'MESSAGERIE'
export interface VisitMail {
  id: string
  template: string
  subject: string
  body: string
  recipients: { name: string; email: string }[]
  status: VisitMailStatus
  authorName: string
  createdAt: string
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

/// --- Variantes de projet ---

export interface ApiVariantLine {
  id: string
  variantId: string
  /** Ouvrage du diagnostic auquel la ligne se substitue. null = travail nouveau. */
  replacesItemId: string | null
  /** Article du catalogue retenu : il porte les prix par état, donc le calcul du montant. */
  catalogItemId: number | null
  /** État retenu dans la variante ; permet de passer un ouvrage de moyen à mauvais. */
  state: ElementState | null
  cfcCode: string
  label: string
  unit: string | null
  area: number | null
  /** Montant HT de la ligne, servi en texte comme tous les décimaux. */
  amount: string
  /** true = montant repris à la main, il ne suit plus le catalogue. */
  costManual: boolean
  note: string | null
  createdAt: string
  updatedAt: string
}

export interface ApiVariant {
  id: string
  projectId: string
  name: string
  description: string | null
  displayOrder: number
  lines: ApiVariantLine[]
  createdAt: string
  updatedAt: string
}

// ---------- Base CFC v3 ----------
//
// Le catalogue du bureau, commun a tous les diagnostiqueurs. Les prix arrivent
// en nombres, contrairement a l'ancien catalogue qui les envoyait en chaines.

export interface ApiArticleEtat {
  etat: EtatArticle
  travaux: string | null
  /** CHF HT par unite. Pour l'etat moyen, la part fixe du prix. */
  prix: number | null
  partPrixMauvais: number | null
  unite: Unite
}

export interface ApiArticleEtape {
  articleId: string
  etapeNumero: number
  /** Rang dans l'etape, qui suit le code CFC. */
  ordreDansEtape: number
}

export interface ApiArticle {
  id: string
  cfcCode: string
  nom: string
  /** Chapitre du rapport client. */
  domaineRapport: string
  groupeAlternatives: string | null
  echafaudage: boolean
  uniteEntretien: Unite
  uniteRemplacement: Unite
  baseQuantite: BaseQuantite
  indicationQuantite: string | null
  coefficient: number
  /** Consigne interne, jamais imprimee dans le rapport. */
  noteDiagnostiqueur: string | null
  articleLieId: string | null
  actif: boolean
  ligneOrigine: string | null
  etats: ApiArticleEtat[]
  etapes: ApiArticleEtape[]
}

export interface ApiEtapeVisite {
  numero: number
  nom: string
  zone: string
}

export interface ApiPosteAutomatique {
  cfcCode: string
  libelle: string
  declencheur: "toujours" | "echafaudage_facade" | "communs_mauvais"
  unite: Unite
  prix: number
  regleQuantite: "surface_echafaudee" | "par_cage_escalier" | "surface_plancher" | "forfait"
  remarque: string | null
}

export interface ApiBaseCfc {
  articles: ApiArticle[]
  etapes: ApiEtapeVisite[]
  postes: ApiPosteAutomatique[]
  count: number
}

export interface ApiNoeudCfc {
  code: string
  libelle: string
  niveau: number
  parentCode: string | null
}

/** Un article tel qu'on l'écrit : les états et les étapes en entier. */
export interface ApiArticleEcrit {
  cfcCode: string
  nom: string
  domaineRapport: string
  groupeAlternatives: string | null
  echafaudage: boolean
  uniteEntretien: Unite
  uniteRemplacement: Unite
  baseQuantite: BaseQuantite
  indicationQuantite: string | null
  coefficient: number
  noteDiagnostiqueur: string | null
  articleLieId?: string | null
  actif: boolean
  etats: ApiArticleEtat[]
  /** Numéros des étapes de visite, en cases à cochées. */
  etapes: number[]
}

/** Une modification d'article, telle que l'historique la rend. */
export interface ApiModificationArticle {
  id: string
  articleId: string
  champ: string
  ancienneValeur: string | null
  nouvelleValeur: string | null
  /** null = écrit par un import, pas par une personne. */
  auteur: string | null
  date: string
}

// ---------- Notifications ----------

export type TypeNotification = 'diagnostic_cree' | 'priorite_urgente' | 'rappel_visite' | 'resume_hebdo'

/** Une notification du centre : la trace durable, que la cloche affiche. */
export interface ApiNotification {
  id: string
  type: TypeNotification
  titre: string
  texte: string | null
  /** Où mène la notification quand on la touche. */
  url: string | null
  /** Regroupement : une seule notification par sujet. */
  cle: string | null
  lueLe: string | null
  creeLe: string
}

/** Ce que le serveur sait envoyer, indépendamment des réglages de la personne. */
export interface CanauxDisponibles {
  push: boolean
  email: boolean
}

// ---------------------------------------------------------------- partenaires

export type MetierPartenaire =
  | 'ARCHITECTE' | 'EXPERT_CECB' | 'INGENIEUR_CIVIL' | 'INGENIEUR_CVSE' | 'PHYSICIEN_BATIMENT'
  | 'CONSEIL_ENERGIE' | 'DIAGNOSTIC_POLLUANTS' | 'GEOMETRE' | 'ENTREPRISE_GENERALE' | 'AUTRE'

/**
 * Un partenaire de l'annuaire, tenu par Finalyn : un professionnel qu'on
 * contacte par Diagly (PRO), ou un outil qu'on rejoint par un lien (OUTIL).
 */
export interface Partenaire {
  id: string
  type: 'PRO' | 'OUTIL'
  nom: string
  contact: string | null
  metiers: MetierPartenaire[]
  cantons: string[]
  langues: string[]
  description: string | null
  /** Ce que fait un outil, en quelques mots. */
  categorie: string | null
  /** L'offre réservée aux utilisateurs de Diagly, et le lien qui la donne. */
  offre: string | null
  lienOffre: string | null
  /** Ouvertures de l'offre depuis Diagly. */
  clics: number
  email: string | null
  telephone: string | null
  siteWeb: string | null
  localite: string | null
  verifie: boolean
  certification: string | null
  actif: boolean
  createdAt: string
  updatedAt: string
  _count?: { demandes: number }
}

export type StatutDemande = 'ENVOYEE' | 'MESSAGERIE' | 'ECHEC' | 'EN_COURS' | 'TERMINEE'

/** Une mise en relation, telle que la suit celui qui l'a envoyée. */
export interface DemandePartenaire {
  id: string
  partnerId: string
  projectId: string | null
  objet: string
  message: string
  dossier: string | null
  lienRapport: string | null
  statut: StatutDemande
  createdAt: string
  updatedAt: string
  partner: { id: string; nom: string; metiers: MetierPartenaire[]; email: string | null; telephone: string | null }
  projet: string | null
}

/** Une mise en relation, vue depuis la gestion de l'annuaire. */
export interface DemandePartenaireAdmin {
  id: string
  partenaire: string
  objet: string
  statut: StatutDemande
  createdAt: string
  auteur: string
  societe: string | null
}
