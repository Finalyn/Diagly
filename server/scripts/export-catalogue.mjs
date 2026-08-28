// Export du catalogue de prix (base de calcul Diagly) : CSV pour Excel + JSON brut.
// Usage : node scripts/export-catalogue.mjs [dossier de sortie]
import { PrismaClient } from '@prisma/client'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const OUT = process.argv[2] ?? join(process.cwd(), '..', 'exports')
mkdirSync(OUT, { recursive: true })
const prisma = new PrismaClient()

const COLS = [
  ['cfcCode', 'Code CFC'],
  ['category', 'Catégorie'],
  ['categoryCfc', 'CFC catégorie'],
  ['description', 'Élément'],
  ['unit', 'Unité de prix'],
  ['quantityFormula', 'Formule de quantité'],
  ['priceTbe', 'Prix Très bon'],
  ['priceBon', 'Prix Bon'],
  ['priceMoyen', 'Prix Moyen'],
  ['priceMauvais', 'Prix Mauvais'],
  ['priceImprovement', 'Prix Amélioration'],
  ['priceNorms', 'Prix Remise aux normes'],
  ['workTbe', 'Travaux Très bon'],
  ['workBon', 'Travaux Bon'],
  ['workMoyen', 'Travaux Moyen'],
  ['workMauvais', 'Travaux Mauvais'],
  ['workImprovement', 'Travaux Amélioration'],
  ['workNorms', 'Travaux Remise aux normes'],
  ['descTbe', 'État Très bon'],
  ['descBon', 'État Bon'],
  ['descMoyen', 'État Moyen'],
  ['descMauvais', 'État Mauvais'],
]

// Neutralise l'injection de formule (même règle que l'export de diagnostic).
const neutralise = (s) => (/^[=+@\t\r]/.test(s) || (s.startsWith('-') && Number.isNaN(Number(s))) ? `'${s}` : s)
const cell = (v) => {
  if (v == null) return ''
  const s = neutralise(String(v))
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const items = await prisma.catalogItem.findMany({
  where: { ownerId: null }, // catalogue de référence (hors personnalisations de compte)
  orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
})

const csv =
  '﻿' +
  [COLS.map(([, l]) => cell(l)).join(';'), ...items.map((it) => COLS.map(([k]) => cell(it[k])).join(';'))].join('\r\n')

writeFileSync(join(OUT, 'diagly-base-prix.csv'), csv, 'utf8')
writeFileSync(join(OUT, 'diagly-base-prix.json'), JSON.stringify(items, null, 1), 'utf8')

// Petit résumé pour vérification.
const parPrix = (k) => items.filter((i) => i[k] && /^[0-9'’.,\s]+$/.test(String(i[k]))).length
const cats = [...new Set(items.map((i) => i.category).filter(Boolean))]
console.log(`${items.length} éléments de référence, ${cats.length} catégories`)
console.log(`prix numériques : Moyen ${parPrix('priceMoyen')}, Mauvais ${parPrix('priceMauvais')}`)
console.log(`avec formule de quantité : ${items.filter((i) => i.quantityFormula).length}`)
console.log(`unités distinctes : ${[...new Set(items.map((i) => i.unit).filter(Boolean))].length}`)
console.log('écrit dans', OUT)

await prisma.$disconnect()
