// Synchronise le catalogue de reference (seed-data.json) vers une base existante.
//
// Le seed ne s'execute que sur une base vide : il ne sert a rien pour ajouter des
// elements a une installation en service. Ce script comble l'ecart, sans jamais
// toucher a ce qui existe : des diagnostics pointent sur ces lignes.
//
//   node scripts/sync-catalogue.mjs              apercu
//   node scripts/sync-catalogue.mjs --appliquer  ecrit les manquants
//
// Les items d'un utilisateur (ownerId non nul) ne sont jamais concernes.
import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ICI = dirname(fileURLToPath(import.meta.url))
const DATA = join(ICI, '..', 'prisma', 'seed-data.json')
const appliquer = process.argv.includes('--appliquer')
const prisma = new PrismaClient()

const norm = (s) => (s ?? '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

const { items } = JSON.parse(readFileSync(DATA, 'utf-8'))
const enBase = await prisma.catalogItem.findMany({
  where: { ownerId: null },
  select: { id: true, description: true, cfcCode: true, workMoyen: true, workMauvais: true },
})
const parNom = new Map(enBase.map((i) => [norm(i.description), i]))

const aCreer = items.filter((i) => !parNom.has(norm(i.description)))
const enTrop = enBase.filter((i) => !items.some((j) => norm(j.description) === norm(i.description)))

console.log(`Reference : ${items.length} items · Base : ${enBase.length} items`)
console.log(`\n=== A CREER : ${aCreer.length} ===`)
for (const i of aCreer) console.log(`  ${(i.cfcCode ?? '?').padEnd(9)} ${i.description}`)

if (enTrop.length) {
  console.log(`\n=== EN BASE MAIS PAS DANS LA REFERENCE : ${enTrop.length} ===`)
  console.log('  (jamais supprimes par ce script : a examiner a la main)')
  for (const i of enTrop) console.log(`  ${(i.cfcCode ?? '?').padEnd(9)} ${i.description}`)
}

if (!appliquer) {
  console.log('\nApercu seul. Relancer avec --appliquer pour creer les manquants.')
} else if (aCreer.length === 0) {
  console.log('\nRien a creer.')
} else {
  const res = await prisma.catalogItem.createMany({ data: aCreer, skipDuplicates: true })
  console.log(`\n${res.count} items crees.`)
}

await prisma.$disconnect()
