#!/usr/bin/env bash
#
# Déploiement de Diagly sur le serveur Infomaniak, par SSH et rsync.
#
# Le dépôt n'en portait aucun : la mise en ligne se faisait à la main, et rien
# n'écrivait nulle part l'ordre des opérations. Cet ordre compte, en particulier
# entre le schéma de la base et le redémarrage de l'API.
#
# Par sécurité, le script ne transfère RIEN tant qu'on ne lui passe pas --go :
# sans ce drapeau il fait une simulation rsync complète et affiche ce qu'il
# aurait écrit. Un premier déploiement se regarde avant de se lancer.
#
#   cp .env.deploy.example .env.deploy   puis remplir
#   bash scripts/deploy.sh               simulation
#   bash scripts/deploy.sh --go          pour de vrai
#
set -euo pipefail

cd "$(dirname "$0")/.."

# ---------------------------------------------------------------- réglages
if [ -f .env.deploy ]; then
  # shellcheck disable=SC1091
  . ./.env.deploy
fi

: "${DEPLOY_HOST:?DEPLOY_HOST manquant (voir .env.deploy)}"
: "${DEPLOY_USER:?DEPLOY_USER manquant}"
: "${DEPLOY_PATH:?DEPLOY_PATH manquant, le dossier applicatif sur le serveur}"
DEPLOY_PORT="${DEPLOY_PORT:-22}"
# Nom du processus à redémarrer. pm2 par défaut ; mettre systemd:<unité> sinon.
DEPLOY_SERVICE="${DEPLOY_SERVICE:-pm2:diagly}"

GO=0
[ "${1:-}" = "--go" ] && GO=1
RSYNC_MODE="--dry-run"
[ "$GO" = "1" ] && RSYNC_MODE=""

SSH="ssh -p $DEPLOY_PORT ${DEPLOY_USER}@${DEPLOY_HOST}"
RSYNC_SSH="ssh -p $DEPLOY_PORT"

dire() { printf '\n\033[1m%s\033[0m\n' "$*"; }

# --------------------------------------------------------------- garde-fous
if [ -n "$(git status --porcelain)" ]; then
  echo "L'arbre de travail n'est pas propre. On ne publie que ce qui est commité." >&2
  git status --short >&2
  exit 1
fi

dire "Publication de $(git rev-parse --short HEAD) sur ${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}"
[ "$GO" = "1" ] || echo "(simulation : rien ne sera écrit. Ajouter --go pour transférer.)"

# ---------------------------------------------------------------- fabrication
dire "1. Construction"
npm run build
( cd server && npm run build )

# ------------------------------------------------------------------ transfert
# Le front part dans web/, servi par Express via STATIC_DIR. --delete nettoie les
# anciens bundles hachés, qui s'accumuleraient sinon à chaque mise en ligne.
dire "2. Front vers ${DEPLOY_PATH}/web"
rsync -az $RSYNC_MODE --delete -e "$RSYNC_SSH" \
  dist/ "${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}/web/"

# Le serveur : le JS compilé, de quoi installer ses dépendances, et le schéma.
# Pas de --delete sur prisma/, le dossier peut porter des fichiers du serveur.
dire "3. API vers ${DEPLOY_PATH}/server"
rsync -az $RSYNC_MODE --delete -e "$RSYNC_SSH" \
  server/dist/ "${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}/server/dist/"
rsync -az $RSYNC_MODE -e "$RSYNC_SSH" \
  server/package.json server/package-lock.json \
  "${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}/server/"
rsync -az $RSYNC_MODE -e "$RSYNC_SSH" \
  server/prisma/ "${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}/server/prisma/"

if [ "$GO" != "1" ]; then
  dire "Simulation terminée. Rien n'a été écrit."
  exit 0
fi

# ------------------------------------------------------------------- à distance
dire "4. Dépendances, schéma et redémarrage"
$SSH bash -se <<REMOTE
set -euo pipefail
cd "${DEPLOY_PATH}/server"

npm ci --omit=dev
npx prisma generate

# Sauvegarde avant de toucher au schéma. Sans elle, une colonne perdue l'est.
horodatage=\$(date +%Y%m%d-%H%M%S)
mysqldump --single-transaction --no-tablespaces "\$DB_NAME" > "../sauvegardes/avant-\$horodatage.sql" 2>/dev/null \
  || echo "ATTENTION : sauvegarde impossible, vérifier DB_NAME et le dossier ../sauvegardes"

npx prisma db push

# Le piège connu : users.preferences est un JSON NOT NULL avec defaut {}. Selon
# l'etat de depart, db push laisse des lignes a NULL, et la lecture des
# preferences fait echouer la connexion des comptes deja existants. On repare
# avant de redemarrer, pas apres le premier appel au support.
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.\\\$executeRawUnsafe(\"UPDATE users SET preferences = '{}' WHERE preferences IS NULL\")
  .then((n) => console.log('preferences reparees sur ' + n + ' ligne(s)'))
  .catch((e) => { console.error('reparation preferences : ' + e.message); process.exit(1); })
  .finally(() => p.\\\$disconnect());
"

case "${DEPLOY_SERVICE}" in
  pm2:*)     pm2 restart "\${DEPLOY_SERVICE#pm2:}" ;;
  systemd:*) sudo systemctl restart "\${DEPLOY_SERVICE#systemd:}" ;;
  *)         echo "DEPLOY_SERVICE non reconnu : ${DEPLOY_SERVICE}. Redemarrer a la main." ;;
esac
REMOTE

dire "5. Contrôle"
curl -fsS "https://${DEPLOY_HOST}/health" && echo || echo "La page /health n'a pas repondu, verifier le service."

dire "Publié."
