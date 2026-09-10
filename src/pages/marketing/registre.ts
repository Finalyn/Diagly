import { BASE_URL } from '@/lib/api'

/**
 * Les deux interrogations que la page publique a le droit de faire.
 *
 * La recherche d'adresse passe directement par le service fédéral geo.admin.ch,
 * public et sans clé : elle ne rend que des libellés et des coordonnées, rien
 * qu'un annuaire ne donnerait.
 *
 * L'année de construction, elle, passe par notre serveur. Le registre fédéral
 * répond d'un bloc : sa réponse porte aussi l'emprise au sol, les étages, les
 * logements et la surface de référence énergétique. Appelé depuis le navigateur,
 * tout cela s'afficherait dans l'onglet réseau, et il n'y aurait plus grand-chose
 * à venir chercher chez nous. Le serveur ne relaie que l'année.
 */

const RECHERCHE = 'https://api3.geo.admin.ch/rest/services/api/SearchServer?type=locations&origins=address&limit=6&sr=4326&searchText='

export interface Lieu {
  label: string
  lat: number
  lon: number
}

/** Ce que la page publique sait du bâtiment : rien de plus que cela. */
export interface Releve {
  annee: string | null
}

/** Le service rend du HTML dans ses libellés : on le retire avant de l'afficher. */
function nettoyer(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

/** Propositions d'adresses suisses pour ce que le visiteur a commencé à taper. */
export async function chercher(q: string): Promise<Lieu[]> {
  try {
    const j = await (await fetch(RECHERCHE + encodeURIComponent(q))).json()
    return (j?.results ?? [])
      .map((r: { attrs?: { label?: string; lat?: number; lon?: number } }) => r.attrs)
      .filter((a: { lat?: number; lon?: number }) => typeof a?.lat === 'number' && typeof a?.lon === 'number')
      .map((a: { label?: string; lat: number; lon: number }) => ({ label: nettoyer(a.label ?? ''), lat: a.lat, lon: a.lon }))
  } catch {
    return []
  }
}

/**
 * Année de construction du bâtiment situé au point retenu.
 * Rend null quand le point ne tombe sur aucun bâtiment recensé : une adresse
 * peut exister sans que le registre porte encore la construction.
 */
export async function releverBatiment(lieu: Lieu): Promise<Releve | null> {
  try {
    const r = await fetch(`${BASE_URL}/api/vitrine/annee?lat=${lieu.lat}&lon=${lieu.lon}`)
    if (!r.ok) return null
    const j = await r.json()
    return { annee: typeof j?.annee === 'string' ? j.annee : null }
  } catch {
    return null
  }
}

/**
 * Quelques immeubles pour démarrer sans rien taper.
 * Les coordonnées viennent du service fédéral d'adresses, pas d'une lecture de
 * carte : à cent mètres près, le point ne tombe plus sur le bâtiment et le
 * registre ne rend rien.
 */
export const EXEMPLES: Lieu[] = [
  { label: 'Avenue de la Gare 12, 1700 Fribourg', lat: 46.803150, lon: 7.152379 },
  { label: 'Chemin de Boston 8, 1004 Lausanne', lat: 46.523853, lon: 6.620190 },
  { label: 'Rue du Rhône 40, 1204 Genève', lat: 46.204304, lon: 6.146671 },
]
