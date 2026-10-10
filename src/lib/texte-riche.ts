/**
 * Le peu de mise en forme que le modèle emploie, rendu lisible.
 *
 * Il répond en Markdown léger : du gras, parfois une liste, rarement un titre.
 * Affiché brut, cela donne des « **mot** » au milieu des phrases, et la réponse
 * a l'air bâclée alors qu'elle est juste.
 *
 * Écrit ici plutôt qu'ajouté en dépendance : le besoin tient en cent lignes,
 * et surtout, rendre du Markdown complet voudrait dire accepter du HTML écrit
 * par un modèle dans une page qui affiche les données d'un client. On n'analyse
 * donc que ce qu'on sait rendre, et le reste reste du texte.
 */

export type Segment =
  | { type: 'texte'; texte: string }
  | { type: 'gras'; texte: string }
  | { type: 'italique'; texte: string }
  | { type: 'code'; texte: string }

export type Bloc =
  | { type: 'titre'; segments: Segment[] }
  | { type: 'paragraphe'; lignes: Segment[][] }
  | { type: 'liste'; items: Segment[][] }
  | { type: 'numerotee'; items: Segment[][] }

/** `**gras**`, `*italique*`, `_italique_`, `` `code` ``. Le gras d'abord : ses deux étoiles contiennent celle de l'italique. */
const MARQUES = /\*\*(.+?)\*\*|`([^`]+)`|\*([^*\n]+?)\*|_([^_\n]+?)_/g

export function segments(ligne: string): Segment[] {
  const sortie: Segment[] = []
  let curseur = 0
  MARQUES.lastIndex = 0
  for (let m = MARQUES.exec(ligne); m; m = MARQUES.exec(ligne)) {
    if (m.index > curseur) sortie.push({ type: 'texte', texte: ligne.slice(curseur, m.index) })
    if (m[1] !== undefined) sortie.push({ type: 'gras', texte: m[1] })
    else if (m[2] !== undefined) sortie.push({ type: 'code', texte: m[2] })
    else sortie.push({ type: 'italique', texte: (m[3] ?? m[4]) as string })
    curseur = m.index + m[0].length
  }
  if (curseur < ligne.length) sortie.push({ type: 'texte', texte: ligne.slice(curseur) })
  return sortie.length > 0 ? sortie : [{ type: 'texte', texte: ligne }]
}

const PUCE = /^\s*[-*•]\s+(.*)$/
const NUMERO = /^\s*\d+[.)]\s+(.*)$/
const TITRE = /^\s*#{1,4}\s+(.*)$/

/** Découpe la réponse en blocs : paragraphes, listes, titres. */
export function analyser(texte: string): Bloc[] {
  const blocs: Bloc[] = []
  // Un paragraphe en cours, ou une liste en cours : on ferme l'un en ouvrant l'autre.
  let paragraphe: Segment[][] = []
  let liste: Segment[][] = []
  let numerotee: Segment[][] = []

  const fermer = () => {
    if (paragraphe.length > 0) { blocs.push({ type: 'paragraphe', lignes: paragraphe }); paragraphe = [] }
    if (liste.length > 0) { blocs.push({ type: 'liste', items: liste }); liste = [] }
    if (numerotee.length > 0) { blocs.push({ type: 'numerotee', items: numerotee }); numerotee = [] }
  }

  for (const brute of texte.split(/\r?\n/)) {
    const ligne = brute.trimEnd()
    if (ligne.trim() === '') { fermer(); continue }

    const titre = TITRE.exec(ligne)
    if (titre) { fermer(); blocs.push({ type: 'titre', segments: segments(titre[1]) }); continue }

    const puce = PUCE.exec(ligne)
    if (puce) {
      if (paragraphe.length > 0 || numerotee.length > 0) fermer()
      liste.push(segments(puce[1]))
      continue
    }

    const numero = NUMERO.exec(ligne)
    if (numero) {
      if (paragraphe.length > 0 || liste.length > 0) fermer()
      numerotee.push(segments(numero[1]))
      continue
    }

    if (liste.length > 0 || numerotee.length > 0) fermer()
    paragraphe.push(segments(ligne))
  }
  fermer()
  return blocs
}
