// Ordre de visite d'un immeuble, et rattachement de chaque élément du catalogue
// à son étape.
//
// L'ordre vient du bureau : on commence dehors par la façade, on entre, on monte,
// on redescend au sous-sol, on finit par la toiture et les abords. Il ne suit pas
// la nomenclature CFC, qui est un ordre comptable et non un ordre de visite.
//
// Les règles s'appuient sur la catégorie de l'item, parce que c'est elle qui porte
// le regroupement voulu par le terrain. Le code CFC ne sert qu'aux exceptions :
// une même catégorie peut contenir des ouvrages qu'on relève à deux endroits
// différents (une cloison mobile est dans le logement, une main courante dans la
// cage d'escalier, alors que les deux sont de la menuiserie).

export const ETAPES = [
  'Façade',
  'Porte extérieure',
  'Boîte aux lettres',
  "Communs / cage d'escalier",
  'Installations techniques',
  'Buanderie / Cave',
  'Toitures',
  'Structure',
  'Appartements',
  'Fenêtres',
  'Annexe',
]

/** Étape par défaut d'une catégorie du catalogue. */
const PAR_CATEGORIE = {
  'FACADE': 'Façade',
  'Balcons': 'Façade',
  'Parois extérieures': 'Façade',
  'Modénature façades': 'Façade',
  'Isolation murs': 'Façade',
  'Échafaudage': 'Façade',
  'PORTES EXTERIEURES': 'Porte extérieure',
  'Portes': 'Porte extérieure',
  'Portes extérieures': 'Porte extérieure',
  '272.2 Ouvrages métalliques courants': "Communs / cage d'escalier",
  '273 Menuiserie': "Communs / cage d'escalier",
  'Portes intérieures': "Communs / cage d'escalier",
  "Cages d'escalier": "Communs / cage d'escalier",
  'Locaux communs': "Communs / cage d'escalier",
  '23 Installations électriques': 'Installations techniques',
  '24 Installations CVC': 'Installations techniques',
  '25 Installations sanitaires': 'Installations techniques',
  'TECHNIQUES CVSE': 'Installations techniques',
  'Isolation sol': 'Buanderie / Cave',
  'TOITURE': 'Toitures',
  'STRUCTURE': 'Structure',
  'Revêtement de murs': 'Appartements',
  'Revêtement de sols': 'Appartements',
  'Revêtement de plafonds': 'Appartements',
  'Groupe sanitaire': 'Appartements',
  'FENETRES': 'Fenêtres',
  'STORES et VOLETS': 'Fenêtres',
  'Fenêtres': 'Fenêtres',
  '4 Aménagement extérieurs': 'Annexe',
}

/**
 * Exceptions, évaluées avant la catégorie. Chaque entrée dit pourquoi l'ouvrage
 * se relève ailleurs que là où le tableau le range.
 */
const EXCEPTIONS = [
  // La boîte aux lettres est une étape à elle seule, entre la porte et les communs.
  { test: (d) => /bo[iî]te aux lettres/i.test(d.description), etape: 'Boîte aux lettres' },
  // Un portail, une clôture, un abri : c'est dehors, quelle que soit la catégorie.
  { test: (d) => /^42|^46/.test(d.cfcCode ?? ''), etape: 'Annexe' },
  // Cloisons et obscurcissement intérieur : dans le logement, pas dans la cage.
  { test: (d) => /^27[67]/.test(d.cfcCode ?? ''), etape: 'Appartements' },
  // Plâtrerie, crépis et isolation intérieure : les surfaces du logement.
  { test: (d) => (d.cfcCode ?? '').startsWith('271'), etape: 'Appartements' },
  // Un ascenseur ou un monte-charge se relève au local technique.
  { test: (d) => (d.cfcCode ?? '').startsWith('261'), etape: 'Installations techniques' },
]

/** Étape de visite d'un item, ou null si aucune règle ne s'applique. */
export function etapeDe(item) {
  for (const r of EXCEPTIONS) if (r.test(item)) return r.etape
  const parCat = PAR_CATEGORIE[item.category ?? '']
  if (parCat) return parCat

  // Repli sur le code CFC, pour un item dont la catégorie n'est pas connue.
  const cfc = item.cfcCode ?? ''
  if (/^21|^226|^227/.test(cfc)) return 'Façade'
  if (/^22[234]/.test(cfc)) return 'Toitures'
  if (/^2[3456]/.test(cfc)) return 'Installations techniques'
  if (/^272/.test(cfc)) return "Communs / cage d'escalier"
  if (/^273/.test(cfc)) return "Communs / cage d'escalier"
  if (/^28/.test(cfc)) return 'Appartements'
  if (/^221|^228/.test(cfc)) return 'Fenêtres'
  return null
}
