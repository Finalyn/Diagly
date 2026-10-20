/**
 * Mise en pages A4 d'un document.
 *
 * Le rapport était un flux continu : à l'écran une longue liste, et c'est le
 * navigateur qui décidait seul, au moment d'imprimer, où tomberaient les coupures.
 * On ne voyait donc jamais le document qu'on allait remettre au client.
 *
 * Ici le découpage est fait avant l'affichage : le contenu arrive en blocs, on les
 * mesure à la largeur utile d'une page, puis on les répartit sur des feuilles A4
 * réelles. L'écran et le papier montrent alors exactement la même chose, et chaque
 * feuille peut porter son en-tête (le logo) et son numéro.
 *
 * Deux sortes de blocs :
 *  - `bloc`   : un morceau insécable (un paragraphe, un tableau court, une fiche
 *               d'ouvrage avec ses photos) ;
 *  - `lignes` : un groupe de lignes d'un tableau long. Les groupes consécutifs d'un
 *               même tableau sont réunis sur la page, sous un en-tête de colonnes
 *               qui se répète à chaque page — sans quoi un devis qui déborde perd
 *               ses intitulés de colonnes.
 */
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { HAUTEUR_CONTENU } from './constants'
import { PagesDesBlocs } from './page-contexte'

export type BlocDocument =
  | {
      type: 'bloc'
      cle: string
      noeud: ReactNode
      /** Force l'ouverture d'une nouvelle page avant ce bloc. */
      nouvellePage?: boolean
      /** Ne pas laisser ce bloc seul en bas de page (titre). */
      avecSuivant?: boolean
    }
  | {
      type: 'lignes'
      cle: string
      /** Identifie le tableau auquel ces lignes appartiennent. */
      tableauId: string
      /** Largeurs de colonnes, pour que les morceaux restent alignés d'une page à l'autre. */
      colonnes: ReactNode
      /** En-tête de colonnes, répété en haut de chaque page où le tableau continue. */
      entete: ReactNode
      /** Les `<tr>` de ce groupe. */
      lignes: ReactNode
      nouvellePage?: boolean
      avecSuivant?: boolean
    }

interface Page {
  blocs: BlocDocument[]
}

/** Nombre de pixels par millimètre, mesuré sur le rendu réel plutôt que supposé. */
function pixelsParMm(sonde: HTMLElement | null): number {
  if (!sonde) return 96 / 25.4
  const l = sonde.getBoundingClientRect().width
  return l > 0 ? l / 100 : 96 / 25.4
}

/**
 * Répartit les blocs sur les pages, d'après leurs hauteurs mesurées.
 *
 * Glouton : on remplit la page courante tant que le bloc suivant tient. Un bloc
 * plus haut qu'une page vide occupe sa propre page et déborde — mieux vaut un
 * débordement visible qu'un contenu tronqué en silence.
 */
function repartir(
  blocs: BlocDocument[],
  hauteurs: number[],
  hauteursEntetes: Map<string, number>,
  hauteurPage: number,
): Page[] {
  const pages: Page[] = [{ blocs: [] }]
  let restant = hauteurPage
  /** Tableaux dont l'en-tête est déjà posé sur la page courante. */
  let entetesPosees = new Set<string>()

  const nouvellePage = () => {
    pages.push({ blocs: [] })
    restant = hauteurPage
    entetesPosees = new Set()
  }

  for (let i = 0; i < blocs.length; i++) {
    const bloc = blocs[i]
    let besoin = hauteurs[i]

    // Un tableau qui commence ou reprend sur cette page paie son en-tête.
    const entete = bloc.type === 'lignes' && !entetesPosees.has(bloc.tableauId)
      ? (hauteursEntetes.get(bloc.tableauId) ?? 0)
      : 0
    besoin += entete

    // Un titre ne reste pas seul : il emmène le bloc qui le suit.
    if (bloc.avecSuivant && i + 1 < blocs.length) besoin += hauteurs[i + 1]

    const pageVide = pages[pages.length - 1].blocs.length === 0
    if (bloc.nouvellePage && !pageVide) nouvellePage()
    else if (besoin > restant && !pageVide) nouvellePage()

    // Recalcul après un éventuel changement de page : l'en-tête n'est plus posé.
    const enteteFinal = bloc.type === 'lignes' && !entetesPosees.has(bloc.tableauId)
      ? (hauteursEntetes.get(bloc.tableauId) ?? 0)
      : 0
    if (bloc.type === 'lignes') entetesPosees.add(bloc.tableauId)

    pages[pages.length - 1].blocs.push(bloc)
    restant -= hauteurs[i] + enteteFinal
  }

  return pages
}

/** Regroupe les blocs consécutifs d'un même tableau, pour n'en faire qu'un `<table>`. */
function grouper(blocs: BlocDocument[]): (BlocDocument | { type: 'tableau'; cle: string; morceaux: Extract<BlocDocument, { type: 'lignes' }>[] })[] {
  const sortie: (BlocDocument | { type: 'tableau'; cle: string; morceaux: Extract<BlocDocument, { type: 'lignes' }>[] })[] = []
  for (const bloc of blocs) {
    if (bloc.type !== 'lignes') { sortie.push(bloc); continue }
    const dernier = sortie[sortie.length - 1]
    if (dernier && 'type' in dernier && dernier.type === 'tableau' && dernier.morceaux[0].tableauId === bloc.tableauId) {
      dernier.morceaux.push(bloc)
    } else {
      sortie.push({ type: 'tableau', cle: `t-${bloc.cle}`, morceaux: [bloc] })
    }
  }
  return sortie
}

export interface DocumentA4Props {
  blocs: BlocDocument[]
  /** En-tête répété en haut de chaque page (le logo). */
  entete: ReactNode
  /** Mention répétée en pied de page, à gauche du numéro. */
  mentionPied?: ReactNode
  /**
   * La première page n'a pas de pied : une page de garde ne porte ni numéro
   * ni mention. Elle compte quand même : la page suivante est la deuxième.
   */
  sansPiedPremierePage?: boolean
}

export function DocumentA4({ blocs, entete, mentionPied, sansPiedPremierePage }: DocumentA4Props) {
  const sondeRef = useRef<HTMLDivElement>(null)
  const mesureRef = useRef<HTMLDivElement>(null)
  const [pages, setPages] = useState<Page[] | null>(null)

  // Signature du contenu : les blocs sont reconstruits à chaque rendu du parent,
  // seule leur composition doit relancer une mesure.
  const signature = useMemo(() => blocs.map((b) => b.cle).join('|'), [blocs])

  useLayoutEffect(() => {
    let abandonne = false

    const mesurer = async () => {
      const hote = mesureRef.current
      if (!hote) return

      // Une photo pas encore décodée a une hauteur nulle : la page serait calculée
      // sur un document sans images, puis débordée à l'affichage.
      const images = Array.from(hote.querySelectorAll('img'))
      await Promise.all(images.map((img) => img.complete
        ? Promise.resolve()
        : new Promise<void>((ok) => { img.onload = img.onerror = () => ok() })))
      if (abandonne) return

      const parMm = pixelsParMm(sondeRef.current)
      const lire = (sel: string) => Array.from(hote.querySelectorAll<HTMLElement>(sel))
        .map((e) => e.getBoundingClientRect().height / parMm)

      const hauteurs = lire(':scope > [data-mesure]')
      const hauteursEntetes = new Map<string, number>()
      for (const e of hote.querySelectorAll<HTMLElement>('[data-entete]')) {
        hauteursEntetes.set(e.dataset.entete!, e.getBoundingClientRect().height / parMm)
      }

      if (hauteurs.length !== blocs.length) return
      const calcul = repartir(blocs, hauteurs, hauteursEntetes, HAUTEUR_CONTENU)
      setPages((prec) => {
        // Sans cette comparaison, chaque mesure relancerait un rendu, qui relancerait
        // une mesure : le composant tournerait en boucle.
        const meme = prec
          && prec.length === calcul.length
          && prec.every((p, i) => p.blocs.length === calcul[i].blocs.length
            && p.blocs.every((b, j) => b.cle === calcul[i].blocs[j].cle))
        return meme ? prec : calcul
      })
    }

    void mesurer()
    return () => { abandonne = true }
  }, [blocs, signature])

  // Publié pour le sommaire : où chaque bloc est tombé.
  const pagesDesBlocs = useMemo(() => {
    const carte = new Map<string, number>()
    pages?.forEach((page, i) => page.blocs.forEach((b) => carte.set(b.cle, i + 1)))
    return carte
  }, [pages])

  /**
   * Les blocs du moment, par clé.
   *
   * La pagination garde ses pages tant que la composition ne change pas, pour
   * ne pas boucler entre mesure et rendu. Mais elle gardait aussi les noeuds
   * mesurés : un texte corrigé, une couleur changée ou un auteur renommé ne
   * paraissaient plus, puisque l'écran montrait la version d'avant. On ne
   * conserve donc que le découpage, et le contenu vient du rendu courant.
   */
  const blocsDuMoment = useMemo(() => new Map(blocs.map((b) => [b.cle, b])), [blocs])

  const tableauxUniques = useMemo(() => {
    const vus = new Map<string, Extract<BlocDocument, { type: 'lignes' }>>()
    for (const b of blocs) if (b.type === 'lignes' && !vus.has(b.tableauId)) vus.set(b.tableauId, b)
    return Array.from(vus.values())
  }, [blocs])

  return (
    <PagesDesBlocs.Provider value={pagesDesBlocs}>
    <div className="doc-a4">
      {/* Sonde : donne le rapport pixels/millimètre du rendu courant. */}
      <div ref={sondeRef} className="doc-sonde" aria-hidden />

      {/* Passe de mesure : hors écran, à la largeur exacte d'une page. */}
      <div ref={mesureRef} className="doc-mesure" aria-hidden>
        {blocs.map((b) => (
          <div key={b.cle} className="doc-bloc" data-mesure>
            {b.type === 'bloc' ? b.noeud : (
              <table className="doc-tableau w-full"><colgroup>{b.colonnes}</colgroup><tbody>{b.lignes}</tbody></table>
            )}
          </div>
        ))}
        {tableauxUniques.map((t) => (
          <table key={t.tableauId} className="doc-tableau w-full" data-entete={t.tableauId}>
            <colgroup>{t.colonnes}</colgroup>{t.entete}
          </table>
        ))}
      </div>

      {pages && pages.map((page, i) => (
        <section key={i} className="doc-feuille">
          <div className="doc-contenu">
            <header className="doc-entete">{entete}</header>
            <div className="doc-corps">
              {grouper(page.blocs.map((b) => blocsDuMoment.get(b.cle) ?? b)).map((g) => (
                'type' in g && g.type === 'tableau' ? (
                  <div key={g.cle} className="doc-bloc">
                    <table className="doc-tableau w-full">
                      <colgroup>{g.morceaux[0].colonnes}</colgroup>
                      {g.morceaux[0].entete}
                      <tbody>{g.morceaux.map((m) => <Fragmentaire key={m.cle}>{m.lignes}</Fragmentaire>)}</tbody>
                    </table>
                  </div>
                ) : (
                  <div key={g.cle} className="doc-bloc">{g.type === 'bloc' ? g.noeud : null}</div>
                )
              ))}
            </div>
            {sansPiedPremierePage && i === 0 ? <footer className="doc-pied border-transparent" aria-hidden /> : (
              <footer className="doc-pied">
                <span>{mentionPied}</span>
                <span>{i + 1} / {pages.length}</span>
              </footer>
            )}
          </div>
        </section>
      ))}
    </div>
    </PagesDesBlocs.Provider>
  )
}

/** Laisse passer des `<tr>` sans insérer d'élément entre `<tbody>` et ses lignes. */
function Fragmentaire({ children }: { children: ReactNode }) {
  return <>{children}</>
}
