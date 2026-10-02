/**
 * Le placement d'une visite guidée : le trou du projecteur et la bulle.
 *
 * Une bulle qui sort de l'écran, qui recouvre ce qu'elle désigne ou qui part du
 * mauvais côté ruine la visite. Le calcul vit donc ici, en géométrie pure : il
 * se teste sans navigateur, alors qu'à l'œil il faudrait rejouer chaque étape
 * sur chaque taille de fenêtre.
 */

export interface Rect { x: number; y: number; w: number; h: number }
export interface Taille { w: number; h: number }

/** Côté de la cible où la bulle se pose. */
export type Cote = 'haut' | 'bas' | 'gauche' | 'droite'
export type CoteSouhaite = Cote | 'auto'

/** Distance entre la cible et la bulle, et entre la bulle et le bord. */
export const MARGE = 16

/** Place restante de chaque côté de la cible. */
export function places(cible: Rect, fenetre: Taille): Record<Cote, number> {
  return {
    haut: cible.y,
    bas: fenetre.h - (cible.y + cible.h),
    gauche: cible.x,
    droite: fenetre.w - (cible.x + cible.w),
  }
}

/** Ce qu'il faut de place, d'un côté donné, pour y poser la bulle. */
function requis(bulle: Taille, cote: Cote): number {
  return (cote === 'haut' || cote === 'bas' ? bulle.h : bulle.w) + MARGE * 2
}

/**
 * Le côté retenu.
 *
 * Le côté souhaité l'emporte s'il tient. Sinon on prend le plus large, pour que
 * la bulle reste entière : mieux vaut une bulle au mauvais endroit qu'une bulle
 * coupée par le bord.
 */
export function coteChoisi(cible: Rect, bulle: Taille, fenetre: Taille, souhaite: CoteSouhaite = 'auto'): Cote {
  const p = places(cible, fenetre)
  if (souhaite !== 'auto' && p[souhaite] >= requis(bulle, souhaite)) return souhaite

  const ordre: Cote[] = ['droite', 'gauche', 'bas', 'haut']
  const tenables = ordre.filter((c) => p[c] >= requis(bulle, c))
  if (tenables.length > 0) {
    // À égalité d'encombrement, l'ordre ci-dessus tranche : on lit de gauche à
    // droite, une bulle à droite de ce qu'elle montre se lit dans la foulée.
    return tenables.reduce((meilleur, c) => (p[c] - requis(bulle, c) > p[meilleur] - requis(bulle, meilleur) ? c : meilleur))
  }
  return ordre.reduce((meilleur, c) => (p[c] > p[meilleur] ? c : meilleur))
}

const borne = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

/** Position de la bulle, en coordonnées de fenêtre. */
export function placerBulle(
  cible: Rect | null,
  bulle: Taille,
  fenetre: Taille,
  souhaite: CoteSouhaite = 'auto',
): { x: number; y: number; cote: Cote | null } {
  // Sans cible, la bulle se centre : l'étape explique sans rien désigner.
  if (!cible) {
    return {
      x: Math.round((fenetre.w - bulle.w) / 2),
      y: Math.round((fenetre.h - bulle.h) / 2),
      cote: null,
    }
  }

  const cote = coteChoisi(cible, bulle, fenetre, souhaite)
  const maxX = Math.max(MARGE, fenetre.w - bulle.w - MARGE)
  const maxY = Math.max(MARGE, fenetre.h - bulle.h - MARGE)

  if (cote === 'droite' || cote === 'gauche') {
    const x = cote === 'droite' ? cible.x + cible.w + MARGE : cible.x - bulle.w - MARGE
    const y = cible.y + cible.h / 2 - bulle.h / 2
    return { x: Math.round(borne(x, MARGE, maxX)), y: Math.round(borne(y, MARGE, maxY)), cote }
  }

  const y = cote === 'bas' ? cible.y + cible.h + MARGE : cible.y - bulle.h - MARGE
  const x = cible.x + cible.w / 2 - bulle.w / 2
  return { x: Math.round(borne(x, MARGE, maxX)), y: Math.round(borne(y, MARGE, maxY)), cote }
}

/**
 * Le trou du projecteur : la cible, un peu élargie, sans sortir de la fenêtre.
 *
 * Le débord est courant quand la cible touche un bord, et un trou qui dépasse
 * laisse un liseré clair le long de l'écran.
 */
export function trouDuProjecteur(cible: Rect, marge = 8, fenetre?: Taille): Rect {
  const x = cible.x - marge
  const y = cible.y - marge
  const w = cible.w + marge * 2
  const h = cible.h + marge * 2
  if (!fenetre) return { x, y, w, h }
  const gauche = Math.max(0, x)
  const haut = Math.max(0, y)
  return {
    x: gauche,
    y: haut,
    w: Math.min(fenetre.w, x + w) - gauche,
    h: Math.min(fenetre.h, y + h) - haut,
  }
}

/**
 * La pointe de la bulle, en coordonnées relatives à la bulle.
 *
 * Elle vise le centre de la cible, sans jamais quitter le bord de la bulle :
 * une pointe posée dans l'angle arrondi se décolle.
 */
export function pointeDeLaBulle(
  cible: Rect,
  bulle: { x: number; y: number } & Taille,
  cote: Cote,
  rayon = 18,
): { x: number; y: number } {
  if (cote === 'droite' || cote === 'gauche') {
    const centre = cible.y + cible.h / 2 - bulle.y
    return { x: cote === 'droite' ? 0 : bulle.w, y: Math.round(borne(centre, rayon, bulle.h - rayon)) }
  }
  const centre = cible.x + cible.w / 2 - bulle.x
  return { x: Math.round(borne(centre, rayon, bulle.w - rayon)), y: cote === 'bas' ? 0 : bulle.h }
}

/** Vers où le personnage doit pointer pour désigner la cible depuis la bulle. */
export function direction(cote: Cote | null): 'gauche' | 'droite' | 'haut' | 'bas' | null {
  if (!cote) return null
  // La bulle est à droite de la cible : le bras part vers la gauche.
  return { droite: 'gauche', gauche: 'droite', bas: 'haut', haut: 'bas' }[cote] as 'gauche' | 'droite' | 'haut' | 'bas'
}
