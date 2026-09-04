// Annulation d'un ajout d'items de catalogue.
//
// Contexte : sync-catalogue.mjs a ete lance en production avec une reference qui
// ne correspondait pas au catalogue reellement en service. Il a cree 107 doublons.
// Ce script les retire, en gardant les six elements qui manquaient vraiment.
//
// Il ne supprime que des items sans proprietaire (catalogue de reference) et
// jamais un item auquel un diagnostic est rattache : il s'arrete si c'est le cas.
//
//   node scripts/annuler-import-catalogue.mjs            apercu
//   node scripts/annuler-import-catalogue.mjs --appliquer
//   node scripts/annuler-import-catalogue.mjs 107        pour un autre nombre
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const appliquer = process.argv.includes('--appliquer')
const combien = Number(process.argv.find((a) => /^\d+$/.test(a))) || 107

// Ces six-la manquaient reellement au catalogue de production : on les garde.
const A_GARDER = [
  'Boîte aux lettres',
  'Porte carrousel',
  'Stores bannes',
  'Balcons - Structure',
  'Monte-fauteuil',
  'Portail automatique',
]

const derniers = await prisma.catalogItem.findMany({
  where: { ownerId: null },
  orderBy: { id: 'desc' },
  take: combien,
  select: { id: true, cfcCode: true, description: true },
})

const gardes = derniers.filter((i) => A_GARDER.includes(i.description))
const aSupprimer = derniers.filter((i) => !A_GARDER.includes(i.description))
const ids = aSupprimer.map((i) => i.id)

const rattaches = await prisma.diagnosticItem.findMany({
  where: { catalogItemId: { in: ids } },
  select: { catalogItemId: true, cfcLabel: true },
})

const total = await prisma.catalogItem.count({ where: { ownerId: null } })
console.log(`Catalogue de reference : ${total} items`)
console.log(`Examine : les ${combien} derniers crees (id ${Math.min(...derniers.map((i) => i.id))} a ${Math.max(...derniers.map((i) => i.id))})`)
console.log(`\nGARDES (manquaient vraiment) : ${gardes.length}`)
for (const i of gardes) console.log(`  ${(i.cfcCode ?? '?').padEnd(8)} ${i.description}`)
console.log(`\nA SUPPRIMER : ${aSupprimer.length}`)
for (const i of aSupprimer.slice(0, 8)) console.log(`  ${(i.cfcCode ?? '?').padEnd(8)} ${i.description}`)
if (aSupprimer.length > 8) console.log(`  ... et ${aSupprimer.length - 8} autres`)

if (rattaches.length > 0) {
  console.log(`\nARRET : ${rattaches.length} de ces items sont utilises par des diagnostics.`)
  console.log('Rien n a ete supprime. Il faut les examiner un par un.')
  await prisma.$disconnect()
  process.exit(1)
}
console.log('\nAucun de ces items n est utilise par un diagnostic : suppression sans perte.')

if (!appliquer) {
  console.log('\nApercu seul. Relancer avec --appliquer pour supprimer.')
} else {
  const res = await prisma.catalogItem.deleteMany({ where: { id: { in: ids }, ownerId: null } })
  console.log(`\n${res.count} items supprimes. Catalogue : ${total - res.count} items.`)
}
await prisma.$disconnect()
