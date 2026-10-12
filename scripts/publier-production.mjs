#!/usr/bin/env node
/**
 * Prépare une mise en ligne : recopie le code dans le dépôt de production.
 *
 *   node scripts/publier-production.mjs           prépare et montre ce qui change
 *   node scripts/publier-production.mjs --pousser prépare, commite et pousse
 *
 * La production (Infomaniak) ne lit pas ce dépôt-ci. Elle suit le dépôt privé
 * Finalyn/diagly-deploy, cloné à côté de celui-ci (../diagly-deploy, ou le
 * chemin donné par DIAGLY_DEPLOY). Ce dépôt-là contient :
 *   - le serveur : un miroir des fichiers suivis de server/ ;
 *   - le front déjà construit, dans public/ : le serveur ne le construit pas ;
 *   - quatre choses qui lui sont propres et que ce script ne touche jamais :
 *     scripts/deploy.sh (lancé sur le serveur), son .gitignore, uploads/ et
 *     public/mobile (l'ancienne app mobile, toujours servie sous /mobile).
 *
 * Ensuite, sur le serveur :
 *   cd ~/sites/diagly.ch && git fetch origin && git reset --hard origin/main && bash scripts/deploy.sh
 *
 * Seul du code commité part : le script refuse un dépôt source modifié.
 */
import { execSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SOURCE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CIBLE = resolve(process.env.DIAGLY_DEPLOY ?? join(SOURCE, '..', 'diagly-deploy'))
const POUSSER = process.argv.includes('--pousser')

const PROTEGES = ['.gitignore', 'scripts/deploy.sh', 'uploads/.gitkeep']
const protege = (f) => PROTEGES.includes(f) || f.startsWith('public/')

const sh = (cmd, cwd, voir = false) =>
  voir ? (execSync(cmd, { cwd, stdio: 'inherit' }), '') : execSync(cmd, { cwd, encoding: 'utf8' }).trim()
const dire = (m) => console.log(`\n==> ${m}`)
const arreter = (m) => { console.error(`\nARRÊT : ${m}`); process.exit(1) }

// ------------------------------------------------------------- vérifications
if (!existsSync(join(CIBLE, '.git'))) arreter(`dépôt de production introuvable : ${CIBLE}`)
if (sh('git status --porcelain', SOURCE)) arreter('le dépôt source a des modifications non commitées.')
if (sh('git status --porcelain', CIBLE)) arreter(`le dépôt de production a des modifications : ${CIBLE}`)
if (sh('git rev-parse --abbrev-ref HEAD', CIBLE) !== 'main') arreter('le dépôt de production doit être sur main.')

const branche = sh('git rev-parse --abbrev-ref HEAD', SOURCE)
const commit = sh('git rev-parse --short HEAD', SOURCE)
const titre = sh('git log -1 --pretty=%s', SOURCE)
dire(`Source : ${branche} @ ${commit} (${titre})`)

dire('Dépôt de production à jour')
sh('git pull --ff-only', CIBLE, true)

// ---------------------------------------------------------------------- front
dire('1/3  Front (build web, même origine que l’API)')
sh('npm run build', SOURCE, true)

// --------------------------------------------------------------------- serveur
dire('2/3  Serveur : miroir des fichiers suivis de server/')
const fichiers = sh('git ls-files', join(SOURCE, 'server')).split('\n').filter(Boolean)
for (const f of fichiers) {
  if (protege(f)) continue
  mkdirSync(dirname(join(CIBLE, f)), { recursive: true })
  cpSync(join(SOURCE, 'server', f), join(CIBLE, f))
}
const garder = new Set(fichiers)
const retires = sh('git ls-files', CIBLE).split('\n').filter((f) => f && !protege(f) && !garder.has(f))
for (const f of retires) rmSync(join(CIBLE, f))
console.log(`${fichiers.length} fichiers recopiés, ${retires.length} retirés`)

// -------------------------------------------------------------- front publié
dire('3/3  Front construit vers public/ (public/mobile conservé)')
const PUBLIC = join(CIBLE, 'public')
mkdirSync(PUBLIC, { recursive: true })
for (const e of readdirSync(PUBLIC)) if (e !== 'mobile') rmSync(join(PUBLIC, e), { recursive: true, force: true })
cpSync(join(SOURCE, 'dist'), PUBLIC, { recursive: true })

// ------------------------------------------------------------------- résultat
sh('git add -A', CIBLE)
const bilan = sh('git diff --cached --shortstat', CIBLE)
if (!bilan) { dire('Rien ne change : la production a déjà cette version.'); process.exit(0) }
dire(`Changements : ${bilan}`)
console.log(sh('git diff --cached --name-status -- prisma/schema.prisma package.json', CIBLE) || '(schéma et dépendances inchangés)')

const date = new Date().toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' })
const message = `Version du ${date} : ${branche} @ ${commit}\n\n${titre}`
if (!POUSSER) {
  // Le dépôt de production retrouve exactement son état de départ (il était
  // propre, vérifié plus haut) : l'aperçu ne laisse rien derrière lui.
  sh('git reset -q --hard', CIBLE)
  sh('git clean -fdq', CIBLE)
  dire('Aperçu seulement. Relancer avec --pousser pour commiter et pousser.')
  process.exit(0)
}
execSync('git commit -q -F -', { cwd: CIBLE, input: message })
sh('git push -q origin main', CIBLE, true)
dire(`Poussé : ${sh('git log -1 --pretty="%h %s"', CIBLE)}`)
console.log('\nSur le serveur :\n  cd ~/sites/diagly.ch && git fetch origin && git reset --hard origin/main && bash scripts/deploy.sh')
