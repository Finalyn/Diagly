#!/usr/bin/env bash
#
# Mise en ligne, exécutée SUR le serveur, dans le dépôt déjà cloné.
#
#   cd ~/sites/diagly.ch
#   git fetch origin && git reset --hard origin/<branche>
#   bash scripts/deploy-serveur.sh
#
# Ce que la commande manuelle oubliait, et qui tient le site debout :
#
#   npm run build a la racine ne construit que le front. L'API est un paquet
#   separe dans server/, avec ses propres dependances et sa propre compilation.
#   Sans elles, pm2 relance l'ancien code.
#
#   prisma generate et db push : le client doit suivre le schema, sinon les
#   routes qui touchent aux tables neuves echouent a la premiere requete.
#
#   users.preferences : JSON NOT NULL avec {} pour defaut. Selon l'etat de
#   depart, db push laisse des lignes a NULL et la lecture des preferences fait
#   echouer la connexion des comptes existants. Le site repond, la page
#   s'affiche, et plus personne ne se connecte.
#
#   une sauvegarde avant de toucher au schema : db push ne sait pas defaire.
#
set -euo pipefail
cd "$(dirname "$0")/.."
RACINE="$PWD"

SERVICE="${SERVICE:-diagly}"
SAUVEGARDES="${SAUVEGARDES:-$RACINE/sauvegardes}"

dire() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

dire "Version $(git rev-parse --short HEAD) sur $(git rev-parse --abbrev-ref HEAD)"
git --no-pager log -1 --pretty='%s'

# --------------------------------------------------------------------- front
dire "1/5  Front"
npm ci
npm run build          # produit dist/, vers lequel pointe STATIC_DIR

# ----------------------------------------------------------------------- api
dire "2/5  API"
cd server
npm ci --omit=dev
npx prisma generate
npm run build          # produit server/dist/, lance par pm2

# ---------------------------------------------------------------- sauvegarde
dire "3/5  Sauvegarde de la base"
mkdir -p "$SAUVEGARDES"
HORO=$(date +%Y%m%d-%H%M%S)
DUMP="$SAUVEGARDES/avant-$HORO.sql"

# Le mot de passe ne transite par aucune variable de shell ni par la ligne de
# commande, ou un simple ps le rendrait visible : node ecrit un fichier d'options
# MySQL en 0600, mysqldump le lit, on l'efface. Les identifiants viennent de
# DATABASE_URL, dans server/.env, que le deploiement ne touche jamais.
OPTIONS=$(mktemp)
chmod 600 "$OPTIONS"
trap 'rm -f "$OPTIONS"' EXIT

node -e '
require("dotenv").config();
const fs = require("fs");
const u = new URL(process.env.DATABASE_URL);
fs.writeFileSync(process.argv[1], [
  "[client]",
  "host=" + u.hostname,
  "port=" + (u.port || "3306"),
  "user=" + decodeURIComponent(u.username),
  "password=" + decodeURIComponent(u.password),
  "",
].join("\n"), { mode: 0o600 });
console.log(u.pathname.replace(/^\//, ""));
' "$OPTIONS" > /tmp/diagly-db-nom.$$
DB_NOM=$(cat /tmp/diagly-db-nom.$$); rm -f /tmp/diagly-db-nom.$$

if mysqldump --defaults-extra-file="$OPTIONS" --single-transaction --no-tablespaces \
     "$DB_NOM" > "$DUMP" 2>/dev/null; then
  echo "Sauvegarde ecrite : $DUMP ($(du -h "$DUMP" | cut -f1))"
else
  rm -f "$DUMP"
  echo "ECHEC de la sauvegarde. On ne touche pas au schema sans filet." >&2
  echo "Verifier que mysqldump est installe et que DATABASE_URL est bonne." >&2
  exit 1
fi

# ------------------------------------------------------------------- schema
dire "4/5  Schema et reparation"
npx prisma db push

node -e '
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
p.$executeRawUnsafe("UPDATE users SET preferences = \x27{}\x27 WHERE preferences IS NULL")
  .then((n) => console.log("preferences remises a {} sur " + n + " ligne(s)"))
  .catch((e) => { console.error("reparation preferences : " + e.message); process.exit(1); })
  .finally(() => p.$disconnect());
'

# --------------------------------------------------------------- redemarrage
dire "5/5  Redemarrage"
cd "$RACINE"
pm2 restart "$SERVICE" --update-env
sleep 2
pm2 describe "$SERVICE" | grep -E "status|uptime|restarts" || true

dire "Controle"
PORT_API=$(node -e 'require("dotenv").config({path:"server/.env"}); console.log(process.env.PORT || 4000)')
if curl -fsS "http://127.0.0.1:${PORT_API}/health"; then
  echo
  dire "En ligne."
else
  echo
  echo "L API ne repond pas sur /health. Voir : pm2 logs $SERVICE --lines 50" >&2
  echo "Pour revenir en arriere : git reset --hard <commit precedent> puis relancer ce script." >&2
  echo "Si le schema est en cause, restaurer $DUMP." >&2
  exit 1
fi
