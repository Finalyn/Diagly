import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft, ArrowUp, Building2, Check, ImagePlus, Loader2, MessageSquarePlus,
  PanelLeftClose, PanelLeftOpen, Paperclip, Search, Sparkles, Trash2, X,
} from 'lucide-react'
import { Button, Input } from '@/components/ui'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/stores/auth'
import {
  lireConversations, ecrireConversations, nouvelleConversation, titreDepuis,
  type Conversation, type MessageChat,
} from '@/lib/conversations'
import { cn } from '@/lib/utils'

const SUGGESTIONS = [
  'Résume ce diagnostic en cinq lignes',
  'Quels travaux sont prioritaires, et pourquoi ?',
  'Explique le CFC 221 à un propriétaire',
  'Rédige le message d’envoi du rapport au client',
]

/** Quatre photos par message : au delà, la réponse se dilue et la facture monte. */
const PHOTOS_MAX = 4
const POIDS_MAX = 6 * 1024 * 1024

/**
 * L'assistant, en page pleine.
 *
 * Il était un panneau flottant posé sur l'application : il en cachait une
 * partie, se refermait au moindre clic à côté, et ne gardait rien d'une
 * question à l'autre. Une conversation se mène sur son propre écran, avec ce
 * qu'on lui a déjà dit sous les yeux.
 *
 * Deux choses s'y attachent, et ce sont elles qui le rendent utile ici plutôt
 * que dans n'importe quel chat : des diagnostics, dont le contenu part avec la
 * question, et des photos, que le modèle regarde.
 */
export function AssistantPage() {
  const [parametres] = useSearchParams()
  const navigate = useNavigate()
  const prenom = useAuth((s) => s.user?.firstName)

  const [conversations, setConversations] = useState<Conversation[]>(() => lireConversations())
  const [courante, setCourante] = useState<Conversation>(() => lireConversations()[0] ?? nouvelleConversation())
  const [saisie, setSaisie] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [listeOuverte, setListeOuverte] = useState(true)
  const [choixDossier, setChoixDossier] = useState(false)

  const champFichier = useRef<HTMLInputElement>(null)
  const filRef = useRef<HTMLDivElement>(null)
  const saisieRef = useRef<HTMLTextAreaElement>(null)

  // Un diagnostic ouvert quand on arrive se rattache de lui-même : c'est de lui
  // qu'on veut parler neuf fois sur dix.
  const depuis = parametres.get('projet')
  useEffect(() => {
    if (!depuis) return
    setCourante((c) => (c.diagnostics.includes(depuis) ? c : { ...c, diagnostics: [...c.diagnostics, depuis] }))
  }, [depuis])

  useEffect(() => {
    filRef.current?.scrollTo({ top: filRef.current.scrollHeight, behavior: 'smooth' })
  }, [courante.messages, enCours])

  const enregistrer = (maj: Conversation) => {
    setCourante(maj)
    setConversations((liste) => {
      const suite = [maj, ...liste.filter((c) => c.id !== maj.id)]
      ecrireConversations(suite)
      return suite.sort((a, b) => b.modifieeLe - a.modifieeLe)
    })
  }

  const envoyer = async (texte: string) => {
    const contenu = texte.trim()
    if ((!contenu && photos.length === 0) || enCours) return
    setErreur(null)
    const message: MessageChat = { role: 'user', content: contenu || 'Que montre cette photo ?', images: photos.length ? photos : undefined }
    const avecQuestion: Conversation = {
      ...courante,
      titre: courante.messages.length === 0 ? titreDepuis(message.content) : courante.titre,
      modifieeLe: Date.now(),
      messages: [...courante.messages, message],
    }
    enregistrer(avecQuestion)
    setSaisie('')
    setPhotos([])
    setEnCours(true)
    try {
      const r = await api.assistant.chat({
        messages: avecQuestion.messages.map((m) => ({ role: m.role, content: m.content, images: m.images })),
        projectIds: avecQuestion.diagnostics,
      })
      enregistrer({
        ...avecQuestion,
        modifieeLe: Date.now(),
        messages: [...avecQuestion.messages, { role: 'assistant', content: r.reply }],
      })
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'L’assistant est momentanément indisponible.')
    } finally {
      setEnCours(false)
    }
  }

  const ajouterPhotos = (fichiers: FileList | null) => {
    if (!fichiers) return
    setErreur(null)
    const place = PHOTOS_MAX - photos.length
    for (const f of Array.from(fichiers).slice(0, Math.max(0, place))) {
      if (!f.type.startsWith('image/')) { setErreur('Seules les images peuvent être jointes.'); continue }
      if (f.size > POIDS_MAX) { setErreur(`« ${f.name} » dépasse 6 Mo.`); continue }
      const lecteur = new FileReader()
      lecteur.onload = () => setPhotos((p) => (p.length >= PHOTOS_MAX ? p : [...p, String(lecteur.result)]))
      lecteur.readAsDataURL(f)
    }
    if (champFichier.current) champFichier.current.value = ''
  }

  const ouvrir = (c: Conversation) => { setCourante(c); setPhotos([]); setErreur(null) }
  const demarrer = () => { const n = nouvelleConversation(); setCourante(n); setPhotos([]); setErreur(null); saisieRef.current?.focus() }
  const supprimer = (id: string) => {
    const reste = conversations.filter((c) => c.id !== id)
    ecrireConversations(reste)
    setConversations(reste)
    if (courante.id === id) setCourante(reste[0] ?? nouvelleConversation())
  }

  const vide = courante.messages.length === 0

  return (
    <div className="flex h-[calc(100dvh-7rem)] gap-3">
      {listeOuverte && (
        <ListeConversations
          conversations={conversations}
          courante={courante.id}
          onOuvrir={ouvrir}
          onSupprimer={supprimer}
          onNouvelle={demarrer}
        />
      )}

      <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <header className="flex shrink-0 items-center gap-2 border-b px-3 py-2.5">
          {/* La barre du bas est masquée sur cet écran : sans cette flèche, on
              ne ressortirait pas de la conversation au téléphone. */}
          <button
            onClick={() => navigate(-1)}
            title="Revenir"
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted lg:hidden"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setListeOuverte((o) => !o)}
            title={listeOuverte ? 'Masquer les conversations' : 'Afficher les conversations'}
            className="hidden rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted lg:block"
          >
            {listeOuverte ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </button>
          <p className="min-w-0 flex-1 truncate text-sm font-semibold">{courante.titre}</p>
          <Button variant="outline" size="sm" onClick={() => setChoixDossier(true)}>
            <Paperclip className="mr-2 h-3.5 w-3.5" />
            {courante.diagnostics.length > 0 ? `${courante.diagnostics.length} diagnostic${courante.diagnostics.length > 1 ? 's' : ''}` : 'Rattacher un diagnostic'}
          </Button>
        </header>

        {courante.diagnostics.length > 0 && (
          <DossiersRattaches
            ids={courante.diagnostics}
            onRetirer={(id) => enregistrer({ ...courante, diagnostics: courante.diagnostics.filter((x) => x !== id), modifieeLe: Date.now() })}
          />
        )}

        <div ref={filRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          {vide ? (
            <Accueil prenom={prenom ?? undefined} onChoisir={(s) => { setSaisie(s); saisieRef.current?.focus() }} />
          ) : (
            <div className="mx-auto max-w-3xl space-y-5">
              {courante.messages.map((m, i) => <Bulle key={i} message={m} />)}
              {enCours && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />L’assistant réfléchit…
                </div>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t px-4 py-3 sm:px-6">
          <div className="mx-auto max-w-3xl">
            {erreur && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</p>}

            {photos.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {photos.map((src, i) => (
                  <div key={i} className="relative">
                    <img src={src} alt="" className="h-16 w-16 rounded-lg border object-cover" />
                    <button
                      onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                      title="Retirer la photo"
                      className="absolute -right-1.5 -top-1.5 rounded-full bg-neutral-900 p-0.5 text-white shadow"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-end gap-2 rounded-2xl border bg-background p-2 focus-within:ring-2 focus-within:ring-ring">
              <button
                onClick={() => champFichier.current?.click()}
                disabled={photos.length >= PHOTOS_MAX}
                title={photos.length >= PHOTOS_MAX ? `${PHOTOS_MAX} photos au maximum` : 'Joindre une photo'}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
              >
                <ImagePlus className="h-5 w-5" />
              </button>
              <input ref={champFichier} type="file" accept="image/*" multiple className="hidden" onChange={(e) => ajouterPhotos(e.target.files)} />
              <textarea
                ref={saisieRef}
                value={saisie}
                onChange={(e) => setSaisie(e.target.value)}
                onKeyDown={(e) => {
                  // Entrée envoie, Maj+Entrée passe à la ligne : c'est l'usage
                  // de tous les messageries, et le pouce le sait déjà.
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void envoyer(saisie) }
                }}
                rows={1}
                placeholder="Posez votre question, ou déposez une photo…"
                className="max-h-40 min-h-[2.5rem] flex-1 resize-none bg-transparent py-2 text-[15px] outline-none placeholder:text-muted-foreground"
              />
              <button
                onClick={() => void envoyer(saisie)}
                disabled={enCours || (!saisie.trim() && photos.length === 0)}
                title="Envoyer"
                className="rounded-xl bg-blue-600 p-2 text-white transition-colors hover:bg-blue-700 disabled:opacity-30"
              >
                <ArrowUp className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
              L’assistant lit les diagnostics rattachés. Ses estimations restent à vérifier sur place.
            </p>
          </div>
        </div>
      </section>

      {choixDossier && (
        <ChoixDiagnostics
          choisis={courante.diagnostics}
          onFermer={() => setChoixDossier(false)}
          onBasculer={(id) => enregistrer({
            ...courante,
            modifieeLe: Date.now(),
            diagnostics: courante.diagnostics.includes(id)
              ? courante.diagnostics.filter((x) => x !== id)
              : [...courante.diagnostics, id],
          })}
        />
      )}
    </div>
  )
}

// ------------------------------------------------------------------ la liste

function ListeConversations({ conversations, courante, onOuvrir, onSupprimer, onNouvelle }: {
  conversations: Conversation[]
  courante: string
  onOuvrir: (c: Conversation) => void
  onSupprimer: (id: string) => void
  onNouvelle: () => void
}) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] lg:flex">
      <div className="p-3">
        <Button variant="outline" className="w-full justify-start" onClick={onNouvelle}>
          <MessageSquarePlus className="mr-2 h-4 w-4" />Nouvelle conversation
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {conversations.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            Vos conversations s’empileront ici.
          </p>
        ) : (
          conversations.map((c) => (
            <div
              key={c.id}
              className={cn('group flex items-center gap-1 rounded-xl px-2 transition-colors',
                c.id === courante ? 'bg-blue-50' : 'hover:bg-black/[0.03]')}
            >
              <button onClick={() => onOuvrir(c)} className="min-w-0 flex-1 py-2.5 text-left">
                <p className={cn('truncate text-sm', c.id === courante ? 'font-semibold text-blue-700' : 'text-neutral-700')}>{c.titre}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {new Date(c.modifieeLe).toLocaleDateString('fr-CH')}
                  {c.diagnostics.length > 0 && ` · ${c.diagnostics.length} diagnostic${c.diagnostics.length > 1 ? 's' : ''}`}
                </p>
              </button>
              <button
                onClick={() => onSupprimer(c.id)}
                title="Supprimer la conversation"
                className="shrink-0 rounded-lg p-1.5 text-muted-foreground opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </aside>
  )
}

// ------------------------------------------------------------ la conversation

function Accueil({ prenom, onChoisir }: { prenom?: string; onChoisir: (s: string) => void }) {
  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
        <Sparkles className="h-7 w-7" strokeWidth={1.8} />
      </span>
      <h1 className="mt-4 text-xl font-bold">
        {prenom ? `Bonjour ${prenom}` : 'Bonjour'}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Rattachez un diagnostic et posez votre question. Vous pouvez aussi joindre une photo prise sur place.
      </p>
      <div className="mt-6 grid w-full gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onChoisir(s)}
            className="rounded-xl border border-black/[0.06] px-4 py-3 text-left text-sm text-neutral-700 transition-colors hover:bg-muted/50"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

function Bulle({ message }: { message: MessageChat }) {
  const deMoi = message.role === 'user'
  return (
    <div className={cn('flex', deMoi ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[85%] rounded-2xl px-4 py-3', deMoi ? 'bg-blue-600 text-white' : 'bg-muted/60 text-neutral-800')}>
        {message.images && message.images.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {message.images.map((src, i) => <img key={i} src={src} alt="" className="h-28 w-28 rounded-lg object-cover" />)}
          </div>
        )}
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{message.content}</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------- les diagnostics

function DossiersRattaches({ ids, onRetirer }: { ids: string[]; onRetirer: (id: string) => void }) {
  const projets = useQuery({ queryKey: ['projects'], queryFn: () => api.projects.list() })
  const parId = useMemo(
    () => new Map((projets.data?.projects ?? []).map((p) => [p.id, p.name])),
    [projets.data],
  )
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-blue-50/40 px-4 py-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">Rattachés</span>
      {ids.map((id) => (
        <span key={id} className="flex items-center gap-1.5 rounded-lg bg-white px-2 py-1 text-xs shadow-sm">
          <Building2 className="h-3 w-3 text-blue-600" />
          <span className="max-w-[16rem] truncate">{parId.get(id) ?? 'Diagnostic'}</span>
          <button onClick={() => onRetirer(id)} title="Détacher" className="text-muted-foreground hover:text-foreground">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  )
}

function ChoixDiagnostics({ choisis, onFermer, onBasculer }: {
  choisis: string[]
  onFermer: () => void
  onBasculer: (id: string) => void
}) {
  const [recherche, setRecherche] = useState('')
  const projets = useQuery({ queryKey: ['projects'], queryFn: () => api.projects.list() })
  const q = recherche.trim().toLowerCase()
  const liste = (projets.data?.projects ?? []).filter(
    (p) => !q || p.name.toLowerCase().includes(q) || (p.address ?? '').toLowerCase().includes(q),
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-neutral-900/50" onClick={onFermer} />
      <div className="relative flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-xl">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <p className="flex-1 font-semibold">Rattacher des diagnostics</p>
          <button onClick={onFermer} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="border-b p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Chercher un diagnostic…" className="pl-9" />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Le premier rattaché est lu en détail, les suivants en résumé.
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {projets.isLoading ? (
            <div className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : liste.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Aucun diagnostic trouvé.</p>
          ) : (
            <div className="divide-y">
              {liste.map((p) => {
                const pris = choisis.includes(p.id)
                return (
                  <button key={p.id} onClick={() => onBasculer(p.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40">
                    <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-md border', pris ? 'border-blue-600 bg-blue-600 text-white' : 'border-neutral-300')}>
                      {pris && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{[p.address, p.city].filter(Boolean).join(', ') || 'Sans adresse'}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
        <div className="border-t p-3">
          <Button className="w-full" onClick={onFermer}>Terminé</Button>
        </div>
      </div>
    </div>
  )
}
