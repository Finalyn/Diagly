/**
 * Le tracé d'un anneau de progression.
 *
 * Quelques lignes d'arithmétique, mais sorties de l'affichage pour être
 * vérifiables : un anneau faux ne se voit pas, il se lit de travers. Un quart
 * rempli qui en montre un tiers ne provoque aucune erreur, il donne seulement une
 * fausse idée de ce qui reste à relever.
 */

/** Part remplie, bornée à l'intervalle [0, 1]. Un total nul ne remplit rien. */
export function partRemplie(faits: number, total: number): number {
  if (!Number.isFinite(faits) || !Number.isFinite(total) || total <= 0) return 0
  if (faits <= 0) return 0
  return Math.min(1, faits / total)
}

export const circonference = (rayon: number): number => 2 * Math.PI * rayon

/**
 * Le décalage de pointillé qui laisse voir la part remplie.
 *
 * Le trait fait toute la circonférence ; on le repousse d'autant qu'il reste à
 * faire. À zéro pour cent, le décalage vaut la circonférence entière et rien ne
 * se voit ; à cent, il vaut zéro et le cercle est complet.
 */
export function decalageAnneau(faits: number, total: number, rayon: number): number {
  return circonference(rayon) * (1 - partRemplie(faits, total))
}
