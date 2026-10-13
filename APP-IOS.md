# L'app iPhone et iPad

L'app de l'App Store n'est pas une seconde application. C'est le front de ce
dépôt, embarqué dans une coquille native par [Capacitor](https://capacitorjs.com)
8, avec des fonctions natives là où le web ne suffit pas : impression, réseau,
écran de lancement, barre d'état, clavier, barre du bas native, connexion Apple
et Google, notifications Apple (APNs). Restent à venir : caméra native, partage
de fichiers, liens universels.

Sur iPhone, l'app montre la version de terrain, comme le site sous 768 px, en
portrait seulement. Sur iPad, elle montre l'app complète avec son menu de
gauche, dans toutes les orientations. Le menu se replie par le bouton en haut à
gauche (le choix est retenu) ; dans l'éditeur du relevé, l'iPad travaille un
panneau à la fois, comme le téléphone, et replie le menu d'office
(`useEstTablette` dans `src/lib/use-mobile.ts`, `src/stores/menu-lateral.ts`).
En Split View, l'iPad passe à la version de terrain dès que la fenêtre devient
étroite.

## Comment elle tourne

- Le front est construit par `npm run build:app` (mode Vite `app`), puis copié
  dans `ios/App/App/public` par `cap sync`. Il est **dans** l'app : une
  modification du site n'atteint l'iPhone qu'à la version suivante de l'app.
- La page est servie depuis `capacitor://localhost`. Les appels partent vers
  `https://diagly.ch` (`BASE_URL` dans `src/lib/api.ts`, et `vite.config.ts`
  en mode `app`). Pour viser un autre serveur :
  `VITE_API_URL=https://… npm run build:app`.
- Le serveur accepte l'origine `capacitor://localhost` en dur (CORS, dans
  `server/src/index.ts`). Les fichiers de `/uploads` portent
  `Cross-Origin-Resource-Policy: cross-origin`, sans quoi l'app n'afficherait
  aucun plan : l'accès reste gardé par le jeton signé de l'URL.
- `src/lib/plateforme.ts` dit si l'on est dans l'app (`estAppNative`). Dans
  l'app : pas de vitrine (`/` mène à `/app`), pas de page de paiement ni de
  section Facturation (règle 3.1.1 de l'App Store), pas de service worker.
  Un lien destiné à sortir de l'app (rapport partagé, invitation) part de
  `ORIGINE_PUBLIQUE`, soit `https://diagly.ch`.
- La vue web ne défile pas d'un bloc (`scrollEnabled: false` dans
  `capacitor.config.ts`) : seules les zones de contenu défilent, l'en-tête et la
  barre du bas restent en place.
- Sur iPhone, la barre du bas est dessinée par iOS (`BarreOngletsPlugin.swift`,
  pilotée par `src/components/layout/MobileNav.tsx`) : en Liquid Glass sur
  iOS 26, avec le flou du système avant. Le front décrit les boutons et reçoit
  les touchers ; la navigation reste au routeur web. Elle s'efface pendant la
  saisie au clavier.

**Conséquence durable :** des versions anciennes de l'app restent installées
des semaines après une mise en ligne. L'API doit donc rester compatible avec
elles : ajouter des champs et des routes, oui ; en retirer ou en changer le
sens, seulement après une version de l'app qui ne s'en sert plus.

## Le hors-ligne

Sur le terrain, le réseau manque souvent (sous-sol, cage d'escalier) et iOS
ferme volontiers une app passée en arrière-plan. Les relevés passent donc par
une **file d'envoi** (`src/lib/hors-ligne/`) :

- chaque saisie (créer, modifier, supprimer un relevé) s'affiche tout de suite,
  est écrite sur l'appareil (fichiers de l'app sur iOS, dans `Library/NoCloud`,
  hors sauvegarde iCloud ; IndexedDB sur le web), puis part au serveur dès que
  possible, dans l'ordre, une à la fois ;
- l'identifiant d'un relevé est un UUID choisi par l'appareil : une création
  renvoyée après une coupure ne fait pas de doublon (le serveur rend le relevé
  existant, ou répond 409 si cet identifiant appartient à un autre diagnostic),
  et une modification d'un relevé créé hors-ligne vise directement son
  identifiant définitif ;
- sans réponse du serveur, l'envoi est retenté après 5 s, puis 10, 20, 30 et
  60 s ; un refus définitif (relevé supprimé ailleurs, droits insuffisants,
  photos trop lourdes) est affiché et retiré de la file ;
- les saisies d'un autre compte (session expirée, appareil partagé) attendent
  le retour de ce compte : elles ne partent jamais sous un autre ;
- les lectures de relevés (`api.diagnostics.get` et `listItems`) superposent
  la file à la réponse du serveur : un rafraîchissement n'efface jamais une
  saisie pas encore partie ;
- le bandeau du haut dit ce qui attend, si le serveur est injoignable, et ce
  qu'il a refusé ; la déconnexion prévient avant d'effacer des saisies ;
- « Préparer pour le terrain », dans le sommaire du dossier sur téléphone,
  charge le dossier, sa visite et la base CFC sur l'appareil avant la visite
  (pas les plans). Le cache des requêtes est gardé sept jours sur l'appareil.

**Règle :** une nouvelle écriture faite sur le terrain passe par `saisir()`
(`file-envoi.ts`), jamais par un appel direct à l'API ni par une mutation
react-query, qui ne survivrait pas à la fermeture de l'app.

## Les comptes

- **Se connecter avec Apple** (app seulement) : la feuille d'iOS
  (`ConnexionPlugin.swift`, méthode `apple`) rend un jeton d'identité, que
  `POST /api/auth/apple` vérifie auprès d'Apple. Le compte se retrouve par
  l'identifiant Apple, puis par l'adresse si Apple l'a vérifiée ; sinon il est
  créé. Une adresse relais d'Apple fait un compte à part.
- **Google** : dans l'app, la fenêtre de connexion sécurisée d'iOS
  (`ASWebAuthenticationSession`) ouvre `/api/auth/google?app=1&challenge=…`.
  Google refuse les connexions dans la vue web d'une app, d'où ce détour. Une
  autre app peut déclarer l'adresse `ch.diagly.app://` : le retour ne porte donc
  pas de jetons, seulement un code à usage unique valable une minute
  (`?code=…`). Le plugin a tiré un secret dont seule l'empreinte SHA-256
  (`challenge`) est partie ; `POST /api/auth/app/echange` échange le code avec
  ce secret (PKCE, `server/src/lib/pkce.ts`) et rend la session ou l'étape 2FA.
  Une version de l'app d'avant cet échange reçoit « Mettez à jour l'app ».
- La double authentification s'applique aussi à ces deux connexions.
- **Suppression du compte** (règle 5.1.1 d'Apple) : Paramètres, Compte,
  « Supprimer mon compte », en tapant SUPPRIMER. Le serveur
  (`POST /api/auth/compte/supprimer`) efface les dossiers, relevés, photos,
  plans (fichiers compris) et notifications, et révoque l'accès Apple. Le
  propriétaire d'une équipe qui a d'autres membres doit d'abord la confier.
  Les dossiers (et opérations) d'un autre membre d'équipe ne sont pas effacés :
  ils passent au propriétaire de l'équipe, dans la même transaction.

## Les notifications

- La permission se demande une fois, juste après la première connexion
  (`src/lib/natif.ts`) ; elle reste modifiable dans Paramètres, Notifications.
- Le jeton de l'appareil part au serveur (`POST /api/push/appareil`) à chaque
  démarrage, et en est retiré à la déconnexion (`/api/push/appareil/retirer`).
- Le serveur envoie par APNs (`server/src/lib/apple.ts`) avec la clé Apple du
  `.env` de production : `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`
  (le contenu du `.p8` en base64, sur une ligne). Sans elle, aucune
  notification sur l'iPhone, et pas de révocation Apple à la suppression d'un
  compte ; la connexion Apple marche quand même. `APNS_SANDBOX=true` ne sert
  qu'à une app compilée en développement : TestFlight et l'App Store utilisent
  l'APNs de production.
- Toucher une notification ouvre la page qu'elle désigne.

## Compiler sans Mac

Xcode n'existe que sur Mac. La compilation se fait sur les machines macOS de
GitHub Actions (`.github/workflows/app-ios.yml`, `macos-26`, Node 22). Le dépôt
est public aujourd'hui et destiné à passer **en privé** (les données, elles,
restent chez Infomaniak) : une minute macOS y comptera alors pour dix sur le
forfait d'Actions, soit une trentaine d'envois TestFlight par mois dans les
2'000 minutes du forfait gratuit. D'où des déclenchements automatiques limités
au code natif.

- **À chaque push** sur `app-ios` ou `master` qui touche le code natif
  (`ios/`, `package.json`, `capacitor.config.ts`, le workflow lui-même) :
  compilation pour le simulateur, sans signature. Elle dit si le projet
  compile.
- **À la demande** : onglet *Actions* > *App iOS* > *Run workflow*, case
  « Signer la version et l'envoyer sur TestFlight » cochée (par défaut). La
  version est signée, envoyée sur App Store Connect, et apparaît dans
  TestFlight une quinzaine de minutes plus tard. Le numéro de build est
  l'heure UTC (`AAMMJJHHMM`) ; le numéro de version (`MARKETING_VERSION`) est
  réglé dans le projet Xcode. Case décochée : compilation simulateur seulement.

La signature est une **signature de distribution**, réglée à la main dans la
configuration Release de la cible App. La signature automatique de Xcode passe
par un profil de développement, qu'Apple refuse de créer tant qu'aucun appareil
n'est enregistré sur le compte : avec la distribution, aucun appareil n'est
nécessaire.

- Le **certificat de distribution** (« Apple Distribution: Jack Guisolan »,
  expire le 12 octobre 2027) a été créé une fois, par l'API, depuis le poste.
  Il vit dans les secrets `IOS_DIST_P12` (le .p12 en base64) et
  `IOS_DIST_P12_PASSWORD`, et nulle part ailleurs : à son expiration, ou s'il
  est perdu, on en crée un autre et on remplace ces deux secrets. Pendant
  l'envoi, il passe par un trousseau temporaire, effacé à la fin.
- Le **profil App Store** « Diagly App Store (CI) » est recréé à chaque envoi
  par `ios/outils/profil-app-store.mjs`, avec la clé d'API App Store Connect.
  Il suit ainsi les capacités cochées sur l'identifiant `ch.diagly.app`
  (notifications, connexion Apple).
- Ce script vérifie d'abord que l'app existe dans App Store Connect : Apple ne
  permet pas de l'y créer par l'API, c'est la seule étape à faire à la main.

**Les secrets du workflow** (GitHub > Settings > Secrets and variables >
Actions). L'envoi vérifie leur présence en premier et s'arrête en nommant ceux
qui manquent :

| Secret | Contenu |
| --- | --- |
| `APPLE_TEAM_ID` | identifiant d'équipe, 10 caractères |
| `ASC_KEY_ID` | identifiant de la clé d'API App Store Connect |
| `ASC_ISSUER_ID` | identifiant de l'émetteur de cette clé |
| `ASC_KEY_P8` | contenu complet du fichier `.p8` de la clé, lignes BEGIN et END comprises |
| `IOS_DIST_P12` | certificat de distribution, `.p12` en base64 |
| `IOS_DIST_P12_PASSWORD` | mot de passe du `.p12` |
| `VITE_CARTO_KEY` | facultatif : clé publique des fonds de carte, inscrite dans le front au build |

## À faire une fois chez Apple

Ces étapes ont été faites pour Diagly ; elles ne se refont que pour un nouveau
compte, ou pour remplacer une clé perdue.

1. **Identifiant d'équipe.** developer.apple.com > Account > Membership
   details : *Team ID*, 10 caractères.
2. **Identifiant de l'app** `ch.diagly.app` : créé par l'API. Les capacités
   *Push Notifications* et *Sign in with Apple* sont demandées par
   `ios/App/App/App.entitlements` ; *Associated Domains* attendra les liens
   universels.
3. **L'app dans App Store Connect.** Apps > + > Nouvelle app. Plateforme iOS,
   nom « Diagly », langue principale Français, bundle ID `ch.diagly.app`,
   SKU `diagly-ios`, accès complet.
4. **Clé d'API App Store Connect.** Users and Access > Integrations > App
   Store Connect API > Team Keys > +. Nom « GitHub Actions », accès *Admin*
   (pour créer certificats et profils). Télécharger
   le fichier `.p8` : **il ne se télécharge qu'une fois**. Noter le *Key ID*
   et l'*Issuer ID* affiché au-dessus de la liste.
5. **Les secrets du dépôt** (tableau ci-dessus). Depuis ce poste, sans afficher
   la clé :
   `gh secret set ASC_KEY_P8 --repo Finalyn/Diagly < chemin/AuthKey_XXXX.p8`
6. **TestFlight.** App Store Connect > l'app > TestFlight > Test interne : créer
   un groupe, y ajouter les testeurs. Chacun installe l'app TestFlight sur
   l'iPhone ou l'iPad, puis Diagly depuis TestFlight.

## Le serveur d'abord

L'app parle à la production, et le front embarqué suit le code de la branche :
les routes qu'il appelle doivent exister en production. Mettre le serveur de
la branche en ligne (`DEPLOIEMENT.md`) **avant** d'envoyer sur TestFlight une
version qui appelle des routes nouvelles. Sans l'autorisation de
`capacitor://localhost` côté serveur, chaque appel serait refusé et l'app
resterait sur l'écran de connexion avec une erreur réseau.

## Le projet natif

| Fichier | Rôle |
| --- | --- |
| `capacitor.config.ts` | identifiant `ch.diagly.app`, réglages iOS (vue qui ne défile pas, mode mobile sur iPad) et plugins |
| `ios/App/App/Info.plist` | français, mode clair, autorisations caméra et photos, portrait sur iPhone, toutes orientations sur iPad |
| `ios/App/App/App.entitlements` | notifications (APNs de production) et connexion Apple |
| `ios/App/App/AppDelegate.swift` | transmet le jeton APNs de l'appareil à Capacitor |
| `ios/App/App/DiaglyViewController.swift` | vue principale : enregistre les plugins maison, geste de retour depuis le bord, pas d'aperçu Safari |
| `ios/App/App/ImpressionPlugin.swift` | feuille d'impression iOS (`src/lib/impression.ts`) |
| `ios/App/App/ConnexionPlugin.swift` | connexion Apple et fenêtre de connexion sécurisée pour Google (`src/lib/connexion-native.ts`) |
| `ios/App/App/BarreOngletsPlugin.swift` | barre du bas native, Liquid Glass sur iOS 26 (`src/lib/barre-native.ts`) |
| `src/lib/natif.ts` | démarrage dans l'app : écran de lancement, barre d'état, réseau, retour au premier plan, notifications |
| `src/lib/push-client.ts` | permission et jeton des notifications, côté app comme côté navigateur |
| `ios/outils/profil-app-store.mjs` | crée le profil App Store par l'API, lancé par le workflow |
| `ios/outils/ajouter-au-projet.py` | déclare un nouveau fichier Swift dans le projet Xcode, sans Xcode |

Un fichier Swift posé dans `ios/App/App` n'est pas compilé tant qu'il n'est pas
déclaré dans `project.pbxproj` : `python ios/outils/ajouter-au-projet.py
App/MonFichier.swift`. Un plugin maison s'enregistre en plus à la main dans
`DiaglyViewController.capacitorDidLoad`.

L'icône et l'écran de lancement sont tirés de `public/diagly-mark.svg` sur fond
blanc (icône 1024 px sans transparence, exigée par Apple). L'app demande
iOS 15 au minimum.

## Feuille de route

1. **Fondations** : fait. Projet iOS, front embarqué, compilation dans le
   cloud, envoi TestFlight.
2. **Sensation native** : barre du bas native faite. Restent la caméra native,
   l'export PDF/Excel/photos par la feuille de partage, le retour haptique
   ailleurs que dans la barre, les liens universels (rapport partagé,
   invitation, mot de passe oublié).
3. **Hors-ligne robuste** : fait pour les relevés (voir plus haut). Reste
   hors file : les autres écritures (fiche du bâtiment, visite), qui se font
   surtout au bureau.
4. **Comptes** : fait. « Se connecter avec Apple », Google par la fenêtre
   sécurisée d'iOS, suppression du compte dans l'app.
5. **Notifications** Apple (APNs) : fait, à côté du push web.
6. **Publication** : politique de confidentialité en ligne, captures iPhone et
   iPad, fiche App Store, compte de démonstration pour la revue.
