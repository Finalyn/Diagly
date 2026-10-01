/**
 * Numéro de page de chaque bloc, une fois le document découpé.
 *
 * Un sommaire n'a de valeur que s'il renvoie à des pages, et une page n'est
 * connue qu'après la répartition. Ce contexte referme la boucle : la pagination
 * publie où chaque bloc est tombé, et le sommaire y lit ses renvois. Ajouter un
 * numéro en bout de ligne ne change pas la hauteur du sommaire, donc ne relance
 * pas de découpage : pas de va-et-vient entre les deux.
 *
 * Dans son propre fichier parce qu'un module qui exporte des composants ne doit
 * rien exporter d'autre, sous peine de casser le rafraîchissement à chaud.
 */
import { createContext, useContext } from 'react'

export const PagesDesBlocs = createContext<Map<string, number>>(new Map())

/** Page où se trouve le bloc `cle`, ou undefined tant que le document n'est pas découpé. */
export function usePageDuBloc(cle: string): number | undefined {
  return useContext(PagesDesBlocs).get(cle)
}
