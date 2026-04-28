export type ProjectStatus = 'NON_PLANIFIE' | 'PLANIFIE' | 'EN_COURS' | 'EN_REVUE' | 'TERMINE' | 'ARCHIVE'
export type BuildingType = 'LOGEMENT' | 'VILLA' | 'CHALET' | 'SCOLAIRE' | 'BUREAU' | 'ADMINISTRATIF' | 'INDUSTRIEL' | 'HOTEL' | 'COMMERCIAL' | 'AUTRE'
export type ElementState = 'TRES_BON' | 'BON' | 'MOYEN' | 'MAUVAIS'
export type Priority = 'I' | 'II' | 'III'
export type DiagStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED'
export type PlanType = 'FLOOR' | 'FACADE' | 'SECTION' | 'SITE' | 'OTHER'
export type TenderStatus = 'DRAFT' | 'SENT' | 'RECEIVED' | 'AWARDED' | 'CLOSED'

export interface User { id: string; email: string; firstName: string; lastName: string; role: string; companyName: string; phone: string; plan: string }
export interface Project { id: string; name: string; address: string; city: string; postalCode?: string; canton: string; parcelNumber?: string; yearBuilt?: number; buildingType: BuildingType; nbApartments?: number; nbFloors?: number; floorHeight?: number; nbStaircases?: number; floorArea?: number; builtArea?: number; facadeArea?: number; terrainArea?: number; perimeter?: number; windowPct: number; honoraryPct: number; reservePct: number; status: ProjectStatus; totalBudget?: number; createdAt: Date; updatedAt: Date }
export interface StateGuide { criteria: string; works: string[] }
export interface CFCItem { id: string; code: string; label: string; unit: string; priceMin: number; priceMax: number; priceAvg: number; category: string; subcategory?: string; works: string[]; stateGuide?: Partial<Record<ElementState, StateGuide>> }
export interface DiagnosticItem { id: string; diagnosticId: string; cfcCode: string; cfcLabel: string; state: ElementState; priority: Priority; notes?: string; photos: string[]; works: string[]; estimatedCost: number; area?: number; unit?: string; yearInstalled?: number }
export interface Diagnostic { id: string; projectId: string; visitDate?: Date; status: DiagStatus; notes?: string; items: DiagnosticItem[] }
export interface Apartment { id: string; buildingId: string; number: string; floor: number; area?: number; rooms?: number; tenant?: string; history: WorkHistoryEntry[] }
export interface WorkHistoryEntry { id: string; date: Date; description: string; cfcCode?: string; cost?: number; company?: string }
export interface Building { id: string; name: string; address: string; city: string; yearBuilt?: number; apartments: Apartment[] }
export interface TenderCompany { id: string; name: string; email: string; amount?: number; status: string }
export interface Tender { id: string; projectId: string; title: string; status: TenderStatus; companies: TenderCompany[]; createdAt: Date }
export interface ActivityItem { id: string; date: Date; description: string; type: 'diagnostic' | 'project' | 'report' | 'tender' | 'building' }

export const statusLabels: Record<ProjectStatus, string> = {
  NON_PLANIFIE: 'Non planifie', PLANIFIE: 'Planifie', EN_COURS: 'En cours',
  EN_REVUE: 'En revue', TERMINE: 'Termine', ARCHIVE: 'Archive'
}
export const statusColors: Record<ProjectStatus, string> = {
  NON_PLANIFIE: 'bg-gray-400', PLANIFIE: 'bg-blue-400', EN_COURS: 'bg-blue-500',
  EN_REVUE: 'bg-yellow-500', TERMINE: 'bg-green-500', ARCHIVE: 'bg-gray-500'
}
export const buildingTypeLabels: Record<BuildingType, string> = {
  LOGEMENT: 'Logement', VILLA: 'Villa', CHALET: 'Chalet', SCOLAIRE: 'Ecole / Scolaire',
  BUREAU: 'Bureau', ADMINISTRATIF: 'Administratif', INDUSTRIEL: 'Industriel',
  HOTEL: 'Hotel', COMMERCIAL: 'Commercial', AUTRE: 'Autre',
}

export const roomBlocks: Record<BuildingType, string[]> = {
  LOGEMENT: ['Entree', 'Salon / Sejour', 'Cuisine', 'Salle de bains', 'WC', 'Chambre', 'Balcon / Terrasse', 'Buanderie / Cave', 'Communs', 'Enveloppe'],
  VILLA: ['Entree', 'Salon / Sejour', 'Cuisine', 'Salle de bains', 'WC', 'Chambre', 'Balcon / Terrasse', 'Buanderie / Cave', 'Enveloppe'],
  CHALET: ['Entree', 'Salon / Sejour', 'Cuisine', 'Salle de bains', 'Chambre', 'Balcon / Terrasse', 'Enveloppe'],
  SCOLAIRE: ['Hall', 'Salle de classe', 'Salle de sport / Gymnase', 'Sanitaires', 'Cantine', 'Couloirs / Escaliers', 'Enveloppe'],
  BUREAU: ['Accueil', 'Open space / Bureaux', 'Salles de reunion', 'Sanitaires', 'Cafeteria', 'Couloirs / Escaliers', 'Enveloppe'],
  ADMINISTRATIF: ['Accueil', 'Open space / Bureaux', 'Salles de reunion', 'Sanitaires', 'Cafeteria', 'Couloirs / Escaliers', 'Enveloppe'],
  INDUSTRIEL: ['Hall de production', 'Bureaux', 'Sanitaires / vestiaires', 'Stockage', 'Quai', 'Enveloppe'],
  HOTEL: ['Lobby / Reception', 'Chambre', 'Salle de bains chambre', 'Restaurant', 'Cuisine professionnelle', 'Sanitaires communs', 'Communs / Couloirs', 'Enveloppe'],
  COMMERCIAL: ['Surface de vente', 'Reserves', 'Sanitaires', 'Communs', 'Enveloppe'],
  AUTRE: ['Espaces principaux', 'Sanitaires', 'Communs', 'Enveloppe'],
}

export const blockCfcCodes: Record<string, string[]> = {
  'Entree': ['411', '343', '442'],
  'Salon / Sejour': ['411', '442', '441', '343', '321'],
  'Cuisine': ['411', '431', '432', '461', '511', '521', '531'],
  'Salle de bains': ['411', '432', '431', '471', '511', '512'],
  'WC': ['411', '432', '511', '512'],
  'Chambre': ['411', '442', '343', '321'],
  'Balcon / Terrasse': ['271', '281', '351', '291'],
  'Buanderie / Cave': ['411', '511', '531'],
  'Communs': ['411', '343', '342', '351', '442', '551'],
  'Enveloppe': ['271', '272', '281', '283', '284', '291', '311', '312', '313', '412', '321'],
  'Hall': ['411', '343', '442', '351'],
  'Salle de classe': ['411', '442', '343', '321', '531'],
  'Salle de sport / Gymnase': ['411', '442', '321', '531', '523'],
  'Sanitaires': ['411', '431', '432', '511', '512'],
  'Cantine': ['411', '431', '432', '461', '511', '521', '531', '523'],
  'Couloirs / Escaliers': ['411', '442', '351', '343', '551'],
  'Accueil': ['411', '442', '343', '321'],
  'Open space / Bureaux': ['411', '442', '321', '343', '531'],
  'Salles de reunion': ['411', '442', '321', '343', '531'],
  'Cafeteria': ['411', '431', '432', '461', '511', '521', '531'],
  'Hall de production': ['411', '442', '531', '523', '551'],
  'Bureaux': ['411', '442', '321', '343', '531'],
  'Sanitaires / vestiaires': ['411', '431', '432', '511', '512'],
  'Stockage': ['411', '442', '531'],
  'Quai': ['351', '442', '531'],
  'Lobby / Reception': ['411', '442', '343', '321', '551'],
  'Salle de bains chambre': ['411', '432', '471', '511', '512'],
  'Restaurant': ['411', '431', '432', '321', '343', '531', '523'],
  'Cuisine professionnelle': ['411', '431', '432', '461', '511', '521', '531', '523'],
  'Sanitaires communs': ['411', '431', '432', '511', '512'],
  'Communs / Couloirs': ['411', '442', '343', '342', '351', '551'],
  'Surface de vente': ['411', '442', '321', '343', '531', '523'],
  'Reserves': ['411', '442', '531'],
  'Espaces principaux': ['411', '442', '343', '321', '531'],
}
export const stateLabels: Record<ElementState, string> = { TRES_BON: 'Tres bon', BON: 'Bon', MOYEN: 'Moyen', MAUVAIS: 'Mauvais' }

export const defaultStateGuide: Record<ElementState, StateGuide> = {
  TRES_BON: { criteria: 'Element neuf ou recent, sans defaut visible. Aucune intervention necessaire dans les 10 prochaines annees.', works: [] },
  BON: { criteria: 'Element fonctionnel, defauts mineurs (legere usure, salissures). Aucune intervention urgente, surveillance et entretien preventif.', works: ['Entretien preventif', 'Nettoyage'] },
  MOYEN: { criteria: 'Element encore fonctionnel mais usure visible (fissures, decolorations, jeux). Intervention a planifier dans les 5 ans pour eviter une degradation acceleree.', works: ['Reparation locale', 'Entretien correctif', 'Mise en peinture / refection'] },
  MAUVAIS: { criteria: 'Element en fin de vie, degradation importante ou defaut critique. Intervention urgente (securite, etancheite ou fonctionnement compromis).', works: ['Remplacement complet', 'Remise a neuf', 'Renforcement structurel'] },
}
export const stateColors: Record<ElementState, string> = { TRES_BON: 'bg-green-500', BON: 'bg-green-400', MOYEN: 'bg-orange-400', MAUVAIS: 'bg-red-500' }
export const priorityColors: Record<Priority, string> = { I: 'bg-red-500 text-white', II: 'bg-orange-500 text-white', III: 'bg-green-500 text-white' }
export const priorityDescriptions: Record<Priority, string> = {
  I: 'Urgent - intervention dans les 12 mois (securite, etancheite ou fonction critique en jeu).',
  II: 'A planifier sous 1 a 5 ans pour eviter une degradation acceleree ou des couts plus eleves.',
  III: 'Entretien preventif a moyen / long terme (>5 ans), pas de risque immediat.',
}

export const mockUser: User = { id: 'usr_1', email: 'sophie.berger@diagly-demo.ch', firstName: 'Sophie', lastName: 'Berger', role: 'DT', companyName: 'Berger & Fils SA', phone: '+41 21 312 45 67', plan: 'PRO' }

export const mockProjects: Project[] = [
  { id: 'prj_1', name: 'Renovation Residence du Lac', address: 'Av. de Cour 42', city: 'Lausanne', postalCode: '1006', canton: 'VD', parcelNumber: 'VD-1234', yearBuilt: 1972, buildingType: 'LOGEMENT', nbApartments: 24, nbFloors: 6, floorHeight: 2.7, nbStaircases: 2, floorArea: 3200, builtArea: 580, facadeArea: 2800, terrainArea: 1200, perimeter: 120, windowPct: 0.30, honoraryPct: 12, reservePct: 5, status: 'EN_COURS', totalBudget: 1850000, createdAt: new Date('2025-11-15'), updatedAt: new Date('2026-03-20') },
  { id: 'prj_2', name: 'Ecole primaire des Paquis', address: 'Rue de Zurich 18', city: 'Geneve', postalCode: '1201', canton: 'GE', parcelNumber: 'GE-5678', yearBuilt: 1965, buildingType: 'SCOLAIRE', nbApartments: 0, nbFloors: 3, floorHeight: 3.2, nbStaircases: 2, floorArea: 2400, builtArea: 850, facadeArea: 1920, terrainArea: 3500, perimeter: 140, windowPct: 0.35, honoraryPct: 10, reservePct: 5, status: 'TERMINE', totalBudget: 980000, createdAt: new Date('2025-09-01'), updatedAt: new Date('2026-02-10') },
  { id: 'prj_3', name: 'Immeuble Grand-Rue', address: 'Grand-Rue 15', city: 'Fribourg', postalCode: '1700', canton: 'FR', parcelNumber: 'FR-9012', yearBuilt: 1988, buildingType: 'LOGEMENT', nbApartments: 16, nbFloors: 5, floorHeight: 2.6, nbStaircases: 1, floorArea: 2100, builtArea: 420, facadeArea: 1820, terrainArea: 650, perimeter: 90, windowPct: 0.28, honoraryPct: 11, reservePct: 5, status: 'EN_REVUE', totalBudget: 720000, createdAt: new Date('2025-10-20'), updatedAt: new Date('2026-03-15') },
  { id: 'prj_4', name: 'Hotel Beau-Rivage', address: 'Quai du Mont-Blanc 8', city: 'Montreux', canton: 'VD', yearBuilt: 1955, buildingType: 'HOTEL', nbApartments: 45, nbFloors: 7, floorHeight: 3.0, nbStaircases: 3, floorArea: 5600, builtArea: 900, facadeArea: 4200, terrainArea: 2800, perimeter: 160, windowPct: 0.32, honoraryPct: 13, reservePct: 5, status: 'NON_PLANIFIE', totalBudget: 3200000, createdAt: new Date('2026-03-01'), updatedAt: new Date('2026-03-01') },
  { id: 'prj_5', name: 'Centre administratif Numa Droz', address: 'Rue Numa-Droz 2', city: 'Neuchatel', canton: 'NE', parcelNumber: 'NE-3456', yearBuilt: 1980, buildingType: 'ADMINISTRATIF', nbApartments: 0, nbFloors: 4, floorHeight: 2.8, nbStaircases: 2, floorArea: 3800, builtArea: 1050, facadeArea: 2560, terrainArea: 1800, perimeter: 130, windowPct: 0.40, honoraryPct: 10, reservePct: 5, status: 'ARCHIVE', totalBudget: 1450000, createdAt: new Date('2024-06-15'), updatedAt: new Date('2025-12-20') },
  { id: 'prj_6', name: 'Residence Les Alpes', address: 'Chemin des Cretes 12', city: 'Sion', canton: 'VS', yearBuilt: 1990, buildingType: 'LOGEMENT', nbApartments: 18, nbFloors: 5, floorHeight: 2.6, nbStaircases: 1, floorArea: 2400, builtArea: 480, windowPct: 0.28, honoraryPct: 11, reservePct: 5, status: 'EN_COURS', totalBudget: 920000, createdAt: new Date('2025-06-10'), updatedAt: new Date('2026-03-28') },
  { id: 'prj_7', name: 'Groupe scolaire Vinet', address: 'Av. Vinet 30', city: 'Lausanne', canton: 'VD', yearBuilt: 1958, buildingType: 'SCOLAIRE', nbApartments: 0, nbFloors: 3, floorHeight: 3.4, nbStaircases: 3, floorArea: 4200, builtArea: 1400, windowPct: 0.35, honoraryPct: 10, reservePct: 5, status: 'EN_COURS', totalBudget: 2100000, createdAt: new Date('2026-01-15'), updatedAt: new Date('2026-04-02') },
  { id: 'prj_8', name: 'Immeuble Chauderon', address: 'Pl. Chauderon 4', city: 'Lausanne', canton: 'VD', yearBuilt: 1935, buildingType: 'LOGEMENT', nbApartments: 32, nbFloors: 7, floorHeight: 2.9, nbStaircases: 2, floorArea: 4800, builtArea: 700, windowPct: 0.25, honoraryPct: 12, reservePct: 5, status: 'EN_REVUE', totalBudget: 3500000, createdAt: new Date('2025-08-20'), updatedAt: new Date('2026-03-30') },
  { id: 'prj_9', name: 'Centre commercial Balexert', address: 'Av. Louis-Casai 27', city: 'Geneve', canton: 'GE', yearBuilt: 1971, buildingType: 'COMMERCIAL', nbApartments: 0, nbFloors: 2, floorHeight: 4.0, nbStaircases: 4, floorArea: 12000, builtArea: 6000, windowPct: 0.45, honoraryPct: 8, reservePct: 5, status: 'EN_REVUE', totalBudget: 5800000, createdAt: new Date('2025-04-01'), updatedAt: new Date('2026-02-15') },
  { id: 'prj_10', name: 'Villa Weissenstein', address: 'Weissensteinstr. 45', city: 'Berne', canton: 'BE', yearBuilt: 2005, buildingType: 'LOGEMENT', nbApartments: 1, nbFloors: 2, floorHeight: 2.7, nbStaircases: 1, floorArea: 280, builtArea: 160, windowPct: 0.32, honoraryPct: 15, reservePct: 5, status: 'NON_PLANIFIE', totalBudget: 180000, createdAt: new Date('2026-04-01'), updatedAt: new Date('2026-04-01') },
  { id: 'prj_11', name: 'EMS Les Jardins', address: 'Route de Berne 8', city: 'Fribourg', canton: 'FR', yearBuilt: 1982, buildingType: 'AUTRE', nbApartments: 42, nbFloors: 3, floorHeight: 2.8, nbStaircases: 2, floorArea: 3600, builtArea: 1200, windowPct: 0.30, honoraryPct: 10, reservePct: 5, status: 'PLANIFIE', totalBudget: 1650000, createdAt: new Date('2026-03-20'), updatedAt: new Date('2026-04-05') },
  { id: 'prj_12', name: 'Parking Riponne', address: 'Pl. de la Riponne', city: 'Lausanne', canton: 'VD', yearBuilt: 1975, buildingType: 'AUTRE', nbApartments: 0, nbFloors: 4, floorHeight: 2.5, nbStaircases: 2, floorArea: 8000, builtArea: 2000, windowPct: 0.05, honoraryPct: 8, reservePct: 5, status: 'EN_COURS', totalBudget: 4200000, createdAt: new Date('2025-12-01'), updatedAt: new Date('2026-04-08') },
  { id: 'prj_13', name: 'PPE Montbrillant', address: 'Rue de Montbrillant 16', city: 'Geneve', canton: 'GE', yearBuilt: 1968, buildingType: 'LOGEMENT', nbApartments: 20, nbFloors: 6, floorHeight: 2.7, nbStaircases: 1, floorArea: 2800, builtArea: 500, windowPct: 0.30, honoraryPct: 12, reservePct: 5, status: 'TERMINE', totalBudget: 1100000, createdAt: new Date('2025-07-10'), updatedAt: new Date('2026-01-20') },
  { id: 'prj_14', name: 'Temple de Lutry', address: 'Grand-Rue 22', city: 'Lutry', canton: 'VD', yearBuilt: 1577, buildingType: 'AUTRE', nbApartments: 0, nbFloors: 1, floorHeight: 8.0, nbStaircases: 1, floorArea: 400, builtArea: 400, windowPct: 0.15, honoraryPct: 15, reservePct: 10, status: 'ARCHIVE', totalBudget: 890000, createdAt: new Date('2024-01-15'), updatedAt: new Date('2025-10-30') },
  { id: 'prj_15', name: 'Usine Tornos', address: 'Rue Industrielle 3', city: 'Moutier', canton: 'BE', yearBuilt: 1962, buildingType: 'INDUSTRIEL', nbApartments: 0, nbFloors: 2, floorHeight: 5.0, nbStaircases: 1, floorArea: 6000, builtArea: 3000, windowPct: 0.20, honoraryPct: 8, reservePct: 5, status: 'TERMINE', totalBudget: 2800000, createdAt: new Date('2025-03-01'), updatedAt: new Date('2026-02-28') },
]

export const mockCFCItems: CFCItem[] = [
  { id: 'cfc_1', code: '211', label: 'Fouilles et terrassement', unit: 'm3', priceMin: 35, priceMax: 85, priceAvg: 55, category: 'Gros oeuvre', subcategory: 'Terrassement', works: ['Excavation', 'Remblayage'] },
  { id: 'cfc_2', code: '221', label: 'Maconnerie', unit: 'm2', priceMin: 120, priceMax: 280, priceAvg: 195, category: 'Gros oeuvre', subcategory: 'Maconnerie', works: ['Reparation fissures', 'Rejointoiement'] },
  { id: 'cfc_3', code: '224', label: 'Beton arme', unit: 'm3', priceMin: 450, priceMax: 850, priceAvg: 620, category: 'Gros oeuvre', subcategory: 'Beton', works: ['Reparation beton', 'Renforcement structure'] },
  { id: 'cfc_4', code: '261', label: 'Echafaudage', unit: 'm2', priceMin: 25, priceMax: 55, priceAvg: 38, category: 'Gros oeuvre', subcategory: 'Echafaudage', works: ['Montage echafaudage'] },
  { id: 'cfc_5', code: '271', label: 'Couverture et etancheite toiture', unit: 'm2', priceMin: 85, priceMax: 220, priceAvg: 145, category: 'Enveloppe', subcategory: 'Toiture', works: ['Remplacement couverture', 'Refection etancheite'], stateGuide: {
    TRES_BON: { criteria: 'Couverture recente (<10 ans), aucun defaut visible, ferblanterie intacte.', works: [] },
    BON: { criteria: 'Couverture en bon etat, mousses ou salissures legeres. Pas de fuite signalee.', works: ['Nettoyage couverture', 'Demoussage', 'Controle ferblanterie'] },
    MOYEN: { criteria: 'Quelques tuiles fissurees ou deplacees, etancheite degradee localement, traces d\'humidite ponctuelles. Risque de fuite a moyen terme.', works: ['Remplacement tuiles localisees', 'Refection etancheite ponctuelle', 'Reprise ferblanterie'] },
    MAUVAIS: { criteria: 'Fuites averees, sous-couverture endommagee, isolation potentiellement humide. Risque structurel et thermique.', works: ['Refection complete couverture', 'Refection etancheite', 'Reprise charpente si necessaire'] },
  } },
  { id: 'cfc_6', code: '272', label: 'Isolation thermique toiture', unit: 'm2', priceMin: 60, priceMax: 150, priceAvg: 95, category: 'Enveloppe', subcategory: 'Toiture', works: ['Pose isolation minerale', 'Pare-vapeur'] },
  { id: 'cfc_7', code: '281', label: 'Ferblanterie', unit: 'ml', priceMin: 45, priceMax: 120, priceAvg: 75, category: 'Enveloppe', subcategory: 'Ferblanterie', works: ['Remplacement gouttieres', 'Couvertines'] },
  { id: 'cfc_8', code: '283', label: 'Isolation facade', unit: 'm2', priceMin: 150, priceMax: 320, priceAvg: 230, category: 'Enveloppe', subcategory: 'Facade', works: ['Isolation par exterieur', 'Crepi sur isolation'] },
  { id: 'cfc_9', code: '284', label: 'Facade ventilee', unit: 'm2', priceMin: 280, priceMax: 500, priceAvg: 380, category: 'Enveloppe', subcategory: 'Facade', works: ['Ossature metallique', 'Parement'] },
  { id: 'cfc_10', code: '291', label: 'Crepi facade', unit: 'm2', priceMin: 65, priceMax: 140, priceAvg: 95, category: 'Enveloppe', subcategory: 'Facade', works: ['Crepi mineral', 'Crepi synthetique'], stateGuide: {
    TRES_BON: { criteria: 'Crepi recent, teinte uniforme, aucune fissure, pas de salissures ni decollement.', works: [] },
    BON: { criteria: 'Crepi en bon etat general, salissures legeres, microfissures de surface non actives.', works: ['Nettoyage haute pression', 'Traitement hydrofuge'] },
    MOYEN: { criteria: 'Fissures visibles >0.3mm, decollements localises, taches d\'humidite ou developpement biologique (algues, mousses). Pas de risque structurel mais esthetique degradee.', works: ['Rebouchage des fissures', 'Traitement antifongique', 'Mise en peinture facade', 'Reprise localisee du crepi'] },
    MAUVAIS: { criteria: 'Fissures structurelles, eclats importants, decollement par plaques, infiltrations averees. Crepi non protecteur, risque pour la maconnerie.', works: ['Piochage et refection complete du crepi', 'Pose isolation perimetrique', 'Etudes structurelles si fissures actives'] },
  } },
  { id: 'cfc_11', code: '311', label: 'Fenetres bois', unit: 'pce', priceMin: 1200, priceMax: 2800, priceAvg: 1900, category: 'Fenetres et portes', subcategory: 'Fenetres', works: ['Remplacement fenetres', 'Triple vitrage'], stateGuide: {
    TRES_BON: { criteria: 'Fenetres recentes (<15 ans), double ou triple vitrage, joints intacts, bois en parfait etat.', works: [] },
    BON: { criteria: 'Fenetres fonctionnelles, double vitrage, leger vieillissement de la peinture, joints encore performants.', works: ['Reprise peinture', 'Graissage ferrures'] },
    MOYEN: { criteria: 'Simple vitrage ou double vitrage ancien (>25 ans), joints durcis, bois grise par endroits, condensations frequentes. Performance thermique mediocre.', works: ['Remplacement des joints', 'Remise en peinture', 'Etude de remplacement (Minergie)'] },
    MAUVAIS: { criteria: 'Bois pourri, vitrage casse ou descelle, fenetre non etanche, courants d\'air importants. Performance thermique inacceptable.', works: ['Remplacement complet des fenetres', 'Pose triple vitrage', 'Reprise des tableaux et appuis'] },
  } },
  { id: 'cfc_12', code: '312', label: 'Fenetres PVC', unit: 'pce', priceMin: 800, priceMax: 1800, priceAvg: 1250, category: 'Fenetres et portes', subcategory: 'Fenetres', works: ['Remplacement fenetres PVC'] },
  { id: 'cfc_13', code: '313', label: 'Fenetres aluminium', unit: 'pce', priceMin: 1500, priceMax: 3500, priceAvg: 2400, category: 'Fenetres et portes', subcategory: 'Fenetres', works: ['Remplacement fenetres alu'] },
  { id: 'cfc_14', code: '321', label: 'Stores et protections solaires', unit: 'pce', priceMin: 400, priceMax: 1200, priceAvg: 750, category: 'Fenetres et portes', subcategory: 'Protections', works: ['Stores a lamelles', 'Motorisation'] },
  { id: 'cfc_15', code: '342', label: 'Portes palieres', unit: 'pce', priceMin: 1800, priceMax: 3500, priceAvg: 2500, category: 'Fenetres et portes', subcategory: 'Portes', works: ['Remplacement porte paliere'] },
  { id: 'cfc_16', code: '343', label: 'Portes interieures', unit: 'pce', priceMin: 600, priceMax: 1500, priceAvg: 950, category: 'Fenetres et portes', subcategory: 'Portes', works: ['Remplacement portes'] },
  { id: 'cfc_17', code: '351', label: 'Serrurerie et metallerie', unit: 'ml', priceMin: 250, priceMax: 600, priceAvg: 400, category: 'Fenetres et portes', subcategory: 'Serrurerie', works: ['Garde-corps', 'Main courante'] },
  { id: 'cfc_18', code: '411', label: 'Peinture interieure', unit: 'm2', priceMin: 18, priceMax: 45, priceAvg: 28, category: 'Finitions', subcategory: 'Peinture', works: ['Peinture murs', 'Peinture plafonds'], stateGuide: {
    TRES_BON: { criteria: 'Peinture recente (<5 ans), couleur uniforme, aucune trace, surface lisse.', works: [] },
    BON: { criteria: 'Peinture propre, traces de mobilier ou frottements legers, pas d\'ecaillage.', works: ['Retouches localisees'] },
    MOYEN: { criteria: 'Decoloration, salissures, petites ecailles ou microfissures, traces d\'humidite legeres. Renovation a prevoir.', works: ['Remise en peinture complete', 'Rebouchage et lissage', 'Traitement anti-humidite preventif'] },
    MAUVAIS: { criteria: 'Ecaillage important, moisissures, support degrade. Renovation indispensable, traitement de la cause sous-jacente requis.', works: ['Decapage complet', 'Traitement antifongique', 'Reparation du support', 'Mise en peinture complete'] },
  } },
  { id: 'cfc_19', code: '412', label: 'Peinture facade', unit: 'm2', priceMin: 35, priceMax: 85, priceAvg: 55, category: 'Finitions', subcategory: 'Peinture', works: ['Ravalement facade'] },
  { id: 'cfc_20', code: '431', label: 'Carrelage sol', unit: 'm2', priceMin: 85, priceMax: 180, priceAvg: 125, category: 'Finitions', subcategory: 'Carrelage', works: ['Pose carrelage neuf'] },
  { id: 'cfc_21', code: '432', label: 'Carrelage mural', unit: 'm2', priceMin: 95, priceMax: 200, priceAvg: 140, category: 'Finitions', subcategory: 'Carrelage', works: ['Faience salle de bains'] },
  { id: 'cfc_22', code: '441', label: 'Revetement sol souple', unit: 'm2', priceMin: 45, priceMax: 120, priceAvg: 75, category: 'Finitions', subcategory: 'Sols', works: ['Linoleum', 'PVC'] },
  { id: 'cfc_23', code: '442', label: 'Parquet', unit: 'm2', priceMin: 80, priceMax: 200, priceAvg: 130, category: 'Finitions', subcategory: 'Sols', works: ['Pose parquet massif', 'Vitrification'] },
  { id: 'cfc_24', code: '461', label: 'Cuisine equipee', unit: 'pce', priceMin: 8000, priceMax: 25000, priceAvg: 15000, category: 'Finitions', subcategory: 'Cuisine', works: ['Remplacement cuisine'] },
  { id: 'cfc_25', code: '471', label: 'Amenagement salle de bains', unit: 'pce', priceMin: 12000, priceMax: 30000, priceAvg: 18000, category: 'Finitions', subcategory: 'Salle de bains', works: ['Renovation complete SDB'] },
  { id: 'cfc_26', code: '511', label: 'Appareils sanitaires', unit: 'pce', priceMin: 800, priceMax: 3500, priceAvg: 1800, category: 'Installations techniques', subcategory: 'Sanitaire', works: ['Remplacement WC', 'Lavabo'] },
  { id: 'cfc_27', code: '512', label: 'Canalisations sanitaires', unit: 'ml', priceMin: 120, priceMax: 350, priceAvg: 220, category: 'Installations techniques', subcategory: 'Sanitaire', works: ['Remplacement colonnes'] },
  { id: 'cfc_28', code: '521', label: 'Production de chaleur', unit: 'fft', priceMin: 25000, priceMax: 80000, priceAvg: 45000, category: 'Installations techniques', subcategory: 'Chauffage', works: ['Remplacement chaudiere', 'Pompe a chaleur'], stateGuide: {
    TRES_BON: { criteria: 'Installation recente (<10 ans) a haut rendement (PAC, gaz a condensation, pellets). Conforme aux exigences cantonales.', works: [] },
    BON: { criteria: 'Installation 10-15 ans, rendement correct, entretien regulier, pas de fuite ni de bruit anormal.', works: ['Service annuel', 'Equilibrage hydraulique'] },
    MOYEN: { criteria: 'Installation 15-25 ans (mazout/gaz ancienne generation), rendement faible, consommation elevee. Etude de remplacement recommandee, exigences MoPEC a anticiper.', works: ['Etude de variantes (PAC, pellets, CAD)', 'Remplacement a moyen terme', 'Optimisation regulation'] },
    MAUVAIS: { criteria: 'Installation >25 ans, pannes recurrentes, mazout non conforme MoPEC 2025/2030. Remplacement obligatoire.', works: ['Remplacement par pompe a chaleur', 'Raccordement chauffage a distance', 'Demande de subventions cantonales'] },
  } },
  { id: 'cfc_29', code: '522', label: 'Distribution chauffage', unit: 'ml', priceMin: 85, priceMax: 200, priceAvg: 135, category: 'Installations techniques', subcategory: 'Chauffage', works: ['Conduites chauffage', 'Radiateurs'] },
  { id: 'cfc_30', code: '523', label: 'Ventilation', unit: 'm2', priceMin: 40, priceMax: 120, priceAvg: 75, category: 'Installations techniques', subcategory: 'Ventilation', works: ['VMC double flux'] },
  { id: 'cfc_31', code: '531', label: 'Installations electriques', unit: 'm2', priceMin: 55, priceMax: 150, priceAvg: 95, category: 'Installations techniques', subcategory: 'Electricite', works: ['Refection tableau', 'Cablage'] },
  { id: 'cfc_32', code: '551', label: 'Ascenseur', unit: 'pce', priceMin: 80000, priceMax: 180000, priceAvg: 120000, category: 'Installations techniques', subcategory: 'Transport', works: ['Remplacement ascenseur'] },
]

export const cfcCategories = [
  { code: '2', label: 'Gros oeuvre', children: [
    { code: '21', label: 'Terrassement', children: [{ code: '211', label: 'Fouilles et terrassement' }] },
    { code: '22', label: 'Maconnerie et beton', children: [{ code: '221', label: 'Maconnerie' }, { code: '224', label: 'Beton arme' }] },
    { code: '26', label: 'Echafaudage', children: [{ code: '261', label: 'Echafaudage' }] },
    { code: '27', label: 'Toiture', children: [{ code: '271', label: 'Couverture et etancheite' }, { code: '272', label: 'Isolation thermique' }] },
    { code: '28', label: 'Facade', children: [{ code: '281', label: 'Ferblanterie' }, { code: '283', label: 'Isolation facade' }, { code: '284', label: 'Facade ventilee' }] },
    { code: '29', label: 'Crepi', children: [{ code: '291', label: 'Crepi facade' }] },
  ]},
  { code: '3', label: 'Fenetres et portes', children: [
    { code: '31', label: 'Fenetres', children: [{ code: '311', label: 'Fenetres bois' }, { code: '312', label: 'Fenetres PVC' }, { code: '313', label: 'Fenetres aluminium' }] },
    { code: '32', label: 'Protections solaires', children: [{ code: '321', label: 'Stores' }] },
    { code: '34', label: 'Portes', children: [{ code: '342', label: 'Portes palieres' }, { code: '343', label: 'Portes interieures' }] },
    { code: '35', label: 'Serrurerie', children: [{ code: '351', label: 'Serrurerie et metallerie' }] },
  ]},
  { code: '4', label: 'Finitions interieures', children: [
    { code: '41', label: 'Peinture', children: [{ code: '411', label: 'Peinture interieure' }, { code: '412', label: 'Peinture facade' }] },
    { code: '43', label: 'Carrelage', children: [{ code: '431', label: 'Carrelage sol' }, { code: '432', label: 'Carrelage mural' }] },
    { code: '44', label: 'Sols', children: [{ code: '441', label: 'Sol souple' }, { code: '442', label: 'Parquet' }] },
    { code: '46', label: 'Cuisine', children: [{ code: '461', label: 'Cuisine equipee' }] },
    { code: '47', label: 'Salle de bains', children: [{ code: '471', label: 'Amenagement SDB' }] },
  ]},
  { code: '5', label: 'Installations techniques', children: [
    { code: '51', label: 'Sanitaire', children: [{ code: '511', label: 'Appareils sanitaires' }, { code: '512', label: 'Canalisations' }] },
    { code: '52', label: 'Chauffage et ventilation', children: [{ code: '521', label: 'Production chaleur' }, { code: '522', label: 'Distribution chauffage' }, { code: '523', label: 'Ventilation' }] },
    { code: '53', label: 'Electricite', children: [{ code: '531', label: 'Installations electriques' }] },
    { code: '55', label: 'Transport', children: [{ code: '551', label: 'Ascenseur' }] },
  ]},
]

export const mockDiagnostics: Diagnostic[] = [
  {
    id: 'diag_1', projectId: 'prj_1', visitDate: new Date('2026-03-18'), status: 'IN_PROGRESS',
    notes: 'Visite effectuee avec le concierge M. Muller. Acces toiture par cage B.',
    items: [
      { id: 'di_1', diagnosticId: 'diag_1', cfcCode: '271', cfcLabel: 'Couverture et etancheite toiture', state: 'MAUVAIS', priority: 'I', notes: 'Infiltrations multiples, membrane fissuree', photos: ['/mock/photo1.jpg', '/mock/photo2.jpg'], works: ['Refection etancheite complete', 'Isolation toiture'], estimatedCost: 145000, area: 580, unit: 'm2', yearInstalled: 1995 },
      { id: 'di_2', diagnosticId: 'diag_1', cfcCode: '283', cfcLabel: 'Isolation facade', state: 'MAUVAIS', priority: 'I', notes: 'Aucune isolation, ponts thermiques importants', photos: ['/mock/photo3.jpg'], works: ['Isolation par exterieur (EPI)', 'Crepi sur isolation'], estimatedCost: 644000, area: 2800, unit: 'm2', yearInstalled: 1972 },
      { id: 'di_3', diagnosticId: 'diag_1', cfcCode: '312', cfcLabel: 'Fenetres PVC', state: 'MOYEN', priority: 'II', notes: 'Double vitrage ancien, joints uses', photos: ['/mock/photo4.jpg'], works: ['Remplacement fenetres PVC triple vitrage'], estimatedCost: 180000, area: 144, unit: 'pce', yearInstalled: 2002 },
      { id: 'di_4', diagnosticId: 'diag_1', cfcCode: '521', cfcLabel: 'Production de chaleur', state: 'MAUVAIS', priority: 'I', notes: 'Chaudiere mazout en fin de vie, rendement < 75%', photos: ['/mock/photo5.jpg'], works: ['Remplacement par pompe a chaleur air-eau'], estimatedCost: 65000, unit: 'fft', yearInstalled: 1998 },
      { id: 'di_5', diagnosticId: 'diag_1', cfcCode: '531', cfcLabel: 'Installations electriques', state: 'MOYEN', priority: 'II', notes: 'Tableau electrique conforme mais ancien', photos: [], works: ['Mise a niveau tableau', 'Remplacement prises vetustes'], estimatedCost: 304000, area: 3200, unit: 'm2', yearInstalled: 1990 },
      { id: 'di_6', diagnosticId: 'diag_1', cfcCode: '411', cfcLabel: 'Peinture interieure', state: 'MOYEN', priority: 'III', notes: 'Etat general correct, rafraichissement dans 2-3 ans', photos: [], works: ['Peinture murs et plafonds communs'], estimatedCost: 56000, area: 2000, unit: 'm2', yearInstalled: 2015 },
      { id: 'di_7', diagnosticId: 'diag_1', cfcCode: '551', cfcLabel: 'Ascenseur', state: 'BON', priority: 'III', notes: 'Modernise en 2018, bon etat general', photos: [], works: ['Entretien courant'], estimatedCost: 5000, unit: 'fft', yearInstalled: 2018 },
      { id: 'di_8', diagnosticId: 'diag_1', cfcCode: '281', cfcLabel: 'Ferblanterie', state: 'MAUVAIS', priority: 'II', notes: 'Gouttieres percees cote nord, couvertines a remplacer', photos: ['/mock/photo6.jpg'], works: ['Remplacement gouttieres', 'Couvertines neuves'], estimatedCost: 18000, area: 240, unit: 'ml', yearInstalled: 1995 },
    ]
  },
  {
    id: 'diag_2', projectId: 'prj_2', visitDate: new Date('2025-12-05'), status: 'COMPLETED',
    notes: 'Diagnostic complet realise. Batiment en etat correct pour son age.',
    items: [
      { id: 'di_20', diagnosticId: 'diag_2', cfcCode: '271', cfcLabel: 'Couverture toiture', state: 'MOYEN', priority: 'II', notes: 'Toiture plate, quelques fissures', photos: [], works: ['Refection partielle etancheite'], estimatedCost: 95000, area: 850, unit: 'm2', yearInstalled: 2005 },
      { id: 'di_21', diagnosticId: 'diag_2', cfcCode: '311', cfcLabel: 'Fenetres bois', state: 'MAUVAIS', priority: 'I', notes: 'Fenetres bois originales 1965, infiltrations', photos: [], works: ['Remplacement complet fenetres'], estimatedCost: 285000, area: 150, unit: 'pce', yearInstalled: 1965 },
      { id: 'di_22', diagnosticId: 'diag_2', cfcCode: '521', cfcLabel: 'Production chaleur', state: 'MOYEN', priority: 'II', notes: 'Chaudiere gaz 2010, encore fonctionnelle', photos: [], works: ['Planifier remplacement PAC'], estimatedCost: 55000, unit: 'fft', yearInstalled: 2010 },
      { id: 'di_23', diagnosticId: 'diag_2', cfcCode: '431', cfcLabel: 'Carrelage sol', state: 'MOYEN', priority: 'III', notes: 'Carrelage couloirs use mais intact', photos: [], works: ['Remplacement carrelage couloirs'], estimatedCost: 45000, area: 360, unit: 'm2', yearInstalled: 1990 },
    ]
  },
]

export const mockBuildings: Building[] = [
  {
    id: 'bld_1', name: 'Residence du Lac', address: 'Av. de Cour 42', city: 'Lausanne', yearBuilt: 1972,
    apartments: [
      { id: 'apt_1', buildingId: 'bld_1', number: '1A', floor: 1, area: 72, rooms: 3.5, tenant: 'Famille Rochat', history: [{ id: 'wh_1', date: new Date('2024-06-15'), description: 'Remplacement robinetterie cuisine', cfcCode: '511', cost: 1200, company: 'Plomberie Vaudoise SA' }, { id: 'wh_2', date: new Date('2023-03-10'), description: 'Peinture complete appartement', cfcCode: '411', cost: 4500, company: 'Peinture Lacroix' }] },
      { id: 'apt_2', buildingId: 'bld_1', number: '1B', floor: 1, area: 85, rooms: 4.5, tenant: 'M. Dupont', history: [{ id: 'wh_3', date: new Date('2025-01-20'), description: 'Reparation chasse eau', cfcCode: '511', cost: 350, company: 'Plomberie Vaudoise SA' }] },
      { id: 'apt_3', buildingId: 'bld_1', number: '1C', floor: 1, area: 65, rooms: 2.5, tenant: 'Mme Favre', history: [] },
      { id: 'apt_4', buildingId: 'bld_1', number: '2A', floor: 2, area: 72, rooms: 3.5, tenant: 'Famille Blanc', history: [{ id: 'wh_4', date: new Date('2024-11-05'), description: 'Remplacement cuisine complete', cfcCode: '461', cost: 14500, company: 'Cuisines Modernes SA' }] },
      { id: 'apt_5', buildingId: 'bld_1', number: '2B', floor: 2, area: 85, rooms: 4.5, tenant: 'M. Pittet', history: [] },
      { id: 'apt_6', buildingId: 'bld_1', number: '2C', floor: 2, area: 65, rooms: 2.5, tenant: 'Mme Clerc', history: [{ id: 'wh_5', date: new Date('2025-02-18'), description: 'Remplacement parquet salon', cfcCode: '442', cost: 3200, company: 'Parqueterie du Leman' }] },
      { id: 'apt_7', buildingId: 'bld_1', number: '3A', floor: 3, area: 72, rooms: 3.5, tenant: 'Famille Muller', history: [] },
      { id: 'apt_8', buildingId: 'bld_1', number: '3B', floor: 3, area: 85, rooms: 4.5, tenant: 'M. Rey', history: [{ id: 'wh_6', date: new Date('2024-09-22'), description: 'Renovation salle de bains', cfcCode: '471', cost: 18500, company: 'Bains & Co Sarl' }] },
      { id: 'apt_9', buildingId: 'bld_1', number: '3C', floor: 3, area: 65, rooms: 2.5, tenant: 'Mme Bonvin', history: [] },
      { id: 'apt_10', buildingId: 'bld_1', number: '4A', floor: 4, area: 72, rooms: 3.5, tenant: 'Famille Savoy', history: [] },
      { id: 'apt_11', buildingId: 'bld_1', number: '4B', floor: 4, area: 85, rooms: 4.5, tenant: 'M. Tanner', history: [{ id: 'wh_7', date: new Date('2025-03-01'), description: 'Remplacement porte paliere', cfcCode: '342', cost: 2800, company: 'Menuiserie Alpine Sarl' }] },
      { id: 'apt_12', buildingId: 'bld_1', number: '4C', floor: 4, area: 65, rooms: 2.5, tenant: 'Mme Berset', history: [] },
    ]
  },
  {
    id: 'bld_2', name: 'Les Tilleuls', address: 'Rue des Tilleuls 8-10', city: 'Lausanne', yearBuilt: 1985,
    apartments: [
      { id: 'apt_20', buildingId: 'bld_2', number: '1A', floor: 1, area: 78, rooms: 3.5, tenant: 'Famille Weber', history: [{ id: 'wh_20', date: new Date('2025-09-12'), description: 'Remplacement porte paliere', cfcCode: '342', cost: 2800, company: 'Menuiserie Alpine Sarl' }] },
      { id: 'apt_21', buildingId: 'bld_2', number: '1B', floor: 1, area: 92, rooms: 4.5, tenant: 'M. Schneider', history: [] },
      { id: 'apt_22', buildingId: 'bld_2', number: '2A', floor: 2, area: 78, rooms: 3.5, tenant: 'Mme Brunner', history: [] },
      { id: 'apt_23', buildingId: 'bld_2', number: '2B', floor: 2, area: 92, rooms: 4.5, tenant: 'Famille Gerber', history: [{ id: 'wh_21', date: new Date('2025-05-20'), description: 'Peinture complete', cfcCode: '411', cost: 4200, company: 'Peinture Lacroix' }] },
      { id: 'apt_24', buildingId: 'bld_2', number: '3A', floor: 3, area: 78, rooms: 3.5, tenant: 'M. Huber', history: [] },
      { id: 'apt_25', buildingId: 'bld_2', number: '3B', floor: 3, area: 92, rooms: 4.5, tenant: 'Mme Keller', history: [] },
      { id: 'apt_26', buildingId: 'bld_2', number: '4A', floor: 4, area: 78, rooms: 3.5, tenant: 'Famille Moser', history: [] },
      { id: 'apt_27', buildingId: 'bld_2', number: '4B', floor: 4, area: 92, rooms: 4.5, tenant: 'M. Graf', history: [{ id: 'wh_22', date: new Date('2024-12-10'), description: 'Remplacement robinetterie SDB', cfcCode: '511', cost: 980, company: 'Plomberie Vaudoise SA' }] },
    ]
  },
]

export const mockDashboardStats = { activeProjects: 12, urgentItems: 7, totalBudget: 2450000, cecbEstimated: 4 }

export const mockBudgetChart = [
  { month: 'Avr 25', previsionnel: 180000, reel: 165000 },
  { month: 'Mai 25', previsionnel: 220000, reel: 210000 },
  { month: 'Juin 25', previsionnel: 195000, reel: 240000 },
  { month: 'Juil 25', previsionnel: 160000, reel: 155000 },
  { month: 'Aout 25', previsionnel: 140000, reel: 130000 },
  { month: 'Sep 25', previsionnel: 250000, reel: 270000 },
  { month: 'Oct 25', previsionnel: 310000, reel: 290000 },
  { month: 'Nov 25', previsionnel: 280000, reel: 300000 },
  { month: 'Dec 25', previsionnel: 150000, reel: 120000 },
  { month: 'Jan 26', previsionnel: 200000, reel: 185000 },
  { month: 'Fev 26', previsionnel: 230000, reel: 215000 },
  { month: 'Mar 26', previsionnel: 260000, reel: 245000 },
]

export const mockActivity: ActivityItem[] = [
  { id: 'act_1', date: new Date('2026-04-09'), description: 'Diagnostic mis a jour - Residence du Lac', type: 'diagnostic' },
  { id: 'act_2', date: new Date('2026-04-08'), description: 'Rapport PDF genere - Ecole des Paquis', type: 'report' },
  { id: 'act_3', date: new Date('2026-04-07'), description: 'Nouveau projet cree - Hotel Beau-Rivage', type: 'project' },
  { id: 'act_4', date: new Date('2026-04-07'), description: "Appel d'offres envoye - Immeuble Grand-Rue", type: 'tender' },
  { id: 'act_5', date: new Date('2026-04-05'), description: '3 photos ajoutees - Diagnostic Residence du Lac', type: 'diagnostic' },
  { id: 'act_6', date: new Date('2026-04-04'), description: 'Devis recu de Batipro SA - Immeuble Grand-Rue', type: 'tender' },
  { id: 'act_7', date: new Date('2026-04-03'), description: 'Appartement 2B ajoute - Les Tilleuls', type: 'building' },
  { id: 'act_8', date: new Date('2026-04-02'), description: 'Statut modifie : Rapport termine - Ecole des Paquis', type: 'project' },
  { id: 'act_9', date: new Date('2026-04-01'), description: 'Visite planifiee le 18 mars - Residence du Lac', type: 'diagnostic' },
  { id: 'act_10', date: new Date('2026-03-30'), description: 'Estimation CECB generee - Residence du Lac', type: 'project' },
]

export const mockTenders: Tender[] = [
  {
    id: 'tnd_1', projectId: 'prj_3', title: 'Lot 1 - Fenetres et portes', status: 'SENT', createdAt: new Date('2026-03-10'),
    companies: [
      { id: 'tc_1', name: 'Menuiserie Alpine Sarl', email: 'offres@alpine-menu.ch', amount: 185000, status: 'received' },
      { id: 'tc_2', name: 'Fentech SA', email: 'devis@fentech.ch', amount: 172000, status: 'received' },
      { id: 'tc_3', name: 'Vitrex Suisse', email: 'info@vitrex.ch', amount: undefined, status: 'pending' },
    ]
  },
  {
    id: 'tnd_2', projectId: 'prj_3', title: 'Lot 2 - Peinture interieure et facade', status: 'DRAFT', createdAt: new Date('2026-03-15'),
    companies: [
      { id: 'tc_4', name: 'Peinture Lacroix', email: 'contact@lacroix-peinture.ch', amount: undefined, status: 'pending' },
      { id: 'tc_5', name: 'ColorPro SA', email: 'devis@colorpro.ch', amount: undefined, status: 'pending' },
    ]
  },
  {
    id: 'tnd_3', projectId: 'prj_1', title: 'Lot 1 - Toiture et etancheite', status: 'RECEIVED', createdAt: new Date('2026-02-20'),
    companies: [
      { id: 'tc_6', name: 'Toitures Romandes SA', email: 'offres@toitures-romandes.ch', amount: 152000, status: 'received' },
      { id: 'tc_7', name: 'Etanchevaud Sarl', email: 'info@etanchevaud.ch', amount: 148500, status: 'received' },
      { id: 'tc_8', name: 'CouvrToit SA', email: 'devis@couvrtoit.ch', amount: 161000, status: 'received' },
    ]
  },
]
