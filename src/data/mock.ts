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

/**
 * Priorité en couleur de texte, pour les rapports.
 *
 * `priorityColors` est une pastille pleine : lisible à l'écran, lourde dans un
 * document imprimé où la priorité se lit au fil du texte. Les teintes sont assez
 * sombres pour rester lisibles sur blanc et à l'impression noir et blanc.
 */
export const priorityTextColors: Record<Priority, string> = {
  I:   'text-red-700',
  II:  'text-orange-700',
  III: 'text-green-700',
}

export const priorityDescriptions: Record<Priority, string> = {
  I:   "À engager dans les cinq ans : dégradation avérée, sécurité, étanchéité ou fonction critique en jeu.",
  II:  'À planifier entre cinq et dix ans, avant que la dégradation ne s’accélère et ne renchérisse les travaux.',
  III: 'Au-delà de dix ans : entretien préventif, à mutualiser avec un chantier ultérieur.',
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
