/**
 * La réponse du guide photo, remise d'aplomb avant de partir vers l'écran.
 *
 * Le modèle reçoit une consigne : quand une photo ne permet pas d'évaluer
 * l'élément (capture d'écran, sujet sans rapport, image inexploitable, autre
 * élément que celui choisi), il ne propose aucun état. Une consigne se suit
 * presque toujours, pas toujours. Or l'écran qui affichait « Bon, PIII » sous
 * une capture d'écran de logiciel est précisément ce qu'on veut rendre
 * impossible : la règle est donc tenue ici, une fois, plutôt que confiée au
 * modèle seul ou répétée dans chaque écran.
 *
 * Module sans base ni réseau, pour être vérifiable par les tests.
 */

/** Les champs d'évaluation qui n'ont plus de sens sur une photo inutilisable. */
const CHAMPS_D_EVALUATION = ["state", "priority", "stateReason", "note"] as const;

/** Les numéros de photos (1 = première envoyée) que le modèle désigne, gardés s'ils existent. */
function numerosValides(brut: unknown, nbPhotos: number): number[] {
  if (!Array.isArray(brut)) return [];
  const gardes = brut.filter((n): n is number => Number.isInteger(n) && n >= 1 && n <= nbPhotos);
  return [...new Set(gardes)].sort((a, b) => a - b);
}

/**
 * Applique la règle « photo inutilisable » à une analyse brute du modèle.
 *
 * - Une photo qui montre un autre élément que le CFC choisi compte comme
 *   inutilisable pour cet élément, même si le modèle a oublié de le dire :
 *   l'évaluer reviendrait à noter le mauvais ouvrage.
 * - Dans ce cas, état, priorité, justification et note sont vidés, quoi que le
 *   modèle ait écrit.
 * - `photosAEcarter` dit quelles photos supprimer. Sans indication exploitable,
 *   toutes les photos envoyées sont en cause : c'est l'ensemble qui a été jugé.
 */
export function normaliserAnalysePhoto(
  analyse: Record<string, unknown>,
  nbPhotos: number,
  cfcSelectionne: boolean,
): Record<string, unknown> {
  const autreElement = cfcSelectionne && analyse.matchesSelected === false;
  const inutilisable = analyse.photoInutilisable === true || autreElement;

  if (!inutilisable) {
    // Rien à signaler : on ne laisse pas traîner une raison ou des numéros que
    // l'écran pourrait prendre pour un avertissement.
    const propre: Record<string, unknown> = { ...analyse, photoInutilisable: false };
    delete propre.raisonInutilisable;
    delete propre.photosAEcarter;
    return propre;
  }

  const designees = numerosValides(analyse.photosAEcarter, nbPhotos);
  const photosAEcarter = designees.length > 0 ? designees : Array.from({ length: nbPhotos }, (_, i) => i + 1);
  const raison =
    typeof analyse.raisonInutilisable === "string" && analyse.raisonInutilisable.trim()
      ? analyse.raisonInutilisable.trim()
      : null;

  const resultat: Record<string, unknown> = { ...analyse, photoInutilisable: true, raisonInutilisable: raison, photosAEcarter };
  for (const champ of CHAMPS_D_EVALUATION) resultat[champ] = null;
  return resultat;
}
