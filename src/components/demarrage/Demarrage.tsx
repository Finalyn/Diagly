/**
 * Les trois façons de commencer un diagnostic, et la relecture d'un fichier lu
 * par l'IA.
 *
 * Partir de zéro reste le chemin de toujours : l'adresse, puis les registres
 * fédéraux. Les deux autres partent d'un fichier : un document quelconque
 * (ancien rapport, relevé Excel, état des lieux Word ou PDF) ou un certificat
 * énergétique CECB. L'IA en tire le bâtiment et les éléments ; rien n'est
 * créé avant que le diagnostiqueur ait relu, corrigé un article, un état, ou
 * décoché ce qu'il ne veut pas reprendre.
 */
import { useMemo, useRef, useState } from 'react'
import { PenLine, FileText, Zap, Upload, Loader2, AlertCircle, ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle, Select } from '@/components/ui'
import { api, ApiError } from '@/lib/api'
import { useBaseCfc } from '@/lib/base-cfc/requete'
import { buildingTypeLabels } from '@/data/mock'
import { cn } from '@/lib/utils'
import type { ApiBaseCfc, BatimentLu, ElementState, LectureCecb, LectureDocument } from '@/lib/api-types'
import { lettreDeClasse, type ImportPret, type SourceImport } from '@/lib/demarrage'
import { MENTION_CECB } from '@/lib/marque-cecb'

export type Depart = 'zero' | SourceImport

// ---------------------------------------------------------------- choix

const CHOIX: { id: Depart; icone: typeof PenLine; titre: string; texte: string; detail: string }[] = [
  {
    id: 'zero', icone: PenLine, titre: 'Partir de zéro',
    texte: 'Saisissez l’adresse : les registres fédéraux remplissent l’année, les surfaces et les étages.',
    detail: 'Le relevé se fait ensuite sur place, étape par étape.',
  },
  {
    id: 'document', icone: FileText, titre: 'Importer un document',
    texte: 'Un ancien rapport, un relevé Excel, un état des lieux Word ou PDF.',
    detail: 'Le bâtiment et les éléments décrits sont repris, avec leur état, pour être vérifiés sur place.',
  },
  {
    id: 'cecb', icone: Zap, titre: 'Partir d’un certificat énergétique',
    texte: 'Le certificat énergétique cantonal (CECB®) du bâtiment, en PDF.',
    detail: 'Le bâtiment, l’étiquette énergétique et les éléments visés par les mesures recommandées.',
  },
]

export function ChoixDepart({ onChoisir }: { onChoisir: (d: Depart) => void }) {
  return (
    <div className="space-y-3">
      {/* Sur iPad debout (« tablette »), les trois départs s'empilent : côte à
          côte, à côté du menu, leurs textes tenaient sur des colonnes étroites. */}
      <div className="grid gap-3 md:grid-cols-3 tablette:grid-cols-1" data-visite="creation-departs">
        {CHOIX.map((c) => (
          <button
            key={c.id}
            data-visite={`depart-${c.id}`}
            onClick={() => onChoisir(c.id)}
            className="group flex flex-col rounded-2xl border border-black/[0.08] bg-card p-5 text-left transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_14px_40px_-16px_rgba(0,0,0,0.18)]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-900/[0.04] text-muted-foreground transition-colors group-hover:bg-blue-50 group-hover:text-blue-600">
              <c.icone className="h-5 w-5" strokeWidth={1.6} />
            </span>
            <span className="mt-4 text-base font-semibold">{c.titre}</span>
            <span className="mt-1 text-sm text-muted-foreground">{c.texte}</span>
            <span className="mt-3 border-t border-black/[0.06] pt-3 text-xs text-muted-foreground">{c.detail}</span>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
              {c.id === 'zero' ? 'Commencer' : 'Choisir le fichier'}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </button>
        ))}
      </div>
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <img src="/diagly-mark.svg" alt="" className="h-3.5 w-3.5" />
        Les fichiers sont lus par l’assistant Diagly. Vous relisez tout avant que le diagnostic soit créé.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------- import

type Lecture =
  | { source: 'document'; fichier: string; data: LectureDocument }
  | { source: 'cecb'; fichier: string; data: LectureCecb }

export function ImportFichier({ source, onRetour, onPret }: { source: SourceImport; onRetour: () => void; onPret: (imp: ImportPret) => void }) {
  const [lecture, setLecture] = useState<Lecture | null>(null)
  const [enCours, setEnCours] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [survol, setSurvol] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const lire = async (file: File) => {
    setErreur(null); setEnCours(file.name)
    try {
      if (source === 'cecb') {
        const r = await api.demarrage.cecb(file)
        if (!r.configured) throw new Error('La lecture par l’assistant n’est pas activée sur ce serveur.')
        if (!r.lecture) throw new Error('Le certificat n’a pas pu être lu. Vérifiez qu’il s’agit d’un PDF lisible, et non d’un scan flou.')
        if (!r.lecture.estUnCertificat) throw new Error('Ce PDF ne ressemble pas à un certificat énergétique.')
        setLecture({ source: 'cecb', fichier: file.name, data: r.lecture })
      } else {
        const r = await api.demarrage.document(file)
        if (!r.configured) throw new Error('La lecture par l’assistant n’est pas activée sur ce serveur.')
        if (!r.lecture) throw new Error(r.tronque ? 'Le document est trop long pour être lu en une fois. Essayez avec la partie qui décrit le bâtiment.' : 'Le document n’a pas pu être lu.')
        if (!r.lecture.estUnBatiment) throw new Error('Ce document ne semble décrire aucun bâtiment.')
        setLecture({ source: 'document', fichier: file.name, data: r.lecture })
      }
    } catch (e) {
      setErreur(e instanceof ApiError || e instanceof Error ? e.message : 'Lecture impossible.')
    } finally { setEnCours(null) }
  }

  if (lecture) {
    return <Relecture lecture={lecture} onRecommencer={() => setLecture(null)} onPret={onPret} />
  }

  const accept = source === 'cecb' ? 'application/pdf,.pdf' : '.pdf,.docx,.xlsx,.xlsm,.csv,.txt'
  return (
    <Card className="overflow-hidden">
      <CardHeader className="space-y-0 border-b border-black/[0.06] px-5 py-3.5">
        <CardTitle className="text-base">{source === 'cecb' ? 'Partir d’un certificat énergétique' : 'Importer un document'}</CardTitle>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {source === 'cecb'
            ? 'Le certificat énergétique cantonal (CECB®), en PDF. Le bâtiment, l’étiquette et les mesures recommandées sont repris.'
            : 'Ancien rapport, relevé Excel, état des lieux Word ou PDF. Le bâtiment et les éléments décrits sont repris.'}
        </p>
      </CardHeader>
      <CardContent className="space-y-4 p-5">
        <div
          onDragOver={(e) => { e.preventDefault(); setSurvol(true) }}
          onDragLeave={() => setSurvol(false)}
          onDrop={(e) => { e.preventDefault(); setSurvol(false); const f = e.dataTransfer.files?.[0]; if (f && !enCours) lire(f) }}
          className={cn('flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-colors',
            survol ? 'border-blue-400 bg-blue-50/50' : 'border-black/[0.1] bg-neutral-50/50')}
        >
          {enCours ? (
            <>
              <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
              <p className="mt-3 text-sm font-medium">Lecture de « {enCours} »</p>
              <p className="mt-1 text-xs text-muted-foreground">L’assistant Diagly lit le document et le rapproche de votre base. Quelques secondes, parfois une minute.</p>
            </>
          ) : (
            <>
              <Upload className="h-7 w-7 text-muted-foreground" strokeWidth={1.5} />
              <p className="mt-3 text-sm font-medium">Déposez le fichier ici</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {source === 'cecb' ? 'PDF, 12 Mo au plus' : 'PDF, Word (.docx), Excel (.xlsx), CSV. 12 Mo au plus.'}
              </p>
              <Button variant="outline" className="mt-4" onClick={() => input.current?.click()}>Choisir un fichier</Button>
            </>
          )}
          <input ref={input} type="file" accept={accept} className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) lire(f) }} />
        </div>
        {erreur && (
          <p className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{erreur}</p>
        )}
        {source === 'cecb' && <p className="text-[11px] leading-relaxed text-muted-foreground">{MENTION_CECB}</p>}
        <div className="flex justify-start">
          <Button variant="ghost" onClick={onRetour} disabled={!!enCours}><ArrowLeft className="h-4 w-4" />Changer de point de départ</Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------- relecture

const ETATS: { v: ElementState | ''; label: string }[] = [
  { v: '', label: 'Non évalué' }, { v: 'TRES_BON', label: 'Très bon' }, { v: 'BON', label: 'Bon' },
  { v: 'MOYEN', label: 'Moyen' }, { v: 'MAUVAIS', label: 'Mauvais' },
]

interface Ligne {
  cle: number
  source: string
  remarque: string | null
  annee: number | null
  articleId: string
  etapeNumero: number | null
  etat: ElementState | ''
  garder: boolean
  priorite?: string | null
}

function champsBatiment(b: BatimentLu): [string, string][] {
  const l: [string, string | number | null | undefined][] = [
    ['Nom', b.nom],
    ['Adresse', [b.adresse, [b.npa, b.localite].filter(Boolean).join(' '), b.canton && `(${b.canton})`].filter(Boolean).join(', ').replace(', (', ' (')],
    ['EGID', b.egid],
    ['Type', b.type ? buildingTypeLabels[b.type] : null],
    ['Construction', b.anneeConstruction],
    ['Rénovation', b.anneeRenovation],
    ['Logements', b.nbLogements],
    ['Étages', b.nbEtages],
    ['Cages d’escalier', b.nbCages],
    ['Surface de plancher', b.surfacePlancher != null ? `${b.surfacePlancher} m²` : null],
    ['Surface bâtie', b.surfaceBatie != null ? `${b.surfaceBatie} m²` : null],
    ['Terrain', b.surfaceTerrain != null ? `${b.surfaceTerrain} m²` : null],
    ['Périmètre', b.perimetre != null ? `${b.perimetre} m` : null],
  ]
  return l.filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => [k, String(v)])
}

function Relecture({ lecture, onRecommencer, onPret }: { lecture: Lecture; onRecommencer: () => void; onPret: (imp: ImportPret) => void }) {
  const baseQuery = useBaseCfc()
  const base = baseQuery.data
  const [lignes, setLignes] = useState<Ligne[]>(() => {
    if (lecture.source === 'document') {
      return lecture.data.elements.map((e, i) => ({
        cle: i, source: e.source, remarque: e.remarque, annee: e.annee,
        articleId: e.articleId ?? '', etapeNumero: e.etapeNumero, etat: e.etat ?? '', garder: !!e.articleId,
      }))
    }
    return lecture.data.mesures.map((m, i) => ({
      cle: i, source: m.label, remarque: null, annee: null, priorite: m.priorite,
      articleId: m.articleId ?? '', etapeNumero: m.etapeNumero, etat: '', garder: !!m.articleId,
    }))
  })
  const poser = (cle: number, p: Partial<Ligne>) => setLignes((l) => l.map((x) => (x.cle === cle ? { ...x, ...p } : x)))

  const articles = useMemo(() => [...(base?.articles ?? [])].filter((a) => a.actif).sort((a, b) => a.cfcCode.localeCompare(b.cfcCode, 'fr', { numeric: true })), [base])
  const retenues = lignes.filter((l) => l.garder && l.articleId && l.etapeNumero)
  const champs = champsBatiment(lecture.data.batiment)
  const confiance = lecture.data.confiance

  const valider = () => onPret({
    source: lecture.source,
    fichier: lecture.fichier,
    batiment: lecture.data.batiment,
    energie: lecture.source === 'cecb' ? lecture.data.energie : null,
    mesures: lecture.source === 'cecb' ? lecture.data.mesures.map((m) => ({ label: m.label, priorite: m.priorite })) : [],
    confiance,
    releves: retenues.map((l) => ({
      articleId: l.articleId, etapeNumero: l.etapeNumero!, etat: l.etat || null, remarque: l.remarque, annee: l.annee,
      source: l.source,
    })),
  })

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 border-b border-black/[0.06] px-5 py-3.5">
          <div className="min-w-0">
            <CardTitle className="text-base">Ce que l’assistant a lu</CardTitle>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              « {lecture.fichier} »{confiance ? ` · lecture ${confiance === 'high' ? 'sûre' : confiance === 'medium' ? 'à vérifier' : 'incertaine'}` : ''}
            </p>
          </div>
          <Button size="sm" variant="ghost" className="shrink-0" onClick={onRecommencer}><RotateCcw className="h-3.5 w-3.5" />Autre fichier</Button>
        </CardHeader>
        <CardContent className="space-y-5 p-5">
          {lecture.source === 'document' && lecture.data.resume && <p className="text-sm text-muted-foreground">{lecture.data.resume}</p>}

          <section>
            <h3 className="mb-2 text-sm font-semibold">Bâtiment</h3>
            {champs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune information sur le bâtiment. Vous la saisirez à l’étape suivante.</p>
            ) : (
              <dl className="grid gap-x-6 sm:grid-cols-2">
                {champs.map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-3 border-b border-black/[0.05] py-2 text-sm">
                    <dt className="text-muted-foreground">{k}</dt><dd className="text-right">{v}</dd>
                  </div>
                ))}
              </dl>
            )}
            <p className="mt-2 text-xs text-muted-foreground">Ces valeurs pré-remplissent le formulaire, où vous les corrigez. En y choisissant l’adresse dans la liste proposée, les registres fédéraux complètent le reste.</p>
          </section>

          {lecture.source === 'cecb' && <EtiquetteLue energie={lecture.data.energie} />}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="space-y-0 border-b border-black/[0.06] px-5 py-3.5">
          <CardTitle className="text-base">{lecture.source === 'cecb' ? 'Éléments visés par les mesures' : 'Éléments relevés'}</CardTitle>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {lecture.source === 'cecb'
              ? 'Chaque mesure recommandée désigne un élément existant. Il entre dans le diagnostic sans état, à vérifier sur place.'
              : 'Chaque élément devient un relevé du diagnostic, avec l’état indiqué par le document. Corrigez l’article ou l’état si besoin.'}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {baseQuery.isLoading ? (
            <div className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : lignes.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">Aucun élément trouvé dans le document.</p>
          ) : (
            <div className="divide-y divide-black/[0.05]">
              {lignes.map((l) => (
                <LigneElement key={l.cle} ligne={l} base={base} articles={articles} cecb={lecture.source === 'cecb'} onChange={(p) => poser(l.cle, p)} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {retenues.length
            ? `${retenues.length} relevé${retenues.length > 1 ? 's' : ''} seront créés avec le diagnostic.`
            : 'Aucun relevé ne sera créé : seul le bâtiment est repris.'}
        </p>
        <Button onClick={valider}>
          Continuer avec ces données<ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function LigneElement({ ligne: l, base, articles, cecb, onChange }: {
  ligne: Ligne; base: ApiBaseCfc | undefined; articles: ApiBaseCfc['articles']; cecb: boolean; onChange: (p: Partial<Ligne>) => void
}) {
  const article = base?.articles.find((a) => a.id === l.articleId)
  const etapes = (article?.etapes ?? []).map((e) => ({ numero: e.etapeNumero, nom: base?.etapes.find((x) => x.numero === e.etapeNumero)?.nom ?? `Étape ${e.etapeNumero}` }))
  return (
    <div className={cn('grid gap-3 px-5 py-3.5 md:grid-cols-[24px_minmax(0,1.1fr)_minmax(0,1.4fr)_150px] md:items-center', !l.garder && 'bg-neutral-50/60')}>
      <input type="checkbox" checked={l.garder} disabled={!l.articleId}
        onChange={(e) => onChange({ garder: e.target.checked })} className="h-4 w-4 accent-blue-600" aria-label="Reprendre cet élément" />
      <div className="min-w-0">
        <p className={cn('text-sm font-medium', !l.garder && 'text-muted-foreground')}>{l.source}</p>
        {(l.remarque || l.priorite) && (
          <p className="text-xs text-muted-foreground">{[l.priorite && `Priorité ${l.priorite}`, l.remarque].filter(Boolean).join(' · ')}</p>
        )}
        {!l.articleId && <p className="text-xs text-amber-700">Pas d’article correspondant : choisissez-en un pour le reprendre.</p>}
      </div>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] gap-2">
        <Select value={l.articleId} onChange={(e) => {
          const a = base?.articles.find((x) => x.id === e.target.value)
          const premiere = a?.etapes[0]?.etapeNumero ?? null
          onChange({ articleId: e.target.value, etapeNumero: a?.etapes.some((x) => x.etapeNumero === l.etapeNumero) ? l.etapeNumero : premiere, garder: !!e.target.value })
        }} className="h-9 text-xs">
          <option value="">Choisir un article…</option>
          {articles.map((a) => <option key={a.id} value={a.id}>{a.cfcCode} {a.nom}</option>)}
        </Select>
        <Select value={l.etapeNumero ?? ''} disabled={!article} onChange={(e) => onChange({ etapeNumero: Number(e.target.value) })} className="h-9 text-xs">
          {etapes.map((e) => <option key={e.numero} value={e.numero}>{e.nom}</option>)}
        </Select>
      </div>
      {cecb ? (
        <p className="text-xs text-muted-foreground md:text-right">À vérifier sur place</p>
      ) : (
        <Select value={l.etat} onChange={(e) => onChange({ etat: e.target.value as ElementState | '' })} className="h-9 text-xs">
          {ETATS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
        </Select>
      )}
    </div>
  )
}

function EtiquetteLue({ energie: e }: { energie: LectureCecb['energie'] }) {
  const lignes: [string, string | null][] = [
    ['Classe de l’enveloppe', lettreDeClasse(e.classEnvelope)],
    ['Classe globale', lettreDeClasse(e.classGlobal)],
    ['Surface de référence (SRE)', e.sre != null ? `${e.sre} m²` : null],
    ['Chauffage', e.consumptionHeat != null ? `${e.consumptionHeat} kWh/m²·an` : null],
    ['Électricité', e.consumptionElec != null ? `${e.consumptionElec} kWh/m²·an` : null],
    ['Agent énergétique', e.energyAgent ?? null],
    ['Année de référence', e.refYear != null ? String(e.refYear) : null],
    ['Date du certificat', e.dateCertificat && !Number.isNaN(new Date(e.dateCertificat).getTime()) ? new Date(e.dateCertificat).toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' }) : null],
  ]
  const presentes = lignes.filter(([, v]) => v)
  return (
    <section className="border-t border-black/[0.06] pt-5">
      <h3 className="mb-2 text-sm font-semibold">Étiquette énergétique</h3>
      {presentes.length === 0 ? <p className="text-sm text-muted-foreground">Aucune donnée énergétique lisible.</p> : (
        <dl className="grid gap-x-6 sm:grid-cols-2">
          {presentes.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-3 border-b border-black/[0.05] py-2 text-sm">
              <dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="mt-2 text-xs text-muted-foreground">Reprise dans l’onglet Étiquette énergétique du dossier.</p>
    </section>
  )
}
