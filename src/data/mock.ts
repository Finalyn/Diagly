/**
 * Constantes UI partagées entre les composants (labels, couleurs sémantiques,
 * référentiels statiques par type de bâtiment).
 *
 * Ce fichier ne contient PLUS de données fictives (utilisateurs, projets,
 * bâtiments de démo). Pour le snapshot complet de la maquette originale (avec
 * Sophie Berger & co), voir `_mockup-reference/mock.ts` à la racine du repo.
 */

// ---------- Types métier (alignés sur server/prisma/schema.prisma) ----------

export type ProjectStatus = 'NON_PLANIFIE' | 'PLANIFIE' | 'EN_COURS' | 'EN_REVUE' | 'TERMINE' | 'ARCHIVE'
export type BuildingType = 'LOGEMENT' | 'VILLA' | 'CHALET' | 'SCOLAIRE' | 'BUREAU' | 'ADMINISTRATIF' | 'INDUSTRIEL' | 'HOTEL' | 'COMMERCIAL' | 'AUTRE'
export type ElementState = 'TRES_BON' | 'BON' | 'MOYEN' | 'MAUVAIS'
export type Priority = 'I' | 'II' | 'III'
export type DiagStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED'

// ---------- Labels FR ----------

export const statusLabels: Record<ProjectStatus, string> = {
  NON_PLANIFIE: 'Non planifié',
  PLANIFIE:     'Planifié',
  EN_COURS:     'En cours',
  EN_REVUE:     'En revue',
  TERMINE:      'Terminé',
  ARCHIVE:      'Archivé',
}

export const buildingTypeLabels: Record<BuildingType, string> = {
  LOGEMENT:      'Logement',
  VILLA:         'Villa',
  CHALET:        'Chalet',
  SCOLAIRE:      'École / Scolaire',
  BUREAU:        'Bureau',
  ADMINISTRATIF: 'Administratif',
  INDUSTRIEL:    'Industriel',
  HOTEL:         'Hôtel',
  COMMERCIAL:    'Commercial',
  AUTRE:         'Autre',
}

export const stateLabels: Record<ElementState, string> = {
  TRES_BON: 'Très bon',
  BON:      'Bon',
  MOYEN:    'Moyen',
  MAUVAIS:  'Mauvais',
}

// ---------- Couleurs sémantiques ----------

export const statusColors: Record<ProjectStatus, string> = {
  NON_PLANIFIE: 'bg-gray-400',
  PLANIFIE:     'bg-blue-400',
  EN_COURS:     'bg-blue-500',
  EN_REVUE:     'bg-yellow-500',
  TERMINE:      'bg-green-500',
  ARCHIVE:      'bg-gray-500',
}

export const stateColors: Record<ElementState, string> = {
  TRES_BON: 'bg-green-500',
  BON:      'bg-green-400',
  MOYEN:    'bg-orange-400',
  MAUVAIS:  'bg-red-500',
}

export const priorityColors: Record<Priority, string> = {
  I:   'bg-red-500 text-white',
  II:  'bg-orange-500 text-white',
  III: 'bg-green-500 text-white',
}

export const priorityDescriptions: Record<Priority, string> = {
  I:   'Urgent, intervention dans les 12 mois (sécurité, étanchéité ou fonction critique en jeu).',
  II:  'À planifier sous 1 à 5 ans pour éviter une dégradation accélérée ou des coûts plus élevés.',
  III: 'Entretien préventif à moyen / long terme (>5 ans), pas de risque immédiat.',
}

// ---------- Référentiels métier ----------

/** Pièces inspectables par type de bâtiment, utilisé par le mode guidé. */
export const roomBlocks: Record<BuildingType, string[]> = {
  LOGEMENT:      ['Entrée', 'Salon / Séjour', 'Cuisine', 'Salle de bains', 'WC', 'Chambre', 'Balcon / Terrasse', 'Buanderie / Cave', 'Communs', 'Enveloppe'],
  VILLA:         ['Entrée', 'Salon / Séjour', 'Cuisine', 'Salle de bains', 'WC', 'Chambre', 'Balcon / Terrasse', 'Buanderie / Cave', 'Enveloppe'],
  CHALET:        ['Entrée', 'Salon / Séjour', 'Cuisine', 'Salle de bains', 'Chambre', 'Balcon / Terrasse', 'Enveloppe'],
  SCOLAIRE:      ['Hall', 'Salle de classe', 'Salle de sport / Gymnase', 'Sanitaires', 'Cantine', 'Couloirs / Escaliers', 'Enveloppe'],
  BUREAU:        ['Accueil', 'Open space / Bureaux', 'Salles de réunion', 'Sanitaires', 'Cafétéria', 'Couloirs / Escaliers', 'Enveloppe'],
  ADMINISTRATIF: ['Accueil', 'Open space / Bureaux', 'Salles de réunion', 'Sanitaires', 'Cafétéria', 'Couloirs / Escaliers', 'Enveloppe'],
  INDUSTRIEL:    ['Hall de production', 'Bureaux', 'Sanitaires / vestiaires', 'Stockage', 'Quai', 'Enveloppe'],
  HOTEL:         ['Lobby / Réception', 'Chambre', 'Salle de bains chambre', 'Restaurant', 'Cuisine professionnelle', 'Sanitaires communs', 'Communs / Couloirs', 'Enveloppe'],
  COMMERCIAL:    ['Surface de vente', 'Réserves', 'Sanitaires', 'Communs', 'Enveloppe'],
  AUTRE:         ['Espaces principaux', 'Sanitaires', 'Communs', 'Enveloppe'],
}
