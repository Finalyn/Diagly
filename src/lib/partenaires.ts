/**
 * Les libellés de l'annuaire des partenaires, et le premier jet d'une demande.
 *
 * « Expert CECB® » est un titre : le serveur refuse de l'attribuer sans
 * vérification par Finalyn sur la liste officielle (voir marque-cecb.ts).
 */
import type { DemandePartenaire, MetierPartenaire, Partenaire, StatutDemande } from './api-types'

export const METIERS: { id: MetierPartenaire; label: string }[] = [
  { id: 'ARCHITECTE', label: 'Architecte' },
  { id: 'EXPERT_CECB', label: 'Expert CECB®' },
  { id: 'INGENIEUR_CIVIL', label: 'Ingénieur civil' },
  { id: 'INGENIEUR_CVSE', label: 'Ingénieur CVSE' },
  { id: 'PHYSICIEN_BATIMENT', label: 'Physicien du bâtiment' },
  { id: 'CONSEIL_ENERGIE', label: 'Conseil en énergie' },
  { id: 'DIAGNOSTIC_POLLUANTS', label: 'Diagnostic amiante et polluants' },
  { id: 'GEOMETRE', label: 'Géomètre' },
  { id: 'ENTREPRISE_GENERALE', label: 'Entreprise générale' },
  { id: 'AUTRE', label: 'Autre' },
]
export const LIBELLE_METIER = Object.fromEntries(METIERS.map((m) => [m.id, m.label])) as Record<MetierPartenaire, string>

export const CANTONS = ['AG', 'AI', 'AR', 'BE', 'BL', 'BS', 'FR', 'GE', 'GL', 'GR', 'JU', 'LU', 'NE', 'NW', 'OW', 'SG', 'SH', 'SO', 'SZ', 'TG', 'TI', 'UR', 'VD', 'VS', 'ZG', 'ZH']

export const LANGUES: { id: string; label: string }[] = [
  { id: 'fr', label: 'Français' },
  { id: 'de', label: 'Allemand' },
  { id: 'it', label: 'Italien' },
  { id: 'en', label: 'Anglais' },
]
export const LIBELLE_LANGUE = Object.fromEntries(LANGUES.map((l) => [l.id, l.label])) as Record<string, string>

export const STATUT_DEMANDE: Record<StatutDemande, { label: string; point: string }> = {
  ENVOYEE: { label: 'En attente de réponse', point: 'bg-amber-500' },
  MESSAGERIE: { label: 'Ouverte dans la messagerie', point: 'bg-neutral-400' },
  ECHEC: { label: 'Échec de l’envoi', point: 'bg-red-500' },
  EN_COURS: { label: 'Échange en cours', point: 'bg-blue-500' },
  TERMINEE: { label: 'Terminée', point: 'bg-emerald-500' },
}

const OBJET: Record<MetierPartenaire, string> = {
  ARCHITECTE: 'Projet de rénovation',
  EXPERT_CECB: 'Demande de certificat énergétique (CECB®)',
  INGENIEUR_CIVIL: 'Expertise de structure',
  INGENIEUR_CVSE: 'Installations techniques à revoir',
  PHYSICIEN_BATIMENT: 'Analyse de l’enveloppe du bâtiment',
  CONSEIL_ENERGIE: 'Conseil en rénovation énergétique',
  DIAGNOSTIC_POLLUANTS: 'Diagnostic amiante et polluants avant travaux',
  GEOMETRE: 'Relevé d’un bâtiment',
  ENTREPRISE_GENERALE: 'Demande d’offre pour des travaux',
  AUTRE: 'Demande de collaboration',
}

const BESOIN: Record<MetierPartenaire, string> = {
  ARCHITECTE: 'J’ai établi le diagnostic d’un bâtiment et je cherche un architecte pour en étudier la rénovation.',
  EXPERT_CECB: 'J’ai établi le diagnostic d’un bâtiment et je souhaite faire établir son certificat énergétique cantonal (CECB®).',
  INGENIEUR_CIVIL: 'Le diagnostic d’un bâtiment fait apparaître des points de structure que je souhaite faire examiner.',
  INGENIEUR_CVSE: 'Le diagnostic d’un bâtiment fait apparaître des installations techniques à revoir (chauffage, ventilation, sanitaire ou électricité).',
  PHYSICIEN_BATIMENT: 'Le diagnostic d’un bâtiment soulève des questions d’enveloppe (isolation, humidité, ponts thermiques) que je souhaite faire analyser.',
  CONSEIL_ENERGIE: 'Je prépare la rénovation énergétique d’un bâtiment et je cherche un conseil sur les variantes et les subventions.',
  DIAGNOSTIC_POLLUANTS: 'Des travaux sont envisagés sur un bâtiment et je souhaite faire établir un diagnostic amiante et polluants au préalable.',
  GEOMETRE: 'J’ai besoin d’un relevé précis d’un bâtiment.',
  ENTREPRISE_GENERALE: 'Le diagnostic d’un bâtiment est établi et je souhaite recevoir une offre pour les travaux.',
  AUTRE: 'Je vous contacte au sujet d’un bâtiment dont j’ai établi le diagnostic.',
}

/** L'objet proposé : selon le métier pour lequel on contacte, et le bâtiment s'il y en a un. */
export function objetPropose(metier: MetierPartenaire, batiment?: string | null): string {
  return batiment ? `${OBJET[metier]}, ${batiment}` : OBJET[metier]
}

/** Le premier jet du message, que l'utilisateur relit et complète. */
export function messagePropose(metier: MetierPartenaire, p: Partenaire, auteur: string, avecDossier: boolean): string {
  const salut = p.contact ? `Bonjour ${p.contact},` : 'Bonjour,'
  const dossier = avecDossier ? ' Vous trouverez ci-dessous le résumé du dossier.' : ''
  return `${salut}\n\n${BESOIN[metier]}${dossier}\n\nSeriez-vous disponible pour en parler ?\n\nMeilleures salutations,\n${auteur}`
}

/** Le texte d'une demande pour la messagerie de l'utilisateur, dossier compris. */
export function corpsPourMessagerie(d: Pick<DemandePartenaire, 'message' | 'dossier' | 'lienRapport'>): string {
  return [
    d.message,
    d.dossier ? `Le bâtiment concerné\n${d.dossier}` : null,
    d.lienRapport ? `Rapport de diagnostic (lecture seule) :\n${d.lienRapport}` : null,
  ].filter(Boolean).join('\n\n')
}

/** Le métier pour lequel on contacte : celui du besoin choisi s'il est le sien, sinon son premier. */
export function metierDeContact(p: Partenaire, besoin: MetierPartenaire[] | null): MetierPartenaire {
  return p.metiers.find((m) => besoin?.includes(m)) ?? p.metiers[0] ?? 'AUTRE'
}

/**
 * L'entrée de l'annuaire : ce dont l'utilisateur a besoin, pas une liste de
 * métiers. Chaque besoin regroupe les métiers (ou les outils) qui y répondent.
 */
export interface Besoin {
  id: 'cecb' | 'renovation' | 'travaux' | 'images' | 'specialiste'
  titre: string
  texte: string
  metiers?: MetierPartenaire[]
  outils?: boolean
}
export const BESOINS: Besoin[] = [
  { id: 'cecb', titre: 'Un certificat énergétique', texte: 'Un expert CECB® certifié établit le certificat du bâtiment.', metiers: ['EXPERT_CECB'] },
  { id: 'renovation', titre: 'Un projet de rénovation', texte: 'Un architecte conçoit la rénovation et conduit les travaux.', metiers: ['ARCHITECTE'] },
  { id: 'travaux', titre: 'Des offres pour les travaux', texte: 'Une entreprise générale chiffre et réalise le chantier.', metiers: ['ENTREPRISE_GENERALE'] },
  { id: 'images', titre: 'Des images du projet', texte: 'Montrer le bâtiment rénové avant les travaux, grâce à l’IA.', outils: true },
  {
    id: 'specialiste', titre: 'Un autre spécialiste', texte: 'Ingénieurs, physique du bâtiment, énergie, amiante, géomètre.',
    metiers: ['INGENIEUR_CIVIL', 'INGENIEUR_CVSE', 'PHYSICIEN_BATIMENT', 'CONSEIL_ENERGIE', 'DIAGNOSTIC_POLLUANTS', 'GEOMETRE', 'AUTRE'],
  },
]

/** Les partenaires qui répondent à un besoin (tous, sans besoin choisi). */
export function repondA(p: Partenaire, b: Besoin | null): boolean {
  if (!b) return true
  if (b.outils) return p.type === 'OUTIL'
  return p.type === 'PRO' && p.metiers.some((m) => b.metiers?.includes(m))
}
