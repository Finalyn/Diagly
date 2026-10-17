/**
 * Le dépôt d'un jeu de plans, en tête de la page Métrés.
 *
 * On lâche ses fichiers (PDF ou images) sur la zone ; une petite fenêtre
 * demande pour quel bâtiment : un nouveau, créé tout de suite sous un nom
 * provisoire tiré du nom de fichier (le cartouche le complétera), ou un
 * dossier existant. Le dossier se crée par la même route que le formulaire
 * de création, avec son diagnostic ; les fichiers partent comme plans du
 * dossier, par la route des plans ; puis l'espace de travail s'ouvre, et
 * l'analyse de tout le jeu démarre d'elle-même.
 *
 * Un plan papier se scanne (ScannerPlans) : le PDF obtenu, une page à la
 * taille de chaque feuille, prend ensuite exactement le même chemin.
 */
import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, FileText, Image as ImageIcon, Loader2, Plus, ScanLine, Search, Upload, X } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'
import { nomProvisoire } from '@/lib/plans/feuilles'
import { MarqueDiagly } from '@/components/plans/AnalyseIA'
import { ScannerPlans } from '@/components/metres/ScannerPlans'

const FICHIERS_ADMIS = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
const TAILLE_MAX = 30 * 1024 * 1024

function formatTaille(octets: number): string {
  if (octets < 1024 * 1024) return `${Math.max(1, Math.round(octets / 1024))} Ko`
  return `${(octets / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`
}

const sansAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function DepotPlans() {
  const champ = useRef<HTMLInputElement>(null)
  const [survol, setSurvol] = useState(false)
  const [fichiers, setFichiers] = useState<File[] | null>(null)
  const [refuses, setRefuses] = useState<string[]>([])
  const [scanner, setScanner] = useState(false)

  const recevoir = (liste: FileList | null) => {
    if (!liste?.length) return
    const tous = Array.from(liste)
    const admis = tous.filter((f) => FICHIERS_ADMIS.includes(f.type) && f.size <= TAILLE_MAX)
    setRefuses(tous.filter((f) => !admis.includes(f)).map((f) => f.name))
    if (admis.length) setFichiers(admis)
    if (champ.current) champ.current.value = ''
  }

  return (
    <>
      <div
        onDragOver={(e) => { e.preventDefault(); setSurvol(true) }}
        onDragLeave={() => setSurvol(false)}
        onDrop={(e) => { e.preventDefault(); setSurvol(false); recevoir(e.dataTransfer.files) }}
        className={cn('flex flex-col items-center justify-center gap-3 rounded-[24px] border-2 border-dashed bg-white/70 px-6 py-10 text-center transition-colors sm:py-14',
          survol ? 'border-blue-500 bg-blue-50/70' : 'border-black/15')}
        data-visite="metres-depot"
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-blue-600">
          <Upload className="h-6 w-6" strokeWidth={1.8} />
        </span>
        <div>
          <p className="text-[19px] font-semibold tracking-tight text-foreground sm:text-[22px]">Déposez vos plans (PDF ou images) : l’IA mesure tout</p>
          <p className="mx-auto mt-1.5 max-w-xl text-sm text-muted-foreground">
            Chaque feuille est lue : numéro, étage, échelle, façades, fenêtres, pièces, éléments comptés.
            Vous validez ce qu’elle propose, et les quantités s’additionnent, étages types compris.
          </p>
        </div>
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          <button
            onClick={() => champ.current?.click()}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />Choisir des fichiers
          </button>
          <button
            onClick={() => setScanner(true)}
            data-visite="metres-scanner"
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-black/15 bg-white px-5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          >
            <ScanLine className="h-4 w-4" />Scanner un plan
          </button>
        </div>
        <p className="text-xs text-muted-foreground">PDF vectoriels de préférence · 30 Mo au plus par fichier</p>
        <p className="max-w-lg text-xs text-muted-foreground">
          Plan papier : scannez-le bien à plat, de face et bien éclairé. Sans traits vectoriels, l’accrochage n’y existe pas : les zones s’y placent à l’œil.
        </p>
        <input ref={champ} type="file" multiple accept="application/pdf,image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => recevoir(e.target.files)} />
        {refuses.length > 0 && (
          <p className="text-xs text-red-700">
            Refusé{refuses.length > 1 ? 's' : ''} (PDF ou image, 30 Mo au plus) : {refuses.join(', ')}
          </p>
        )}
      </div>

      {fichiers && <ChoixDuBatiment fichiers={fichiers} onFermer={() => setFichiers(null)} />}
      {scanner && (
        <ScannerPlans
          onFichier={(f) => { setScanner(false); setRefuses([]); setFichiers([f]) }}
          onFermer={() => setScanner(false)}
        />
      )}
    </>
  )
}

/** Pour quel bâtiment ? Un nouveau, ou un dossier existant. */
function ChoixDuBatiment({ fichiers, onFermer }: { fichiers: File[]; onFermer: () => void }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<'nouveau' | 'existant'>('nouveau')
  const [nom, setNom] = useState(() => nomProvisoire(fichiers[0].name))
  const [recherche, setRecherche] = useState('')
  const [choisi, setChoisi] = useState<string | null>(null)
  const [progression, setProgression] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  const projets = useQuery({ queryKey: ['projects'], queryFn: () => api.projects.list() })
  const filtres = useMemo(() => {
    const q = sansAccents(recherche.trim())
    const liste = projets.data?.projects ?? []
    return (q ? liste.filter((p) => sansAccents(`${p.name} ${p.address} ${p.city}`).includes(q)) : liste).slice(0, 50)
  }, [projets.data, recherche])

  const pret = mode === 'nouveau' ? nom.trim().length > 0 : !!choisi
  const enCours = progression !== null

  const deposer = async () => {
    setErreur(null)
    try {
      let projectId = choisi
      if (mode === 'nouveau') {
        setProgression('Création du dossier…')
        // Les réglages par défaut du formulaire de création ; l'adresse reste
        // vide, le cartouche la donnera.
        const { project } = await api.projects.create({
          name: nom.trim(), address: '', city: '', canton: 'VD', buildingType: 'LOGEMENT',
          floorHeight: 2.7, nbStaircases: 1, honoraryPct: 12, reservePct: 5, windowPct: 30,
        })
        await api.projects.createDiagnostic(project.id, {})
        projectId = project.id
        void queryClient.invalidateQueries({ queryKey: ['projects'] })
      }
      if (!projectId) return
      let manquants = 0
      for (const [i, f] of fichiers.entries()) {
        setProgression(`Envoi des plans ${i + 1}/${fichiers.length}…`)
        try { await api.plans.upload(projectId, f) } catch { manquants++ }
      }
      if (manquants === fichiers.length) throw new Error('Aucun plan n’a pu être envoyé. Réessayez.')
      void queryClient.invalidateQueries({ queryKey: ['plans', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['metres'] })
      navigate(`/app/metres/${projectId}`, { state: { analyserTout: true, plansManquants: manquants } })
    } catch (e) {
      setErreur(e instanceof ApiError || e instanceof Error ? e.message : 'Le dépôt a échoué.')
      setProgression(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 pb-[calc(var(--safe-bottom)+1rem)] pl-[calc(var(--safe-left)+1rem)] pr-[calc(var(--safe-right)+1rem)] pt-[calc(var(--safe-top)+1rem)]"
      onClick={enCours ? undefined : onFermer}
    >
      <div className="flex max-h-full w-full max-w-lg flex-col rounded-2xl border bg-background p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center gap-2.5">
          <MarqueDiagly className="h-6 w-6" />
          <h3 className="min-w-0 flex-1 text-lg font-semibold">Pour quel bâtiment ?</h3>
          {!enCours && <button onClick={onFermer} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted" title="Fermer"><X className="h-4 w-4" /></button>}
        </div>
        <p className="mb-3 text-sm text-muted-foreground">Un métré concerne toujours un bâtiment : ses plans rejoignent son dossier.</p>

        <ul className="mb-3 max-h-28 space-y-1 overflow-y-auto rounded-xl border bg-muted/30 p-2 text-xs">
          {fichiers.map((f) => (
            <li key={`${f.name}-${f.size}`} className="flex items-center gap-2">
              {f.type === 'application/pdf' ? <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ImageIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">{formatTaille(f.size)}</span>
            </li>
          ))}
        </ul>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
          <Option actif={mode === 'nouveau'} onClick={() => setMode('nouveau')} titre="Nouveau bâtiment" detail="Le dossier se crée tout de suite ; le nom et l’adresse lus au cartouche le compléteront.">
            {mode === 'nouveau' && (
              <input
                value={nom} onChange={(e) => setNom(e.target.value)} maxLength={255} autoFocus
                aria-label="Nom du bâtiment"
                className="mt-2 h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            )}
          </Option>
          <Option actif={mode === 'existant'} onClick={() => setMode('existant')} titre="Dossier existant" detail="Les plans s’ajoutent à ceux du dossier.">
            {mode === 'existant' && (
              <div className="mt-2">
                <label className="flex h-10 items-center gap-2 rounded-lg border bg-background px-3 focus-within:ring-2 focus-within:ring-primary">
                  <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Nom, adresse, localité" className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none" />
                </label>
                <ul className="mt-2 max-h-52 space-y-1 overflow-y-auto">
                  {projets.isLoading && <li className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Chargement…</li>}
                  {!projets.isLoading && filtres.length === 0 && <li className="px-2 py-2 text-xs text-muted-foreground">Aucun dossier ne correspond.</li>}
                  {filtres.map((p) => (
                    <li key={p.id}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setChoisi(p.id) }}
                        className={cn('flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors',
                          choisi === p.id ? 'bg-foreground text-background' : 'hover:bg-muted')}
                      >
                        <Building2 className="h-4 w-4 shrink-0 opacity-60" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{p.name}</span>
                          <span className={cn('block truncate text-xs', choisi === p.id ? 'text-background/70' : 'text-muted-foreground')}>
                            {[p.address, p.city].filter(Boolean).join(', ') || 'Adresse non renseignée'}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Option>
        </div>

        {erreur && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</p>}

        <div className="mt-4 flex gap-2">
          <button onClick={onFermer} disabled={enCours} className="h-11 flex-1 rounded-lg border text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50">Annuler</button>
          <button
            onClick={() => void deposer()}
            disabled={!pret || enCours}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {enCours ? <><Loader2 className="h-4 w-4 animate-spin" />{progression}</> : `Déposer ${fichiers.length > 1 ? `les ${fichiers.length} fichiers` : 'le fichier'}`}
          </button>
        </div>
      </div>
    </div>
  )
}

function Option({ actif, onClick, titre, detail, children }: {
  actif: boolean; onClick: () => void; titre: string; detail: string; children?: React.ReactNode
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) onClick() }}
      className={cn('cursor-pointer rounded-xl border px-3 py-2.5 transition-colors', actif ? 'border-foreground bg-muted/40' : 'hover:bg-muted/30')}
    >
      <div className="flex items-start gap-2.5">
        <span className={cn('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border', actif && 'border-foreground')}>
          {actif && <span className="h-2 w-2 rounded-full bg-foreground" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{titre}</span>
          <span className="block text-xs text-muted-foreground">{detail}</span>
        </span>
      </div>
      {children}
    </div>
  )
}
