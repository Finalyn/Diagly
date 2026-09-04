/**
 * Réordonne le catalogue CFC selon la logique de VISITE et non selon la nomenclature.
 *
 * Le diagnostiqueur parcourt le bâtiment dans un ordre physique : il commence dehors par
 * la façade, entre, monte, redescend à la cave, finit par la toiture et les annexes.
 * Le catalogue suivait l'ordre du tableau d'origine, ce qui obligeait à sauter d'un bout
 * à l'autre de la liste pendant la visite.
 *
 * L'ordre des étapes vient du terrain (retour de visite du 31 août 2026).
 * Chaque item reçoit displayOrder = numéro d'étape × 1000 + rang dans l'étape ;
 * l'écart de 1000 laisse la place d'insérer de nouveaux items sans tout renuméroter.
 *
 * Usage :  node scripts/reorder-catalogue.mjs           (aperçu, n'écrit rien)
 *          node scripts/reorder-catalogue.mjs --appliquer
 */
import { PrismaClient } from '@prisma/client'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { ETAPES, etapeDe } from './etapes-visite.mjs'

const prisma = new PrismaClient()
const appliquer = process.argv.includes('--appliquer')

const items = await prisma.catalogItem.findMany({
  where: { ownerId: null },
  orderBy: { displayOrder: 'asc' },
  select: { id: true, category: true, cfcCode: true, description: true, displayOrder: true },
})

const parEtape = new Map(ETAPES.map((e) => [e, []]))
const orphelins = []
for (const it of items) {
  const e = etapeDe(it)
  if (e) parEtape.get(e).push(it)
  else orphelins.push(it)
}

/** Regroupe les items d'une étape par catégorie, dans l'ordre de première apparition :
 *  l'écran regroupe par nom de catégorie, une catégorie éclatée s'afficherait en deux morceaux. */
function grouperParCategorie(liste) {
  const ordre = []
  const parCat = new Map()
  for (const it of liste) {
    const c = it.category ?? 'Autres'
    if (!parCat.has(c)) { parCat.set(c, []); ordre.push(c) }
    parCat.get(c).push(it)
  }
  return ordre.flatMap((c) => parCat.get(c))
}

// Une même catégorie répartie sur deux étapes s'afficherait au mauvais endroit.
const etapeParCategorie = new Map()
for (const [etape, liste] of parEtape) {
  for (const it of liste) {
    const c = it.category ?? 'Autres'
    const vue = etapeParCategorie.get(c)
    if (vue && vue !== etape) console.log(`ATTENTION : catégorie « ${c} » présente dans « ${vue} » ET « ${etape} »`)
    etapeParCategorie.set(c, etape)
  }
}

const nouveaux = new Map()
ETAPES.forEach((etape, i) => {
  const liste = grouperParCategorie(parEtape.get(etape))
  console.log(`\n${i + 1}. ${etape.toUpperCase()}  (${liste.length} items)`)
  let cat = ''
  liste.forEach((it, rang) => {
    nouveaux.set(it.id, (i + 1) * 1000 + rang)
    if (it.category !== cat) { cat = it.category; console.log(`     ${cat}`) }
  })
  if (!liste.length) console.log('     (aucun item au catalogue)')
})
if (orphelins.length) {
  console.log('\nNON CLASSÉS :')
  orphelins.forEach((it, rang) => {
    nouveaux.set(it.id, 99_000 + rang)
    console.log(`   ${it.cfcCode} ${it.description}`)
  })
}

if (!appliquer) {
  console.log('\n(aperçu seulement — relancer avec --appliquer pour écrire)')
  await prisma.$disconnect()
  process.exit(0)
}

for (const [id, order] of nouveaux) {
  await prisma.catalogItem.update({ where: { id }, data: { displayOrder: order } })
}
console.log(`\n${nouveaux.size} items renumérotés en base.`)

// Le fichier de seed doit rester en phase, sinon une base neuve repart dans l'ancien ordre.
const chemin = fileURLToPath(new URL('../prisma/seed-data.json', import.meta.url))
const seed = JSON.parse(readFileSync(chemin, 'utf8'))
const parCle = new Map(items.map((i) => [`${i.cfcCode}|${i.description}`, nouveaux.get(i.id)]))
let maj = 0
for (const it of seed.items) {
  const o = parCle.get(`${it.cfcCode}|${it.description}`)
  if (o != null && it.displayOrder !== o) { it.displayOrder = o; maj++ }
}
seed.items.sort((a, b) => a.displayOrder - b.displayOrder)
writeFileSync(chemin, JSON.stringify(seed, null, 1), 'utf8')
console.log(`${maj} items renumérotés dans le fichier de seed.`)
await prisma.$disconnect()
