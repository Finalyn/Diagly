/**
 * La documentation du centre d'aide : articles et tutoriels.
 *
 * Le contenu vit ici, en données pures, et pas dans les écrans : on peut le
 * relire, le corriger et le chercher sans ouvrir un composant. Les durées de
 * lecture ne sont pas écrites à la main, elles se calculent (voir
 * `recherche-aide.ts`) : un chiffre saisi devient faux à la première retouche.
 */

/** Un bloc de contenu dans un article. */
export type Bloc =
  | { type: 'texte'; texte: string }
  | { type: 'liste'; items: string[] }
  | { type: 'etapes'; items: string[] }
  | { type: 'astuce'; texte: string }
  | { type: 'attention'; texte: string }

export interface Section {
  /** Ancre de la section, pour le sommaire de l'article. */
  id: string
  titre: string
  blocs: Bloc[]
}

export interface Article {
  slug: string
  titre: string
  resume: string
  /** Identifiant de la catégorie qui la porte. */
  categorie: string
  sections: Section[]
  /** Slugs d'articles à lire ensuite. */
  voirAussi?: string[]
}

export interface CategorieDoc {
  id: string
  label: string
  description: string
  /** Clé d'icône, résolue à l'affichage : les données ne connaissent pas React. */
  icone: 'depart' | 'releve' | 'argent' | 'plan' | 'rapport' | 'donnees' | 'compte' | 'partenaires'
}

export const CATEGORIES: CategorieDoc[] = [
  { id: 'prise-en-main', label: 'Prise en main', description: 'Comprendre l’application et son vocabulaire.', icone: 'depart' },
  { id: 'releve', label: 'Relevé et diagnostic', description: 'Évaluer les ouvrages, les états, les quantités.', icone: 'releve' },
  { id: 'chiffrage', label: 'Chiffrage', description: 'Des états relevés au budget de rénovation.', icone: 'argent' },
  { id: 'plans', label: 'Plans et quantités', description: 'Mesurer sur un plan et alimenter le diagnostic.', icone: 'plan' },
  { id: 'rapports', label: 'Rapports et partage', description: 'Produire les documents et les transmettre.', icone: 'rapport' },
  { id: 'donnees', label: 'Données, exports et API', description: 'Sortir les données et les brancher ailleurs.', icone: 'donnees' },
  { id: 'compte', label: 'Compte, équipe et sécurité', description: 'Organisation, rôles, accès.', icone: 'compte' },
]

export const ARTICLES: Article[] = [
  // ------------------------------------------------------------ prise en main
  {
    slug: 'demarrer',
    titre: 'Démarrer avec Diagly',
    resume: 'Ce qu’est un diagnostic, comment l’application est organisée, et le parcours d’un dossier du début à la fin.',
    categorie: 'prise-en-main',
    sections: [
      {
        id: 'diagnostic',
        titre: 'Ce qu’est un diagnostic',
        blocs: [
          { type: 'texte', texte: 'Un diagnostic, dans Diagly, c’est l’analyse complète d’un bâtiment : ses ouvrages (façades, toiture, fenêtres, chauffage, sanitaires…), l’état de chacun, les priorités d’intervention qui en découlent, le coût estimé des travaux et le plan pluriannuel qui en résulte.' },
          { type: 'texte', texte: 'La règle est simple : un bâtiment égale un diagnostic. Quand plusieurs immeubles appartiennent à la même opération (une PPE, un portefeuille de régie), un diagnostic multi-bâtiments les regroupe et consolide leurs coûts.' },
        ],
      },
      {
        id: 'ecrans',
        titre: 'Les écrans de l’application',
        blocs: [
          { type: 'texte', texte: 'Le menu de gauche donne accès aux sept espaces de l’application.' },
          {
            type: 'liste',
            items: [
              'Accueil : le dernier diagnostic à reprendre, vos dossiers récents et l’activité du moment.',
              'Diagnostics : la liste de vos dossiers, et la création d’un nouveau.',
              'Base de données : le catalogue d’ouvrages CFC, ses prix et ses textes.',
              'Paramètres : votre compte, votre entreprise, et votre équipe (membres, invitations, rôles).',
              'Intégrations : clés d’API, webhooks, connecteurs.',
              'Parc immobilier : vos bâtiments, vus comme un patrimoine plutôt que dossier par dossier.',
              'Paramètres : votre profil, votre entreprise, votre sécurité.',
            ],
          },
          { type: 'astuce', texte: 'L’assistant Diagly, en bas du menu, répond en langage courant sur vos diagnostics et sur le fonctionnement de l’application.' },
        ],
      },
      {
        id: 'parcours',
        titre: 'Le parcours d’un dossier',
        blocs: [
          {
            type: 'etapes',
            items: [
              'Créer le diagnostic avec l’adresse du bâtiment : Diagly va chercher seul les données publiques disponibles.',
              'Relever les ouvrages un par un, avec leur état et leurs photos.',
              'Vérifier les quantités, à la main ou depuis les plans.',
              'Contrôler le chiffrage, les honoraires, la réserve et la TVA.',
              'Comparer les variantes de rénovation.',
              'Éditer le rapport et le transmettre au client.',
            ],
          },
          { type: 'texte', texte: 'Chacune de ces étapes a son outil dans le menu du dossier, et rien n’oblige à les suivre dans l’ordre : un relevé peut être repris à tout moment, le chiffrage se recalcule seul.' },
        ],
      },
    ],
    voirAussi: ['onglets-diagnostic', 'terrain'],
  },
  {
    slug: 'onglets-diagnostic',
    titre: 'Les sections d’un dossier',
    resume: 'Le relevé, puis les outils du menu de gauche : à quoi sert chacun, et dans quel ordre les utiliser.',
    categorie: 'prise-en-main',
    sections: [
      {
        id: 'liste',
        titre: 'Le relevé et ses outils',
        blocs: [
          {
            type: 'liste',
            items: [
              'Visite : les interlocuteurs, le rendez-vous, la préparation et les mails pour organiser la visite.',
              'Relevé : le cœur du travail, ouvrage par ouvrage. Un dossier s’ouvre directement dessus.',
              'Fiche du bâtiment : la carte, l’identité du bâtiment, les données publiques et les chiffres clés du dossier.',
              'Photos : toutes les photos du dossier rassemblées, par ouvrage.',
              'Coûts : le chiffrage détaillé, les honoraires, la réserve, la TVA.',
              'Variantes : les scénarios de rénovation comparés.',
              'Rapports : les documents à éditer et le lien de partage.',
              'Plans : les plans du bâtiment, leur étalonnage et les mesures.',
              'Étiquette énergétique : la performance du bâtiment et l’import d’un certificat.',
            ],
          },
        ],
      },
      {
        id: 'ordre',
        titre: 'Dans quel ordre travailler',
        blocs: [
          { type: 'texte', texte: 'Sur le terrain, seul le relevé compte : on y relève les états et on y prend les photos. Tout le reste se fait au bureau, et se nourrit de ce relevé.' },
          { type: 'texte', texte: 'Coûts ne demande aucune saisie pour fonctionner : tout s’y calcule depuis le relevé. On y passe pour ajuster, pas pour remplir.' },
        ],
      },
    ],
    voirAussi: ['demarrer', 'etats-priorites'],
  },
  {
    slug: 'terrain',
    titre: 'Travailler sur le terrain',
    resume: 'Diagly sur téléphone et tablette, les photos, et ce qui se passe quand le réseau manque.',
    categorie: 'prise-en-main',
    sections: [
      {
        id: 'mobile',
        titre: 'Sur téléphone et tablette',
        blocs: [
          { type: 'texte', texte: 'Diagly est une application web : elle s’ouvre dans le navigateur d’un ordinateur, d’une tablette ou d’un téléphone, sans rien installer. Les écrans de relevé sont pensés pour le pouce, avec des cibles larges et une navigation réduite à l’essentiel.' },
          { type: 'astuce', texte: 'Depuis le navigateur de votre téléphone, « Ajouter à l’écran d’accueil » installe Diagly comme une application : elle s’ouvre en plein écran, sans barre d’adresse.' },
        ],
      },
      {
        id: 'photos',
        titre: 'Les photos',
        blocs: [
          { type: 'texte', texte: 'Chaque ouvrage relevé accepte des photos, prises directement avec l’appareil ou choisies dans la galerie, et une observation libre. Les deux se retrouvent dans le rapport documenté et dans le reportage photo.' },
          { type: 'texte', texte: 'Prenez la photo au moment du constat, pas après : c’est elle qui justifie l’état relevé auprès du client, et elle est bien plus difficile à retrouver une fois la visite terminée.' },
        ],
      },
      {
        id: 'reseau',
        titre: 'Quand le réseau manque',
        blocs: [
          { type: 'texte', texte: 'Une cave, une cage d’escalier ou un chantier isolé coupent souvent la connexion. La saisie continue : vos modifications sont conservées sur l’appareil et repartent vers le serveur dès que le réseau revient. Un bandeau vous indique l’état de la connexion.' },
          { type: 'attention', texte: 'Attendez que le bandeau indique la reconnexion avant de fermer l’application en fin de visite : c’est à ce moment que les photos, plus lourdes que le texte, finissent de partir.' },
        ],
      },
    ],
    voirAussi: ['onglets-diagnostic', 'etats-priorites'],
  },

  // ------------------------------------------------------------------- relevé
  {
    slug: 'etats-priorites',
    titre: 'États, priorités et année d’intervention',
    resume: 'Les quatre états, les trois priorités, et comment l’année de travaux en découle.',
    categorie: 'releve',
    sections: [
      {
        id: 'etats',
        titre: 'Les quatre états',
        blocs: [
          { type: 'texte', texte: 'Chaque ouvrage relevé reçoit un état, et un seul.' },
          {
            type: 'liste',
            items: [
              'Très bon : neuf ou récent, aucune intervention à prévoir.',
              'Bon : usage normal, entretien courant.',
              'Moyen : usure visible, intervention à planifier.',
              'Mauvais : fin de vie, l’ouvrage doit être remplacé ou remis en état.',
            ],
          },
          { type: 'texte', texte: 'L’état n’est pas qu’un constat : c’est lui qui détermine le travail à prévoir, donc le prix unitaire retenu dans le catalogue et le texte qui décrira l’intervention dans le rapport.' },
        ],
      },
      {
        id: 'priorites',
        titre: 'Les trois priorités',
        blocs: [
          {
            type: 'liste',
            items: [
              'Priorité I : urgent, généralement un ouvrage en mauvais état ou une question de sécurité.',
              'Priorité II : à moyen terme.',
              'Priorité III : à long terme.',
            ],
          },
          { type: 'texte', texte: 'La priorité est proposée à partir de l’état, et reste modifiable : un ouvrage en état moyen peut devenir prioritaire parce qu’un échafaudage est déjà prévu, ou parce que le propriétaire a une contrainte de calendrier.' },
        ],
      },
      {
        id: 'annee',
        titre: 'L’année d’intervention',
        blocs: [
          { type: 'texte', texte: 'L’année est déduite de la priorité : priorité I l’année de la visite, priorité II trois ans plus tard, priorité III sept ans plus tard. C’est elle qui construit le plan pluriannuel de travaux.' },
          { type: 'astuce', texte: 'Fixez l’année à la main quand plusieurs ouvrages doivent être traités ensemble : regrouper une réfection de façade et un remplacement de fenêtres la même année évite de payer deux fois l’échafaudage.' },
        ],
      },
    ],
    voirAussi: ['catalogue-cfc', 'calcul-couts'],
  },
  {
    slug: 'catalogue-cfc',
    titre: 'Le catalogue CFC',
    resume: 'La nomenclature suisse des ouvrages, les articles du catalogue, et comment l’adapter à votre pratique.',
    categorie: 'releve',
    sections: [
      {
        id: 'cfc',
        titre: 'Ce qu’est un code CFC',
        blocs: [
          { type: 'texte', texte: 'Le CFC, Code des Frais de Construction, est la nomenclature suisse normalisée des ouvrages. Elle classe tout ce qui compose un bâtiment sous un numéro stable : 221 pour les fenêtres, 224 pour la toiture, 226 pour les façades, 242 pour la production de chaleur, et ainsi de suite.' },
          { type: 'texte', texte: 'Chaque ouvrage relevé dans Diagly porte son code CFC. C’est ce qui permet au rapport d’être lu par un architecte, une régie ou une entreprise sans traduction, et aux coûts de se regrouper par corps de métier.' },
        ],
      },
      {
        id: 'articles',
        titre: 'Les articles du catalogue',
        blocs: [
          { type: 'texte', texte: 'Un article du catalogue, c’est un ouvrage type : un libellé, un code CFC, une unité (m², m, pièce, forfait), un prix unitaire par état, et les textes qui décrivent le travail à faire selon cet état.' },
          { type: 'texte', texte: 'Au relevé, vous choisissez l’article qui correspond à ce que vous avez devant vous, vous donnez son état, et le reste suit.' },
        ],
      },
      {
        id: 'adapter',
        titre: 'Adapter le catalogue',
        blocs: [
          { type: 'texte', texte: 'L’écran Base de données donne accès à tout le catalogue. Vous pouvez y modifier les prix unitaires, les unités, les libellés et les descriptions par état, et ajouter vos propres articles.' },
          { type: 'texte', texte: 'Vos modifications ne concernent que votre compte, ou votre organisation si vous en avez une. Le bouton de réinitialisation remet le catalogue de référence en place.' },
          { type: 'attention', texte: 'Un prix modifié ne change pas les diagnostics déjà chiffrés tant que vous ne les recalculez pas : c’est voulu, un rapport remis ne doit pas bouger tout seul.' },
        ],
      },
    ],
    voirAussi: ['quantites', 'calcul-couts'],
  },
  {
    slug: 'quantites',
    titre: 'Les quantités et les groupes de surface',
    resume: 'D’où viennent les mètres carrés, et comment Diagly évite de compter deux fois la même surface.',
    categorie: 'releve',
    sections: [
      {
        id: 'origine',
        titre: 'D’où vient une quantité',
        blocs: [
          { type: 'texte', texte: 'Une quantité peut arriver de trois façons : estimée depuis la géométrie du bâtiment (emprise et volume issus du registre fédéral), saisie à la main, ou reportée depuis une mesure faite sur un plan.' },
          { type: 'texte', texte: 'La quantité saisie l’emporte toujours sur l’estimation : dès que vous entrez une valeur, Diagly cesse d’estimer cet ouvrage.' },
        ],
      },
      {
        id: 'groupes',
        titre: 'Les groupes de surface',
        blocs: [
          { type: 'texte', texte: 'Une façade n’est jamais d’un seul type. Un bâtiment peut avoir du crépi sur trois faces et du bardage bois sur la quatrième. Si chacun de ces deux articles reçoit la surface totale de façade, le devis compte la surface deux fois.' },
          { type: 'texte', texte: 'Les articles qui se partagent une même surface sont donc rassemblés dans un groupe. Vous relevez ceux qui sont réellement présents, et vous dites quelle part de la surface revient à chacun, en pourcent. Les types absents ne sont tout simplement pas relevés.' },
          { type: 'texte', texte: 'Tant que les parts d’un groupe ne totalisent pas cent pourcent, Diagly le signale : la répartition est incomplète, et les quantités de ce groupe ne sont pas fiables.' },
          { type: 'astuce', texte: 'Pour un bâtiment dont toute la façade est du même type, laissez la part à cent pourcent : le groupe n’a qu’un membre et se comporte comme un ouvrage ordinaire.' },
        ],
      },
    ],
    voirAussi: ['mesurer-reporter', 'calcul-couts'],
  },

  // ----------------------------------------------------------------- chiffrage
  {
    slug: 'calcul-couts',
    titre: 'Comment un coût est calculé',
    resume: 'Du prix unitaire au montant TTC : la chaîne complète, dans l’ordre où elle s’applique.',
    categorie: 'chiffrage',
    sections: [
      {
        id: 'base',
        titre: 'Le coût d’un ouvrage',
        blocs: [
          { type: 'texte', texte: 'Le coût d’un ouvrage, c’est son prix unitaire pour l’état relevé, multiplié par sa quantité, puis indexé sur le marché actuel.' },
          { type: 'texte', texte: 'Le coefficient d’indexation vient de l’indice suisse des prix de la construction publié par l’Office fédéral de la statistique. Les prix du catalogue sont une base de référence : l’indexation les amène à la date du diagnostic. Le coefficient retenu est affiché dans la synthèse des coûts.' },
        ],
      },
      {
        id: 'total',
        titre: 'Du total HT au total TTC',
        blocs: [
          {
            type: 'etapes',
            items: [
              'Somme des coûts d’ouvrages : le total hors taxe des travaux.',
              'Honoraires : un pourcentage appliqué sur ce total, ajustable par dossier.',
              'Réserve : un second pourcentage, pour les imprévus de chantier.',
              'TVA à 8,1 pourcent, appliquée en dernier.',
            ],
          },
          { type: 'texte', texte: 'Les pourcentages d’honoraires et de réserve se règlent dans Coûts, dans le menu du dossier, et le détail du calcul reste visible à chaque étape : un client qui conteste un montant doit pouvoir en suivre la construction.' },
        ],
      },
    ],
    voirAussi: ['enveloppes-variantes', 'catalogue-cfc'],
  },
  {
    slug: 'enveloppes-variantes',
    titre: 'Enveloppes et variantes de rénovation',
    resume: 'Les trois enveloppes de travaux par ouvrage, et les variantes qui comparent d’autres façons de faire.',
    categorie: 'chiffrage',
    sections: [
      {
        id: 'enveloppes',
        titre: 'Les trois enveloppes',
        blocs: [
          { type: 'texte', texte: 'Un même ouvrage peut être traité à trois niveaux d’ambition, chiffrés séparément.' },
          {
            type: 'liste',
            items: [
              'Réparation : remettre l’existant en état, sans changer sa nature.',
              'Amélioration : monter en gamme, gagner en confort ou en durée de vie.',
              'Mise aux normes : isolation, énergie, conformité réglementaire.',
            ],
          },
        ],
      },
      {
        id: 'variantes',
        titre: 'Les variantes',
        blocs: [
          { type: 'texte', texte: 'Une variante répond à « et si l’on s’y prenait autrement » : isoler par l’intérieur plutôt que par l’extérieur, passer au pellet ou au chauffage à distance plutôt qu’à la pompe à chaleur.' },
          {
            type: 'liste',
            items: [
              'Elle reprend tout le diagnostic et ne change que les ouvrages que vous désignez.',
              'L’ouvrage remplacé sort du total, la solution retenue prend sa place avec son montant.',
              'Corriger le diagnostic met à jour toutes les variantes d’un coup : il n’y a jamais deux copies du dossier qui divergent.',
            ],
          },
          { type: 'texte', texte: 'Elles se comparent côte à côte au diagnostic de base, chacune avec son budget complet du HT au TTC.' },
          { type: 'astuce', texte: 'C’est la comparaison qui parle à un propriétaire, pas le montant isolé : les variantes côte à côte montrent ce qu’on achète en changeant de solution.' },
        ],
      },
    ],
    voirAussi: ['calcul-couts', 'choisir-rapport'],
  },

  // --------------------------------------------------------------------- plans
  {
    slug: 'etalonner',
    titre: 'Étalonner un plan',
    resume: 'Pourquoi l’échelle est demandée avant tout, et comment l’appliquer à un document de plusieurs pages.',
    categorie: 'plans',
    sections: [
      {
        id: 'pourquoi',
        titre: 'Pourquoi étalonner',
        blocs: [
          { type: 'texte', texte: 'Un plan importé est une image : Diagly y voit des pixels, pas des mètres. L’étalonnage est le geste qui fait le lien, une fois pour toutes, entre les deux.' },
          { type: 'texte', texte: 'Tant qu’une page n’a pas d’échelle, les outils de mesure restent inaccessibles et l’éditeur s’ouvre directement sur l’étalonnage. C’est volontaire : une surface relevée sur un plan non étalonné serait fausse sans que rien ne le signale.' },
        ],
      },
      {
        id: 'geste',
        titre: 'Le geste',
        blocs: [
          {
            type: 'etapes',
            items: [
              'Choisissez l’outil Étalonner.',
              'Tracez un trait sur une cote connue du plan, le plus long possible : une façade entière vaut mieux qu’une porte.',
              'Saisissez la longueur réelle de ce trait, dans l’unité de votre choix (mètres, centimètres ou millimètres).',
              'Validez : l’échelle est enregistrée avec le plan.',
            ],
          },
          { type: 'astuce', texte: 'Plus le trait d’étalonnage est long, plus la mesure est juste : une erreur de quelques pixels sur une cote de vingt mètres pèse dix fois moins que sur une cote de deux mètres.' },
        ],
      },
      {
        id: 'pages',
        titre: 'Les documents de plusieurs pages',
        blocs: [
          { type: 'texte', texte: 'Un PDF de coupes ou de façades porte souvent la même échelle sur toutes ses pages. Après l’étalonnage, Diagly vous propose donc d’appliquer l’échelle mesurée à toutes les pages, ou de choisir celles qui la partagent, avec un aperçu de chacune.' },
          { type: 'attention', texte: 'Une page à une autre échelle, un détail au 1:20 au milieu de plans au 1:100 par exemple, doit être décochée puis étalonnée séparément.' },
        ],
      },
    ],
    voirAussi: ['mesurer-reporter', 'quantites'],
  },
  {
    slug: 'mesurer-reporter',
    titre: 'Mesurer, zoner et reporter dans le diagnostic',
    resume: 'Les outils de l’éditeur de plans, le rattachement d’une zone à un ouvrage, et le report des quantités.',
    categorie: 'plans',
    sections: [
      {
        id: 'outils',
        titre: 'Les outils',
        blocs: [
          {
            type: 'liste',
            items: [
              'Déplacer : faire glisser le plan, zoomer à la molette ou au pincement.',
              'Sélection : reprendre une annotation posée, la déplacer, changer sa couleur, la supprimer.',
              'Étalonner : donner l’échelle de la page.',
              'Mesurer : une cote entre deux points, affichée en mètres.',
              'Dessiner et Flèche : annoter librement.',
              'Note : poser un commentaire sur un point du plan.',
              'Zone : délimiter une surface, au glisser pour un rectangle ou point par point pour une forme libre.',
              'Référence : superposer un second plan en transparence pour comparer deux états.',
            ],
          },
          { type: 'astuce', texte: 'Ctrl+Z annule le dernier geste et Ctrl+Maj+Z le rejoue, y compris un déplacement ou un changement de couleur. Échap abandonne le tracé en cours et revient à la sélection, sans rien effacer de ce qui est posé.' },
        ],
      },
      {
        id: 'rattacher',
        titre: 'Rattacher une zone à un ouvrage',
        blocs: [
          { type: 'texte', texte: 'Une surface mesurée ne vaut que si l’on sait de quoi elle est la surface. Dès qu’une zone est tracée, Diagly propose donc de la rattacher à un ouvrage du diagnostic.' },
          { type: 'texte', texte: 'La liste des mesures de la page, à droite de l’éditeur, montre ce qui est rattaché et ce qui ne l’est pas. Un clic sur une ligne ouvre le choix de l’ouvrage.' },
          { type: 'texte', texte: 'Le rattachement est possible avant même que l’ouvrage soit relevé : vous pouvez préparer les surfaces sur plan, puis faire le relevé ensuite.' },
        ],
      },
      {
        id: 'report',
        titre: 'Reporter les quantités',
        blocs: [
          { type: 'texte', texte: 'Les zones et les cotes rattachées à un même ouvrage s’additionnent, y compris à travers plusieurs plans et plusieurs pages. Le total est proposé comme quantité de cet ouvrage, et le coût se recalcule avec elle.' },
          { type: 'texte', texte: 'Le report reste un geste explicite : Diagly vous montre ce qu’il a mesuré et ce que cela changerait, et vous décidez. Une quantité ne change jamais toute seule sous un dossier en cours.' },
        ],
      },
    ],
    voirAussi: ['etalonner', 'quantites'],
  },

  // ------------------------------------------------------------------ rapports
  {
    slug: 'choisir-rapport',
    titre: 'Choisir le bon rapport',
    resume: 'Huit documents, un destinataire pour chacun : lequel éditer et pour qui.',
    categorie: 'rapports',
    sections: [
      {
        id: 'rapports',
        titre: 'Les rapports de diagnostic',
        blocs: [
          {
            type: 'liste',
            items: [
              'Complet : le document de référence, préambule, méthode, cadre normatif, relevé complet et annexes. C’est celui qu’on remet à un propriétaire ou à une régie.',
              'Rapport : la version resserrée, le relevé et le chiffrage, sans l’appareil méthodologique.',
              'De l’existant : l’état des lieux seul, sans chiffrage, utile en amont d’une acquisition.',
              'Rapports photo : le reportage, ouvrage par ouvrage, avec les observations.',
            ],
          },
        ],
      },
      {
        id: 'variantes',
        titre: 'Les documents de variantes',
        blocs: [
          {
            type: 'liste',
            items: [
              'Sommaire : une page, les totaux par scénario, pour une séance de décision.',
              'Détaillé : le chiffrage ouvrage par ouvrage de chaque scénario.',
              'Documenté : le détaillé enrichi des photos du relevé.',
              'Par scénario : un document par scénario, pour les présenter séparément.',
            ],
          },
        ],
      },
      {
        id: 'mise-en-page',
        titre: 'La mise en page',
        blocs: [
          { type: 'texte', texte: 'Tous les documents sont paginés en A4, avec votre logo et la numérotation sur chaque page. Ce que vous voyez à l’écran est ce qui sortira de l’imprimante ou du PDF.' },
          { type: 'astuce', texte: 'Votre logo se dépose dans Paramètres, à la rubrique de l’entreprise. Sans logo déposé, c’est celui de Diagly qui apparaît.' },
        ],
      },
    ],
    voirAussi: ['partager', 'enveloppes-variantes'],
  },
  {
    slug: 'partager',
    titre: 'Partager un rapport au client',
    resume: 'Le lien de partage, ce qu’il montre, et comment le reprendre.',
    categorie: 'rapports',
    sections: [
      {
        id: 'lien',
        titre: 'Le lien de partage',
        blocs: [
          { type: 'texte', texte: 'Depuis Rapports, le bouton Partager crée un lien que vous pouvez transmettre par courriel ou par message. Votre client l’ouvre dans son navigateur, sans compte et sans installation.' },
          { type: 'texte', texte: 'La page partagée est en lecture seule : le destinataire consulte le rapport et peut l’imprimer, mais ne modifie rien.' },
        ],
      },
      {
        id: 'maitrise',
        titre: 'Garder la main',
        blocs: [
          { type: 'attention', texte: 'Un lien de partage est public : toute personne qui le possède peut ouvrir le rapport. Transmettez-le comme vous transmettriez le PDF lui-même, et révoquez-le quand le dossier est clos.' },
          { type: 'texte', texte: 'Le lien peut être révoqué à tout moment depuis le même écran. Il cesse alors de fonctionner pour tout le monde, y compris pour qui l’avait déjà ouvert.' },
        ],
      },
    ],
    voirAussi: ['choisir-rapport', 'export-api'],
  },

  // ------------------------------------------------------------------- données
  {
    slug: 'egid-donnees',
    titre: 'EGID et données publiques',
    resume: 'L’identifiant fédéral du bâtiment, et ce que Diagly va chercher tout seul.',
    categorie: 'donnees',
    sections: [
      {
        id: 'egid',
        titre: 'L’EGID',
        blocs: [
          { type: 'texte', texte: 'L’EGID est l’identifiant fédéral unique d’un bâtiment, attribué par le Registre des bâtiments et des logements. Deux systèmes qui parlent du même immeuble le désignent par le même EGID, quelle que soit la façon dont son adresse est écrite.' },
          { type: 'texte', texte: 'C’est pourquoi il figure sur chaque ressource exportée et sur chaque réponse de l’API : c’est la clé qui permet de rapprocher un diagnostic Diagly d’une fiche dans un ERP immobilier.' },
        ],
      },
      {
        id: 'geo',
        titre: 'Ce que Diagly récupère seul',
        blocs: [
          { type: 'texte', texte: 'À la création d’un diagnostic, à partir de l’adresse, Diagly interroge les services publics fédéraux et cantonaux.' },
          {
            type: 'liste',
            items: [
              'Emprise au sol, volume et identité du bâtiment au registre fédéral.',
              'Affectation de la parcelle.',
              'Sensibilité au bruit.',
              'Zone radon.',
              'Classe de sol sismique.',
              'Protection du patrimoine : inventaires fédéraux et sites protégés.',
            ],
          },
          { type: 'texte', texte: 'Ces données sont publiques et gratuites. Quand elles signalent une contrainte, protection patrimoniale ou zone radon élevée par exemple, un avertissement apparaît dans le rapport : ce sont des surcoûts et des mesures à anticiper.' },
        ],
      },
    ],
    voirAussi: ['export-api', 'demarrer'],
  },
  {
    slug: 'export-api',
    titre: 'Exports, API et webhooks',
    resume: 'Sortir vos données en Excel, CSV ou JSON, et brancher Diagly sur vos outils.',
    categorie: 'donnees',
    sections: [
      {
        id: 'exports',
        titre: 'Les exports',
        blocs: [
          { type: 'texte', texte: 'Un diagnostic s’exporte en trois formats. Excel et CSV donnent des tables, avec un mappage de colonnes que vous pouvez régler pour coller à votre modèle. JSON donne la charge utile complète : bâtiment, ouvrages, plan de travaux, chiffrage.' },
          { type: 'texte', texte: 'Le CSV ne contient qu’une table à la fois : choisissez laquelle avant d’exporter. Excel rassemble tous les onglets dans un seul fichier.' },
        ],
      },
      {
        id: 'api',
        titre: 'L’API',
        blocs: [
          { type: 'texte', texte: 'L’écran Intégrations permet de créer une clé d’API. Elle n’est affichée qu’une seule fois, à la création : copiez-la immédiatement et rangez-la dans votre gestionnaire de secrets.' },
          { type: 'texte', texte: 'La documentation interactive publiée au même endroit permet d’essayer chaque point d’entrée depuis le navigateur, avec votre clé.' },
        ],
      },
      {
        id: 'webhooks',
        titre: 'Les webhooks',
        blocs: [
          { type: 'texte', texte: 'Un webhook fait partir un appel vers votre système dès qu’un événement se produit dans Diagly, sans que vous ayez à interroger l’API en boucle.' },
          { type: 'attention', texte: 'Vérifiez toujours la signature HMAC des appels reçus avant de les traiter : c’est elle qui prouve que l’appel vient bien de Diagly. Le journal des envois permet de rejouer un appel manqué.' },
        ],
      },
    ],
    voirAussi: ['egid-donnees', 'equipe-roles'],
  },

  // -------------------------------------------------------------------- compte
  {
    slug: 'equipe-roles',
    titre: 'Organisation, membres et rôles',
    resume: 'Passer d’un compte seul à une équipe, et donner à chacun le bon niveau d’accès.',
    categorie: 'compte',
    sections: [
      {
        id: 'organisation',
        titre: 'Créer l’organisation',
        blocs: [
          { type: 'texte', texte: 'Tant que vous travaillez seul, vos diagnostics vous appartiennent. Dès que vous créez l’équipe de votre société depuis Paramètres > Membres, ils deviennent ceux de l’organisation : vos collègues y accèdent, et le travail ne disparaît pas avec un départ.' },
        ],
      },
      {
        id: 'roles',
        titre: 'Les rôles',
        blocs: [
          {
            type: 'liste',
            items: [
              'Administrateur : tout, y compris la gestion des membres et du catalogue.',
              'Membre : crée et modifie les diagnostics.',
              'Lecture seule : consulte sans rien changer.',
            ],
          },
          { type: 'astuce', texte: 'Le rôle de lecture seule convient bien à un mandant externe, une régie ou un propriétaire qui veut suivre l’avancement sans risque de modification.' },
        ],
      },
    ],
    voirAussi: ['securite', 'export-api'],
  },
  {
    slug: 'securite',
    titre: 'Sécurité du compte',
    resume: 'Mot de passe, double authentification et sessions actives.',
    categorie: 'compte',
    sections: [
      {
        id: 'mot-de-passe',
        titre: 'Mot de passe et sessions',
        blocs: [
          { type: 'texte', texte: 'Le mot de passe se change dans Paramètres, à la rubrique Sécurité. Toutes vos sessions actives sont révoquées au changement : un appareil perdu ou un poste partagé perd immédiatement l’accès.' },
        ],
      },
      {
        id: 'double-facteur',
        titre: 'La double authentification',
        blocs: [
          { type: 'texte', texte: 'La double authentification ajoute un code temporaire, fourni par une application d’authentification, à la connexion. Un mot de passe volé ne suffit alors plus pour entrer.' },
          { type: 'attention', texte: 'Conservez les codes de secours remis à l’activation ailleurs que sur le téléphone qui génère les codes : c’est le seul moyen de reprendre la main si vous le perdez.' },
        ],
      },
    ],
    voirAussi: ['equipe-roles'],
  },
]

// ---------------------------------------------------------------- tutoriels

export interface EtapeTuto {
  titre: string
  detail: string
  /** Chemin dans l'application, tel qu'on le lit à l'écran. */
  ecran?: string
}

export interface Tutoriel {
  slug: string
  titre: string
  objectif: string
  /** Temps réel du tutoriel, pas un temps de lecture : il s'écrit à la main. */
  duree: string
  niveau: 'Débutant' | 'Intermédiaire' | 'Avancé'
  prerequis?: string[]
  etapes: EtapeTuto[]
  /** Articles à lire pour aller plus loin. */
  pourAllerPlusLoin?: string[]
}

export const TUTORIELS: Tutoriel[] = [
  {
    slug: 'premier-diagnostic',
    titre: 'Réaliser son premier diagnostic',
    objectif: 'Créer un dossier, organiser la visite, relever le bâtiment et sortir un rapport, du début à la fin.',
    duree: '30 min',
    niveau: 'Débutant',
    etapes: [
      { titre: 'Créer le diagnostic', detail: 'Cliquez sur Nouveau diagnostic et choisissez votre point de départ : de zéro avec l’adresse, depuis un document (ancien rapport, relevé Excel, Word ou PDF), ou depuis un certificat CECB. Avec un fichier, relisez ce que l’assistant a lu avant de valider.', ecran: 'Nouveau diagnostic' },
      { titre: 'Laisser les données publiques arriver', detail: 'En choisissant l’adresse dans la liste proposée, Diagly interroge les registres fédéraux et cantonaux et remplit seul l’EGID, l’emprise, le volume, l’affectation et les contraintes. Vérifiez la fiche du bâtiment : si le bâtiment identifié n’est pas le bon, corrigez l’adresse avant d’aller plus loin.', ecran: 'Dossier > Fiche du bâtiment' },
      { titre: 'Organiser la visite', detail: 'Enregistrez la gérance et le concierge, fixez le rendez-vous et envoyez la demande puis la confirmation : chaque mail est pré-rempli avec le dossier. Le rendez-vous entre dans votre calendrier.', ecran: 'Dossier > Visite' },
      { titre: 'Relever les ouvrages', detail: 'Le dossier s’ouvre sur son relevé. Suivez les étapes dans l’ordre de la visite et donnez à chaque ouvrage son état. Ajoutez une photo et une observation là où l’état se discute, c’est-à-dire partout où vous relevez Moyen ou Mauvais.', ecran: 'Dossier > Relevé' },
      { titre: 'Vérifier les quantités', detail: 'Les quantités estimées depuis la géométrie sont des ordres de grandeur. Reprenez à la main celles qui pèsent dans le budget, et répartissez les parts des groupes de surface signalés comme incomplets.', ecran: 'Dossier > Relevé' },
      { titre: 'Contrôler le chiffrage', detail: 'Coûts montre le détail du calcul. Ajustez le pourcentage d’honoraires et celui de réserve selon votre pratique, et relisez le total TTC.', ecran: 'Dossier > Coûts' },
      { titre: 'Comparer des variantes', detail: 'Pour chaque autre façon de faire (isoler par l’intérieur, changer d’agent énergétique), créez une variante : elle remplace les ouvrages que vous désignez et se compare au diagnostic de base. C’est la vue qui sert à la discussion avec le propriétaire.', ecran: 'Dossier > Variantes' },
      { titre: 'Éditer le rapport', detail: 'Choisissez Complet pour un document de référence. Relisez-le à l’écran : il est paginé en A4, ce que vous voyez est ce qui sera imprimé.', ecran: 'Dossier > Rapports' },
      { titre: 'Transmettre', detail: 'Créez le lien de partage et envoyez-le à votre client, ou imprimez le rapport en PDF. Pensez à révoquer le lien quand le dossier est clos.', ecran: 'Dossier > Rapports' },
    ],
    pourAllerPlusLoin: ['etats-priorites', 'calcul-couts', 'choisir-rapport'],
  },
  {
    slug: 'demarrer-fichier',
    titre: 'Démarrer depuis un document ou un certificat énergétique',
    objectif: 'Reprendre un ancien rapport, un relevé Excel ou un certificat énergétique pour ne pas tout ressaisir.',
    duree: '10 min',
    niveau: 'Débutant',
    prerequis: ['Le fichier en PDF, Word (.docx), Excel (.xlsx) ou CSV, 12 Mo au plus. Un certificat énergétique cantonal (CECB®) se fournit en PDF.'],
    etapes: [
      { titre: 'Choisir le point de départ', detail: 'Cliquez sur Nouveau diagnostic, puis sur Importer un document ou sur Partir d’un certificat énergétique.', ecran: 'Nouveau diagnostic' },
      { titre: 'Déposer le fichier', detail: 'L’assistant Diagly le lit en quelques secondes. Un ancien format Office (.doc, .xls) est refusé : enregistrez-le en .docx, en .xlsx ou en PDF.' },
      { titre: 'Relire le bâtiment', detail: 'Adresse, année, logements, étages, surfaces : tout ce qui a été trouvé s’affiche, et pré-remplira le formulaire. Pour un certificat énergétique s’y ajoute l’étiquette énergétique, qui sera reprise dans le dossier.' },
      { titre: 'Relire les éléments', detail: 'Chaque élément trouvé est rattaché à un article de votre base, avec l’état indiqué par le document. Corrigez l’article ou l’état quand il le faut, et décochez ce que vous ne voulez pas reprendre. Un élément sans article correspondant reste de côté tant que vous n’en choisissez pas un.' },
      { titre: 'Compléter et créer', detail: 'Le formulaire s’ouvre pré-rempli. Choisissez l’adresse dans la liste proposée pour que les registres fédéraux complètent le reste, puis validez : le dossier s’ouvre sur son relevé, éléments compris, chacun gardant en note sa source.', ecran: 'Dossier > Relevé' },
      { titre: 'Vérifier sur place', detail: 'Les éléments d’un document ou d’un certificat sont des points de départ. Les mesures d’un certificat entrent sans état : elles désignent ce qu’il faut aller voir.' },
    ],
    pourAllerPlusLoin: ['egid-donnees', 'etats-priorites'],
  },
  {
    slug: 'contacter-prestataire',
    titre: 'Confier la suite à un prestataire',
    objectif: 'Trouver l’expert, l’architecte ou l’entreprise qui prendra le relais, et le contacter avec votre dossier.',
    duree: '5 min',
    niveau: 'Débutant',
    etapes: [
      { titre: 'Partir de votre besoin', detail: 'Ouvrez Prestataires et choisissez ce dont vous avez besoin : un certificat énergétique, un projet de rénovation, des offres pour les travaux, des images du projet ou un autre spécialiste.', ecran: 'Prestataires' },
      { titre: 'Choisir le prestataire', detail: 'Affinez par canton et par langue. L’écusson vert indique une certification contrôlée par Finalyn, comme l’inscription d’un expert CECB® sur la liste officielle.' },
      { titre: 'Joindre le dossier', detail: 'Cliquez sur Contacter et choisissez le dossier concerné : le prestataire en reçoit le résumé. Cochez le rapport en lecture seule si vous voulez qu’il le consulte en entier.' },
      { titre: 'Relire et envoyer', detail: 'L’objet et le message sont pré-remplis selon le métier : relisez-les, puis envoyez. Le message part à votre nom et la réponse arrive directement dans votre messagerie.' },
      { titre: 'Suivre l’échange', detail: 'Dans Mes demandes, notez quand le prestataire a répondu, puis marquez la demande comme terminée.', ecran: 'Prestataires > Mes demandes' },
    ],
  },
  {
    slug: 'organiser-visite',
    titre: 'Organiser la visite',
    objectif: 'Fixer le rendez-vous, prévenir les bonnes personnes et arriver avec ce qu’il faut.',
    duree: '15 min',
    niveau: 'Débutant',
    prerequis: ['Le diagnostic est créé.'],
    etapes: [
      { titre: 'Enregistrer les interlocuteurs', detail: 'La gérance, le propriétaire, le concierge, et les locataires avec leur logement. Ce sont eux qui recevront les mails.', ecran: 'Dossier > Visite' },
      { titre: 'Prendre contact', detail: 'Envoyez la demande de visite, ou proposez deux ou trois créneaux. Le mail énumère les locaux à ouvrir et les documents à préparer.', ecran: 'Dossier > Visite' },
      { titre: 'Fixer le rendez-vous', detail: 'Date, heure, durée, lieu de rendez-vous et personne qui ouvre. Enregistré, il entre dans votre calendrier avec un rappel et devient la date de visite du diagnostic.' },
      { titre: 'Prévenir les occupants', detail: 'Envoyez la confirmation à la gérance, l’avis aux locataires (il s’imprime aussi pour l’entrée de l’immeuble), et demandez l’accès à un ou deux logements.' },
      { titre: 'Préparer', detail: 'Cochez les documents reçus, les accès confirmés et le matériel prêt. Les documents encore attendus remplissent d’eux-mêmes les mails qui les demandent.' },
      { titre: 'Après la visite', detail: 'Envoyez les remerciements avec le délai du rapport. Tout ce qui est parti reste dans l’historique du dossier.' },
    ],
    pourAllerPlusLoin: ['terrain'],
  },
  {
    slug: 'releve-terrain',
    titre: 'Faire un relevé sur le terrain',
    objectif: 'Mener une visite au téléphone ou à la tablette, photos comprises, même sans réseau.',
    duree: '15 min',
    niveau: 'Débutant',
    prerequis: ['Le diagnostic est créé depuis le bureau, avec son adresse.'],
    etapes: [
      { titre: 'Installer Diagly sur l’appareil', detail: 'Ouvrez Diagly dans le navigateur du téléphone et choisissez Ajouter à l’écran d’accueil. L’application s’ouvrira ensuite en plein écran, comme une application installée.' },
      { titre: 'Ouvrir le dossier avant de partir', detail: 'Chargez le diagnostic pendant que vous avez encore du réseau : le contenu est alors disponible sur l’appareil, et la visite peut commencer même dans une cave.' },
      { titre: 'Relever ouvrage par ouvrage', detail: 'Suivez l’ordre des étapes proposé : il correspond au parcours physique d’un bâtiment, de l’extérieur vers les techniques. Dans chaque étape, touchez l’ouvrage puis le type que vous avez devant vous, et donnez-lui son état.', ecran: 'Dossier > Relevé' },
      { titre: 'Photographier au moment du constat', detail: 'Prenez la photo tout de suite, pas en fin de visite. Une photo prise au moment où vous relevez un défaut se passe de commentaire ; la même prise une heure plus tard demande de se souvenir de quoi il s’agissait.' },
      { titre: 'Noter ce que la photo ne montre pas', detail: 'L’observation libre sert à ce qui ne se photographie pas : une odeur d’humidité, un bruit de circulateur, une information donnée par le concierge.' },
      { titre: 'Attendre la synchronisation', detail: 'De retour dans une zone couverte, gardez l’application ouverte jusqu’à ce que le bandeau indique la reconnexion. Les photos, plus lourdes, finissent de partir à ce moment.' },
    ],
    pourAllerPlusLoin: ['terrain', 'etats-priorites'],
  },
  {
    slug: 'plan-quantites',
    titre: 'Mesurer sur un plan et reporter les quantités',
    objectif: 'Passer d’un PDF d’architecte à des surfaces justes dans le relevé.',
    duree: '20 min',
    niveau: 'Intermédiaire',
    prerequis: ['Un plan du bâtiment en PDF ou en image.', 'Un diagnostic existant, même partiellement relevé.'],
    etapes: [
      { titre: 'Importer le plan', detail: 'Ouvrez Plans, dans le menu du dossier, et déposez votre fichier. Les PDF de plusieurs pages sont gérés tels quels, chaque page gardant ses propres mesures.', ecran: 'Dossier > Plans' },
      { titre: 'Étalonner la page', detail: 'L’éditeur s’ouvre sur l’étalonnage tant qu’il n’y a pas d’échelle. Tracez un trait sur la cote connue la plus longue du plan et saisissez sa longueur réelle.' },
      { titre: 'Étendre l’échelle aux autres pages', detail: 'Si le document porte la même échelle sur plusieurs pages, cochez-les dans l’aperçu proposé. Décochez les pages à une autre échelle, un détail au 1:20 par exemple, pour les étalonner séparément.' },
      { titre: 'Tracer les zones', detail: 'Avec l’outil Zone, délimitez une surface au glisser pour un rectangle, ou point par point pour une forme libre. La surface s’affiche en direct, arrondie au demi mètre carré.' },
      { titre: 'Rattacher chaque zone à son ouvrage', detail: 'Le choix de l’ouvrage est proposé dès la zone tracée. La liste des mesures, à droite, signale en orange celles qui ne sont rattachées à rien : un clic sur la ligne ouvre le choix.' },
      { titre: 'Comparer deux états', detail: 'L’outil Référence superpose un second plan en transparence, par exemple le projet par-dessus l’existant. Vous choisissez la page à superposer et vous la faites glisser pour l’aligner.' },
      { titre: 'Reporter dans le relevé', detail: 'De retour dans le relevé, les ouvrages dont les plans portent des mesures proposent le report. Diagly affiche la quantité mesurée, le total des zones concernées et ce que cela change au coût. Vous validez.', ecran: 'Dossier > Relevé' },
    ],
    pourAllerPlusLoin: ['etalonner', 'mesurer-reporter', 'quantites'],
  },
  {
    slug: 'rapport-client',
    titre: 'Produire et partager un rapport',
    objectif: 'Sortir le bon document et le transmettre proprement.',
    duree: '10 min',
    niveau: 'Débutant',
    etapes: [
      { titre: 'Mettre votre marque', detail: 'Dans Paramètres, déposez votre logo et choisissez votre couleur (Personnalisation), puis vérifiez vos coordonnées (Entreprise). Ils figureront sur chaque page de chaque document.', ecran: 'Paramètres > Personnalisation' },
      { titre: 'Choisir le document', detail: 'Complet pour un propriétaire ou une régie, Rapport pour une version resserrée, De l’existant pour un état des lieux sans chiffrage, Rapports photo pour le reportage seul.', ecran: 'Dossier > Rapports' },
      { titre: 'Adapter au client', detail: 'Personnaliser, sous la liste des documents, change le logo, la couleur ou l’auteur pour ce dossier seulement, sans toucher aux autres.', ecran: 'Dossier > Rapports' },
      { titre: 'Relire à l’écran', detail: 'La mise en page est celle de l’impression, en A4 paginé. Relisez les travaux repris de votre base : ce sont eux que votre client lira, et ils gagnent souvent à être précisés pour le bâtiment concerné.' },
      { titre: 'Partager ou imprimer', detail: 'Le lien de partage ouvre le rapport dans un navigateur, sans compte. Imprimer produit le PDF, avec la même mise en page.' },
      { titre: 'Refermer le dossier', detail: 'Quand le mandat est terminé, révoquez le lien de partage : il cesse de fonctionner pour tout le monde.' },
    ],
    pourAllerPlusLoin: ['choisir-rapport', 'partager'],
  },
  {
    slug: 'catalogue-maison',
    titre: 'Adapter le catalogue à votre pratique',
    objectif: 'Mettre vos prix et vos textes dans le catalogue pour que les rapports sortent justes du premier coup.',
    duree: '20 min',
    niveau: 'Intermédiaire',
    prerequis: ['Un rôle Administrateur ou Propriétaire : la base de données ne se modifie qu’avec ces droits.'],
    etapes: [
      { titre: 'Repérer les articles qui comptent', detail: 'Inutile de tout reprendre. Partez d’un diagnostic déjà chiffré et regardez les dix postes les plus lourds : ce sont eux qui font le budget.', ecran: 'Dossier > Coûts' },
      { titre: 'Ajuster les prix unitaires', detail: 'Dans Base de données, corrigez le prix unitaire de ces articles pour chaque état, avec les chiffres de vos dernières soumissions.', ecran: 'Base de données' },
      { titre: 'Reprendre les textes', detail: 'Les travaux décrits pour chaque état sont ceux qui partiront dans le rapport. Récrivez-les dans vos mots : un texte qui ressemble à votre façon d’écrire vous évitera de le retoucher dossier après dossier.' },
      { titre: 'Ajouter vos propres articles', detail: 'Un ouvrage que vous rencontrez souvent et qui n’est pas au catalogue mérite son article, avec son code CFC, son unité et ses prix.' },
      { titre: 'Vérifier sur un nouveau dossier', detail: 'Créez un diagnostic d’essai et relevez quelques ouvrages : c’est le moyen le plus rapide de voir si vos prix et vos textes tombent juste. Supprimez-le ensuite.' },
    ],
    pourAllerPlusLoin: ['catalogue-cfc', 'calcul-couts'],
  },
  {
    slug: 'inviter-equipe',
    titre: 'Mettre en place son équipe',
    objectif: 'Créer l’équipe de votre société, inviter vos collaborateurs et leur donner le bon rôle.',
    duree: '10 min',
    niveau: 'Débutant',
    prerequis: ['Le nom de votre société renseigné dans Paramètres > Entreprise : l’équipe le porte.'],
    etapes: [
      { titre: 'Créer l’équipe', detail: 'Dans Paramètres > Membres, créez l’équipe : elle porte le nom de votre société. Vos diagnostics existants lui sont rattachés et deviennent ceux de l’équipe.', ecran: 'Paramètres > Membres' },
      { titre: 'Inviter les membres', detail: 'Saisissez l’adresse d’un collaborateur et choisissez son rôle. Il reçoit un lien par courriel qui le rattache directement à l’équipe ; le lien se copie aussi, si le courriel tarde.', ecran: 'Paramètres > Membres' },
      { titre: 'Choisir les rôles', detail: 'Administrateur pour ceux qui gèrent l’équipe et la base de données, Membre pour les diagnostiqueurs, Lecture seule pour un mandant externe. Le tableau des droits dit exactement ce que chacun peut faire.', ecran: 'Paramètres > Rôles et droits' },
      { titre: 'Suivre les invitations', detail: 'Les invitations pas encore acceptées restent visibles, avec leur date d’expiration. Révoquez celles qui n’ont plus lieu d’être.', ecran: 'Paramètres > Invitations' },
    ],
    pourAllerPlusLoin: ['equipe-roles', 'catalogue-cfc'],
  },
  {
    slug: 'planifier-parc',
    titre: 'Planifier les travaux sur plusieurs années',
    objectif: 'Passer d’un relevé d’états à un budget d’entretien étalé, pour un immeuble ou pour un parc.',
    duree: '25 min',
    niveau: 'Intermédiaire',
    prerequis: ['Au moins un diagnostic relevé et chiffré.'],
    etapes: [
      { titre: 'Fixer les années d’intervention', detail: 'Reprenez les années proposées par les priorités et ajustez-les. C’est ici que se décide l’étalement : un budget annuel régulier vaut mieux qu’une année à six chiffres suivie de deux années vides.', ecran: 'Dossier > Relevé' },
      { titre: 'Regrouper ce qui se fait ensemble', detail: 'Mettez la même année aux ouvrages qui partagent un moyen de chantier. Une façade et des fenêtres traitées la même année ne paient l’échafaudage qu’une fois.' },
      { titre: 'Retenir les enveloppes', detail: 'Pour chaque ouvrage, retenez ou non l’amélioration et la mise aux normes en plus de la réparation : ce choix change le montant.', ecran: 'Dossier > Relevé' },
      { titre: 'Comparer des variantes', detail: 'Une variante met en regard une autre façon de faire et son budget complet. Regardez l’écart autant que les totaux : c’est lui qui dit ce qu’on achète en changeant de solution.', ecran: 'Dossier > Variantes' },
      { titre: 'Voir le parc dans son ensemble', detail: 'L’écran Parc immobilier rassemble vos bâtiments. Pour une régie ou un propriétaire institutionnel, c’est la vue qui compte : l’effort à prévoir, bâtiment par bâtiment et année par année.', ecran: 'Parc immobilier' },
      { titre: 'Sortir le budget', detail: 'Exportez en Excel pour intégrer le plan de travaux à votre suivi comptable, ou branchez votre ERP sur l’API pour qu’il se tienne à jour tout seul.', ecran: 'Dossier > Rapports' },
    ],
    pourAllerPlusLoin: ['etats-priorites', 'enveloppes-variantes', 'export-api'],
  },
  {
    slug: 'brancher-erp',
    titre: 'Brancher un ERP ou un partenaire',
    objectif: 'Exposer vos diagnostics à un autre système, par l’API et les webhooks.',
    duree: '45 min',
    niveau: 'Avancé',
    prerequis: ['Un accès développeur au système à raccorder.'],
    etapes: [
      { titre: 'Créer une clé d’API', detail: 'Dans Intégrations, créez une clé par outil à raccorder. Elle n’est affichée qu’à la création : copiez-la tout de suite dans votre gestionnaire de secrets. Les clés sont personnelles.', ecran: 'Intégrations > Clés d’API' },
      { titre: 'Essayer les points d’entrée', detail: 'La documentation interactive permet d’appeler l’API depuis le navigateur avec votre clé. Commencez par lister vos diagnostics, puis descendez vers le détail d’un dossier.', ecran: 'Intégrations > Documentation' },
      { titre: 'Rapprocher par l’EGID', detail: 'Chaque ressource porte l’EGID du bâtiment. C’est lui qu’il faut utiliser comme clé de jointure avec votre système, et pas l’adresse, dont l’écriture varie d’une base à l’autre.' },
      { titre: 'Déclarer un webhook', detail: 'Ajoutez l’adresse de réception de votre système et cochez les événements voulus, pour être prévenu au moment où ils se produisent plutôt que d’interroger l’API en boucle.', ecran: 'Intégrations > Webhooks' },
      { titre: 'Vérifier la signature', detail: 'Côté récepteur, recalculez la signature HMAC de chaque appel avec le secret de l’adresse avant de le traiter : l’exemple de code est sur la page. Un appel sans signature valable n’est pas un appel de Diagly.' },
      { titre: 'Prévoir les reprises', detail: 'Votre système sera indisponible un jour ou l’autre. L’historique des envois permet de renvoyer les appels manqués : prévoyez un traitement idempotent côté récepteur.' },
    ],
    pourAllerPlusLoin: ['export-api', 'egid-donnees'],
  },
]
