/**
 * Commencer avec des plans : le dépôt, la lecture par l'IA, la relecture.
 *
 * Les métrés de chaque ouvrage partent de quelques chiffres du bâtiment. Les
 * registres publics les donnent à peu près ; des plans d'architecte à
 * l'échelle les donnent mesurés. L'IA lit le jeu de plans (étages, façades,
 * coupe, cartouche) et rend chaque grandeur avec sa page, sa méthode et sa
 * confiance ; le diagnostiqueur relit, corrige ce qu'il faut, et rien n'est
 * créé avant qu'il valide.
 *
 * Deux copies des fichiers circulent. Pour la lecture, les images sont
 * ramenées à ce que le modèle voit réellement (2576 px sur le grand côté) :
 * au-delà, une photo de plan pèse sans rien apporter, et l'API refuse une
 * image trop lourde. Les originaux, eux, sont rangés tels quels dans les Plans
 * du dossier une fois celui-ci créé (voir ProjectNew).
 *
 * L'échelle lue sur une page est seulement affichée : l'outil Plan s'étalonne
 * par un trait tracé sur une cote connue, en pixels, et une échelle d'impression
 * ne dit rien de la résolution d'un scan ou d'une photo.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Upload, Loader2, AlertCircle, AlertTriangle, ArrowLeft, ArrowRight, RotateCcw, FileText, Image as ImageIcon, X } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from '@/components/ui'
import { api, ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { GrandeurLue, LecturePlans, RoofType } from '@/lib/api-types'
import {
  GRANDEURS_DES_PLANS, aVerifier, champsDepuisPlans, lieuDeLaPage, valeursInitiales,
  type ValeursRetenues,
} from '@/lib/demarrage-plans'
import type { ImportPret } from '@/lib/demarrage'

const MAX_FICHIERS = 12
const MAX_TOTAL = 30 * 1024 * 1024
const ACCEPTES = /\.(pdf|jpe?g|png|webp)$/i
const TYPES_ACCEPTES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
/** Le grand côté au-delà duquel le modèle ne voit pas plus de détail. */
const COTE_LU = 2576
/** Une image plus lourde est réduite même si elle est petite : l'API plafonne chaque image. */
const POIDS_LU = 3.5 * 1024 * 1024

const taille = (octets: number) =>
  octets < 1024 * 1024 ? `${Math.max(1, Math.round(octets / 1024))} Ko` : `${(octets / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`

/** Un nombre à la suisse romande : 226,3 ; 1’450. */
const nombre = (v: number) => v.toLocaleString('fr-CH', { maximumFractionDigits: 2 })
const avecUnite = (v: number, unite: string) => (unite ? `${nombre(v)} ${unite}` : nombre(v))

const estPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name)

/**
 * La copie d'une image envoyée à la lecture : réduite à ce que le modèle voit,
 * en JPEG sur fond blanc (un PNG transparent deviendrait noir). Un PDF, ou une
 * image déjà légère, part tel quel ; une image illisible par le navigateur
 * aussi, et le serveur dira si elle passe.
 */
async function copiePourLecture(f: File): Promise<File> {
  if (estPdf(f)) return f
  const url = URL.createObjectURL(f)
  try {
    const img = await new Promise<HTMLImageElement>((ok, ko) => {
      const i = new Image()
      i.onload = () => ok(i)
      i.onerror = ko
      i.src = url
    })
    const grand = Math.max(img.naturalWidth, img.naturalHeight)
    if (grand <= COTE_LU && f.size <= POIDS_LU) return f
    const k = Math.min(1, COTE_LU / grand)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * k)
    canvas.height = Math.round(img.naturalHeight * k)
    const ctx = canvas.getContext('2d')
    if (!ctx) return f
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.9))
    return blob ? new File([blob], f.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }) : f
  } catch {
    return f
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function ImportPlans({ onRetour, onPret }: { onRetour: () => void; onPret: (imp: ImportPret) => void }) {
  const [fichiers, setFichiers] = useState<File[]>([])
  const [lecture, setLecture] = useState<{ data: LecturePlans; noms: string[] } | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [secondes, setSecondes] = useState(0)
  const [erreur, setErreur] = useState<string | null>(null)
  const [survol, setSurvol] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  // Une lecture prend une à trois minutes : un compteur dit que rien n'est figé.
  useEffect(() => {
    if (!enCours) return
    setSecondes(0)
    const t = window.setInterval(() => setSecondes((s) => s + 1), 1000)
    return () => window.clearInterval(t)
  }, [enCours])

  const total = fichiers.reduce((s, f) => s + f.size, 0)

  const ajouter = (liste: FileList | File[] | null | undefined) => {
    if (!liste) return
    setErreur(null)
    const recus = Array.from(liste)
    const refuses = recus.filter((f) => !TYPES_ACCEPTES.includes(f.type) && !ACCEPTES.test(f.name))
    const nouveaux = recus
      .filter((f) => !refuses.includes(f))
      .filter((f) => !fichiers.some((d) => d.name === f.name && d.size === f.size))
    const suite = [...fichiers, ...nouveaux]
    if (refuses.length) {
      setErreur(`${refuses.map((f) => `« ${f.name} »`).join(', ')} : seuls les PDF et les images JPEG, PNG ou WEBP se lisent.`)
    }
    if (suite.length > MAX_FICHIERS) { setErreur(`${MAX_FICHIERS} fichiers au plus : gardez les plans d’étage, une coupe et les façades.`); return }
    if (suite.reduce((s, f) => s + f.size, 0) > MAX_TOTAL) { setErreur('30 Mo au total au plus : retirez les pages inutiles ou allégez les PDF.'); return }
    setFichiers(suite)
  }

  // Quitter l'écran pendant la lecture l'arrête aussi côté serveur : personne
  // ne relirait le résultat, inutile de le payer jusqu'au bout.
  const abandon = useRef<AbortController | null>(null)
  useEffect(() => () => abandon.current?.abort(), [])

  const lire = async () => {
    if (!fichiers.length || enCours) return
    setErreur(null)
    setEnCours(true)
    abandon.current = new AbortController()
    try {
      const copies = await Promise.all(fichiers.map(copiePourLecture))
      const r = await api.demarrage.plans(copies, abandon.current.signal)
      if (!r.configured) throw new Error('La lecture par l’assistant n’est pas activée sur ce serveur.')
      if (r.refus) throw new Error('L’assistant n’a pas pu lire ces fichiers.')
      if (!r.lecture) {
        throw new Error(r.tronque
          ? 'Le jeu de plans est trop long pour être lu en une fois. Gardez les plans d’étage, une coupe et les façades.'
          : 'Les plans n’ont pas pu être lus. Vérifiez qu’ils sont lisibles, puis réessayez.')
      }
      if (!r.lecture.estUnJeuDePlans) throw new Error('Ces fichiers ne ressemblent pas à des plans de bâtiment.')
      setLecture({ data: r.lecture, noms: fichiers.map((f) => f.name) })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      setErreur(e instanceof ApiError || e instanceof Error ? e.message : 'Lecture impossible.')
    } finally {
      setEnCours(false)
    }
  }

  if (lecture) {
    return (
      <RelecturePlans
        lecture={lecture.data} noms={lecture.noms} fichiers={fichiers}
        onRecommencer={() => setLecture(null)} onPret={onPret}
      />
    )
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="space-y-0 border-b border-black/[0.06] px-5 py-3.5">
        <CardTitle className="text-base">Commencer avec des plans</CardTitle>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Les plans d’architecte à l’échelle : plans d’étage, façades, coupe, et le cartouche s’il porte l’adresse. En PDF ou en photos.
        </p>
      </CardHeader>
      <CardContent className="space-y-4 p-5">
        <div
          onDragOver={(e) => { e.preventDefault(); setSurvol(true) }}
          onDragLeave={() => setSurvol(false)}
          onDrop={(e) => { e.preventDefault(); setSurvol(false); if (!enCours) ajouter(e.dataTransfer.files) }}
          className={cn('flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors',
            survol ? 'border-blue-400 bg-blue-50/50' : 'border-black/[0.1] bg-neutral-50/50')}
        >
          {enCours ? (
            <>
              <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
              <p className="mt-3 text-sm font-medium">
                Lecture de {fichiers.length} fichier{fichiers.length > 1 ? 's' : ''} · {Math.floor(secondes / 60)} min {String(secondes % 60).padStart(2, '0')} s
              </p>
              <p className="mt-1 max-w-md text-xs text-muted-foreground">
                L’assistant Diagly lit les cotes, les surfaces et les coupes. Comptez une à trois minutes, et gardez cette page ouverte.
              </p>
            </>
          ) : (
            <>
              <Upload className="h-7 w-7 text-muted-foreground" strokeWidth={1.5} />
              <p className="mt-3 text-sm font-medium">Déposez les plans ici</p>
              <p className="mt-1 text-xs text-muted-foreground">PDF, JPEG, PNG ou WEBP. {MAX_FICHIERS} fichiers et 30 Mo au plus.</p>
              <Button variant="outline" className="mt-4" onClick={() => input.current?.click()}>
                {fichiers.length ? 'Ajouter des fichiers' : 'Choisir les fichiers'}
              </Button>
            </>
          )}
          <input ref={input} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" className="hidden"
            onChange={(e) => { const l = e.target.files; ajouter(l ? Array.from(l) : null); e.target.value = '' }} />
        </div>

        {fichiers.length > 0 && (
          <div className="rounded-xl border border-black/[0.06]">
            <ul className="divide-y divide-black/[0.05]">
              {fichiers.map((f, i) => (
                <li key={`${f.name}-${f.size}`} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  {estPdf(f) ? <FileText className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  <span className="w-7 shrink-0 text-xs text-muted-foreground">F{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{taille(f.size)}</span>
                  <button
                    type="button" disabled={enCours} aria-label={`Retirer ${f.name}`}
                    onClick={() => setFichiers((l) => l.filter((x) => x !== f))}
                    className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-neutral-100 hover:text-foreground disabled:opacity-40"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/[0.06] px-4 py-3">
              <p className="text-xs text-muted-foreground">{fichiers.length} fichier{fichiers.length > 1 ? 's' : ''} · {taille(total)}</p>
              <Button onClick={lire} disabled={enCours}>
                {enCours ? <><Loader2 className="h-4 w-4 animate-spin" />Lecture…</> : <>Lire les plans<ArrowRight className="h-4 w-4" /></>}
              </Button>
            </div>
          </div>
        )}

        {erreur && (
          <p className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{erreur}</p>
        )}
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <img src="/diagly-mark.svg" alt="" className="h-3.5 w-3.5" />
          Les plans sont lus par l’assistant Diagly. Vous relisez chaque mesure avant que le diagnostic soit créé.
        </p>
        <div className="flex justify-start">
          <Button variant="ghost" onClick={onRetour} disabled={enCours}><ArrowLeft className="h-4 w-4" />Changer de point de départ</Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------- relecture

const LIBELLES_TOIT: Record<RoofType, string> = { PLATE: 'Plate', PENTE: 'En pente', MIXTE: 'Mixte' }

/** D'où vient la valeur, en une ligne : la page, la méthode, la confiance. */
function Provenance({ g, noms }: { g: GrandeurLue<unknown>; noms: string[] }) {
  if (g.valeur === null) return null
  const alerte = aVerifier(g)
  const lieu = lieuDeLaPage(g.page, noms)
  return (
    <p className={cn('mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs', alerte ? 'text-amber-800' : 'text-muted-foreground')}>
      {alerte && <AlertTriangle className="h-3 w-3 shrink-0 text-amber-600" />}
      {[lieu, g.methode, g.confiance && `confiance ${g.confiance}`].filter(Boolean).join(' · ')}
    </p>
  )
}

function RelecturePlans({ lecture, noms, fichiers, onRecommencer, onPret }: {
  lecture: LecturePlans; noms: string[]; fichiers: File[]; onRecommencer: () => void; onPret: (imp: ImportPret) => void
}) {
  const [valeurs, setValeurs] = useState<ValeursRetenues>(() => valeursInitiales(lecture))
  const champs = useMemo(() => champsDepuisPlans(valeurs), [valeurs])
  const nbChamps = Object.keys(champs).length
  const remplissantes = GRANDEURS_DES_PLANS.filter((g) => g.champ)
  const pourInformation = GRANDEURS_DES_PLANS.filter((g) => !g.champ && lecture.grandeurs[g.cle].valeur !== null)
  const aRevoir = [...remplissantes.map((g) => lecture.grandeurs[g.cle]), lecture.typeToit].filter(aVerifier).length
  const p = lecture.projet
  const cartouche = [p.nom, p.adresse, [p.npa, p.localite].filter(Boolean).join(' '), p.canton && `(${p.canton})`].filter(Boolean).join(', ').replace(', (', ' (')

  const poser = (cle: keyof ValeursRetenues['grandeurs'], brut: string) => {
    const n = brut.trim() === '' ? null : Number(brut.replace(',', '.'))
    setValeurs((v) => ({ ...v, grandeurs: { ...v.grandeurs, [cle]: n !== null && Number.isFinite(n) ? n : null } }))
  }

  const valider = () => onPret({
    source: 'plans',
    fichier: noms.length === 1 ? noms[0] : `${noms.length} plans`,
    batiment: { nom: p.nom, adresse: p.adresse, npa: p.npa, localite: p.localite, canton: p.canton },
    energie: null,
    mesures: [],
    confiance: null,
    releves: [],
    plans: { fichiers, champs },
  })

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 border-b border-black/[0.06] px-5 py-3.5">
          <div className="min-w-0">
            <CardTitle className="text-base">Ce que l’assistant a lu sur les plans</CardTitle>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {noms.length === 1 ? `« ${noms[0]} »` : `${noms.length} fichiers`}
              {aRevoir > 0 && ` · ${aRevoir} valeur${aRevoir > 1 ? 's' : ''} à vérifier`}
            </p>
          </div>
          <Button size="sm" variant="ghost" className="shrink-0" onClick={onRecommencer}><RotateCcw className="h-3.5 w-3.5" />Autres plans</Button>
        </CardHeader>
        <CardContent className="space-y-3 p-5">
          {lecture.remarques && <p className="text-sm text-muted-foreground">{lecture.remarques}</p>}
          {cartouche ? (
            <p className="text-sm"><span className="text-muted-foreground">Cartouche : </span>{cartouche}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Aucune adresse sur les plans : vous la saisirez à l’étape suivante.</p>
          )}
          <p className="text-xs text-muted-foreground">
            En choisissant ensuite l’adresse dans la liste proposée, les registres fédéraux complètent l’année et la parcelle, sans remplacer les mesures lues ici.
          </p>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="space-y-0 border-b border-black/[0.06] px-5 py-3.5">
          <CardTitle className="text-base">Mesures du bâtiment</CardTitle>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Elles remplissent le dossier, et les métrés en partent. Corrigez une valeur si besoin ; videz-la pour la saisir plus tard. En ambre, une estimation ou une lecture incertaine.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-black/[0.05]">
            {remplissantes.map((d) => {
              const g = lecture.grandeurs[d.cle]
              const v = valeurs.grandeurs[d.cle]
              const corrigee = v !== g.valeur
              return (
                <div key={d.cle} className={cn('grid gap-2 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_170px] sm:items-start', !corrigee && aVerifier(g) && 'bg-amber-50/60')}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{d.libelle}</p>
                    {g.valeur === null
                      ? <p className="mt-0.5 text-xs text-muted-foreground">Non lue sur les plans : vous la saisirez à l’étape suivante.</p>
                      : <Provenance g={g} noms={noms} />}
                    {corrigee && g.valeur !== null && <p className="mt-0.5 text-xs text-blue-700">Corrigée par vous ; lu sur les plans : {avecUnite(g.valeur, d.unite)}.</p>}
                    {g.remarque && <p className="mt-0.5 text-xs text-muted-foreground">{g.remarque}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number" step={d.entier ? 1 : 'any'} min={0} inputMode={d.entier ? 'numeric' : 'decimal'}
                      value={v ?? ''} onChange={(e) => poser(d.cle, e.target.value)}
                      className="h-9 text-right" aria-label={d.libelle}
                    />
                    <span className="w-6 shrink-0 text-xs text-muted-foreground">{d.unite}</span>
                  </div>
                </div>
              )
            })}

            <div className={cn('grid gap-2 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_170px] sm:items-start', valeurs.typeToit === lecture.typeToit.valeur && aVerifier(lecture.typeToit) && 'bg-amber-50/60')}>
              <div className="min-w-0">
                <p className="text-sm font-medium">Type de toiture</p>
                {lecture.typeToit.valeur === null
                  ? <p className="mt-0.5 text-xs text-muted-foreground">Non lu sur les plans.</p>
                  : <Provenance g={lecture.typeToit} noms={noms} />}
                {lecture.typeToit.remarque && <p className="mt-0.5 text-xs text-muted-foreground">{lecture.typeToit.remarque}</p>}
              </div>
              <Select value={valeurs.typeToit ?? ''} onChange={(e) => setValeurs((v) => ({ ...v, typeToit: (e.target.value || null) as RoofType | null }))} className="h-9 text-sm">
                <option value="">Non précisé</option>
                {(Object.keys(LIBELLES_TOIT) as RoofType[]).map((t) => <option key={t} value={t}>{LIBELLES_TOIT[t]}</option>)}
              </Select>
            </div>

            {lecture.typologies.valeur && (
              <div className={cn('px-5 py-3', aVerifier(lecture.typologies) && 'bg-amber-50/60')}>
                <p className="text-sm font-medium">Typologies</p>
                <p className="mt-0.5 text-sm">
                  {Object.entries(lecture.typologies.valeur).sort(([a], [b]) => Number(a) - Number(b)).map(([k, n]) => `${n} × ${k} pièces`).join(' · ')}
                </p>
                <Provenance g={lecture.typologies} noms={noms} />
                {lecture.typologies.remarque && <p className="mt-0.5 text-xs text-muted-foreground">{lecture.typologies.remarque}</p>}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {(pourInformation.length > 0 || lecture.facadesParOrientation.length > 0) && (
        <Card className="overflow-hidden">
          <CardHeader className="space-y-0 border-b border-black/[0.06] px-5 py-3.5">
            <CardTitle className="text-base">Lu aussi, pour information</CardTitle>
            <p className="mt-0.5 text-sm text-muted-foreground">Le dossier n’a pas de champ pour ces mesures ; elles aident à vérifier les autres.</p>
          </CardHeader>
          <CardContent className="divide-y divide-black/[0.05] p-0">
            {pourInformation.map((d) => {
              const g = lecture.grandeurs[d.cle]
              return (
                <div key={d.cle} className="px-5 py-2.5">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span>{d.libelle}</span><span className="font-medium">{g.valeur !== null && avecUnite(g.valeur, d.unite)}</span>
                  </div>
                  <Provenance g={g} noms={noms} />
                </div>
              )
            })}
            {lecture.facadesParOrientation.map((f, i) => (
              <div key={`${f.orientation}-${i}`} className="px-5 py-2.5">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span>Façade {f.orientation.toLowerCase()}</span><span className="font-medium">{f.valeur !== null && avecUnite(f.valeur, 'm²')}</span>
                </div>
                <Provenance g={f} noms={noms} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {lecture.pages.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader className="space-y-0 border-b border-black/[0.06] px-5 py-3.5">
            <CardTitle className="text-base">Pages lues</CardTitle>
            <p className="mt-0.5 text-sm text-muted-foreground">
              L’échelle imprimée n’étalonne pas les plans : dans l’onglet Plans du dossier, tracez une cote connue pour mesurer dessus.
            </p>
          </CardHeader>
          <CardContent className="divide-y divide-black/[0.05] p-0">
            {lecture.pages.map((pg, i) => (
              <div key={`${pg.page}-${i}`} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-5 py-2.5 text-sm">
                <span className="min-w-0">
                  {[pg.titre, pg.type].filter(Boolean).join(' · ') || 'Page'}
                  <span className="ml-2 text-xs text-muted-foreground">{lieuDeLaPage(pg.page, noms)}</span>
                </span>
                <span className={cn('shrink-0 text-xs', pg.echelle ? 'font-medium' : 'text-muted-foreground')}>{pg.echelle ?? 'échelle non indiquée'}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {nbChamps
            ? `${nbChamps} champ${nbChamps > 1 ? 's' : ''} du dossier rempli${nbChamps > 1 ? 's' : ''} depuis les plans. Les plans seront rangés dans le dossier.`
            : 'Aucune mesure retenue : vous les saisirez à l’étape suivante. Les plans seront rangés dans le dossier.'}
        </p>
        <Button onClick={valider}>
          Continuer avec ces mesures<ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
