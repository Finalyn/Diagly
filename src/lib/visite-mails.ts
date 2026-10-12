/**
 * Les mails de l'organisation d'une visite, et la préparation qui les nourrit.
 *
 * Chaque modèle sait à qui il s'adresse par défaut, ce qu'il lui faut pour
 * être envoyé (un rendez-vous fixé, des créneaux), et compose son texte avec
 * les données du dossier : adresse, date, durée, personne qui ouvre, documents
 * encore attendus. Le texte reste modifiable avant l'envoi ; il n'est qu'un
 * point de départ bien écrit.
 *
 * Règles d'écriture : vouvoiement, français de Suisse romande, dates en toutes
 * lettres (« mardi 20 octobre 2026 »), heures au format 9h00.
 */
import type { ApiProject, VisitContact, VisitContactRole, VisitPlan } from './api-types'

// ---------------------------------------------------------------- préparation

export interface ElementPreparation { cle: string; label: string }
export interface GroupePreparation { id: 'doc' | 'acces' | 'materiel'; titre: string; aide: string; coche: string; elements: ElementPreparation[] }

/**
 * Ce qu'on prépare avant de partir. La clé est stable : elle est enregistrée
 * dans le plan de visite (checklist).
 */
export const PREPARATION: GroupePreparation[] = [
  {
    id: 'doc', titre: 'Documents', aide: 'À obtenir de la gérance ou du propriétaire', coche: 'Reçu',
    elements: [
      { cle: 'doc:plans', label: 'Plans du bâtiment' },
      { cle: 'doc:renovations', label: 'Dates des dernières rénovations' },
      { cle: 'doc:entretien', label: 'Contrats et rapports d’entretien des installations' },
      { cle: 'doc:chauffage', label: 'Décomptes de chauffage des trois dernières années' },
      { cle: 'doc:cecb', label: 'Certificat énergétique cantonal (CECB®), s’il existe' },
      { cle: 'doc:amiante', label: 'Diagnostic amiante, s’il existe' },
    ],
  },
  {
    id: 'acces', titre: 'Accès', aide: 'Locaux à rendre accessibles le jour de la visite', coche: 'Confirmé',
    elements: [
      { cle: 'acces:communs', label: 'Parties communes et cage d’escalier' },
      { cle: 'acces:combles', label: 'Combles et toiture si praticable' },
      { cle: 'acces:caves', label: 'Caves et buanderie' },
      { cle: 'acces:chaufferie', label: 'Chaufferie' },
      { cle: 'acces:electrique', label: 'Local électrique' },
      { cle: 'acces:ventilation', label: 'Local de ventilation' },
      { cle: 'acces:logements', label: 'Un ou deux logements représentatifs' },
    ],
  },
  {
    id: 'materiel', titre: 'Matériel', aide: 'À emporter', coche: 'Prêt',
    elements: [
      { cle: 'mat:tablette', label: 'Tablette chargée, dossier ouvert hors ligne' },
      { cle: 'mat:lampe', label: 'Lampe frontale' },
      { cle: 'mat:echelle', label: 'Échelle' },
      { cle: 'mat:laser', label: 'Mètre laser' },
      { cle: 'mat:humidimetre', label: 'Humidimètre' },
      { cle: 'mat:thermique', label: 'Caméra thermique' },
    ],
  },
]

// ---------------------------------------------------------------- formats

// En deux temps : le format fr-CH glisse une virgule après le jour (« mardi, 20 »).
const JOUR = new Intl.DateTimeFormat('fr-CH', { weekday: 'long' })
const DATE = new Intl.DateTimeFormat('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' })
export const dateLongue = (d: Date) => `${JOUR.format(d)} ${DATE.format(d)}`
export const heure = (d: Date) => `${d.getHours()}h${String(d.getMinutes()).padStart(2, '0')}`
export function duree(min: number) {
  if (min < 60) return `${min} minutes`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h} heure${h > 1 ? 's' : ''}`
}
const liste = (items: string[]) => items.map((i) => `- ${i}`).join('\n')

export const ROLE_LABEL: Record<VisitContactRole, string> = {
  GERANCE: 'Gérance', PROPRIETAIRE: 'Propriétaire', CONCIERGE: 'Concierge',
  LOCATAIRE: 'Locataire', ENTREPRISE: 'Entreprise', AUTRE: 'Autre',
}

/** Qui appeler sur place : le concierge d'abord, puis la gérance, puis le premier numéro venu. */
export function aAppeler(contacts: VisitContact[]) {
  const avecTel = contacts.filter((c) => c.phone)
  return avecTel.find((c) => c.role === 'CONCIERGE') ?? avecTel.find((c) => c.role === 'GERANCE') ?? avecTel[0] ?? null
}

/** L'itinéraire jusqu'au bâtiment, dans Google Maps. */
export const lienItineraire = (adresse: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresse)}`

// ---------------------------------------------------------------- contexte

export interface Expediteur {
  nom: string
  societe?: string | null
  telephone?: string | null
  email?: string | null
  /** Logo de l'entreprise, pour l'avis imprimé. */
  logo?: string | null
}

export interface ContexteVisite {
  projet: ApiProject
  plan: VisitPlan
  contacts: VisitContact[]
  expediteur: Expediteur
}

function adresse(p: ApiProject) {
  return [p.address, [p.postalCode, p.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || p.name
}

function rendezVous(plan: VisitPlan) {
  if (!plan.startAt) return null
  const debut = new Date(plan.startAt)
  if (Number.isNaN(debut.getTime())) return null
  const min = plan.durationMin ?? 120
  return { debut, fin: new Date(debut.getTime() + min * 60_000), min }
}

function signature(e: Expediteur) {
  return ['Avec nos meilleures salutations,', '', e.nom, e.societe, e.telephone ? `Tél. ${e.telephone}` : null, e.email]
    .filter((l) => l !== null && l !== undefined)
    .join('\n')
}

function ouvreur(c: ContexteVisite) {
  const o = c.contacts.find((x) => x.id === c.plan.openerContactId)
  if (!o) return null
  return o.company ? `${o.name} (${o.company})` : o.name
}

const docsAttendus = (c: ContexteVisite) =>
  PREPARATION[0].elements.filter((e) => !c.plan.checklist?.[e.cle]).map((e) => e.label)
const accesListe = () => PREPARATION[1].elements.map((e) => e.label)

// ---------------------------------------------------------------- modèles

export type IdModele =
  | 'demande' | 'creneaux' | 'documents' | 'confirmation' | 'avis-locataires'
  | 'acces-logement' | 'rappel' | 'report' | 'remerciement'

export type Moment = 'Prendre contact' | 'Fixer le rendez-vous' | 'Prévenir les occupants' | 'Avant la visite' | 'Après la visite'
export const MOMENTS: Moment[] = ['Prendre contact', 'Fixer le rendez-vous', 'Prévenir les occupants', 'Avant la visite', 'Après la visite']

export interface Modele {
  id: IdModele
  titre: string
  moment: Moment
  description: string
  /** Rôles cochés d'office dans les destinataires. */
  destinataires: VisitContactRole[]
  /** Ce qui manque pour l'envoyer, ou null s'il est prêt. */
  manque: (c: ContexteVisite) => string | null
  composer: (c: ContexteVisite) => { objet: string; corps: string }
}

const sansRdv = (c: ContexteVisite) => (rendezVous(c.plan) ? null : 'Fixez d’abord le rendez-vous.')

export const MODELES: Modele[] = [
  {
    id: 'demande', titre: 'Demande de visite', moment: 'Prendre contact',
    description: 'Premier contact : objet de la visite, locaux à ouvrir, documents à préparer.',
    destinataires: ['GERANCE', 'PROPRIETAIRE'],
    manque: () => null,
    composer: (c) => ({
      objet: `Visite technique ${adresse(c.projet)}`,
      corps: [
        'Madame, Monsieur,',
        '',
        `Dans le cadre du diagnostic technique de l’immeuble sis ${adresse(c.projet)}, nous souhaitons convenir d’une date de visite.`,
        '',
        'La visite dure environ deux heures. Elle demande l’accès aux locaux suivants :',
        liste(accesListe()),
        '',
        'Si vous en disposez, merci de préparer les documents suivants :',
        liste(docsAttendus(c).length ? docsAttendus(c) : PREPARATION[0].elements.map((e) => e.label)),
        '',
        'Nous vous remercions de nous indiquer vos disponibilités ainsi que le nom de la personne qui nous ouvrira les locaux.',
        '',
        signature(c.expediteur),
      ].join('\n'),
    }),
  },
  {
    id: 'creneaux', titre: 'Proposition de créneaux', moment: 'Fixer le rendez-vous',
    description: 'Deux ou trois dates au choix, pour fixer la visite en un seul échange.',
    destinataires: ['GERANCE', 'PROPRIETAIRE'],
    manque: (c) => (c.plan.creneaux?.length ? null : 'Ajoutez au moins un créneau à proposer.'),
    composer: (c) => {
      const min = c.plan.durationMin ?? 120
      const creneaux = (c.plan.creneaux ?? []).map((x) => new Date(x.startAt)).filter((d) => !Number.isNaN(d.getTime()))
      return {
        objet: `Visite technique ${adresse(c.projet)} : proposition de dates`,
        corps: [
          'Madame, Monsieur,',
          '',
          `Pour la visite technique de l’immeuble sis ${adresse(c.projet)}, nous pouvons vous proposer les créneaux suivants :`,
          liste(creneaux.map((d) => `${dateLongue(d)} à ${heure(d)}`)),
          '',
          `La visite dure environ ${duree(min)}. Merci de nous indiquer le créneau qui vous convient, ainsi que le nom de la personne qui nous ouvrira les locaux.`,
          '',
          'Si aucune de ces dates ne vous convient, n’hésitez pas à nous en proposer une autre.',
          '',
          signature(c.expediteur),
        ].join('\n'),
      }
    },
  },
  {
    id: 'documents', titre: 'Demande de documents', moment: 'Fixer le rendez-vous',
    description: 'Les documents encore attendus, d’après la préparation.',
    destinataires: ['GERANCE', 'PROPRIETAIRE'],
    manque: (c) => (docsAttendus(c).length ? null : 'Tous les documents sont marqués comme reçus.'),
    composer: (c) => ({
      objet: `Diagnostic ${adresse(c.projet)} : documents`,
      corps: [
        'Madame, Monsieur,',
        '',
        `Afin de préparer le diagnostic technique de l’immeuble sis ${adresse(c.projet)}, nous vous serions reconnaissants de nous transmettre, si vous en disposez, les documents suivants :`,
        liste(docsAttendus(c)),
        '',
        'Une copie numérique suffit. Ces documents nous évitent des hypothèses au moment du chiffrage des travaux.',
        '',
        signature(c.expediteur),
      ].join('\n'),
    }),
  },
  {
    id: 'confirmation', titre: 'Confirmation du rendez-vous', moment: 'Fixer le rendez-vous',
    description: 'Date, heure, durée, lieu de rendez-vous et locaux à ouvrir.',
    destinataires: ['GERANCE', 'PROPRIETAIRE', 'CONCIERGE'],
    manque: sansRdv,
    composer: (c) => {
      const r = rendezVous(c.plan)!
      const o = ouvreur(c)
      return {
        objet: `Confirmation : visite technique le ${dateLongue(r.debut)}`,
        corps: [
          'Madame, Monsieur,',
          '',
          `Nous vous confirmons la visite technique de l’immeuble sis ${adresse(c.projet)} :`,
          '',
          `Date : ${dateLongue(r.debut)}`,
          `Heure : de ${heure(r.debut)} à ${heure(r.fin)} environ`,
          c.plan.meetingPoint ? `Rendez-vous : ${c.plan.meetingPoint}` : null,
          o ? `Ouverture des locaux : ${o}` : null,
          '',
          'Merci de prévoir l’accès aux locaux suivants :',
          liste(accesListe()),
          '',
          'Nous vous remercions de bien vouloir informer les locataires de notre passage.',
          '',
          signature(c.expediteur),
        ].filter((l) => l !== null).join('\n'),
      }
    },
  },
  {
    id: 'avis-locataires', titre: 'Avis aux locataires', moment: 'Prévenir les occupants',
    description: 'Informe les occupants du passage. S’envoie ou s’imprime pour l’affichage.',
    destinataires: ['LOCATAIRE'],
    manque: sansRdv,
    composer: (c) => {
      const r = rendezVous(c.plan)!
      return {
        objet: `Avis de passage : visite technique le ${dateLongue(r.debut)}`,
        corps: [
          'Madame, Monsieur,',
          '',
          `Nous vous informons qu’une visite technique de l’immeuble sis ${adresse(c.projet)} aura lieu le ${dateLongue(r.debut)}, de ${heure(r.debut)} à ${heure(r.fin)} environ.`,
          '',
          'Cette visite s’inscrit dans un diagnostic de l’état du bâtiment demandé par le propriétaire. Elle porte sur les parties communes, la toiture, les caves et les locaux techniques. Elle n’entraîne aucune intervention ni aucune coupure.',
          '',
          'Avec votre accord, nous pourrions être amenés à visiter brièvement quelques logements. Si vous acceptez de nous recevoir, ou si vous souhaitez nous signaler un problème (humidité, fenêtres, chauffage), merci de nous contacter.',
          '',
          'Nous vous remercions de votre compréhension.',
          '',
          signature(c.expediteur),
        ].join('\n'),
      }
    },
  },
  {
    id: 'acces-logement', titre: 'Accès à un logement', moment: 'Prévenir les occupants',
    description: 'Demande à un locataire de recevoir le diagnostiqueur une vingtaine de minutes.',
    destinataires: [],
    manque: sansRdv,
    composer: (c) => {
      const r = rendezVous(c.plan)!
      return {
        objet: `Visite technique du ${dateLongue(r.debut)} : accès à votre logement`,
        corps: [
          'Madame, Monsieur,',
          '',
          `Dans le cadre de la visite technique de l’immeuble sis ${adresse(c.projet)}, prévue le ${dateLongue(r.debut)} entre ${heure(r.debut)} et ${heure(r.fin)}, nous aimerions voir votre logement pendant une vingtaine de minutes.`,
          '',
          'Nous regarderons l’état des fenêtres, des installations sanitaires, de la cuisine et des radiateurs. Nous ne prenons aucune photo de vos effets personnels.',
          '',
          'Pourriez-vous nous indiquer si cela vous est possible, et à quel moment de la plage vous serez présent ? Si vous préférez qu’une autre personne nous ouvre, merci de nous le préciser.',
          '',
          signature(c.expediteur),
        ].join('\n'),
      }
    },
  },
  {
    id: 'rappel', titre: 'Rappel de la visite', moment: 'Avant la visite',
    description: 'À envoyer la veille ou l’avant-veille.',
    destinataires: ['GERANCE', 'PROPRIETAIRE', 'CONCIERGE'],
    manque: sansRdv,
    composer: (c) => {
      const r = rendezVous(c.plan)!
      const o = ouvreur(c)
      return {
        objet: `Rappel : visite technique le ${dateLongue(r.debut)} à ${heure(r.debut)}`,
        corps: [
          'Madame, Monsieur,',
          '',
          `Nous vous rappelons la visite technique de l’immeuble sis ${adresse(c.projet)}, le ${dateLongue(r.debut)} à ${heure(r.debut)}${c.plan.meetingPoint ? ` (rendez-vous : ${c.plan.meetingPoint})` : ''}.`,
          o ? `\n${o} nous ouvrira les locaux.` : null,
          '',
          'Merci de vérifier que les caves, les combles et les locaux techniques seront accessibles.',
          '',
          signature(c.expediteur),
        ].filter((l) => l !== null).join('\n'),
      }
    },
  },
  {
    id: 'report', titre: 'Report de la visite', moment: 'Avant la visite',
    description: 'Annonce un empêchement et propose de nouvelles dates.',
    destinataires: ['GERANCE', 'PROPRIETAIRE', 'CONCIERGE'],
    manque: sansRdv,
    composer: (c) => {
      const r = rendezVous(c.plan)!
      const creneaux = (c.plan.creneaux ?? []).map((x) => new Date(x.startAt)).filter((d) => !Number.isNaN(d.getTime()) && d > new Date())
      return {
        objet: `Report de la visite technique du ${dateLongue(r.debut)}`,
        corps: [
          'Madame, Monsieur,',
          '',
          `Nous sommes contraints de reporter la visite technique de l’immeuble sis ${adresse(c.projet)}, prévue le ${dateLongue(r.debut)} à ${heure(r.debut)}. Nous vous prions de nous en excuser.`,
          '',
          creneaux.length
            ? `Nous pouvons vous proposer les créneaux suivants :\n${liste(creneaux.map((d) => `${dateLongue(d)} à ${heure(d)}`))}`
            : 'Nous reviendrons vers vous très rapidement avec de nouvelles dates.',
          '',
          'Merci de bien vouloir en informer les locataires.',
          '',
          signature(c.expediteur),
        ].join('\n'),
      }
    },
  },
  {
    id: 'remerciement', titre: 'Remerciements et suite', moment: 'Après la visite',
    description: 'Remercie, annonce le délai du rapport et rappelle les documents manquants.',
    destinataires: ['GERANCE', 'PROPRIETAIRE'],
    manque: () => null,
    composer: (c) => {
      const r = rendezVous(c.plan)
      const manquants = docsAttendus(c)
      return {
        objet: `Visite technique ${adresse(c.projet)} : remerciements`,
        corps: [
          'Madame, Monsieur,',
          '',
          `Nous vous remercions pour votre accueil${r ? ` lors de la visite du ${dateLongue(r.debut)}` : ' lors de notre visite'}.`,
          '',
          'Le rapport de diagnostic, avec l’état des éléments, les priorités d’intervention et l’estimation des coûts, vous sera transmis dans un délai d’environ trois semaines.',
          manquants.length ? `\nPour le compléter, il nous manque encore les documents suivants :\n${liste(manquants)}` : null,
          '',
          'Nous restons à votre disposition pour toute question.',
          '',
          signature(c.expediteur),
        ].filter((l) => l !== null).join('\n'),
      }
    },
  },
]

export const modele = (id: string) => MODELES.find((m) => m.id === id)

/** Les interlocuteurs cochés d'office pour un modèle : ceux qui ont une adresse et le bon rôle. */
export function destinatairesParDefaut(m: Modele, contacts: VisitContact[]) {
  return contacts.filter((c) => c.email && m.destinataires.includes(c.role)).map((c) => c.id)
}
