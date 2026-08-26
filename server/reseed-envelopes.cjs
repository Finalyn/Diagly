// Chiffre les enveloppes AMÉLIORATION et REMISE AUX NORMES du catalogue (là où le texte
// existe déjà) pour que les 3 variantes de rénovation divergent réellement.
// Prix ancrés sur la logique énergétique (isolation enveloppe) + un premium sur le remplacement.
// Usage : node reseed-envelopes.cjs            -> dry-run
//         node reseed-envelopes.cjs --write     -> applique (catalog_items + seed-data.json)
const fs = require('fs')
const path = require('path')
const WRITE = process.argv.includes('--write')

const num = (s) => { if (!s) return undefined; const c = String(s).replace(/['\s]/g, '').replace(',', '.'); return /^[0-9]+(\.[0-9]+)?$/.test(c) ? parseFloat(c) : undefined }

// Prix de remise aux normes (énergie) : isolation de l'enveloppe, triple vitrage, EnR chauffage.
function normsPrice(it) {
  if (!it.workNorms) return null
  const d = (it.description || '').toLowerCase()
  const cfc = it.cfcCode || ''
  const mau = num(it.priceMauvais)
  if (/^226/.test(cfc) || /paroi|fa[cç]ade|isolation mur|mod[eé]nature/.test(d)) return '220'      // ITE CHF/m²
  if (/isolation sol|radier|plancher sur ext/.test(d)) return '120'                                  // isolation sol CHF/m²
  if (/^224/.test(cfc) || /toit|charpente|couverture|isolation toiture/.test(d)) return '180'        // isolation toiture CHF/m²
  if (/^221/.test(cfc) || /fen[eê]tre/.test(d)) return '250'                                          // triple vitrage CHF/m² fenêtre
  if (/^242/.test(cfc) || /chaudi[eè]re|chauffage|pompe|\bpac\b|solaire|sous-station/.test(d)) return '15000' // EnR/normes forfait
  if (/^244/.test(cfc) || /ventilation/.test(d)) return mau ? String(Math.round(mau * 0.8)) : null    // VMC
  return mau ? String(Math.round(mau * 0.5)) : null                                                   // autre mise aux normes : premium
}

// Prix d'amélioration (montée en gamme / confort) : premium modéré sur le remplacement.
function improvementPrice(it) {
  if (!it.workImprovement) return null
  const mau = num(it.priceMauvais)
  return mau ? String(Math.round(mau * 0.35)) : null
}

;(async () => {
  const { PrismaClient } = require('@prisma/client')
  const prisma = new PrismaClient()
  const items = await prisma.catalogItem.findMany({ where: { ownerId: null }, orderBy: { displayOrder: 'asc' } })
  let nImp = 0, nNorms = 0
  const updates = []
  for (const it of items) {
    const pImp = improvementPrice(it)
    const pNor = normsPrice(it)
    if (pImp) nImp++
    if (pNor) nNorms++
    updates.push({ id: it.id, cfcCode: it.cfcCode, description: it.description, unit: it.unit, priceImprovement: pImp, priceNorms: pNor })
  }
  console.log('Éléments:', items.length, '| prix amélioration:', nImp, '| prix normes:', nNorms)
  console.log('--- échantillon ---')
  for (const u of updates.filter((x) => x.priceNorms || x.priceImprovement).slice(0, 20))
    console.log(`[${u.cfcCode}] ${u.description.slice(0, 34).padEnd(34)} ${u.unit} | Imp=${u.priceImprovement || '—'} Nor=${u.priceNorms || '—'}`)

  if (!WRITE) { console.log('\n(dry-run — --write pour appliquer)'); await prisma.$disconnect(); return }

  for (const u of updates)
    await prisma.catalogItem.update({ where: { id: u.id }, data: { priceImprovement: u.priceImprovement, priceNorms: u.priceNorms } })
  // Sync seed-data.json
  const seedPath = path.join(__dirname, 'prisma', 'seed-data.json')
  const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'))
  const byDesc = new Map(updates.map((u) => [u.description, u]))
  for (const s of seed.items) { const u = byDesc.get(s.description); if (u) { s.priceImprovement = u.priceImprovement; s.priceNorms = u.priceNorms } }
  fs.writeFileSync(seedPath, JSON.stringify(seed, null, 1))
  console.log('Appliqué à catalog_items + seed-data.json.')
  await prisma.$disconnect()
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
