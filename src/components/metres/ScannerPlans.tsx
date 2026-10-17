/**
 * Scanner un plan papier, et en faire un PDF que l'outil Métrés mesure.
 *
 * Dans l'app iPhone/iPad, c'est le scanner de documents d'iOS qui s'ouvre
 * (lib/scanner-natif.ts) : il trouve la feuille, la redresse et enchaîne les
 * pages. Ailleurs (ordinateur, navigateur du téléphone), on prend une photo
 * ou on en choisit une ; la feuille est cherchée sur la photo (le plus grand
 * quadrilatère clair), et ses quatre coins se corrigent au doigt, avec une
 * loupe sous le coin qu'on tire. La feuille est alors redressée à la
 * résolution de la photo, et son contraste rendu lisible, en noir et blanc
 * ou en couleur (lib/plans/scan.ts).
 *
 * Le format compte : un plan au 1:100 ne mesure juste que sur une page de la
 * taille de la feuille imprimée. Le rapport des côtés dit l'orientation et
 * confirme que les coins sont bien ceux d'une feuille A ; la taille se
 * choisit (A3 par défaut, puis la dernière choisie). Les pages s'assemblent
 * en un seul PDF, chaque page à la taille réelle de son format, qui suit
 * ensuite le chemin d'un dépôt ordinaire : choix du bâtiment, envoi,
 * analyse, échelle imprimée lue et vérifiée sur une cote.
 *
 * Une photo n'a pas de traits vectoriels : l'accrochage aux traits n'existe
 * pas sur un scan, et l'écran le dit.
 */
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertTriangle, Camera, Check, Crop, ImagePlus, Loader2, Plus, RotateCw, ScanLine, ScanSearch, Trash2, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MarqueDiagly } from '@/components/plans/AnalyseIA'
import {
  FORMAT_PAR_DEFAUT, LISTE_FORMATS, ameliorer, assemblerPdf, coinsParDefaut, detecterFeuille, niveauxDeGris, nomDuScan, ordonnerCoins,
  placement, proposerFormat, rapportDeLaFeuille, rectangle, redresser, tailleRedressee, type FormatPapier, type ModeScan, type Orientation,
  type Point, type Quad,
} from '@/lib/plans/scan'
import { ScanAnnule, scannerNatif, scannerNatifDisponible } from '@/lib/scanner-natif'

/** La limite d'un plan déposé, comme au dépôt de fichiers. */
const TAILLE_MAX = 30 * 1024 * 1024
/** Au-delà, Safari sur iPhone et iPad refuse le canevas : une photo plus grande se réduit d'abord. */
const PIXELS_MAX = 16_000_000
const CLE_FORMAT = 'diagly.scan.format'

/** Une photo prise ou choisie, avant redressement. */
interface Photo {
  url: string
  image: HTMLImageElement
  /** La taille de travail, en pixels (celle de la photo, sauf si elle dépasse la limite des canevas). */
  largeur: number
  hauteur: number
}

/** Une page du scan. */
interface Page {
  id: string
  /** La photo d'origine ; absente quand le scanner d'iOS a déjà redressé la page. */
  photo: Photo | null
  coins: Quad | null
  /** La feuille redressée, avant amélioration. */
  brute: Blob
  largeur: number
  hauteur: number
  format: FormatPapier
  orientation: Orientation
  mode: ModeScan
  /** Le rendu amélioré, tel qu'il partira dans le PDF, et son aperçu. */
  rendu: Blob
  apercu: string
}

type Etape = 'demarrage' | 'source' | 'coins' | 'pages'

const pause = () => new Promise<void>((r) => setTimeout(r, 40))

function canevas(largeur: number, hauteur: number) {
  const c = document.createElement('canvas')
  c.width = largeur
  c.height = hauteur
  return c
}
/** Un canevas vidé rend sa mémoire tout de suite : sur iPhone, quelques photos de 12 millions de pixels la remplissent. */
function liberer(c: HTMLCanvasElement) {
  c.width = 0
  c.height = 0
}
function versJpeg(c: HTMLCanvasElement, qualite: number): Promise<Blob> {
  return new Promise((ok, ko) => c.toBlob((b) => (b ? ok(b) : ko(new Error('L’image n’a pas pu être encodée.'))), 'image/jpeg', qualite))
}
async function decoder(blob: Blob): Promise<{ image: HTMLImageElement; fin: () => void }> {
  const url = URL.createObjectURL(blob)
  const image = new Image()
  image.src = url
  try {
    await image.decode()
  } catch (e) {
    URL.revokeObjectURL(url)
    throw e
  }
  return { image, fin: () => URL.revokeObjectURL(url) }
}

async function chargerPhoto(fichier: Blob): Promise<Photo> {
  const url = URL.createObjectURL(fichier)
  const image = new Image()
  image.src = url
  try {
    // L'image se décode avec son orientation : une photo prise en hauteur reste en hauteur.
    await image.decode()
  } catch {
    URL.revokeObjectURL(url)
    throw new Error('Cette image n’a pas pu être lue. Choisissez une photo JPEG ou PNG.')
  }
  const l = image.naturalWidth, h = image.naturalHeight
  const k = Math.min(1, Math.sqrt(PIXELS_MAX / (l * h)))
  return { url, image, largeur: Math.round(l * k), hauteur: Math.round(h * k) }
}

/** La feuille cherchée sur une réduction de la photo (360 pixels de large suffisent), coins ramenés à la photo. */
function detecter(photo: Photo): Quad | null {
  const l = Math.min(360, photo.largeur)
  const h = Math.max(1, Math.round((l * photo.hauteur) / photo.largeur))
  const c = canevas(l, h)
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(photo.image, 0, 0, l, h)
  const q = detecterFeuille(niveauxDeGris(ctx.getImageData(0, 0, l, h).data, l, h))
  liberer(c)
  return q && (q.map((p) => ({ x: (p.x * photo.largeur) / l, y: (p.y * photo.hauteur) / h })) as Quad)
}

/** La feuille redressée, à la résolution de la photo. */
async function redresserPhoto(photo: Photo, coins: Quad): Promise<{ brute: Blob; largeur: number; hauteur: number }> {
  const c = canevas(photo.largeur, photo.hauteur)
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(photo.image, 0, 0, photo.largeur, photo.hauteur)
  const source = ctx.getImageData(0, 0, photo.largeur, photo.hauteur)
  liberer(c)
  const rapport = rapportDeLaFeuille(coins, photo.largeur, photo.hauteur)
  const t = tailleRedressee(coins, rapport)
  const data = redresser({ largeur: photo.largeur, hauteur: photo.hauteur, data: source.data }, coins, t.largeur, t.hauteur)
  const sortie = canevas(t.largeur, t.hauteur)
  sortie.getContext('2d')!.putImageData(new ImageData(data, t.largeur, t.hauteur), 0, 0)
  const brute = await versJpeg(sortie, 0.95)
  liberer(sortie)
  return { brute, largeur: t.largeur, hauteur: t.hauteur }
}

/** Le rendu d'une page : la feuille redressée, rendue lisible. */
async function rendre(brute: Blob, mode: ModeScan, qualite = 0.9): Promise<Blob> {
  const { image, fin } = await decoder(brute)
  const l = image.naturalWidth, h = image.naturalHeight
  const c = canevas(l, h)
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(image, 0, 0)
  fin()
  const d = ctx.getImageData(0, 0, l, h)
  ameliorer(d.data, l, h, mode)
  ctx.putImageData(d, 0, 0)
  const rendu = await versJpeg(c, qualite)
  liberer(c)
  return rendu
}

/** Un quart de tour dans le sens des aiguilles d'une montre. */
async function pivoter(brute: Blob): Promise<{ brute: Blob; largeur: number; hauteur: number }> {
  const { image, fin } = await decoder(brute)
  const l = image.naturalWidth, h = image.naturalHeight
  const c = canevas(h, l)
  const ctx = c.getContext('2d')!
  ctx.translate(h, 0)
  ctx.rotate(Math.PI / 2)
  ctx.drawImage(image, 0, 0)
  fin()
  const sortie = await versJpeg(c, 0.95)
  liberer(c)
  return { brute: sortie, largeur: h, hauteur: l }
}

function formatRetenu(): FormatPapier {
  try {
    const f = localStorage.getItem(CLE_FORMAT)
    return LISTE_FORMATS.includes(f as FormatPapier) ? (f as FormatPapier) : FORMAT_PAR_DEFAUT
  } catch {
    return FORMAT_PAR_DEFAUT
  }
}
function retenirFormat(f: FormatPapier) {
  try { localStorage.setItem(CLE_FORMAT, f) } catch { /* sans stockage, le choix ne vaut que pour ce scan */ }
}

let compteur = 0
const nouvelId = () => `page-${Date.now().toString(36)}-${compteur++}`

export function ScannerPlans({ onFichier, onFermer }: {
  /** Le PDF du scan, prêt à déposer comme n'importe quel plan. */
  onFichier: (f: File) => void
  onFermer: () => void
}) {
  const [etape, setEtape] = useState<Etape>('demarrage')
  const [natif, setNatif] = useState(false)
  const [pages, setPages] = useState<Page[]>([])
  const [edition, setEdition] = useState<{ photo: Photo; coins: Quad; detectee: boolean; pageId: string | null } | null>(null)
  const [travail, setTravail] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const champPhoto = useRef<HTMLInputElement>(null)
  const champImage = useRef<HTMLInputElement>(null)

  // Les adresses des aperçus et des photos se libèrent en partant.
  const adresses = useRef(new Set<string>())
  useEffect(() => {
    const liste = adresses.current
    return () => { for (const u of liste) URL.revokeObjectURL(u) }
  }, [])
  const apercu = (b: Blob) => {
    const u = URL.createObjectURL(b)
    adresses.current.add(u)
    return u
  }

  /** Les pages que le scanner d'iOS a rendues, déjà redressées, ajoutées au scan. */
  const recevoirNatif = async (images: { image: Blob; largeur: number; hauteur: number }[]) => {
    const format = formatRetenu()
    const nouvelles: Page[] = []
    for (const [i, p] of images.entries()) {
      setTravail(`Préparation de la page ${i + 1}/${images.length}…`)
      await pause()
      const rendu = await rendre(p.image, 'noir_blanc')
      nouvelles.push({
        id: nouvelId(), photo: null, coins: null, brute: p.image, largeur: p.largeur, hauteur: p.hauteur,
        format, orientation: proposerFormat(p.largeur / p.hauteur).orientation, mode: 'noir_blanc', rendu, apercu: apercu(rendu),
      })
    }
    setPages((ps) => [...ps, ...nouvelles])
  }

  const lancerNatif = async () => {
    setErreur(null)
    try {
      const images = await scannerNatif()
      await recevoirNatif(images)
      setEtape('pages')
    } catch (e) {
      if (e instanceof ScanAnnule) {
        // Rien de scanné, rien à garder : on referme. Sinon on retrouve ses pages.
        if (!pages.length) onFermer()
        return
      }
      setErreur(`Le scanner n’a pas abouti : ${(e as Error)?.message || 'erreur inconnue'}. Vous pouvez photographier le plan à la place.`)
      setNatif(false)
      setEtape(pages.length ? 'pages' : 'source')
    } finally {
      setTravail(null)
    }
  }

  // À l'ouverture : le scanner d'iOS dans l'app, la photo ailleurs.
  const lancement = useRef(false)
  useEffect(() => {
    if (lancement.current) return
    lancement.current = true
    void scannerNatifDisponible().then((oui) => {
      setNatif(oui)
      if (oui) void lancerNatif()
      else setEtape('source')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une seule fois, à l'ouverture
  }, [])

  // Échap referme, sauf pendant un traitement.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !travail) onFermer() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [travail, onFermer])

  const recevoirPhoto = async (fichiers: FileList | null) => {
    const f = fichiers?.[0]
    if (champPhoto.current) champPhoto.current.value = ''
    if (champImage.current) champImage.current.value = ''
    if (!f) return
    setErreur(null)
    setTravail('Lecture de la photo…')
    try {
      await pause()
      const photo = await chargerPhoto(f)
      adresses.current.add(photo.url)
      const trouves = detecter(photo)
      setEdition({ photo, coins: trouves ?? coinsParDefaut(photo.largeur, photo.hauteur), detectee: !!trouves, pageId: null })
      setEtape('coins')
    } catch (e) {
      setErreur((e as Error)?.message || 'La photo n’a pas pu être lue.')
    } finally {
      setTravail(null)
    }
  }

  const redresserEdition = async () => {
    if (!edition) return
    setTravail('Redressement de la feuille…')
    setErreur(null)
    try {
      await pause()
      const r = await redresserPhoto(edition.photo, edition.coins)
      const ancienne = edition.pageId ? pages.find((p) => p.id === edition.pageId) : null
      const mode = ancienne?.mode ?? 'noir_blanc'
      setTravail('Amélioration du contraste…')
      await pause()
      const rendu = await rendre(r.brute, mode)
      const page: Page = {
        id: ancienne?.id ?? nouvelId(), photo: edition.photo, coins: edition.coins, brute: r.brute, largeur: r.largeur, hauteur: r.hauteur,
        format: ancienne?.format ?? formatRetenu(), orientation: proposerFormat(r.largeur / r.hauteur).orientation, mode, rendu, apercu: apercu(rendu),
      }
      setPages((ps) => (ancienne ? ps.map((p) => (p.id === ancienne.id ? page : p)) : [...ps, page]))
      setEdition(null)
      setEtape('pages')
    } catch (e) {
      setErreur(`Le redressement a échoué : ${(e as Error)?.message || 'erreur inconnue'}.`)
    } finally {
      setTravail(null)
    }
  }

  /** Une page modifiée, son rendu refait quand l'image ou le mode change. */
  const modifierPage = async (id: string, patch: Partial<Pick<Page, 'mode' | 'format' | 'orientation'>> & { pivoter?: boolean }) => {
    const p = pages.find((x) => x.id === id)
    if (!p) return
    if (patch.format) retenirFormat(patch.format)
    if (!patch.mode && !patch.pivoter) {
      setPages((ps) => ps.map((x) => (x.id === id ? { ...x, ...patch } : x)))
      return
    }
    setTravail(patch.pivoter ? 'Rotation de la page…' : 'Amélioration du contraste…')
    try {
      await pause()
      const tournee = patch.pivoter ? await pivoter(p.brute) : null
      const brute = tournee?.brute ?? p.brute
      const mode = patch.mode ?? p.mode
      const rendu = await rendre(brute, mode)
      setPages((ps) => ps.map((x) => (x.id !== id ? x : {
        ...x, mode, brute, rendu, apercu: apercu(rendu),
        ...(tournee ? {
          largeur: tournee.largeur, hauteur: tournee.hauteur, orientation: x.orientation === 'paysage' ? 'portrait' : 'paysage',
          // Les coins de la photo ne valent plus pour une page tournée : on la reprend depuis son rendu.
          photo: null, coins: null,
        } : {}),
      })))
    } catch (e) {
      setErreur(`La page n’a pas pu être modifiée : ${(e as Error)?.message || 'erreur inconnue'}.`)
    } finally {
      setTravail(null)
    }
  }

  const ajouterPage = () => {
    if (natif) void (async () => { setTravail('Ouverture du scanner…'); await lancerNatif() })()
    else champImage.current?.click()
  }

  const creerPdf = async () => {
    setErreur(null)
    setTravail('Assemblage du PDF…')
    try {
      await pause()
      let rendus = pages.map((p) => p.rendu)
      let fichier = await assembler(pages, rendus)
      // Trop lourd pour un dépôt : les mêmes pages, un peu plus compressées.
      if (fichier.size > TAILLE_MAX) {
        setTravail('Compression des pages…')
        rendus = await Promise.all(pages.map((p) => rendre(p.brute, p.mode, 0.7)))
        fichier = await assembler(pages, rendus)
      }
      if (fichier.size > TAILLE_MAX) throw new Error('le PDF dépasse 30 Mo : scannez moins de pages à la fois')
      onFichier(fichier)
    } catch (e) {
      setErreur(`Le PDF n’a pas pu être créé : ${(e as Error)?.message || 'erreur inconnue'}.`)
      setTravail(null)
    }
  }

  const sombre = etape === 'coins'
  const sousTitre = etape === 'coins'
    ? (edition?.detectee ? 'Feuille trouvée : vérifiez les coins' : 'Placez les quatre coins de la feuille')
    : etape === 'pages' ? `${pages.length} page${pages.length > 1 ? 's' : ''}` : 'Un plan papier, mesuré comme un PDF'

  // Posé à la racine du document : un parent transformé (une transition de
  // page) ramènerait sinon « fixed » à lui, et l'écran ne serait pas couvert.
  return createPortal(
    <div
      className={cn('fixed inset-0 z-[70] flex flex-col pb-[var(--safe-bottom)] pl-[var(--safe-left)] pr-[var(--safe-right)] pt-[var(--safe-top)]',
        sombre ? 'bg-neutral-950 text-white' : 'bg-background text-foreground')}
      role="dialog"
      aria-modal="true"
      aria-label="Scanner un plan"
    >
      <header className={cn('flex shrink-0 items-center gap-3 border-b px-4 py-3', sombre && 'border-white/10')}>
        <MarqueDiagly className={cn('h-6 w-6 shrink-0', sombre && 'brightness-0 invert')} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">Scanner un plan</p>
          <p className={cn('truncate text-xs', sombre ? 'text-white/60' : 'text-muted-foreground')}>{sousTitre}</p>
        </div>
        <button
          onClick={onFermer}
          disabled={!!travail}
          className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg disabled:opacity-40 pointer-coarse:h-11 pointer-coarse:w-11', sombre ? 'hover:bg-white/10' : 'hover:bg-muted')}
          title="Fermer"
          aria-label="Fermer le scanner"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      {erreur && (
        <p className="mx-4 mt-3 flex shrink-0 items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{erreur}
        </p>
      )}

      <div className="relative min-h-0 flex-1">
        {etape === 'demarrage' && (
          <p className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Ouverture du scanner…</p>
        )}

        {etape === 'source' && (
          <Source onPhoto={() => champPhoto.current?.click()} onImage={() => champImage.current?.click()} />
        )}

        {etape === 'coins' && edition && (
          <EditeurCoins photo={edition.photo} coins={edition.coins} onCoins={(coins) => setEdition((e) => (e ? { ...e, coins } : e))} />
        )}

        {etape === 'pages' && (
          <ListePages
            pages={pages}
            onModifier={(id, patch) => void modifierPage(id, patch)}
            onCoins={(p) => {
              if (!p.photo || !p.coins) return
              setEdition({ photo: p.photo, coins: p.coins, detectee: false, pageId: p.id })
              setEtape('coins')
            }}
            onRetirer={(id) => setPages((ps) => ps.filter((x) => x.id !== id))}
          />
        )}

        {travail && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40" aria-live="polite">
            <p className="flex items-center gap-2 rounded-xl bg-background px-4 py-3 text-sm font-medium text-foreground shadow-xl">
              <Loader2 className="h-4 w-4 animate-spin" />{travail}
            </p>
          </div>
        )}
      </div>

      {/* Les gestes de l'étape. */}
      {etape === 'coins' && edition && (
        <footer className="flex shrink-0 flex-wrap items-center gap-2 border-t border-white/10 px-4 py-3">
          <button
            onClick={() => setEdition({ ...edition, coins: rectangle(edition.photo.largeur, edition.photo.hauteur), detectee: false })}
            className="flex h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-white/80 hover:bg-white/10"
            title="La photo entière : pour une feuille qui remplit le cadre"
          >
            <Crop className="h-4 w-4" />Photo entière
          </button>
          <button
            onClick={() => {
              const q = detecter(edition.photo)
              if (q) setEdition({ ...edition, coins: q, detectee: true })
              else setErreur('La feuille n’a pas été trouvée sur la photo : placez ses coins à la main. Un fond plus sombre que le papier aide.')
            }}
            className="flex h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-white/80 hover:bg-white/10"
          >
            <ScanSearch className="h-4 w-4" />Détecter la feuille
          </button>
          <span className="flex-1" />
          <button
            onClick={() => { setEdition(null); setErreur(null); setEtape(pages.length ? 'pages' : 'source') }}
            className="h-11 rounded-lg border border-white/20 px-4 text-sm font-medium hover:bg-white/10"
          >
            {edition.pageId ? 'Annuler' : 'Autre photo'}
          </button>
          <button
            onClick={() => void redresserEdition()}
            disabled={!!travail}
            className="flex h-11 items-center gap-1.5 rounded-lg bg-white px-4 text-sm font-semibold text-neutral-950 hover:bg-white/90 disabled:opacity-50"
          >
            <Check className="h-4 w-4" />Redresser
          </button>
        </footer>
      )}
      {etape === 'pages' && (
        <footer className="flex shrink-0 flex-wrap items-center gap-2 border-t px-4 py-3">
          <button onClick={ajouterPage} disabled={!!travail} className="flex h-11 items-center gap-1.5 rounded-lg border px-4 text-sm font-medium hover:bg-muted disabled:opacity-50">
            <Plus className="h-4 w-4" />Ajouter une page
          </button>
          <span className="flex-1" />
          <button
            onClick={() => void creerPdf()}
            disabled={!pages.length || !!travail}
            className="flex h-11 items-center gap-1.5 rounded-lg bg-foreground px-4 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-40"
          >
            <Check className="h-4 w-4" />Créer le PDF{pages.length > 1 ? ` (${pages.length} pages)` : ''}
          </button>
        </footer>
      )}

      <input ref={champPhoto} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void recevoirPhoto(e.target.files)} />
      <input ref={champImage} type="file" accept="image/*" className="hidden" onChange={(e) => void recevoirPhoto(e.target.files)} />
    </div>,
    document.body,
  )
}

/** Prendre une photo ou en choisir une, avec ce qui fait un bon scan. */
function Source({ onPhoto, onImage }: { onPhoto: () => void; onImage: () => void }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-xl space-y-4 p-4 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-2">
          {/* La prise de vue directe n'a de sens qu'avec un appareil photo sous la main : téléphone, tablette. */}
          <button onClick={onPhoto} className="hidden flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors hover:bg-muted pointer-coarse:flex">
            <Camera className="h-8 w-8 text-blue-600" strokeWidth={1.6} />
            <span className="text-[15px] font-semibold">Prendre une photo</span>
            <span className="text-xs text-muted-foreground">Le plan entier, de face</span>
          </button>
          <button onClick={onImage} className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors hover:bg-muted pointer-fine:sm:col-span-2">
            <ImagePlus className="h-8 w-8 text-blue-600" strokeWidth={1.6} />
            <span className="text-[15px] font-semibold">Choisir une image</span>
            <span className="text-xs text-muted-foreground">Une photo du plan déjà prise (JPEG, PNG)</span>
          </button>
        </div>
        <ConseilsScan />
      </div>
    </div>
  )
}

function ConseilsScan() {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-muted/40 p-3.5 text-sm">
        <p className="mb-1.5 flex items-center gap-1.5 font-semibold"><ScanLine className="h-4 w-4" />Pour un bon scan</p>
        <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
          <li>Le plan bien à plat, sur un fond plus sombre que le papier.</li>
          <li>Photographié de face, la feuille entière dans le cadre.</li>
          <li>Bien éclairé, sans ombre ni reflet.</li>
        </ul>
      </div>
      <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
        <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0 text-amber-700" />
        <span>
          Une photo n’a pas de traits vectoriels : sur un scan, l’accrochage aux traits n’existe pas. Les zones proposées par l’IA s’y
          placent à l’œil, à vérifier une à une, et l’échelle imprimée se contrôle sur une cote.
        </span>
      </p>
    </div>
  )
}

/**
 * Les quatre coins de la feuille, à tirer au doigt ou à la souris. Pendant
 * qu'on tire un coin, une loupe montre ce qu'il y a dessous : le doigt cache
 * justement l'endroit qu'on vise.
 */
function EditeurCoins({ photo, coins, onCoins }: { photo: Photo; coins: Quad; onCoins: (q: Quad) => void }) {
  const cadre = useRef<HTMLDivElement>(null)
  const [place, setPlace] = useState({ l: 0, h: 0 })
  useEffect(() => {
    const el = cadre.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setPlace({ l: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const echelle = place.l && place.h ? Math.min(place.l / photo.largeur, place.h / photo.hauteur) : 0
  const [glisse, setGlisse] = useState<number | null>(null)
  const loupe = useRef<HTMLCanvasElement>(null)

  const versPhoto = (e: React.PointerEvent<SVGSVGElement>): Point => {
    const r = e.currentTarget.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(photo.largeur, ((e.clientX - r.left) / r.width) * photo.largeur)),
      y: Math.max(0, Math.min(photo.hauteur, ((e.clientY - r.top) / r.height) * photo.hauteur)),
    }
  }

  // La loupe : trois fois l'image affichée, centrée sur le coin tiré.
  useEffect(() => {
    const c = loupe.current
    if (glisse == null || !c || !echelle) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    const p = coins[glisse]
    const taille = c.width
    const champ = taille / (echelle * 3)
    ctx.fillStyle = '#111'
    ctx.fillRect(0, 0, taille, taille)
    ctx.drawImage(photo.image, ((p.x - champ / 2) * photo.image.naturalWidth) / photo.largeur, ((p.y - champ / 2) * photo.image.naturalHeight) / photo.hauteur,
      (champ * photo.image.naturalWidth) / photo.largeur, (champ * photo.image.naturalHeight) / photo.hauteur, 0, 0, taille, taille)
    ctx.strokeStyle = '#38bdf8'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(taille / 2, 0); ctx.lineTo(taille / 2, taille)
    ctx.moveTo(0, taille / 2); ctx.lineTo(taille, taille / 2)
    ctx.stroke()
  }, [glisse, coins, echelle, photo])

  const l = photo.largeur, h = photo.hauteur
  const k = echelle ? 1 / echelle : 1
  const chemin = coins.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ') + ' Z'
  return (
    <div ref={cadre} className="absolute inset-3 flex items-center justify-center sm:inset-6">
      {echelle > 0 && (
        <div className="relative" style={{ width: l * echelle, height: h * echelle }}>
          <img src={photo.url} alt="Photo du plan" className="absolute inset-0 h-full w-full select-none" draggable={false} />
          <svg
            viewBox={`0 0 ${l} ${h}`}
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full touch-none"
            onPointerDown={(e) => {
              // Le coin le plus proche, à moins de 36 pixels d'écran.
              const p = versPhoto(e)
              let meilleur = -1, d = (36 * k) ** 2
              coins.forEach((q, i) => {
                const di = (q.x - p.x) ** 2 + (q.y - p.y) ** 2
                if (di < d) { d = di; meilleur = i }
              })
              if (meilleur < 0) return
              e.currentTarget.setPointerCapture(e.pointerId)
              setGlisse(meilleur)
            }}
            onPointerMove={(e) => {
              if (glisse == null) return
              const p = versPhoto(e)
              onCoins(coins.map((q, i) => (i === glisse ? p : q)) as Quad)
            }}
            onPointerUp={() => { if (glisse != null) { setGlisse(null); onCoins(ordonnerCoins(coins)) } }}
            onPointerCancel={() => { if (glisse != null) { setGlisse(null); onCoins(ordonnerCoins(coins)) } }}
          >
            <path d={`M0 0H${l}V${h}H0Z ${chemin}`} fill="rgba(0,0,0,0.5)" fillRule="evenodd" />
            <path d={chemin} fill="none" stroke="#38bdf8" strokeWidth={2.5 * k} />
            {coins.map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r={22 * k} fill="rgba(56,189,248,0.18)" />
                <circle cx={p.x} cy={p.y} r={9 * k} fill={glisse === i ? '#38bdf8' : '#fff'} stroke="#0284c7" strokeWidth={3 * k} />
              </g>
            ))}
          </svg>
          {glisse != null && (
            <canvas
              ref={loupe}
              width={128}
              height={128}
              className={cn('pointer-events-none absolute top-2 h-32 w-32 rounded-full border-2 border-white shadow-2xl',
                coins[glisse].x < l / 2 ? 'right-2' : 'left-2')}
              aria-hidden
            />
          )}
        </div>
      )}
    </div>
  )
}

/** Les pages du scan : leur rendu, leur format, leur mode. */
function ListePages({ pages, onModifier, onCoins, onRetirer }: {
  pages: Page[]
  onModifier: (id: string, patch: Partial<Pick<Page, 'mode' | 'format' | 'orientation'>> & { pivoter?: boolean }) => void
  onCoins: (p: Page) => void
  onRetirer: (id: string) => void
}) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
        <p className="rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Le format fixe l’échelle.</span> Un plan au 1:100 ne mesure juste que sur une page
          de la taille de la feuille imprimée. Toutes les feuilles A ont les mêmes proportions : la photo en donne l’orientation, pas la
          taille. Choisissez celle de la feuille photographiée (le cartouche l’indique souvent) ; l’analyse vérifie ensuite l’échelle sur une cote.
        </p>
        {pages.length === 0 && <p className="rounded-xl border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">Aucune page. Ajoutez-en une.</p>}
        <div className="grid gap-4 md:grid-cols-2">
          {pages.map((p, i) => <CartePage key={p.id} p={p} rang={i + 1} onModifier={onModifier} onCoins={onCoins} onRetirer={onRetirer} />)}
        </div>
        <ConseilsScan />
      </div>
    </div>
  )
}

function CartePage({ p, rang, onModifier, onCoins, onRetirer }: {
  p: Page
  rang: number
  onModifier: (id: string, patch: Partial<Pick<Page, 'mode' | 'format' | 'orientation'>> & { pivoter?: boolean }) => void
  onCoins: (p: Page) => void
  onRetirer: (id: string) => void
}) {
  const proposition = proposerFormat(p.largeur / p.hauteur)
  const pl = placement(p.largeur, p.hauteur, p.format, p.orientation)
  const contraire = proposition.orientation !== p.orientation
  const segment = (actif: boolean) => cn('flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors pointer-coarse:min-h-11',
    actif ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')
  return (
    <section className="overflow-hidden rounded-2xl border bg-background">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <p className="min-w-0 flex-1 text-sm font-semibold">Page {rang}</p>
        <span className="text-xs tabular-nums text-muted-foreground">{p.largeur} × {p.hauteur} px</span>
        <button onClick={() => onRetirer(p.id)} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-600 pointer-coarse:h-11 pointer-coarse:w-11" title="Retirer cette page">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="flex items-center justify-center bg-neutral-200 p-3">
        <img src={p.apercu} alt={`Page ${rang} redressée`} className="max-h-72 w-auto max-w-full border bg-white shadow-sm" />
      </div>
      <div className="space-y-2.5 p-3">
        <div className="flex rounded-lg bg-muted p-0.5" role="group" aria-label="Rendu">
          <button onClick={() => onModifier(p.id, { mode: 'noir_blanc' })} aria-pressed={p.mode === 'noir_blanc'} className={segment(p.mode === 'noir_blanc')}>Noir et blanc</button>
          <button onClick={() => onModifier(p.id, { mode: 'couleur' })} aria-pressed={p.mode === 'couleur'} className={segment(p.mode === 'couleur')}>Couleur</button>
        </div>
        <div className="flex gap-2">
          <select
            value={p.format}
            onChange={(e) => onModifier(p.id, { format: e.target.value as FormatPapier })}
            className="h-9 rounded-lg border bg-background px-2 text-sm pointer-coarse:h-11"
            aria-label="Format de la feuille"
          >
            {LISTE_FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <div className="flex flex-1 rounded-lg bg-muted p-0.5" role="group" aria-label="Orientation">
            <button onClick={() => onModifier(p.id, { orientation: 'portrait' })} aria-pressed={p.orientation === 'portrait'} className={segment(p.orientation === 'portrait')}>Portrait</button>
            <button onClick={() => onModifier(p.id, { orientation: 'paysage' })} aria-pressed={p.orientation === 'paysage'} className={segment(p.orientation === 'paysage')}>Paysage</button>
          </div>
        </div>
        <p className={cn('flex items-start gap-1.5 text-xs', proposition.conforme && !contraire ? 'text-muted-foreground' : 'text-amber-800')}>
          {proposition.conforme && !contraire ? <Check className="mt-px h-3.5 w-3.5 shrink-0 text-emerald-600" /> : <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />}
          <span>
            {!proposition.conforme
              ? `Proportions de 1:${(Math.max(p.largeur / p.hauteur, p.hauteur / p.largeur)).toFixed(2).replace('.', ',')}, pas celles d’une feuille A : les coins sont-ils ceux de la feuille ? L’image est posée sans déformation sur la page, l’échelle imprimée s’y vérifiera sur une cote.`
              : contraire
                ? `L’image est en ${proposition.orientation}, la page en ${p.orientation} : l’image y serait réduite et l’échelle imprimée ne vaudrait plus. Pour un plan couché, pivotez la page.`
                : `Proportions d’une feuille A (écart ${(proposition.ecart * 100).toFixed(1).replace('.', ',')} %). Page de ${pl.largeur} × ${pl.hauteur} mm.`}
          </span>
        </p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => onModifier(p.id, { pivoter: true })} className="flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium hover:bg-muted pointer-coarse:h-11">
            <RotateCw className="h-4 w-4" />Pivoter
          </button>
          {p.photo && p.coins && (
            <button onClick={() => onCoins(p)} className="flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium hover:bg-muted pointer-coarse:h-11">
              <Crop className="h-4 w-4" />Reprendre les coins
            </button>
          )}
        </div>
      </div>
    </section>
  )
}

/** Les pages en un PDF, chacune à la taille de son format, sous le nom du jour. */
async function assembler(pages: Page[], rendus: Blob[]): Promise<File> {
  const donnees = await Promise.all(pages.map(async (p, i) => ({
    jpeg: new Uint8Array(await rendus[i].arrayBuffer()),
    largeurPx: p.largeur,
    hauteurPx: p.hauteur,
    format: p.format,
    orientation: p.orientation,
  })))
  const pdf = await assemblerPdf(donnees, 'Plan scanné')
  return new File([pdf], nomDuScan(), { type: 'application/pdf' })
}
