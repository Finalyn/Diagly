/**
 * Les textes du référentiel, relus avant d'entrer dans un rapport.
 *
 * Les travaux, les améliorations et les libellés sont recopiés de la base dans
 * chaque relevé au moment où il est fait. Corriger la base ne corrige donc pas
 * les dossiers déjà relevés, et une coquille de 2025 ressortait dans un rapport
 * de 2026. Les corrections connues s'appliquent ici, à l'affichage, sur tout ce
 * qui part chez le client. Ce sont les mêmes que celles du script qui corrige
 * l'ancien catalogue (server/scripts/corriger-textes-catalogue.mjs).
 */
import type { ApiArticle, ApiDiagnosticItem } from './api-types'

const CORRECTIONS: [RegExp, string | ((m: string) => string)][] = [
  // « crépis » seulement quand aucune lettre ne suit : « crépissage » est juste.
  [/crépis(?![a-zàâäéèêëîïôöùûüç])/gi, (m) => (m[0] === 'C' ? 'Crépi' : 'crépi')],
  [/ventill(é|e)/gi, (m) => (m[0] === 'V' ? 'Ventil' : 'ventil') + m.slice(-1)],
  [/siliconn/gi, (m) => (m[0] === 'S' ? 'Silicon' : 'silicon')],
  [/réhauss/gi, (m) => (m[0] === 'R' ? 'Rehauss' : 'rehauss')],
  [/Installation électriques/g, 'Installations électriques'],
  [/Installation sanitaires courants/g, 'Installations sanitaires courantes'],
  [/Remise au norme(s)?/g, 'Mise aux normes'],
  [/Remise aux normes/g, 'Mise aux normes'],
  [/pierre artificielles/g, 'pierre artificielle'],
  // Une quantité collée à l'ancienne unité « U » : « 7U » se lit « 7 pce ».
  [/(\d)\s?U\b(?!\s*[=:])/g, '$1 pce'],
  // Les accords générés d'avant : « et 1 autres ouvrages ».
  [/\b1 autres ouvrages\b/g, '1 autre ouvrage'],
  [/\s{2,}/g, ' '],
]

const PLURIELS_JUSTES = ['Crépis et enduits intérieurs']

/** Un texte du référentiel, coquilles connues corrigées. */
export function corrigerTexte(texte: string): string
export function corrigerTexte(texte: string | null): string | null
export function corrigerTexte(texte: string | null): string | null {
  if (texte == null) return null
  if (PLURIELS_JUSTES.some((p) => texte.includes(p))) return texte.trim()
  let t = texte
  for (const [motif, par] of CORRECTIONS) t = t.replace(motif, par as string)
  return t.trim()
}

/**
 * Le nom d'un relevé tel que le rapport l'imprime.
 *
 * Le nom de l'article de la base quand il y en a un : un relevé d'avant la
 * bascule gardait l'intitulé de l'ancien catalogue (« Balcons - Structure »)
 * à côté d'un relevé récent du même ouvrage (« Balcons en béton »).
 */
export function nomDuReleve(
  it: Pick<ApiDiagnosticItem, 'cfcLabel' | 'articleId'>,
  articles?: Map<string, Pick<ApiArticle, 'nom'>> | Pick<ApiArticle, 'nom'>,
): string {
  const article = articles instanceof Map ? (it.articleId ? articles.get(it.articleId) : undefined) : it.articleId ? articles : undefined
  return corrigerTexte(article?.nom ?? it.cfcLabel)
}
