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
  "Cage d'escalier",
  'Locaux techniques',
  'Toiture',
  'Appartements',
  'Abords et extérieurs',
]

/**
 * Étape par défaut d'une catégorie du catalogue.
 *
 * L'ordre est celui de la visite, tel que le bureau la conduit : on se met devant
 * le bâtiment et on relève l'enveloppe (façade, fenêtres, portes, stores), puis on
 * entre et on monte la cage d'escalier, on redescend aux locaux techniques, on
 * finit par la toiture et par les appartements. Les abords ferment la marche.
 */
const PAR_CATEGORIE = {
  // 1. Devant le bâtiment : tout ce qui se voit et se touche depuis l'extérieur.
  'FACADE': 'Façade',
  'FENETRES': 'Façade',
  'PORTES EXTERIEURES': 'Façade',
  'STORES et VOLETS': 'Façade',
  'Balcons': 'Façade',
  'Parois extérieures': 'Façade',
  'Modénature façades': 'Façade',
  'Isolation murs': 'Façade',
  'Échafaudage': 'Façade',

  // 2. On entre et on monte : les surfaces et les ouvrages des communs.
  '272.2 Ouvrages métalliques courants': "Cage d'escalier",
  '273 Menuiserie': "Cage d'escalier",
  "Cages d'escalier": "Cage d'escalier",
  'Locaux communs': "Cage d'escalier",

  // 3. Au sous-sol et dans les gaines : la technique.
  '23 Installations électriques': 'Locaux techniques',
  '24 Installations CVC': 'Locaux techniques',
  'VENTILATION': 'Locaux techniques',
  '25 Installations sanitaires': 'Locaux techniques',
  'TECHNIQUES CVSE': 'Locaux techniques',
  'Isolation sol': 'Locaux techniques',

  // 4. Sous les combles et sur le toit.
  'TOITURE': 'Toiture',
  'STRUCTURE': 'Toiture',

  // 5. Dans les logements.
  'Revêtement de murs': 'Appartements',
  'Revêtement de sols': 'Appartements',
  'Revêtement de plafonds': 'Appartements',
  'Groupe sanitaire': 'Appartements',

  // 6. Dehors, autour du bâtiment.
  '4 Aménagement extérieurs': 'Abords et extérieurs',
}

/**
 * Exceptions, évaluées avant la catégorie. Chaque entrée dit pourquoi l'ouvrage
 * se relève ailleurs que là où le tableau le range.
 */
const EXCEPTIONS = [
  // Un portail, une clôture, un abri : c'est dehors, quelle que soit la catégorie.
  { test: (d) => /^42|^46/.test(d.cfcCode ?? ''), etape: 'Abords et extérieurs' },
  // Cloisons et obscurcissement intérieur : dans le logement, pas dans la cage.
  { test: (d) => /^27[67]/.test(d.cfcCode ?? ''), etape: 'Appartements' },
  // Plâtrerie, crépis et isolation intérieure : les surfaces du logement.
  { test: (d) => (d.cfcCode ?? '').startsWith('271'), etape: 'Appartements' },
  // Portes palières : elles se relèvent depuis le palier, pas depuis le logement.
  { test: (d) => /porte.?s? pali[eè]re/i.test(d.description ?? ''), etape: "Cage d'escalier" },
  // Un ascenseur ou un monte-charge se relève au local technique.
  { test: (d) => (d.cfcCode ?? '').startsWith('261'), etape: 'Locaux techniques' },
  // Ce qui se relève DANS le logement, même si la nomenclature le range dans la
  // technique : on ouvre la porte d'un appartement et on voit sa cuisine, ses
  // appareils sanitaires et ses corps de chauffe. La chaufferie, elle, reste au
  // local technique — c'est un autre moment de la visite.
  { test: (d) => (d.cfcCode ?? '').startsWith('258'), etape: 'Appartements' },
  { test: (d) => (d.cfcCode ?? '').startsWith('251'), etape: 'Appartements' },
  { test: (d) => /corps de chauffe/i.test(d.description ?? ''), etape: 'Appartements' },
  // L'éclairage de secours et la lustrerie des communs : dans la cage d'escalier.
  { test: (d) => /^236\.8|^233/.test(d.cfcCode ?? ''), etape: "Cage d'escalier" },
]

/** Étape de visite d'un item, ou null si aucune règle ne s'applique. */
export function etapeDe(item) {
  for (const r of EXCEPTIONS) if (r.test(item)) return r.etape
  const parCat = PAR_CATEGORIE[item.category ?? '']
  if (parCat) return parCat

  // Repli sur le code CFC, pour un item dont la catégorie n'est pas connue.
  const cfc = item.cfcCode ?? ''
  if (/^21[3456]|^226|^227|^221|^228/.test(cfc)) return 'Façade'
  if (/^21[14]|^22[234]/.test(cfc)) return 'Toiture'
  if (/^2[3456]/.test(cfc)) return 'Locaux techniques'
  if (/^27[23]/.test(cfc)) return "Cage d'escalier"
  if (/^28/.test(cfc)) return 'Appartements'
  return null
}
