import { CONTACT, PLUS, PRIX_DIAGNOSTIC, PRO, QUESTIONS, remise, type Abonnement } from './accueil/contenu'
import { ARTICLES, type Article } from './blog/articles'

/**
 * Le référencement du site public : pour chaque page, son titre, sa
 * description, son adresse canonique et ses données structurées (JSON-LD).
 *
 * Les mêmes données servent deux fois : au build, où chaque page est rendue
 * en HTML avec cette tête (scripts/prerendu.mjs), pour les moteurs de
 * recherche et les assistants d'IA qui ne lisent pas le JavaScript ; puis
 * dans le navigateur, où la page met sa tête à jour en arrivant (tete.ts).
 *
 * Les données structurées disent les faits utiles à un moteur : ce qu'est
 * Diagly (SoftwareApplication, avec ses offres et ses fonctionnalités), qui
 * le publie (Organization), les questions fréquentes (FAQPage), les articles
 * (BlogPosting) et le fil d'Ariane des pages intérieures.
 */

export const SITE = 'https://diagly.ch'

export interface Tete {
  chemin: string
  titre: string
  description: string
  type: 'website' | 'article'
  jsonld: Record<string, unknown>[]
}

const EMAIL = CONTACT.replace('mailto:', '')

const ORGANISATION = {
  '@type': 'Organization',
  '@id': `${SITE}/#organisation`,
  name: 'Diagly',
  url: `${SITE}/`,
  logo: `${SITE}/diagly-logo.png`,
  email: EMAIL,
  areaServed: { '@type': 'Country', name: 'Suisse' },
  parentOrganization: { '@type': 'Organization', name: 'Finalyn' },
}

/** Les fonctionnalités, telles qu'un moteur ou un assistant d'IA doit les retenir. */
export const FONCTIONNALITES_CLES = [
  'Métrés tirés des plans par l’IA : échelle vérifiée, pièces, façades, fenêtres et portes comptées',
  'Surfaces SIA 416 (SP, SN, SC) étage par étage, export Excel',
  'Relevé de l’état sur iPad et iPhone, ouvrage par ouvrage, même hors connexion',
  'Guide IA qui vérifie chaque photo et propose un état',
  'Base de données de prix par code CFC, un prix par état',
  'Chiffrage automatique avec honoraires, réserve et TVA suisse à 8,1 %, estimation à ±15 %',
  'Variantes de travaux comparées, priorités I à III et horizons de travaux',
  'Rapports à l’en-tête du bureau, en PDF ou par lien au client',
  'Présentation 16:9 des plans de repérage et métrés',
  'Assistant IA sur les dossiers, API en lecture, webhooks et serveur MCP',
  'App iPhone et iPad, installable sur Mac et PC, et dans le navigateur',
  'Données hébergées en Suisse chez Infomaniak',
]

/** Un abonnement, tel qu'un moteur doit le lire : un prix par mois, engagement d'un an. */
function offreAbonnement(a: Abonnement) {
  return {
    '@type': 'Offer',
    name: `Abonnement ${a.nom}, engagement d’un an, prix par mois`,
    description: `${a.inclus} diagnostics compris par mois, puis ${a.prixSuivant} CHF le diagnostic (${remise(a)} % de moins qu’à l’unité) ; une heure de formation incluse la première année`,
    price: String(a.prixMois),
    priceCurrency: 'CHF',
    priceSpecification: { '@type': 'UnitPriceSpecification', price: String(a.prixMois), priceCurrency: 'CHF', unitText: 'mois' },
  }
}

const APPLICATION = {
  '@type': 'SoftwareApplication',
  '@id': `${SITE}/#application`,
  name: 'Diagly',
  url: `${SITE}/`,
  image: `${SITE}/og-image.jpg`,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web, iOS, iPadOS, macOS, Windows',
  inLanguage: 'fr-CH',
  description: 'Logiciel suisse de diagnostic de bâtiment : métrés tirés des plans par l’IA, relevé de l’état sur iPad et iPhone, chiffrage par code CFC et rapports à l’en-tête du bureau.',
  featureList: FONCTIONNALITES_CLES,
  publisher: { '@id': `${SITE}/#organisation` },
  offers: [
    { '@type': 'Offer', name: 'Diagnostic à l’unité', price: String(PRIX_DIAGNOSTIC), priceCurrency: 'CHF' },
    offreAbonnement(PLUS),
    offreAbonnement(PRO),
    { '@type': 'Offer', name: 'Entreprise', description: 'Sur devis : volume sur mesure, plusieurs équipes, API et webhooks.', priceCurrency: 'CHF' },
  ],
}

function filDAriane(etapes: [string, string][]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: etapes.map(([nom, chemin], i) => ({ '@type': 'ListItem', position: i + 1, name: nom, item: `${SITE}${chemin}` })),
  }
}

function faq(questions: { q: string; r: string }[]) {
  return {
    '@type': 'FAQPage',
    mainEntity: questions.map((x) => ({ '@type': 'Question', name: x.q, acceptedAnswer: { '@type': 'Answer', text: x.r } })),
  }
}

export const TETE_ACCUEIL: Tete = {
  chemin: '/',
  titre: 'Diagly : logiciel de diagnostic de bâtiment en Suisse, des plans au rapport chiffré',
  description: 'Diagly tire les métrés de vos plans avec l’IA, guide le relevé sur iPad et iPhone, chiffre les travaux par code CFC et sort le rapport à votre en-tête. Créé par des professionnels du bâtiment suisse, hébergé en Suisse.',
  type: 'website',
  jsonld: [ORGANISATION, APPLICATION, { '@type': 'WebSite', '@id': `${SITE}/#site`, url: `${SITE}/`, name: 'Diagly', inLanguage: 'fr-CH', publisher: { '@id': `${SITE}/#organisation` } }, faq(QUESTIONS)],
}

export const TETE_FONCTIONNALITES: Tete = {
  chemin: '/fonctionnalites',
  titre: 'Fonctionnalités de Diagly : métrés par l’IA, relevé hors connexion, chiffrage CFC, rapports',
  description: 'Démarrer un dossier, métrés par l’IA, relevé sur iPad et iPhone même hors connexion, base de prix CFC, chiffrage, présentation 16:9, rapports et assistant : chaque outil de Diagly, montré sur l’application.',
  type: 'website',
  jsonld: [ORGANISATION, APPLICATION, filDAriane([['Accueil', '/'], ['Fonctionnalités', '/fonctionnalites']])],
}

export const TETE_BLOG: Tete = {
  chemin: '/blog',
  titre: 'Blog Diagly : diagnostic de bâtiment, codes CFC, SIA 416 et rénovation en Suisse',
  description: 'Guides pratiques pour les diagnostiqueurs, architectes et régies de Suisse romande : déroulement d’un diagnostic, codes CFC, surfaces SIA 416, certificat énergétique, métrés par l’IA.',
  type: 'website',
  jsonld: [
    ORGANISATION,
    {
      '@type': 'Blog', '@id': `${SITE}/blog#blog`, url: `${SITE}/blog`, name: 'Blog Diagly', inLanguage: 'fr-CH',
      publisher: { '@id': `${SITE}/#organisation` },
      blogPost: ARTICLES.map((a) => ({ '@type': 'BlogPosting', headline: a.titre, url: `${SITE}/blog/${a.slug}`, datePublished: a.date })),
    },
    filDAriane([['Accueil', '/'], ['Blog', '/blog']]),
  ],
}

export function teteArticle(a: Article): Tete {
  const url = `${SITE}/blog/${a.slug}`
  return {
    chemin: `/blog/${a.slug}`,
    titre: `${a.titre} | Blog Diagly`,
    description: a.description,
    type: 'article',
    jsonld: [
      ORGANISATION,
      {
        '@type': 'BlogPosting', '@id': `${url}#article`, mainEntityOfPage: url, url, headline: a.titre, description: a.description,
        abstract: a.enBref, inLanguage: 'fr-CH', datePublished: a.date, dateModified: a.date, image: `${SITE}/og-image.jpg`,
        author: { '@id': `${SITE}/#organisation` }, publisher: { '@id': `${SITE}/#organisation` }, about: a.sujet,
      },
      filDAriane([['Accueil', '/'], ['Blog', '/blog'], [a.titre, `/blog/${a.slug}`]]),
      ...(a.faq?.length ? [faq(a.faq)] : []),
    ],
  }
}
