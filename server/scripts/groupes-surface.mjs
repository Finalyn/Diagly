/**
 * Range les ouvrages alternatifs en groupes de surface.
 *
 * Une façade est en bardage, ou en pierre, ou en crépi. Le catalogue propose
 * chaque type comme un ouvrage distinct, et chacun recevait la totalité de la
 * surface : relever trois types chiffrait trois façades entières. Même chose
 * pour les sols, où carrelage et parquet donnaient deux fois le plancher.
 *
 * Le groupe dit quels ouvrages se partagent une même surface. La part de chacun
 * se saisit au relevé ; le calcul est dans src/lib/groupes-surface.ts.
 *
 * Le rangement part des catégories du catalogue, qui réunissent déjà les types
 * d'une même surface. Deux générations du catalogue se recouvrent — « FACADE »
 * et « Parois extérieures » décrivent le même mur — et sont réunies sous un seul
 * groupe : sans cela, relever un type de chaque génération chiffrerait encore
 * deux façades.
 *
 * Usage :  node scripts/groupes-surface.mjs             (aperçu, n'écrit rien)
 *          node scripts/groupes-surface.mjs --seed      (fichier de seed seul)
 *          node scripts/groupes-surface.mjs --appliquer (seed et base)
 */
import { PrismaClient } from '@prisma/client'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const prisma = new PrismaClient()
const appliquer = process.argv.includes('--appliquer')
const seedSeul = process.argv.includes('--seed')

/**
 * Catégorie du catalogue -> groupe de surface.
 *
 * Seules y figurent les catégories dont les articles sont de vraies
 * alternatives : plusieurs manières de traiter une seule et même surface. Une
 * catégorie qui énumère des ouvrages qui coexistent (menuiserie, sanitaires)
 * n'a rien à y faire — ses articles s'additionnent légitimement.
 */
const GROUPES = {
  // Le revêtement extérieur du mur : un seul par surface de façade.
  'FACADE': 'Revêtement de façade',
  'Parois extérieures': 'Revêtement de façade',
  // L'isolation du mur : absente, intérieure, double mur… une seule à la fois.
  'Isolation murs': 'Isolation des murs',
  // Le sol d'un local : carrelage, parquet, plastique… un seul par surface.
  'Sols': 'Revêtement de sol',
  'Revêtement de sols': 'Revêtement de sol',
  // La paroi intérieure, de même.
  'Murs intérieurs': 'Revêtement de paroi',
  'Revêtement de murs': 'Revêtement de paroi',
  // Et le plafond.
  'Plafonds': 'Revêtement de plafond',
  'Revêtement de plafonds': 'Revêtement de plafond',
  // Le type de fenêtre : bois, métal, PVC… un seul par surface vitrée.
  'FENETRES': 'Type de fenêtre',
  'Fenêtres': 'Type de fenêtre',
}

/**
 * Un article ne rejoint son groupe que s'il se mesure en surface.
 *
 * « Plinthe » est rangée avec les revêtements de sol et se compte au mètre
 * linéaire : elle ne prend aucune part de la surface du sol, elle s'ajoute.
 */
const estSurface = (unit) => /m²|m2/.test(unit ?? '')

/**
 * Ce qui partage la catégorie sans être une alternative.
 *
 * La peinture ne remplace pas un revêtement, elle le recouvre : on peint un
 * crépi, et les deux se chiffrent. Une chape, de même, se coule sous le
 * revêtement. Quant à l'isolation intérieure et à la plâtrerie, elles sont
 * rangées sous les sols au catalogue, ce qui est une erreur de classement :
 * elles ne prennent aucune part de la surface du sol.
 */
const PAS_UNE_ALTERNATIVE = [
  /^227/,                       // peinture extérieure
  /^285/,                       // peinture intérieure
]
const DESCRIPTIONS_HORS_GROUPE = [
  'Chapes',
  "Isolation par l'intérieur",
  'Plâtrerie',
]

const groupeDe = (item) => {
  const g = GROUPES[item.category ?? '']
  if (!g || !estSurface(item.unit)) return null
  const code = (item.cfcCode ?? '').trim()
  if (PAS_UNE_ALTERNATIVE.some((r) => r.test(code))) return null
  if (DESCRIPTIONS_HORS_GROUPE.includes(item.description.trim())) return null
  return g
}

const items = await prisma.catalogItem.findMany({
  where: { ownerId: null },
  orderBy: { displayOrder: 'asc' },
  select: { id: true, cfcCode: true, description: true, category: true, unit: true, surfaceGroup: true },
})

const aChanger = items.filter((it) => groupeDe(it) !== (it.surfaceGroup ?? null))

const parGroupe = new Map()
for (const it of items) {
  const g = groupeDe(it)
  if (!g) continue
  if (!parGroupe.has(g)) parGroupe.set(g, [])
  parGroupe.get(g).push(it)
}

console.log(`Catalogue : ${items.length} articles, ${aChanger.length} à ranger.\n`)
for (const [groupe, liste] of parGroupe) {
  console.log(`${groupe} — ${liste.length} types alternatifs`)
  for (const it of liste) {
    console.log(`    ${String(it.cfcCode ?? '—').padEnd(8)} ${it.description.slice(0, 44).padEnd(46)} ${it.unit}`)
  }
  console.log()
}

// Ce que le rangement laisse dehors, pour qu'on voie ce qui n'est pas couvert.
const horsGroupe = items.filter((it) => !groupeDe(it) && GROUPES[it.category ?? ''])
if (horsGroupe.length) {
  console.log('Articles d’une catégorie groupée mais qui ne se mesurent pas en surface :')
  for (const it of horsGroupe) {
    console.log(`    ${String(it.cfcCode ?? '—').padEnd(8)} ${it.description.slice(0, 44).padEnd(46)} ${it.unit}`)
  }
  console.log()
}

const chemin = fileURLToPath(new URL('../prisma/seed-data.json', import.meta.url))
const seed = JSON.parse(readFileSync(chemin, 'utf8'))
const seedAChanger = seed.items.filter((it) => groupeDe(it) !== (it.surfaceGroup ?? null))
console.log(`Fichier de seed : ${seedAChanger.length} articles à ranger.`)

if (!appliquer && !seedSeul) {
  console.log('\n(aperçu — --seed pour le fichier seul, --appliquer pour le fichier et la base)')
  await prisma.$disconnect()
  process.exit(0)
}

if (appliquer) {
  for (const it of aChanger) {
    await prisma.catalogItem.update({ where: { id: it.id }, data: { surfaceGroup: groupeDe(it) } })
  }
  console.log(`\n${aChanger.length} articles rangés en base.`)
} else {
  console.log(`\nBase inchangée : ${aChanger.length} articles restent à ranger (--appliquer).`)
}

for (const it of seed.items) {
  const g = groupeDe(it)
  if (g) it.surfaceGroup = g
  else delete it.surfaceGroup
}
writeFileSync(chemin, JSON.stringify(seed, null, 1), 'utf8')
console.log(`${seedAChanger.length} articles rangés dans le fichier de seed.`)

await prisma.$disconnect()
