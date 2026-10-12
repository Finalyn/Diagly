# L'app iPhone et iPad

L'app de l'App Store n'est pas une seconde application. C'est le front de ce
dépôt, embarqué dans une coquille native par [Capacitor](https://capacitorjs.com)
8, avec des fonctions natives là où le web ne suffit pas : impression, réseau,
écran de lancement, et à venir caméra, notifications, connexion Apple et
Google, partage de fichiers.

Sur iPhone, l'app montre la version de terrain, comme le site sous 768 px. Sur
iPad, elle montre l'app complète avec sa barre latérale. En Split View, l'iPad
passe à la version de terrain dès que la fenêtre devient étroite.

## Comment elle tourne

- Le front est construit par `npm run build:app` (mode Vite `app`), puis copié
  dans `ios/App/App/public` par `cap sync`. Il est **dans** l'app : une
  modification du site n'atteint l'iPhone qu'à la version suivante de l'app.
- La page est servie depuis `capacitor://localhost`. Les appels partent vers
  `https://diagly.ch` (`BASE_URL` dans `src/lib/api.ts`). Pour viser un autre
  serveur : `VITE_API_URL=https://… npm run build:app`.
- Le serveur accepte l'origine `capacitor://localhost` en dur (CORS, dans
  `server/src/index.ts`). Les fichiers de `/uploads` portent
  `Cross-Origin-Resource-Policy: cross-origin`, sans quoi l'app n'afficherait
  aucun plan : l'accès reste gardé par le jeton signé de l'URL.
- `src/lib/plateforme.ts` dit si l'on est dans l'app (`estAppNative`). Dans
  l'app : pas de vitrine (`/` mène à `/app`), pas de page de paiement ni de
  section Facturation (règle 3.1.1 de l'App Store), pas de service worker.

**Conséquence durable :** des versions anciennes de l'app restent installées
des semaines après une mise en ligne. L'API doit donc rester compatible avec
elles : ajouter des champs et des routes, oui ; en retirer ou en changer le
sens, seulement après une version de l'app qui ne s'en sert plus.

## Compiler sans Mac

Xcode n'existe que sur Mac. La compilation se fait sur les machines macOS de
GitHub Actions (`.github/workflows/app-ios.yml`), gratuites puisque le dépôt
est public.

- **À chaque push** sur `app-ios` ou `master` qui touche l'app : compilation
  pour le simulateur, sans signature. Elle dit si le projet compile.
- **À la demande** : onglet *Actions* > *App iOS* > *Run workflow*. La version
  est signée, envoyée sur App Store Connect, et apparaît dans TestFlight une
  quinzaine de minutes plus tard. Le numéro de build est l'heure UTC
  (`AAMMJJHHMM`).

La signature est automatique : Xcode crée lui-même certificats et profils avec
la clé d'API. Chaque envoi peut laisser un certificat de développement
« Created via API » dans le portail ; s'ils s'accumulent, on révoque les
anciens, cela n'a aucun effet sur les versions publiées.

## À faire une fois chez Apple

1. **Identifiant d'équipe.** developer.apple.com > Account > Membership
   details : *Team ID*, 10 caractères.
2. **Identifiant de l'app.** Certificates, Identifiers & Profiles >
   Identifiers > + > App IDs > App. Bundle ID explicite : `ch.diagly.app`.
   Cocher *Push Notifications*, *Sign in with Apple* et *Associated Domains*
   (serviront aux phases suivantes ; les cocher maintenant évite d'y revenir).
3. **L'app dans App Store Connect.** Apps > + > Nouvelle app. Plateforme iOS,
   nom « Diagly », langue principale Français, bundle ID `ch.diagly.app`,
   SKU `diagly-ios`, accès complet.
4. **Clé d'API App Store Connect.** Users and Access > Integrations > App
   Store Connect API > Team Keys > +. Nom « GitHub Actions », accès *Admin*
   (la signature automatique doit pouvoir créer des certificats). Télécharger
   le fichier `.p8` : **il ne se télécharge qu'une fois**. Noter le *Key ID*
   et l'*Issuer ID* affiché au-dessus de la liste.
5. **Les secrets du dépôt.** GitHub > Settings > Secrets and variables >
   Actions : `APPLE_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, et `ASC_KEY_P8`
   (le contenu complet du `.p8`, lignes BEGIN et END comprises). Depuis ce
   poste, sans afficher la clé :
   `gh secret set ASC_KEY_P8 --repo Finalyn/Diagly < chemin/AuthKey_XXXX.p8`
6. **TestFlight.** App Store Connect > l'app > TestFlight > Test interne : créer
   un groupe, s'y ajouter. Installer l'app TestFlight sur l'iPhone et l'iPad.

## Le serveur avant le premier essai

L'app parle à la production. Tant que le serveur en ligne ne contient pas
l'autorisation de `capacitor://localhost`, **chaque appel est refusé** et
l'app reste sur l'écran de connexion avec une erreur réseau. Le front embarqué
suit aussi le code de la branche : les routes qu'il appelle doivent exister
en production. Mettre le serveur de la branche en ligne
(`DEPLOIEMENT.md`) avant d'installer la première version TestFlight.

## Le projet natif

| Fichier | Rôle |
| --- | --- |
| `capacitor.config.ts` | identifiant `ch.diagly.app`, réglages iOS et plugins |
| `ios/App/App/Info.plist` | français, mode clair, autorisations caméra et photos, orientations |
| `ios/App/App/DiaglyViewController.swift` | vue principale : geste de retour depuis le bord, pas d'aperçu Safari |
| `ios/App/App/ImpressionPlugin.swift` | feuille d'impression iOS (`src/lib/impression.ts`) |
| `src/lib/natif.ts` | démarrage dans l'app : écran de lancement, barre d'état, réseau, retour au premier plan |
| `ios/outils/ajouter-au-projet.py` | déclare un nouveau fichier Swift dans le projet Xcode, sans Xcode |

Un fichier Swift posé dans `ios/App/App` n'est pas compilé tant qu'il n'est pas
déclaré dans `project.pbxproj` : `python ios/outils/ajouter-au-projet.py
App/MonFichier.swift`.

L'icône et l'écran de lancement sont tirés de `public/diagly-mark.svg` sur fond
blanc (icône 1024 px sans transparence, exigée par Apple).

## Feuille de route

1. **Fondations** : fait. Projet iOS, front embarqué, compilation dans le
   cloud, envoi TestFlight.
2. **Sensation native** : caméra native, export PDF/Excel/photos par la
   feuille de partage, retour haptique, liens universels (rapport partagé,
   invitation, mot de passe oublié).
3. **Hors-ligne robuste** : file d'envoi stockée sur l'appareil, qui survit à
   la fermeture de l'app (aujourd'hui, une saisie hors-ligne est perdue si iOS
   ferme l'app avant le retour du réseau), création de relevés hors-ligne,
   préparation d'un dossier avant la visite.
4. **Comptes** : « Se connecter avec Apple » et Google natif, suppression du
   compte dans l'app (exigée par Apple, règle 5.1.1).
5. **Notifications** Apple (APNs), à côté du push web.
6. **Publication** : politique de confidentialité en ligne, captures iPhone et
   iPad, fiche App Store, compte de démonstration pour la revue.
