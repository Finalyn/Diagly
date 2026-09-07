// Synchronise le catalogue de reference (seed-data.json) vers une base existante.
//
// Le seed ne s'execute que sur une base vide : il ne sert a rien pour mettre a
// jour une installation en service. Ce script comble l'ecart.
//
//   node scripts/sync-catalogue.mjs              apercu, n'ecrit rien
//   node scripts/sync-catalogue.mjs --appliquer  cree et met a jour
//
// Trois garde-fous, apres l'incident du 4 septembre :
//   - rien n'est jamais supprime ; ce qui existe en base sans equivalent dans la
//     reference est signale, a examiner a la main
//   - l'appariement se fait sur le libelle normalise, et les id sont conserves :
//     les diagnostics deja saisis restent rattaches a leur ouvrage
//   - les items d'un utilisateur (ownerId non nul) ne sont jamais touches
import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const DATA = fileURLToPath(new URL('../prisma/seed-data.json', import.meta.url))
const appliquer = process.argv.includes('--appliquer')
const prisma = new PrismaClient()

const norm = (s) => (s ?? '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/** Champs repris du catalogue de reference. displayOrder est mis a part : il est
 *  recalcule par reorder-catalogue.mjs selon l'ordre de visite. */
const CHAMPS = [
  'category', 'categoryCfc', 'cfcCode', 'unit', 'quantityFormula',
  'workTbe', 'workBon', 'workMoyen', 'workMauvais', 'workImprovement', 'workNorms',
  'priceTbe', 'priceBon', 'priceMoyen', 'priceMauvais', 'priceImprovement', 'priceNorms',
  'descTbe', 'descBon', 'descMoyen', 'descMauvais', 'scaffoldingNote',
]

const { items: reference } = JSON.parse(readFileSync(DATA, 'utf-8'))
const enBase = await prisma.catalogItem.findMany({ where: { ownerId: null } })
const parNom = new Map(enBase.map((i) => [norm(i.description), i]))

const aCreer = []
const aMettreAJour = []
const inchanges = []

for (const ref of reference) {
  const actuel = parNom.get(norm(ref.description))
  if (!actuel) { aCreer.push(ref); continue }
  const ecarts = CHAMPS.filter((c) => (ref[c] ?? null) !== (actuel[c] ?? null))
  if (ecarts.length) aMettreAJour.push({ id: actuel.id, ref, actuel, ecarts })
  else inchanges.push(ref)
}

const nomsRef = new Set(reference.map((i) => norm(i.description)))
const orphelins = enBase.filter((i) => !nomsRef.has(norm(i.description)))

console.log(`Reference : ${reference.length} ouvrages · Base : ${enBase.length} items`)

console.log(`\n=== A CREER : ${aCreer.length} ===`)
for (const i of aCreer) console.log(`  ${(i.cfcCode ?? '?').padEnd(9)} ${i.description}`)

console.log(`\n=== A METTRE A JOUR : ${aMettreAJour.length} ===`)
const parChamp = new Map()
for (const m of aMettreAJour) for (const c of m.ecarts) parChamp.set(c, (parChamp.get(c) ?? 0) + 1)
for (const [c, n] of [...parChamp].sort((a, b) => b[1] - a[1])) console.log(`  ${c.padEnd(18)} ${n} ouvrages`)
console.log('  exemples :')
for (const m of aMettreAJour.slice(0, 6)) {
  console.log(`    ${m.ref.description.slice(0, 40).padEnd(42)} ${m.ecarts.slice(0, 5).join(', ')}`)
}

console.log(`\n=== INCHANGES : ${inchanges.length} ===`)

if (orphelins.length) {
  console.log(`\n=== EN BASE SANS EQUIVALENT DANS LA REFERENCE : ${orphelins.length} ===`)
  console.log('  (jamais supprimes : a examiner a la main)')
  for (const i of orphelins) console.log(`  ${(i.cfcCode ?? '?').padEnd(9)} ${i.description}`)
}

if (!appliquer) {
  console.log('\nApercu seul. Relancer avec --appliquer pour ecrire.')
} else {
  if (aCreer.length) {
    const res = await prisma.catalogItem.createMany({ data: aCreer, skipDuplicates: true })
    console.log(`\n${res.count} ouvrages crees.`)
  }
  let maj = 0
  for (const m of aMettreAJour) {
    const data = Object.fromEntries(m.ecarts.map((c) => [c, m.ref[c] ?? null]))
    await prisma.catalogItem.update({ where: { id: m.id }, data })
    maj += 1
  }
  console.log(`${maj} ouvrages mis a jour, ${orphelins.length} laisses intacts.`)
}

await prisma.$disconnect()
