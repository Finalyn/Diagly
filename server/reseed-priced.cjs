// Régénère le catalogue : descriptions d'état (Feuille 3) + prix créés/ancrés sur la Feuille 2
// (DIAGLY_FINAL.xlsx). Auto-match par code CFC + mots-clés ; override manuel pour les familles
// où la Feuille 2 est trop grossière (parois extérieures 226, isolations, quelques portes).
// Usage : node reseed-priced.cjs         -> dry-run (affiche, n'écrit rien)
//         node reseed-priced.cjs --write -> écrit seed-data.json + recharge catalog_items
const XLSX = require('C:/Users/switc/Diagly/node_modules/xlsx')
const fs = require('fs')
const path = require('path')

const c = (s) => String(s ?? '').replace(/\s+/g, ' ').trim()
const orN = (s) => c(s) || null
const WRITE = process.argv.includes('--write')

// ---- Feuille 2 : grille de prix + travaux ----
const wf = XLSX.readFile('C:/Users/switc/Desktop/DIAGLY_FINAL.xlsx')
const f2raw = XLSX.utils.sheet_to_json(wf.Sheets['Feuil2'], { header: 1, defval: '', blankrows: false })
const F2 = []
for (let i = 1; i < f2raw.length; i++) {
  const r = f2raw[i]
  if (!c(r[0]) || !c(r[8])) continue
  F2.push({
    desc: c(r[0]), cfc: c(r[1]),
    wTbe: c(r[2]), wBon: c(r[3]), wMoyen: c(r[4]), wMauvais: c(r[5]),
    wImp: c(r[6]), wNorm: c(r[7]),
    unit: c(r[8]), qte: c(r[9]),
    pTbe: c(r[10]), pBon: c(r[11]), pMoyen: c(r[12]), pMauvais: c(r[13]),
    pImp: c(r[14]), pNorm: c(r[15]), scaff: c(r[16]),
  })
}

const STOP = new Set(['des','de','du','la','le','les','en','et','ou','a','a','aux','pour','un','une','avec','sur','par','dans'])
const toks = (s) => new Set(String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').split(' ').filter(w=>w.length>2&&!STOP.has(w)))
const overlap = (a,b) => { const ta=toks(a),tb=toks(b);let n=0;for(const t of ta)if(tb.has(t))n++;return n }
const root = (x) => String(x||'').split('.')[0]

function bestFor(desc, cfc) {
  let cands = F2.filter(f => root(f.cfc) === root(cfc) && root(cfc))
  const byCode = cands.length > 0
  if (!byCode) cands = F2
  let best = null, bs = -1
  for (const f of cands) {
    const s = overlap(desc, f.desc) + (f.cfc === cfc ? 3 : 0)
    if (s > bs) { bs = s; best = f }
  }
  return { best, bs, byCode }
}

// ---- Override : prix créés pour les familles où la Feuille 2 est trop grossière ----
// unité CHF/m² façade = formule "Périmètre x (étage x hauteur d'étage)".
const FAC = "Périmètre x (étage x hauteur d'étage)"
const OVERRIDE = {
  // Parois extérieures (226) : chaque matériau a son coût réel de réfection/remplacement
  'Parois extérieures - Crépi':                    { unit:'CHF/m²', qte:FAC, pMoyen:'45',  pMauvais:'180' },
  'Parois extérieures - Maçonnerie apparente':     { unit:'CHF/m²', qte:FAC, pMoyen:'60',  pMauvais:'350' },
  'Parois extérieures - Béton apparent':           { unit:'CHF/m²', qte:FAC, pMoyen:'80',  pMauvais:'400' },
  'Parois extérieures - Façade ventilée':          { unit:'CHF/m²', qte:FAC, pMoyen:'120', pMauvais:'600' },
  'Parois extérieures - Éléments préfabriqués béton':{ unit:'CHF/m²', qte:FAC, pMoyen:'90', pMauvais:'500' },
  'Parois extérieures - Placage pierre et simili': { unit:'CHF/m²', qte:FAC, pMoyen:'80',  pMauvais:'1200' },
  'Parois extérieures - Bardage bois ou métal':    { unit:'CHF/m²', qte:FAC, pMoyen:'65',  pMauvais:'580' },
  'Parois extérieures - Façade rideau':            { unit:'CHF/m²', qte:FAC, pMoyen:'200', pMauvais:'900' },
  'Modénature façades - XIXe siècle':              { unit:'CHF/ml', qte:'',  pMoyen:'150', pMauvais:'800' },
  'Modénature façades - XXe siècle':               { unit:'CHF/ml', qte:'',  pMoyen:'120', pMauvais:'600' },
  // Isolation des murs : coût = ajout d'isolation (état Mauvais = à isoler), pas d'entretien courant
  'Isolation murs - Absence':                      { unit:'CHF/m²', qte:FAC, pMoyen:'',    pMauvais:'240' },
  'Isolation murs - Existant':                     { unit:'CHF/m²', qte:FAC, pMoyen:'',    pMauvais:'220' },
  'Isolation murs - Façade légère':                { unit:'CHF/m²', qte:FAC, pMoyen:'',    pMauvais:'200' },
  'Isolation murs - Intérieure':                   { unit:'CHF/m²', qte:FAC, pMoyen:'',    pMauvais:'110' },
  'Isolation murs - Double mur':                   { unit:'CHF/m²', qte:FAC, pMoyen:'',    pMauvais:'90'  },
  'Echafaudage':                                   { unit:'CHF/m²', qte:FAC, pMoyen:'',    pMauvais:'45'  },
  'Façade légère portée':                          { unit:'CHF/m²', qte:FAC, pMoyen:'200', pMauvais:'900' },
  // Isolations sol (surface bâtie)
  'Isolation sol - Local non chauffé':             { unit:'CHF/m²', qte:'Surface de bâtie', pMoyen:'', pMauvais:'80'  },
  'Isolation sol - Plancher sur extérieur':        { unit:'CHF/m²', qte:'Surface de bâtie', pMoyen:'', pMauvais:'120' },
  'Isolation sol - Radier':                        { unit:'CHF/m²', qte:'Surface de bâtie', pMoyen:'', pMauvais:'90'  },
  // Portes mal matchées (tombaient sur "fenêtres")
  'Portes manuelles bois/métal':                   { unit:'CHF/U',  qte:'', pMoyen:'250', pMauvais:'1800' },
  // Cloisons / parois vitrées (tombaient sur garde-corps CHF/ml)
  'Cloisons métalliques':                          { unit:'CHF/m²', qte:'', pMoyen:'90',  pMauvais:'350' },
  'Parois vitrées':                                { unit:'CHF/m²', qte:'', pMoyen:'150', pMauvais:'700' },
  // Escaliers (tombaient sur bardage façade)
  'Escaliers - Béton/Bois/Métal':                  { unit:'CHF/U',  qte:"Nombre de cage d'escalier", pMoyen:'800', pMauvais:'12000' },
  // Courant faible : absent de la Feuille 2
  'Courant faible (Interphone/TV)':                { unit:'Forfait', qte:'', pMoyen:'1500', pMauvais:'8000' },
  // Sols : chaque revêtement a son coût (la Feuille 2 ne donnait que la chape)
  'Sols - Parquet':                                { unit:'CHF/m²', qte:'', pMoyen:'45', pMauvais:'180' },
  'Sols - Plastique/Textile':                      { unit:'CHF/m²', qte:'', pMoyen:'25', pMauvais:'70'  },
  'Sols - Carrelage':                              { unit:'CHF/m²', qte:'', pMoyen:'40', pMauvais:'150' },
  'Sols - Béton lavé / Dalle brute / Chape':       { unit:'CHF/m²', qte:'', pMoyen:'30', pMauvais:'90'  },
  'Sols - Faux-plancher':                          { unit:'CHF/m²', qte:'', pMoyen:'60', pMauvais:'200' },
  // Murs intérieurs : peinture ≠ lambris ≠ faïences
  'Murs intérieurs - Peinture/Crépi':              { unit:'CHF/m²', qte:'', pMoyen:'22', pMauvais:'45'  },
  'Murs intérieurs - Toile/Papier':                { unit:'CHF/m²', qte:'', pMoyen:'25', pMauvais:'45'  },
  'Murs intérieurs - Lambris':                     { unit:'CHF/m²', qte:'', pMoyen:'60', pMauvais:'180' },
  'Murs intérieurs - Faïences':                    { unit:'CHF/m²', qte:'', pMoyen:'90', pMauvais:'160' },
  // Chauffage (242) : la Feuille 2 mélange forfait (entretien) et CHF/m² (remplacement) → coût=18 CHF bug.
  // On fige des forfaits totaux réalistes (entretien / remplacement complet) par système.
  'Chaudière Mazout/Gaz':                          { unit:'Forfait', qte:'', pMoyen:'4000', pMauvais:'35000' },
  'Pompe à chaleur':                               { unit:'Forfait', qte:'', pMoyen:'6000', pMauvais:'55000' },
  'Sous-station':                                  { unit:'Forfait', qte:'', pMoyen:'3000', pMauvais:'25000' },
  'Capteurs solaires':                             { unit:'Forfait', qte:'', pMoyen:'2000', pMauvais:'25000' },
  'Distribution chaleur':                          { unit:'Forfait', qte:'', pMoyen:'3000', pMauvais:'30000' },
  'Radiateurs':                                    { unit:'Forfait', qte:'', pMoyen:'2000', pMauvais:'18000' },
  'Chauffage sol':                                 { unit:'Forfait', qte:'', pMoyen:'3000', pMauvais:'45000' },
  'M14-06 Chauffage':                              { unit:'Forfait', qte:'', pMoyen:'5000', pMauvais:'40000' },
}

function category(desc) {
  if (desc.includes(' - ')) return desc.split(' - ')[0].trim()
  const d = desc.toLowerCase()
  if (d.includes('fenêtre') || d.includes('fenetre')) return 'Fenêtres'
  if (d.includes('porte')) return 'Portes'
  if (d.includes('échafaud') || d.includes('echafaud')) return 'Échafaudage'
  if (d.includes('balcon')) return 'Balcons'
  return desc
}

// ---- Feuille 3 : descriptions d'état + amélioration/normes ----
const w3 = XLSX.readFile('C:/Users/switc/Downloads/DIAGLY.xlsx')
const f3 = XLSX.utils.sheet_to_json(w3.Sheets['Feuil3'], { header: 1, defval: '', blankrows: false })

const items = []
let order = 0, over = 0, auto = 0, noprice = 0
for (let i = 1; i < f3.length; i++) {
  const description = c(f3[i][0]); if (!description) continue
  const cfc = c(f3[i][1])
  order++
  const ov = OVERRIDE[description]
  let src, tag
  if (ov) { over++; tag = 'OVERRIDE' }
  else {
    const { best, bs, byCode } = bestFor(description, cfc)
    if (best && bs >= (byCode ? 0 : 2)) { src = best; auto++; tag = `auto(${byCode?'code':'kw'} ${bs}) « ${best.desc} »` }
    else { noprice++; tag = 'SANS PRIX' }
  }
  const pMoyen   = ov ? orN(ov.pMoyen)   : orN(src?.pMoyen)
  const pMauvais = ov ? orN(ov.pMauvais) : orN(src?.pMauvais)
  const unit     = ov ? orN(ov.unit)     : orN(src?.unit)
  const qte      = ov ? orN(ov.qte)      : orN(src?.qte)

  items.push({
    displayOrder: order,
    category: category(description),
    categoryCfc: cfc || null,
    description,
    cfcCode: cfc || null,
    // Travaux par état : issus de la Feuille 2 quand un match existe (sinon vides, la description guide)
    workTbe: orN(src?.wTbe), workBon: orN(src?.wBon), workMoyen: orN(src?.wMoyen), workMauvais: orN(src?.wMauvais),
    // Amélioration / Remise aux normes : Feuille 2 (structuré) sinon texte combiné Feuille 3
    workImprovement: orN(src?.wImp),
    workNorms: orN(src?.wNorm) || orN(f3[i][6]),
    // Descriptions d'état (Feuille 3) : coeur de l'aide au diagnostic
    descTbe: orN(f3[i][2]), descBon: orN(f3[i][3]), descMoyen: orN(f3[i][4]), descMauvais: orN(f3[i][5]),
    unit, quantityFormula: qte,
    priceTbe: orN(src?.pTbe), priceBon: orN(src?.pBon), priceMoyen: pMoyen, priceMauvais: pMauvais,
    priceImprovement: orN(src?.pImp), priceNorms: orN(src?.pNorm),
    scaffoldingNote: orN(src?.scaff),
  })
  console.log(`[${cfc}] ${description}`)
  console.log(`   ${unit||'—'} | ${qte||'—'} | M=${pMoyen||'—'} Mau=${pMauvais||'—'} | ${tag}`)
}
console.log(`\nTotal ${items.length} | override ${over} | auto ${auto} | sans prix ${noprice}`)

if (!WRITE) { console.log('\n(dry-run — relancer avec --write pour appliquer)'); process.exit(0) }

;(async () => {
  const { PrismaClient } = require('@prisma/client')
  const prisma = new PrismaClient()
  const seedPath = path.join(__dirname, 'prisma', 'seed-data.json')
  const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'))
  seed.items = items
  fs.writeFileSync(seedPath, JSON.stringify(seed, null, 1))
  await prisma.catalogItem.deleteMany({})
  await prisma.catalogItem.createMany({ data: items })
  const count = await prisma.catalogItem.count()
  console.log('catalog_items rechargé :', count, '| seed-data.json mis à jour')
  await prisma.$disconnect()
})().catch(async (e) => { console.error('ERR', e.message); process.exit(1) })
