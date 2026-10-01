/**
 * Corrections orthographiques et harmonisation des unités du catalogue.
 *
 * Les fautes du référentiel se retrouvent dans tous les rapports remis aux
 * clients : « crépis » au lieu de « crépi », « ventillée », « siliconnes ». Elles
 * ne se corrigent pas ouvrage par ouvrage dans l'interface, parce qu'elles sont
 * dans la référence commune.
 *
 * Deux cibles, qui doivent rester en phase : le fichier de seed, dont repart
 * toute base neuve, et la base elle-même.
 *
 * Usage :  node scripts/corriger-textes-catalogue.mjs             (aperçu, n'écrit rien)
 *          node scripts/corriger-textes-catalogue.mjs --seed       (fichier de seed seul)
 *          node scripts/corriger-textes-catalogue.mjs --appliquer (seed + base)
 */
import { PrismaClient } from '@prisma/client'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const prisma = new PrismaClient()
const appliquer = process.argv.includes('--appliquer')
// Le fichier de seed est un fichier du dépôt : il se corrige seul, sans toucher
// à la base commune, pour que la correction parte avec le code.
const seedSeul = process.argv.includes('--seed')

/**
 * Les champs de texte du catalogue qui partent dans un rapport.
 * `unit` est traité à part : il ne se corrige pas, il s'harmonise.
 */
const CHAMPS_TEXTE = [
  'description', 'category',
  'workTbe', 'workBon', 'workMoyen', 'workMauvais', 'workImprovement', 'workNorms',
  'descTbe', 'descBon', 'descMoyen', 'descMauvais',
  'scaffoldingNote', 'quantityFormula',
]

/**
 * Corrections de texte.
 *
 * « crépis » ne se remplace que lorsqu'aucune lettre ne suit : « crépissage »
 * est le mot juste et ne doit pas devenir « crépiage ».
 */
const CORRECTIONS = [
  [/crépis(?![a-zàâäéèêëîïôöùûüç])/gi, (m) => (m[0] === 'C' ? 'Crépi' : 'crépi')],
  [/ventillé/gi, (m) => (m[0] === 'V' ? 'Ventilé' : 'ventilé')],
  [/siliconn/gi, (m) => (m[0] === 'S' ? 'Silicon' : 'silicon')],
  [/Installation électriques/g, 'Installations électriques'],
  [/Installation sanitaires courants/g, 'Installations sanitaires courantes'],
  [/Remise au norme(s)?/g, 'Mise aux normes'],
  [/Remise aux normes/g, 'Mise aux normes'],
  [/pierre artificielles/g, 'pierre artificielle'],
]

/**
 * Harmonisation des unités.
 *
 * On ne réduit pas tout à « m² » : l'unité désigne la grandeur dont la quantité
 * est déduite (« CHF/m² SP » = surface de plancher, « CHF/m² fenêtres » = surface
 * vitrée). Les aplatir ferait perdre la quantité automatique de ces ouvrages.
 * Seules les écritures redondantes ou fautives sont corrigées.
 */
const UNITES = new Map([
  ['CHF/U', 'CHF/pce'],
  ['CHF/ pce', 'CHF/pce'],
  ['CHF/m2', 'CHF/m²'],
  ['CHF/SP', 'CHF/m² SP'],
  // Double unité : la quantité de ces ouvrages vient déjà de la formule
  // « Surface de plancher », donc le prix est bien au m² de plancher.
  ['Forfait / CHF/m² SP', 'CHF/m² SP'],
])

/**
 * Intitulés où le pluriel est le mot juste et doit rester.
 *
 * « Crépis et enduits intérieurs » énumère deux familles de revêtements : le
 * singulier y serait une faute, alors que « Façade en crépi » le demande. La
 * règle de correction est aveugle, cette liste ne l'est pas.
 */
const PLURIELS_JUSTES = ['Crépis et enduits intérieurs']

function corrigerTexte(v) {
  if (typeof v !== 'string') return v
  if (PLURIELS_JUSTES.includes(v.trim())) return v
  let out = v
  for (const [motif, remplacement] of CORRECTIONS) {
    out = out.replace(motif, (m) => (typeof remplacement === 'function' ? remplacement(m) : remplacement))
  }
  return out
}

/** Renvoie les champs modifiés d'un article, ou null s'il n'y a rien à faire. */
function corriger(item) {
  const patch = {}
  for (const c of CHAMPS_TEXTE) {
    const avant = item[c]
    const apres = corrigerTexte(avant)
    if (apres !== avant) patch[c] = apres
  }
  const unite = UNITES.get((item.unit ?? '').trim())
  if (unite && unite !== item.unit) patch.unit = unite
  return Object.keys(patch).length ? patch : null
}

// ---------------------------------------------------------------- aperçu
const chemin = fileURLToPath(new URL('../prisma/seed-data.json', import.meta.url))
const seed = JSON.parse(readFileSync(chemin, 'utf8'))

const items = await prisma.catalogItem.findMany({
  where: { ownerId: null },
  orderBy: { displayOrder: 'asc' },
})

const aChanger = []
for (const it of items) {
  const patch = corriger(it)
  if (patch) aChanger.push({ it, patch })
}

console.log(`Catalogue : ${items.length} articles, ${aChanger.length} à corriger.\n`)
for (const { it, patch } of aChanger) {
  console.log(`  ${String(it.cfcCode ?? '—').padEnd(8)} ${it.description.slice(0, 44)}`)
  for (const [c, v] of Object.entries(patch)) {
    const avant = String(it[c] ?? '').slice(0, 60)
    console.log(`      ${c} : « ${avant} » -> « ${String(v).slice(0, 60)} »`)
  }
}

let seedChanges = 0
for (const it of seed.items) if (corriger(it)) seedChanges++
console.log(`\nFichier de seed : ${seedChanges} articles à corriger.`)

if (!appliquer && !seedSeul) {
  console.log('\n(aperçu — --seed pour le fichier seul, --appliquer pour le fichier et la base)')
  await prisma.$disconnect()
  process.exit(0)
}

// ---------------------------------------------------------------- écriture
if (appliquer) {
  for (const { it, patch } of aChanger) {
    await prisma.catalogItem.update({ where: { id: it.id }, data: patch })
  }
  console.log(`\n${aChanger.length} articles corrigés en base.`)
} else {
  console.log(`\nBase inchangée : ${aChanger.length} articles restent à corriger (--appliquer).`)
}

for (const it of seed.items) {
  const patch = corriger(it)
  if (patch) Object.assign(it, patch)
}
writeFileSync(chemin, JSON.stringify(seed, null, 1), 'utf8')
console.log(`${seedChanges} articles corrigés dans le fichier de seed.`)

await prisma.$disconnect()
