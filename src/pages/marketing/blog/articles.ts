import { MENTION_CECB } from '@/lib/marque-cecb'

/**
 * Les articles du blog de diagly.ch.
 *
 * Ils répondent aux questions que se posent les diagnostiqueurs, les
 * architectes, les bureaux d'ingénieurs et les régies de Suisse romande :
 * comment se déroule un diagnostic, comment lire les codes CFC et les
 * surfaces SIA 416, que faire d'un certificat énergétique. Chacun s'ouvre
 * sur un « En bref » qui répond en trois phrases : c'est ce que lisent
 * d'abord les moteurs de recherche et les assistants d'IA.
 *
 * Les faits sont vérifiables (normes, nomenclatures) ; ce qui concerne Diagly
 * décrit ce que fait l'application aujourd'hui, et les chiffres mesurés le
 * disent. Les articles sont rendus en HTML au moment du build
 * (scripts/prerendu.mjs) et repris dans llms-full.txt.
 */

export interface Bloc {
  /** Le titre de la partie (h2). */
  titre: string
  paragraphes?: string[]
  liste?: string[]
  /** Une liste numérotée, quand l'ordre compte. */
  ordonnee?: boolean
}

export interface Article {
  slug: string
  titre: string
  description: string
  /** La réponse courte, en tête d'article. */
  enBref: string
  /** Date de publication, AAAA-MM-JJ. */
  date: string
  /** Minutes de lecture, arrondies. */
  lecture: number
  /** Le mot-clé principal, pour le classement et les liens entre articles. */
  sujet: string
  blocs: Bloc[]
  faq?: { q: string; r: string }[]
  /** Une mention légale en pied d'article (marque déposée). */
  mention?: string
  /** La fonctionnalité de Diagly liée, sur la page Fonctionnalités. */
  lien: { libelle: string; ancre: string }
}

export const ARTICLES: Article[] = [
  {
    slug: 'diagnostic-batiment-suisse-guide',
    titre: 'Diagnostic de bâtiment en Suisse : le guide pas à pas',
    description: 'Ce qu’est un diagnostic de bâtiment, à quoi il sert, comment il se déroule, du relevé de l’état au chiffrage par code CFC, et ce que doit contenir le rapport.',
    enBref: 'Un diagnostic de bâtiment fait l’état de chaque ouvrage (façade, toiture, installations, intérieurs), en déduit les travaux et leur priorité, puis les chiffre. En Suisse, le chiffrage suit le plus souvent les codes CFC et les surfaces se mesurent selon la norme SIA 416. Le résultat est un rapport qui sert à planifier l’entretien ou la rénovation d’un immeuble.',
    date: '2026-10-19',
    lecture: 6,
    sujet: 'Diagnostic de bâtiment',
    blocs: [
      {
        titre: 'À quoi sert un diagnostic de bâtiment ?',
        paragraphes: [
          'Le diagnostic répond à une question simple : dans quel état est ce bâtiment, et que faudra-t-il y faire, quand, pour combien ? Il est demandé par un propriétaire, une régie, une gérance ou une communauté de propriétaires par étages (PPE), avant un achat, avant une rénovation, ou pour bâtir un budget d’entretien sur plusieurs années.',
          'Pour une PPE, il aide à dimensionner le fonds de rénovation. Pour une régie qui gère un parc, il permet de comparer les immeubles entre eux et de répartir les travaux dans le temps.',
        ],
      },
      {
        titre: 'Le déroulement d’un diagnostic',
        ordonnee: true,
        liste: [
          'Rassembler ce qui existe : les plans, un éventuel certificat énergétique (CECB®), les données du registre fédéral des bâtiments.',
          'Préparer la visite : le rendez-vous, l’accès aux locaux techniques et aux combles, l’information des locataires.',
          'Relever l’état sur place, ouvrage par ouvrage, dans l’ordre du tour du bâtiment : une photo, un état, une remarque.',
          'Déduire de chaque état les travaux à prévoir et leur priorité.',
          'Chiffrer : les quantités du bâtiment multipliées par les prix des travaux.',
          'Rédiger le rapport et le remettre au client.',
        ],
      },
      {
        titre: 'Noter l’état d’un ouvrage',
        paragraphes: [
          'La pratique la plus répandue note chaque ouvrage sur quatre états : très bon, bon, moyen, mauvais. L’état appelle des travaux (entretien, réparation, remplacement) et une priorité, souvent sur trois niveaux : I pour l’urgent, II pour le moyen terme, III pour ce qui peut attendre.',
          'Les travaux se rangent ensuite par horizon, par exemple de 0 à 5 ans, de 5 à 10 ans et au-delà. C’est cette lecture dans le temps qui fait d’un diagnostic un outil de planification, et pas seulement un constat.',
        ],
      },
      {
        titre: 'Chiffrer les travaux : codes CFC et quantités',
        paragraphes: [
          'Chaque travail se rattache à une position du Code des frais de construction (CFC), par exemple 221 pour les fenêtres ou 224 pour la couverture. Son coût est le produit d’une quantité (des m² de façade, des pièces de fenêtres) par un prix unitaire qui dépend de l’état constaté.',
          'Au total des travaux hors taxes s’ajoutent les honoraires, une réserve pour imprévus et la TVA, à 8,1 % en Suisse. À ce stade, on parle d’une estimation : une enveloppe à plus ou moins 15 %, qui sert à arbitrer et à budgéter, pas d’un devis d’entreprise.',
        ],
      },
      {
        titre: 'Ce que doit contenir le rapport',
        liste: [
          'Une synthèse lisible par le client : l’état général, les urgences, l’enveloppe des travaux.',
          'La description du bâtiment : adresse, année de construction, niveaux, surfaces.',
          'L’état de chaque ouvrage, avec sa photo et les travaux qu’il appelle.',
          'Le devis estimatif, poste par poste, rangé par code CFC.',
          'La planification des travaux par priorité et par horizon.',
        ],
      },
      {
        titre: 'Gagner du temps sans perdre en rigueur',
        paragraphes: [
          'Une grande partie du temps d’un diagnostic part dans la ressaisie : reporter les mesures des plans, retrouver les photos, recopier les prix, mettre en page. Un outil dédié comme Diagly reprend ces étapes : l’IA tire les métrés des plans, le relevé se fait sur iPad ou iPhone, même hors connexion, le chiffrage s’appuie sur une base de prix par code CFC, et le rapport sort à l’en-tête du bureau.',
        ],
      },
    ],
    faq: [
      { q: 'Quelle différence entre un diagnostic et un CECB® ?', r: 'Le certificat énergétique (CECB®) évalue la performance énergétique de l’enveloppe et des installations. Le diagnostic évalue l’état de chaque ouvrage et les travaux à prévoir. Les deux se complètent : le CECB® éclaire les travaux énergétiques, le diagnostic couvre tout le bâtiment.' },
      { q: 'Qui réalise un diagnostic de bâtiment ?', r: 'Le plus souvent un architecte, un bureau d’ingénieurs ou un expert en bâtiment, mandaté par le propriétaire, la régie ou la PPE.' },
    ],
    lien: { libelle: 'Le relevé sur place dans Diagly', ancre: 'releve' },
  },
  {
    slug: 'codes-cfc-chiffrer-renovation',
    titre: 'Codes CFC : comprendre la nomenclature pour chiffrer une rénovation',
    description: 'Le Code des frais de construction (CFC) range chaque travail dans une position numérotée. Comment il est structuré, et comment s’en servir pour estimer une rénovation.',
    enBref: 'Le CFC (Code des frais de construction, norme SN 506 500 publiée par CRB) classe les coûts d’une construction en groupes numérotés : 1 pour les travaux préparatoires, 2 pour le bâtiment, 4 pour les aménagements extérieurs, 5 pour les frais secondaires. Chiffrer une rénovation par CFC permet de comparer les offres et de suivre le budget poste par poste.',
    date: '2026-10-19',
    lecture: 6,
    sujet: 'Codes CFC',
    blocs: [
      {
        titre: 'Qu’est-ce que le CFC ?',
        paragraphes: [
          'Le Code des frais de construction est la nomenclature de référence des coûts de construction en Suisse. Il range chaque travail dans une position numérotée, de la plus générale (un chiffre) à la plus fine (jusqu’à quatre niveaux). Architectes, entreprises et maîtres d’ouvrage parlent ainsi la même langue : la position 221 désigne partout les fenêtres et portes extérieures.',
        ],
      },
      {
        titre: 'Les groupes principaux',
        liste: [
          '0 : terrain',
          '1 : travaux préparatoires (dont les protections et aménagements provisoires)',
          '2 : bâtiment',
          '3 : équipements d’exploitation',
          '4 : aménagements extérieurs',
          '5 : frais secondaires et comptes d’attente',
          '9 : ameublement et décoration',
        ],
      },
      {
        titre: 'Le groupe 2, bâtiment, en détail',
        paragraphes: [
          'Une rénovation se chiffre surtout dans le groupe 2. Ses sous-groupes suivent l’ordre du chantier :',
        ],
        liste: [
          '21 : gros œuvre 1 (maçonnerie, béton, constructions en acier et en bois)',
          '22 : gros œuvre 2 (221 fenêtres et portes extérieures, 222 ferblanterie, 224 couverture, 226 crépissages de façade, 228 fermetures extérieures et protection solaire)',
          '23 : installations électriques',
          '24 : chauffage, ventilation, conditionnement d’air',
          '25 : installations sanitaires',
          '26 : installations de transport (ascenseurs)',
          '27 et 28 : aménagements intérieurs (281 revêtements de sol, 285 traitement des surfaces intérieures, 287 nettoyage du bâtiment)',
          '29 : honoraires',
        ],
      },
      {
        titre: 'Chiffrer une rénovation par CFC',
        paragraphes: [
          'Chaque ligne du devis porte un code, une désignation, une quantité, une unité et un prix unitaire. Le montant de la ligne est la quantité multipliée par le prix. Les lignes se regroupent par position à trois chiffres, ce qui donne une lecture par corps de métier, celle qu’attendent les entreprises et les maîtres d’ouvrage.',
          'Pour une rénovation, le prix dépend de l’état constaté : une fenêtre en état moyen appelle un entretien, une fenêtre en mauvais état un remplacement. C’est pourquoi une base de prix utile donne, pour chaque article, un prix par état.',
        ],
      },
      {
        titre: 'Les pièges courants',
        liste: [
          'Compter deux fois les mêmes m² : la façade et ses fenêtres, par exemple, quand la façade est comptée vitrage compris.',
          'Oublier les postes de chantier : protection des ouvrages existants, échafaudage, nettoyage final.',
          'Utiliser des prix anciens sans les ajuster au marché.',
          'Mélanger travaux, honoraires et TVA dans une même ligne.',
        ],
      },
      {
        titre: 'Le CFC dans Diagly',
        paragraphes: [
          'Dans Diagly, chaque ouvrage relevé porte son code CFC, son unité et sa quantité, et la base de données du bureau donne un prix et des travaux pour chaque état. Les postes de chantier (protection, échafaudage, nettoyage) s’ajoutent d’eux-mêmes, et le rapport comme les exports suivent la structure du CFC.',
        ],
      },
    ],
    faq: [
      { q: 'CFC ou eCCC-Bât ?', r: 'Le CFC classe les coûts par type de travaux, ce qui correspond aux corps de métier. L’eCCC-Bât (SN 506 511), plus récent, les classe par élément de construction. Les offres d’entreprises restent très souvent établies en CFC.' },
      { q: 'Faut-il chiffrer jusqu’au quatrième niveau ?', r: 'Pour un diagnostic, le niveau à trois chiffres suffit en général à la lecture du devis ; le détail sert à décrire précisément un travail.' },
    ],
    lien: { libelle: 'La base de données CFC de Diagly', ancre: 'base' },
  },
  {
    slug: 'sia-416-surfaces-sp-sn-sc',
    titre: 'SIA 416 : comprendre les surfaces SP, SN, SC et leurs sous-catégories',
    description: 'La norme SIA 416 définit comment mesurer les surfaces d’un bâtiment. Ce que recouvrent SP, SC, SN, SU, SD et SI, avec un exemple chiffré.',
    enBref: 'Selon la norme SIA 416, la surface de plancher (SP) se divise en surface de construction (SC : murs, poteaux) et surface nette (SN). La surface nette se divise à son tour en surface utile (SU, principale SUP et secondaire SUS), surface de dégagement (SD) et surface d’installations (SI).',
    date: '2026-10-19',
    lecture: 5,
    sujet: 'SIA 416',
    blocs: [
      {
        titre: 'Pourquoi une norme pour les surfaces ?',
        paragraphes: [
          'Une surface « habitable » ou « utile » ne veut rien dire tant qu’on n’a pas dit ce qu’on y compte. La norme SIA 416 fixe ces règles pour les surfaces et les volumes des bâtiments : deux bureaux qui mesurent le même étage trouvent les mêmes chiffres, et les comparaisons entre immeubles deviennent possibles.',
        ],
      },
      {
        titre: 'La surface de plancher et ses deux parts',
        paragraphes: [
          'La surface de plancher (SP) est la surface de chaque niveau, mesurée à l’extérieur des murs. Elle se partage en deux :',
        ],
        liste: [
          'la surface de construction (SC) : ce que les murs, les poteaux et les cloisons occupent au sol ;',
          'la surface nette (SN) : tout le reste, la surface entre les murs.',
        ],
      },
      {
        titre: 'Ce que contient la surface nette',
        liste: [
          'Surface utile (SU) : principale (SUP), celle des logements, des bureaux, des classes ; secondaire (SUS), celle des caves, des buanderies, des locaux de rangement.',
          'Surface de dégagement (SD) : couloirs, halls, cages d’escalier.',
          'Surface d’installations (SI) : locaux techniques, chaufferie, gaines.',
        ],
      },
      {
        titre: 'Un exemple',
        paragraphes: [
          'Prenons un étage d’exemple de 220 m² de surface de plancher. Les murs et cloisons en occupent 22 m² : c’est la SC, et il reste 198 m² de surface nette. Sur ces 198 m², deux logements font 170 m² (SUP), la cage d’escalier et le palier 22 m² (SD), un local technique 6 m² (SI).',
          'Ces chiffres servent ensuite partout : la SP pour des ratios de coût par m², la SN et ses parts pour les loyers, l’entretien ou le nettoyage.',
        ],
      },
      {
        titre: 'Les surfaces SIA 416 dans Diagly',
        paragraphes: [
          'Quand l’IA de Diagly lit un jeu de plans, les pièces dessinées donnent les surfaces étage par étage : SP, SN et SC, la SN rangée en SUP, SUS, SD et SI d’après le nom des locaux. Elles s’affichent comme des surfaces à vérifier, et sortent dans l’export Excel des métrés.',
        ],
      },
    ],
    faq: [
      { q: 'Les escaliers font-ils partie de la surface utile ?', r: 'Non. Les cages d’escalier et les couloirs comptent en surface de dégagement (SD), dans la surface nette.' },
      { q: 'La SRE du CECB® est-elle une surface SIA 416 ?', r: 'Non. La surface de référence énergétique (SRE), utilisée pour le certificat énergétique, suit ses propres règles (norme SIA 380). Elle ne se confond pas avec la surface de plancher.' },
    ],
    lien: { libelle: 'Les métrés et les surfaces dans Diagly', ancre: 'quantites' },
  },
  {
    slug: 'cecb-certificat-energetique-diagnostic',
    titre: 'CECB® : lire un certificat énergétique et s’en servir dans un diagnostic',
    description: 'Le certificat énergétique cantonal des bâtiments (CECB®) classe un bâtiment de A à G. Ce qu’il dit, ce qu’il ne dit pas, et comment l’exploiter pour planifier une rénovation.',
    enBref: 'Le certificat énergétique cantonal des bâtiments (CECB®) note un bâtiment sur deux échelles de A à G : l’efficacité de l’enveloppe (isolation, fenêtres) et l’efficacité énergétique globale (enveloppe et installations). Le CECB® Plus y ajoute un rapport de conseil avec des variantes de rénovation. Il complète un diagnostic de l’état, sans le remplacer.',
    date: '2026-10-19',
    lecture: 5,
    sujet: 'Certificat énergétique',
    blocs: [
      {
        titre: 'Le CECB® en quelques mots',
        paragraphes: [
          'Le certificat énergétique cantonal des bâtiments est établi par un expert certifié. Il décrit la performance énergétique d’un bâtiment avec une étiquette commune à toute la Suisse, de A, le plus efficace, à G.',
        ],
      },
      {
        titre: 'Les deux classes de l’étiquette',
        liste: [
          'L’efficacité de l’enveloppe : ce que le bâtiment perd par ses murs, sa toiture, ses fenêtres et ses sols.',
          'L’efficacité énergétique globale : l’enveloppe, plus le chauffage, l’eau chaude et l’électricité, selon l’agent énergétique utilisé.',
        ],
      },
      {
        titre: 'CECB® et CECB® Plus',
        paragraphes: [
          'Le CECB® Plus ajoute au certificat un rapport de conseil : des variantes de rénovation, leur effet sur les classes et une estimation de leur coût. Il est souvent demandé pour des subventions importantes. Les règles varient selon les cantons : renseignez-vous auprès du vôtre.',
        ],
      },
      {
        titre: 'Ce que le certificat apporte à un diagnostic',
        liste: [
          'Des données sur l’enveloppe : composition des murs, type de fenêtres, isolation de la toiture.',
          'Les installations existantes : production de chaleur, agent énergétique.',
          'Une hiérarchie des travaux énergétiques, utile pour fixer les priorités.',
        ],
      },
      {
        titre: 'Ce qu’il ne remplace pas',
        paragraphes: [
          'Le certificat ne dit pas l’état d’usure d’une façade, l’étanchéité d’une toiture, la vétusté d’une cuisine ou d’une colonne de chute. Il ne chiffre pas non plus les travaux poste par poste. C’est le rôle du diagnostic de l’état, que le certificat vient éclairer.',
        ],
      },
      {
        titre: 'Partir d’un certificat énergétique dans Diagly',
        paragraphes: [
          'Dans Diagly, un certificat énergétique (CECB®) en PDF peut servir de point de départ : il pré-remplit le bâtiment et son étiquette, que vous relisez avant de créer le dossier. Les ouvrages existants qu’il décrit (une façade non isolée, une chaudière au mazout) deviennent des relevés à vérifier sur place.',
        ],
      },
    ],
    faq: [
      { q: 'Le certificat énergétique est-il obligatoire ?', r: 'Selon les cantons et les situations (vente d’un bien, demande de subvention), il peut être exigé. Les règles diffèrent d’un canton à l’autre.' },
      { q: 'Qui peut établir un CECB® ?', r: 'Un expert certifié, inscrit auprès de l’association qui gère le certificat. Seul son certificat fait foi.' },
    ],
    mention: MENTION_CECB,
    lien: { libelle: 'Démarrer un dossier depuis un certificat dans Diagly', ancre: 'demarrer' },
  },
  {
    slug: 'metres-plans-intelligence-artificielle',
    titre: 'Métrés à partir de plans : ce que l’IA change pour le diagnostiqueur',
    description: 'Lire l’échelle, dessiner les pièces, compter les portes et les fenêtres : comment l’IA prépare les métrés d’un jeu de plans, et pourquoi la validation humaine reste au centre.',
    enBref: 'Une IA sait aujourd’hui lire un plan d’architecte : trouver l’échelle au cartouche, la vérifier sur une cote, dessiner les pièces, les façades et les fenêtres, et compter les portes. Elle propose, le diagnostiqueur valide. Dans Diagly, une feuille se lit en une quarantaine de secondes, avec un écart inférieur à 0,1 % sur les surfaces tracées*.',
    date: '2026-10-19',
    lecture: 5,
    sujet: 'Métrés',
    blocs: [
      {
        titre: 'Le métré, un travail de patience',
        paragraphes: [
          'Avant de chiffrer, il faut mesurer : les surfaces de chaque pièce, les m² de façade, le nombre de fenêtres et de portes, étage par étage. Sur un jeu de plans complet, c’est souvent la partie la plus longue du dossier, et la plus exposée aux erreurs de report.',
        ],
      },
      {
        titre: 'Ce que l’IA lit sur un plan',
        liste: [
          'Le cartouche : le numéro de la feuille, son titre, l’étage, et les étages identiques qu’elle représente.',
          'L’échelle imprimée, contrôlée sur une cote avant d’être retenue.',
          'Les pièces, dessinées avec leur surface, et les façades.',
          'Les fenêtres, les portes palières et intérieures, comptées et numérotées.',
        ],
      },
      {
        titre: 'Pourquoi la validation reste humaine',
        paragraphes: [
          'Une lecture automatique peut se tromper : un plan scanné de travers, une cote illisible, une pièce mal fermée. C’est pourquoi, dans Diagly, chaque forme proposée arrive « à valider », avec son niveau de confiance. Rien n’entre dans les totaux avant que vous l’ayez validé, une forme à la fois ou en revue.',
        ],
      },
      {
        titre: 'Des métrés aux quantités du devis',
        paragraphes: [
          'Une feuille marquée « trois étages identiques » compte trois fois. Les quantités se lisent par classification, par étage ou par feuille, avec les surfaces SIA 416. Elles sortent en Excel et se reportent dans le diagnostic, où elles deviennent les quantités du chiffrage par code CFC.',
        ],
      },
      {
        titre: 'Et les plans papier ?',
        paragraphes: [
          'Un plan papier se photographie : on ajuste ses quatre coins, et il devient un plan à métrer comme un autre. Sur iPhone et iPad, c’est le scanner de documents d’iOS qui s’en charge.',
        ],
      },
    ],
    faq: [
      { q: 'Quels fichiers peut-on déposer ?', r: 'Des PDF, vectoriels ou scannés, et des images PNG, JPEG ou WebP, jusqu’à 30 Mo par fichier.' },
      { q: 'Où partent les plans analysés ?', r: 'Les plans restent stockés en Suisse. Pour l’analyse, les pages concernées sont envoyées au fournisseur d’IA de Diagly, Anthropic, aux États-Unis.' },
    ],
    mention: '* Mesuré en octobre 2026 sur nos jeux de plans d’essai, PDF vectoriels au 1:100.',
    lien: { libelle: 'Les métrés par l’IA dans Diagly', ancre: 'metres' },
  },
]

export function articleDe(slug: string | undefined): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug)
}

/** La date d'un article, en toutes lettres : 19 octobre 2026. */
export function dateLongue(iso: string) {
  return new Intl.DateTimeFormat('fr-CH', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`))
}
