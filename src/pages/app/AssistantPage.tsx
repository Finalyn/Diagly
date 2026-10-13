import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft, ArrowUp, Building2, Check, Ellipsis, ImagePlus, Loader2, MessageSquarePlus,
  PanelLeftClose, PanelLeftOpen, Paperclip, PanelLeft, Search, SquarePen, Trash2, X,
} from 'lucide-react'
import { Button, Input } from '@/components/ui'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/stores/auth'
import {
  lireConversations, ecrireConversations, nouvelleConversation, titreDepuis,
  repondreDerniereQuestion, texteDeReponse, questionPourApi,
  type Conversation, type MessageChat, type QuestionPosee, type ReponseQuestion,
} from '@/lib/conversations'
import { mouvementReduit } from '@/lib/motion'
import { analyser, type Bloc, type Segment } from '@/lib/texte-riche'
import { useEcranEtroit } from '@/lib/use-mobile'
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
  const [tiroir, setTiroir] = useState(false)
  const [choixDossier, setChoixDossier] = useState(false)
  const etroit = useEcranEtroit()

  // Le volet n'existe que sous 1024 px. Un iPad tourné à l'horizontale pendant
  // qu'il est ouvert le démonte : sans cette remise à zéro, il se rouvrirait
  // de lui-même au retour à la verticale.
  if (!etroit && tiroir) setTiroir(false)

  const champFichier = useRef<HTMLInputElement>(null)
  const filRef = useRef<HTMLDivElement>(null)
  const saisieRef = useRef<HTMLTextAreaElement>(null)
  /** Le lecteur est au bas du fil : il doit y rester si la vue change de taille. */
  const colleEnBas = useRef(true)
  /** Une descente animée vers le dernier message est en cours. */
  const descenteAuto = useRef(false)

  // Un diagnostic ouvert quand on arrive se rattache de lui-même : c'est de lui
  // qu'on veut parler neuf fois sur dix.
  const depuis = parametres.get('projet')
  useEffect(() => {
    if (!depuis) return
    setCourante((c) => (c.diagnostics.includes(depuis) ? c : { ...c, diagnostics: [...c.diagnostics, depuis] }))
  }, [depuis])

  useEffect(() => {
    const fil = filRef.current
    if (!fil) return
    colleEnBas.current = true
    descenteAuto.current = true
    fil.scrollTo({ top: fil.scrollHeight, behavior: 'smooth' })
  }, [courante.messages, enCours])

  // Quand la vue rétrécit, c'est le bas du fil qui reste en place, pas le
  // haut. Dans l'app, le clavier rétrécit la vue (Keyboard, resize: 'native') :
  // sans cela, la réponse qu'on était en train de lire passait sous la zone de
  // saisie au moment même où l'on commençait à répondre.
  useEffect(() => {
    const fil = filRef.current
    if (!fil) return
    let hauteur = fil.clientHeight
    const suivre = () => {
      const ecart = fil.scrollHeight - fil.scrollTop - fil.clientHeight
      // Les positions de passage d'une descente animée ne disent rien de ce
      // que veut le lecteur : seule compte son arrivée en bas.
      if (descenteAuto.current) { if (ecart < 2) descenteAuto.current = false; return }
      colleEnBas.current = ecart < 32
    }
    // Le doigt ou la molette reprennent la main sur une descente en cours.
    const reprendre = () => { descenteAuto.current = false }
    const observateur = new ResizeObserver(() => {
      const avant = hauteur
      hauteur = fil.clientHeight
      if (colleEnBas.current) fil.scrollTop = fil.scrollHeight
      else fil.scrollTop += avant - hauteur
    })
    fil.addEventListener('scroll', suivre, { passive: true })
    fil.addEventListener('touchstart', reprendre, { passive: true })
    fil.addEventListener('wheel', reprendre, { passive: true })
    observateur.observe(fil)
    return () => {
      fil.removeEventListener('scroll', suivre)
      fil.removeEventListener('touchstart', reprendre)
      fil.removeEventListener('wheel', reprendre)
      observateur.disconnect()
    }
  }, [])

  const enregistrer = (maj: Conversation) => {
    setCourante(maj)
    setConversations((liste) => {
      const suite = [maj, ...liste.filter((c) => c.id !== maj.id)]
      ecrireConversations(suite)
      return suite.sort((a, b) => b.modifieeLe - a.modifieeLe)
    })
  }

  /**
   * Envoie un message. `reponse` est donnée quand il vient d'une carte de
   * question ; tapé dans le champ du bas, il répond aussi à la question restée
   * ouverte, et la carte se ferme pareil (voir repondreDerniereQuestion).
   */
  const envoyer = async (texte: string, reponse?: ReponseQuestion) => {
    const contenu = texte.trim()
    // Une réponse touchée sur la carte part seule : le texte en cours de
    // frappe et les photos du champ du bas attendent leur propre envoi.
    const jointes = reponse ? [] : photos
    if ((!contenu && jointes.length === 0) || enCours) return
    setErreur(null)
    const message: MessageChat = { role: 'user', content: contenu || 'Que montre cette photo ?', images: jointes.length ? jointes : undefined }
    const avecQuestion: Conversation = {
      ...courante,
      titre: courante.messages.length === 0 ? titreDepuis(message.content) : courante.titre,
      modifieeLe: Date.now(),
      messages: [...repondreDerniereQuestion(courante.messages, message.content, reponse), message],
    }
    enregistrer(avecQuestion)
    if (!reponse) {
      setSaisie('')
      setPhotos([])
    }
    setEnCours(true)
    try {
      const r = await api.assistant.chat({
        messages: avecQuestion.messages.map((m) => ({
          role: m.role,
          content: m.content,
          images: m.images,
          question: m.question ? questionPourApi(m.question) : undefined,
        })),
        projectIds: avecQuestion.diagnostics,
        questionsAChoix: true,
      })
      enregistrer({
        ...avecQuestion,
        modifieeLe: Date.now(),
        messages: [...avecQuestion.messages, { role: 'assistant', content: r.reply, ...(r.question ? { question: r.question } : {}) }],
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
    // La page prend la hauteur que la mise en page lui laisse, et seul le fil
    // défile. Une hauteur calculée à la main (écran moins une constante) était
    // fausse dans l'app, entre la barre d'état, la barre du haut en verre et la
    // barre d'accueil : la page entière défilait et la saisie quittait le bas.
    <div className="flex h-full min-h-0 gap-3">
      {/* Sur grand écran la liste est une colonne ; au doigt elle devient un
          volet, parce que soixante-quatre pixels de large volés à la
          conversation ne laisseraient ni l'une ni l'autre lisible. */}
      {listeOuverte && (
        <div className="hidden w-64 shrink-0 lg:flex">
          <ListeConversations
            conversations={conversations}
            courante={courante.id}
            onOuvrir={ouvrir}
            onSupprimer={supprimer}
            onNouvelle={demarrer}
          />
        </div>
      )}
      {etroit && (
        <VoletConversations
          ouvert={tiroir}
          onFermer={() => setTiroir(false)}
          conversations={conversations}
          courante={courante.id}
          onOuvrir={(c) => { ouvrir(c); setTiroir(false) }}
          onSupprimer={supprimer}
          onNouvelle={() => { demarrer(); setTiroir(false) }}
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
            <ArrowLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => setTiroir(true)}
            title="Mes conversations"
            aria-label="Mes conversations"
            aria-expanded={tiroir}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted lg:hidden"
          >
            <PanelLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => setListeOuverte((o) => !o)}
            title={listeOuverte ? 'Masquer les conversations' : 'Afficher les conversations'}
            className="hidden rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted lg:block"
          >
            {listeOuverte ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </button>
          <p className="min-w-0 flex-1 truncate text-sm font-semibold">{courante.titre}</p>
          {/* Au doigt, l'étiquette tombe : le trombone et le compte suffisent,
              et le titre garde la place dont il a besoin. */}
          <Button variant="outline" size="sm" onClick={() => setChoixDossier(true)} className="shrink-0 px-2.5 sm:px-3">
            <Paperclip className="h-3.5 w-3.5 sm:mr-2" />
            <span className="hidden sm:inline">
              {courante.diagnostics.length > 0 ? `${courante.diagnostics.length} diagnostic${courante.diagnostics.length > 1 ? 's' : ''}` : 'Rattacher un diagnostic'}
            </span>
            {courante.diagnostics.length > 0 && <span className="ml-1.5 sm:hidden">{courante.diagnostics.length}</span>}
          </Button>
        </header>

        {courante.diagnostics.length > 0 && (
          <DossiersRattaches
            ids={courante.diagnostics}
            onRetirer={(id) => enregistrer({ ...courante, diagnostics: courante.diagnostics.filter((x) => x !== id), modifieeLe: Date.now() })}
          />
        )}

        {/* Le fil est teinté et les réponses sont blanches : tout blanc, les
            bulles de l'assistant se confondaient avec le fond et la
            conversation n'avait plus de relief. */}
        <div ref={filRef} className="min-h-0 flex-1 overflow-y-auto bg-neutral-50 px-3 py-5 sm:px-6">
          {vide ? (
            <Accueil prenom={prenom ?? undefined} onChoisir={(s) => { setSaisie(s); saisieRef.current?.focus() }} />
          ) : (
            <div className="mx-auto max-w-3xl space-y-4">
              {courante.messages.map((m, i) => (
                // La clé porte la conversation : sans elle, une carte à moitié
                // remplie garderait ses cases cochées en passant à une autre
                // conversation qui a une carte au même rang.
                <div key={`${courante.id}-${i}`} className="space-y-2">
                  {/* L'assistant peut n'avoir rien écrit avant sa question : pas de bulle vide. */}
                  {(m.content.trim() || !m.question) && <Bulle message={m} />}
                  {m.question && (
                    <CarteQuestion
                      question={m.question}
                      // Seule la dernière question encore sans réponse se touche.
                      active={i === courante.messages.length - 1 && !m.question.reponse && !enCours}
                      onRepondre={(r) => void envoyer(texteDeReponse(r), r)}
                    />
                  )}
                </div>
              ))}
              {enCours && (
                <div className="flex items-center gap-2 rounded-2xl border border-black/[0.06] bg-white px-4 py-3 text-sm text-muted-foreground shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />L’assistant réfléchit…
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sur téléphone, la mise en page arrête déjà la page au-dessus de la
            barre d'accueil : y ajouter ici la marge de cette barre doublait le
            vide sous le champ. Au-dessus, la carte descend près du bord et la
            garde. */}
        <div className="shrink-0 border-t bg-white px-3 py-3 sm:px-6 md:pb-[max(0.75rem,var(--safe-bottom))]">
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
                placeholder="Posez votre question…"
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
    <aside className="flex w-full flex-col overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
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

// ------------------------------------------------------------------ le volet

/** Les trois quarts d'un téléphone ; sur iPad debout, une colonne et non un demi-écran. */
const LARGEUR_VOLET = 'min(77vw, 23rem)'
const DUREE_VOLET = 280
/** Départ franc, long freinage : la courbe des volets d'iOS. */
const COURBE_VOLET = 'cubic-bezier(0.32, 0.72, 0, 1)'
const GLISSEMENT = `transform ${DUREE_VOLET}ms ${COURBE_VOLET}, border-radius ${DUREE_VOLET}ms ${COURBE_VOLET}`
/** Mouvement réduit : rien ne glisse, le volet apparaît en fondu. */
const DUREE_FONDU = 150

/** Rend à l'application sa place, une fois le volet refermé. */
/**
 * Ce que le volet pousse, et d'où il part. Sur iPad debout, menu de gauche
 * ouvert, le volet s'ouvre au bord droit du menu et ne pousse que la zone de
 * la conversation : le menu reste en place. Sans menu (téléphone, menu
 * replié), toute l'application glisse, barre du haut comprise.
 */
interface CibleDuVolet { element: HTMLElement; gauche: number }

function cibleDuVolet(): CibleDuVolet | null {
  const zone = document.querySelector<HTMLElement>('[data-zone-principale]')
  const gauche = zone ? Math.round(zone.getBoundingClientRect().left) : 0
  if (zone && gauche > 1) return { element: zone, gauche }
  const racine = document.getElementById('root')
  return racine ? { element: racine, gauche: 0 } : null
}

/**
 * Le clic qui suit un toucher, absorbé : le volet s'est déjà fermé au
 * relâcher du doigt, et ce clic tomberait sur ce qui était dessous (un bouton
 * de la conversation).
 */
function avalerLeClicSuivant() {
  const avaler = (e: Event) => { e.preventDefault(); e.stopPropagation() }
  document.addEventListener('click', avaler, { capture: true, once: true })
  window.setTimeout(() => document.removeEventListener('click', avaler, { capture: true }), 500)
}

function lacherApp(racine: HTMLElement) {
  delete racine.dataset.pousseParVolet
  racine.style.transform = ''
  racine.style.transition = ''
  racine.style.borderRadius = ''
  racine.style.overflow = ''
  racine.inert = false
}

/** Sans accents ni capitales : « electricite » trouve « Électricité ». */
const plier = (texte: string) => texte.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

interface GesteVolet {
  id: number
  x: number
  y: number
  largeur: number
  decalage: number
  tire: boolean
  dernierX: number
  dernierT: number
  vitesse: number
}

/**
 * Les conversations, au doigt : téléphone et iPad debout.
 *
 * C'est le volet des apps de chat que tout le monde a déjà en main. La
 * conversation n'est pas assombrie sous un voile : elle glisse vers la droite
 * et reste visible au bord, et c'est elle qu'on touche pour revenir. Le volet
 * ne montre que des titres, sur une ligne chacun : on y cherche une
 * conversation des yeux, et une date ou une icône par ligne ne servaient qu'à
 * ralentir la lecture.
 *
 * Pour glisser, c'est l'application entière qui bouge (#root), barre du haut
 * comprise : déplacer la seule page aurait laissé la barre du haut en place,
 * coupée en deux par le volet. Le volet est donc rendu hors de #root, et ce
 * qu'il pose sur elle est retiré dès qu'il est refermé.
 */
function VoletConversations({ ouvert, onFermer, conversations, courante, onOuvrir, onSupprimer, onNouvelle }: {
  ouvert: boolean
  onFermer: () => void
  conversations: Conversation[]
  courante: string
  onOuvrir: (c: Conversation) => void
  onSupprimer: (id: string) => void
  onNouvelle: () => void
}) {
  const [cherche, setCherche] = useState(false)
  const [filtre, setFiltre] = useState('')
  const [menu, setMenu] = useState<string | null>(null)
  const [defile, setDefile] = useState(false)

  // Chaque ouverture repart d'une liste entière, comme dans les apps de chat.
  // Remettre à zéro à la fermeture aurait changé la liste pendant qu'elle
  // sortait de l'écran.
  const [ouvertAvant, setOuvertAvant] = useState(ouvert)
  if (ouvert !== ouvertAvant) {
    setOuvertAvant(ouvert)
    if (ouvert) { setCherche(false); setFiltre(''); setMenu(null) }
  }

  const panneauRef = useRef<HTMLDivElement>(null)
  const listeRef = useRef<HTMLDivElement>(null)
  const champRecherche = useRef<HTMLInputElement>(null)
  const rangement = useRef(0)
  const retour = useRef<HTMLElement | null>(null)
  const geste = useRef<GesteVolet | null>(null)
  const appui = useRef<{ minuteur: number; x: number; y: number } | null>(null)
  /** Un glissement ou un appui long vient de finir : le clic qui suit ne compte pas. */
  const ignorerClic = useRef(false)
  const dejaPlace = useRef(false)
  /** Choisie à l'ouverture, gardée jusqu'à la fermeture (voir cibleDuVolet). */
  const cible = useRef<CibleDuVolet | null>(null)
  const bordRef = useRef<HTMLDivElement>(null)

  /**
   * Pose le volet et l'application ouverts ou fermés.
   *
   * Les styles sont écrits directement, et non rendus par React : pendant un
   * glissement, le doigt les déplace à chaque image, et React, qui croirait
   * leur valeur inchangée, ne les remettrait pas en place au relâchement.
   */
  const placer = useCallback((ouvrir: boolean, anime: boolean) => {
    const panneau = panneauRef.current
    if (!panneau) return
    if (ouvrir && !cible.current) cible.current = cibleDuVolet()
    // À la fermeture, rien n'est encore poussé au premier affichage : le volet
    // doit quand même se cacher. Exiger l'élément poussé ici le laissait
    // visible dès l'arrivée sur la page, par-dessus la conversation.
    const racine = cible.current?.element ?? null
    window.clearTimeout(rangement.current)
    const reduit = mouvementReduit()
    // Le volet part du bord de ce qu'il pousse (0, ou le bord droit du menu).
    const gauche = cible.current?.gauche ?? 0
    // Marqué pour que le suivi du doigt le retrouve dans la page.
    if (racine) racine.dataset.pousseParVolet = ''
    panneau.style.left = `${gauche}px`
    if (bordRef.current) bordRef.current.style.left = `calc(${gauche}px + ${LARGEUR_VOLET})`
    const glisse = anime && !reduit

    if (ouvrir) {
      if (!racine) return
      // Le bouton qui a ouvert le volet reprend le focus à la fermeture.
      if (!racine.inert && document.activeElement instanceof HTMLElement) retour.current = document.activeElement
      panneau.style.transition = !anime ? 'none' : reduit ? `opacity ${DUREE_FONDU}ms ease-out` : GLISSEMENT
      panneau.style.visibility = 'visible'
      panneau.style.opacity = '1'
      panneau.style.transform = 'translateX(0)'
      racine.style.transition = glisse ? GLISSEMENT : 'none'
      racine.style.transform = `translateX(${LARGEUR_VOLET})`
      racine.style.borderRadius = '2rem 0 0 2rem'
      racine.style.overflow = 'hidden'
      // Ce qui reste visible de l'application se touche pour fermer, rien de
      // plus : ni le clavier ni un lecteur d'écran n'y entrent.
      racine.inert = true
      panneau.focus({ preventScroll: true })
      // La conversation ouverte est en vue, même tout en bas de la liste. Le
      // calcul est fait à la main : scrollIntoView viserait la position du
      // volet en plein mouvement, encore hors de l'écran.
      const liste = listeRef.current
      const ligne = liste?.querySelector<HTMLElement>('[aria-current="true"]')?.parentElement
      if (liste && ligne && (ligne.offsetTop < liste.scrollTop || ligne.offsetTop + ligne.offsetHeight > liste.scrollTop + liste.clientHeight)) {
        liste.scrollTop = ligne.offsetTop - liste.clientHeight / 3
      }
      return
    }

    const duree = !anime ? 0 : reduit ? DUREE_FONDU : DUREE_VOLET
    // Le volet reste visible le temps de sortir, puis disparaît pour de bon.
    panneau.style.transition = !anime
      ? 'none'
      : `${reduit ? `opacity ${DUREE_FONDU}ms ease-out` : GLISSEMENT}, visibility 0s linear ${duree}ms`
    panneau.style.visibility = 'hidden'
    panneau.style.opacity = reduit ? '0' : '1'
    panneau.style.transform = reduit ? 'translateX(0)' : 'translateX(-100%)'
    if (!racine || !racine.style.transform) return
    racine.inert = false
    racine.style.transition = glisse ? GLISSEMENT : 'none'
    racine.style.transform = 'translateX(0)'
    racine.style.borderRadius = '0'
    retour.current?.focus({ preventScroll: true })
    retour.current = null
    // Une transformation laissée sur #root, même nulle, ferait d'elle le repère
    // de tout ce qui est fixe dans l'application : on la retire une fois
    // l'application revenue en place.
    rangement.current = window.setTimeout(() => { lacherApp(racine); cible.current = null }, duree + 50)
  }, [])

  useLayoutEffect(() => {
    // La première pose se fait sans animation : le volet naît fermé, hors de l'écran.
    placer(ouvert, dejaPlace.current)
    dejaPlace.current = true
  }, [ouvert, placer])

  useEffect(() => {
    return () => {
      window.clearTimeout(rangement.current)
      // Le volet peut se démonter ouvert (un lien du menu de gauche, resté
      // utilisable sur iPad) : ce qu'il poussait revient en place.
      const poussee = cible.current?.element ?? document.getElementById('root')
      if (poussee) lacherApp(poussee)
      cible.current = null
    }
  }, [])

  useEffect(() => {
    if (!ouvert) return
    const touche = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      if (menu) setMenu(null)
      else onFermer()
    }
    document.addEventListener('keydown', touche)
    return () => document.removeEventListener('keydown', touche)
  }, [ouvert, menu, onFermer])

  // Un menu ouvert sur une ligne au bord de la partie visible serait coupé,
  // ou caché sous le fondu du bas : la liste défile juste assez pour le
  // montrer en entier.
  useEffect(() => {
    const liste = listeRef.current
    const carte = liste?.querySelector<HTMLElement>('[role="menu"]')
    const ligne = carte?.parentElement
    if (!liste || !carte || !ligne) return
    // La ligne compte autant que son menu : on doit voir de quoi on parle.
    const haut = ligne.offsetTop + Math.min(0, carte.offsetTop) - 8
    const bas = ligne.offsetTop + Math.max(ligne.offsetHeight, carte.offsetTop + carte.offsetHeight) + 32
    const cible = haut < liste.scrollTop
      ? haut
      : bas > liste.scrollTop + liste.clientHeight ? bas - liste.clientHeight : null
    if (cible !== null) liste.scrollTo({ top: cible, behavior: mouvementReduit() ? 'auto' : 'smooth' })
  }, [menu])

  // -------- appui long sur une ligne : ses actions

  const annulerAppui = () => {
    if (!appui.current) return
    window.clearTimeout(appui.current.minuteur)
    appui.current = null
  }

  const appuiDebut = (e: React.PointerEvent, id: string) => {
    if (e.pointerType === 'mouse') return
    annulerAppui()
    appui.current = {
      x: e.clientX,
      y: e.clientY,
      minuteur: window.setTimeout(() => {
        appui.current = null
        ignorerClic.current = true
        setMenu(id)
      }, 450),
    }
  }

  const appuiSuite = (e: React.PointerEvent) => {
    const a = appui.current
    if (a && Math.hypot(e.clientX - a.x, e.clientY - a.y) > 8) annulerAppui()
  }

  // -------- glisser vers la gauche pour fermer

  const gesteDebut = (e: React.PointerEvent<HTMLElement>) => {
    ignorerClic.current = false
    // À la souris, glisser sélectionnerait du texte : on ferme d'un clic.
    if (!ouvert || e.pointerType === 'mouse' || !panneauRef.current) return
    geste.current = {
      id: e.pointerId, x: e.clientX, y: e.clientY, largeur: panneauRef.current.offsetWidth,
      decalage: 0, tire: false, dernierX: e.clientX, dernierT: e.timeStamp, vitesse: 0,
    }
  }

  const gesteSuite = (e: React.PointerEvent<HTMLElement>) => {
    const g = geste.current
    if (!g || g.id !== e.pointerId) return
    const dx = e.clientX - g.x
    const dy = e.clientY - g.y
    if (!g.tire) {
      // Un geste vertical fait défiler la liste ; vers la droite, il n'y a
      // rien à ouvrir de plus.
      if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) { geste.current = null; return }
      if (dx > 10) { geste.current = null; return }
      if (dx > -10) return
      g.tire = true
      e.currentTarget.setPointerCapture(e.pointerId)
      annulerAppui()
    }
    const dt = Math.max(1, e.timeStamp - g.dernierT)
    g.vitesse = (e.clientX - g.dernierX) / dt
    g.dernierX = e.clientX
    g.dernierT = e.timeStamp
    g.decalage = Math.max(-g.largeur, Math.min(0, dx))
    // Le volet et l'application suivent le doigt, sans transition : une
    // transition ici ferait courir l'image derrière le geste.
    const panneau = panneauRef.current
    const racine = document.querySelector<HTMLElement>('[data-pousse-par-volet]')
    if (!panneau || !racine) return
    panneau.style.transition = 'none'
    panneau.style.transform = `translateX(${g.decalage}px)`
    racine.style.transition = 'none'
    racine.style.transform = `translateX(${g.largeur + g.decalage}px)`
  }

  const gesteFin = (e: React.PointerEvent<HTMLElement>, annule = false) => {
    const g = geste.current
    if (!g || g.id !== e.pointerId) return
    geste.current = null
    if (!g.tire) return
    ignorerClic.current = true
    // Un tiers du chemin, ou un geste vif, suffit : on ne demande pas d'aller
    // jusqu'au bord de l'écran.
    if (!annule && (g.decalage < -g.largeur * 0.33 || g.vitesse < -0.35)) onFermer()
    else placer(true, true)
  }

  const gestes = {
    onPointerDown: gesteDebut,
    onPointerMove: gesteSuite,
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => gesteFin(e),
    onPointerCancel: (e: React.PointerEvent<HTMLElement>) => gesteFin(e, true),
    onClickCapture: (e: React.MouseEvent) => {
      if (!ignorerClic.current) return
      ignorerClic.current = false
      e.preventDefault()
      e.stopPropagation()
    },
  }

  const ouvrirRecherche = () => {
    // Le champ doit exister avant qu'on lui donne le focus, dans le même
    // toucher : iOS n'ouvre le clavier que pour un focus donné pendant le geste.
    flushSync(() => setCherche(true))
    champRecherche.current?.focus()
  }

  const q = plier(filtre.trim())
  const visibles = q ? conversations.filter((c) => plier(c.titre).includes(q)) : conversations

  return createPortal(
    <>
      <div
        ref={panneauRef}
        role="dialog"
        aria-modal="true"
        aria-label="Conversations de l’assistant"
        tabIndex={-1}
        {...gestes}
        className="fixed inset-y-0 left-0 z-50 flex w-[min(77vw,23rem)] touch-pan-y flex-col bg-white pl-[var(--safe-left)] outline-none lg:hidden"
      >
        {/* En haut, sous la barre d'état : le titre, et la recherche. */}
        <div className="flex shrink-0 items-center gap-3 pb-3 pl-5 pr-3 pt-[calc(var(--safe-top)+0.75rem)]">
          {cherche ? (
            <>
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
                {/* 17 px : sous 16 px, Safari zoome sur le champ à la saisie. */}
                <input
                  ref={champRecherche}
                  type="search"
                  value={filtre}
                  onChange={(e) => setFiltre(e.target.value)}
                  placeholder="Rechercher"
                  aria-label="Rechercher une conversation"
                  enterKeyHint="search"
                  className="h-11 w-full appearance-none rounded-full bg-black/[0.05] pl-10 pr-4 text-[17px] outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
                />
              </div>
              <button
                type="button"
                onClick={() => { setCherche(false); setFiltre('') }}
                className="shrink-0 px-1 text-[17px] text-[#0167EA]"
              >
                Annuler
              </button>
            </>
          ) : (
            <>
              {/* La marque, et non une icône d'étoiles : l'assistant est Diagly. */}
              <img src="/diagly-mark.svg" alt="" className="h-7 w-auto shrink-0" />
              <h2 className="min-w-0 flex-1 truncate text-[26px] font-bold leading-tight tracking-tight">Assistant</h2>
              <button
                type="button"
                onClick={ouvrirRecherche}
                aria-label="Rechercher une conversation"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black/[0.05] text-neutral-700 transition-colors hover:bg-black/[0.08] active:bg-black/[0.1]"
              >
                <Search className="h-5 w-5" />
              </button>
            </>
          )}
        </div>
        {/* Le seul filet du volet, et seulement quand la liste a défilé sous
            l'en-tête. Un élément à part et non une bordure : la règle
            `* { border-color }` d'index.css, hors des couches de Tailwind,
            l'emporte sur toute couleur de bordure posée par classe. */}
        <div aria-hidden className={cn('h-px shrink-0 bg-black/[0.07] transition-opacity', defile ? 'opacity-100' : 'opacity-0')} />

        {/* Des titres, une ligne chacun, sans cadre ni séparateur. La liste
            est son propre repère (relative) pour que les calculs de défilement
            se fassent dans ses coordonnées, et elle redit pan-y : le geste
            horizontal qui ferme le volet s'arrêterait sinon à elle, qui défile. */}
        <div
          ref={listeRef}
          onScroll={(e) => setDefile(e.currentTarget.scrollTop > 2)}
          className="relative min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-2 pb-6 pt-1"
        >
          {visibles.length === 0 ? (
            <p className="px-3 py-4 text-[15px] text-muted-foreground">
              {q ? 'Aucune conversation ne porte ce titre.' : 'Vos conversations s’empileront ici.'}
            </p>
          ) : (
            <ul>
              {visibles.map((c, i) => {
                const active = c.id === courante
                // Sous les deux dernières lignes d'une longue liste, il n'y a
                // plus de place : leur menu s'ouvre vers le haut.
                const versLeHaut = visibles.length > 3 && i >= visibles.length - 2
                return (
                  <li key={c.id} className={cn('group relative', menu === c.id && 'z-20')}>
                    <button
                      type="button"
                      aria-current={active ? 'true' : undefined}
                      onClick={() => onOuvrir(c)}
                      onPointerDown={(e) => appuiDebut(e, c.id)}
                      onPointerMove={appuiSuite}
                      onPointerUp={annulerAppui}
                      onPointerCancel={annulerAppui}
                      onPointerLeave={annulerAppui}
                      onContextMenu={(e) => { e.preventDefault(); annulerAppui(); setMenu(c.id) }}
                      className={cn(
                        'flex h-12 w-full select-none items-center rounded-xl pl-3 text-left text-[17px] text-foreground transition-colors [-webkit-touch-callout:none]',
                        active || menu === c.id ? 'bg-black/[0.05] pr-12' : 'pr-3 hover:bg-black/[0.03] active:bg-black/[0.05] pointer-fine:pr-12',
                      )}
                    >
                      <span className="min-w-0 truncate">{c.titre}</span>
                    </button>
                    {/* Les actions d'une ligne : en vue sur la conversation
                        ouverte, au survol pour les autres, et par appui long
                        sur n'importe laquelle. Une poubelle sur chaque ligne
                        faisait de la liste une liste de boutons. */}
                    <button
                      type="button"
                      onClick={() => setMenu((m) => (m === c.id ? null : c.id))}
                      aria-label={`Actions sur « ${c.titre} »`}
                      aria-haspopup="menu"
                      aria-expanded={menu === c.id}
                      className={cn(
                        'absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-neutral-500 transition-[opacity,color,background-color] hover:bg-black/[0.06] hover:text-neutral-800',
                        active || menu === c.id
                          ? 'opacity-100'
                          : 'pointer-events-none opacity-0 focus-visible:pointer-events-auto focus-visible:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100',
                      )}
                    >
                      <Ellipsis className="h-5 w-5" />
                    </button>
                    {menu === c.id && (
                      <div
                        role="menu"
                        className={cn('absolute right-1.5 w-56 rounded-2xl bg-white p-1 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.28)] ring-1 ring-black/[0.06]',
                          versLeHaut ? 'bottom-[calc(100%+0.25rem)]' : 'top-[calc(100%+0.25rem)]')}
                      >
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => { setMenu(null); onSupprimer(c.id) }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[16px] text-red-600 transition-colors hover:bg-red-50 active:bg-red-50"
                        >
                          <Trash2 className="h-[18px] w-[18px]" />Supprimer
                        </button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* En bas, au-dessus de la barre d'accueil : la nouvelle conversation.
            La liste s'efface sous le bouton plutôt que de s'y couper net. */}
        <div className="relative shrink-0 px-4 pb-[calc(var(--safe-bottom)+0.75rem)] pt-2">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-full h-6 bg-gradient-to-t from-white to-transparent" />
          <button
            type="button"
            onClick={onNouvelle}
            className="inline-flex h-[52px] max-w-full items-center gap-2.5 rounded-full bg-[#0167EA] pl-5 pr-6 text-[17px] font-semibold text-white shadow-[0_10px_24px_-12px_rgba(1,103,234,0.7)] transition-colors hover:bg-[#0154c4] active:bg-[#0154c4]"
          >
            <SquarePen className="h-5 w-5 shrink-0" />
            <span className="truncate">Nouvelle conversation</span>
          </button>
        </div>

        {/* Un menu ouvert se referme d'un toucher à côté, sans rien ouvrir d'autre. */}
        {menu && <div aria-hidden className="absolute inset-0 z-10" onClick={() => setMenu(null)} />}
      </div>

      {/* Le bord de la conversation, resté visible à droite : le toucher
          referme le volet, le faire glisser vers la gauche aussi. */}
      {ouvert && (
        <div
          aria-hidden
          {...gestes}
          onClick={onFermer}
          ref={bordRef}
          // Sur iPhone, le clic qui suit un toucher n'atteignait pas toujours
          // ce bord : le volet restait ouvert. Un toucher sans glissement le
          // ferme donc dès que le doigt se lève ; onClick reste pour la souris.
          onPointerUp={(e) => {
            const g = geste.current
            gestes.onPointerUp(e)
            if (e.pointerType !== 'mouse' && g && !g.tire) { avalerLeClicSuivant(); onFermer() }
          }}
          className="fixed inset-y-0 right-0 z-50 cursor-pointer touch-none lg:hidden"
          // Position exacte posée par placer() : le bord droit du menu, sur iPad.
          style={{ left: LARGEUR_VOLET }}
        />
      )}
    </>,
    document.body,
  )
}

// ------------------------------------------------------------ la conversation

function Accueil({ prenom, onChoisir }: { prenom?: string; onChoisir: (s: string) => void }) {
  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center text-center">
      {/* La marque, et non une icône d'étoiles : l'assistant est Diagly, pas
          un gadget d'IA posé à côté. */}
      <img src="/diagly-mark.svg" alt="" className="h-14 w-auto" />
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
      <div
        className={cn('max-w-[90%] rounded-2xl px-4 py-3 sm:max-w-[85%]',
          deMoi ? 'bg-blue-600 text-white' : 'border border-black/[0.06] bg-white text-neutral-800 shadow-sm')}
      >
        {message.images && message.images.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {message.images.map((src, i) => <img key={i} src={src} alt="" className="h-24 w-24 rounded-lg object-cover sm:h-28 sm:w-28" />)}
          </div>
        )}
        {deMoi
          ? <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{message.content}</p>
          : <Reponse texte={message.content} />}
      </div>
    </div>
  )
}

/** Le focus du clavier, en bleu Diagly et détaché du bord : visible sur une option déjà teintée. */
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0167EA] focus-visible:ring-offset-2'
/**
 * Les bordures bleues de la carte sont posées en style et non par classe : la
 * règle `* { border-color }` d'index.css, hors des couches de Tailwind,
 * l'emporte sur toute couleur de bordure donnée par une classe.
 */
const BORD_BLEU = { borderColor: '#0167EA' }

/**
 * Une question à choix posée par l'assistant.
 *
 * Quand une demande peut se comprendre de deux façons, taper la précision au
 * pouce, sur le chantier, coûte plus que la question elle-même : les réponses
 * probables sont donc proposées, et un toucher suffit. Le champ « Autre
 * réponse » reste toujours là, parce que l'assistant ne devine pas tout.
 *
 * Une fois la question répondue, la carte reste dans le fil, figée, avec le
 * choix en évidence : relue plus tard, la conversation dit encore ce qui a été
 * décidé et pourquoi la suite a pris ce chemin.
 */
function CarteQuestion({ question, active, onRepondre }: {
  question: QuestionPosee
  /** La dernière question encore sans réponse : la seule qui se touche. */
  active: boolean
  onRepondre: (reponse: ReponseQuestion) => void
}) {
  const id = useId()
  const [coches, setCoches] = useState<string[]>([])
  const [autre, setAutre] = useState('')
  const { reponse, choixMultiple } = question
  const choisi = (libelle: string) => (reponse ? reponse.choix.includes(libelle) : coches.includes(libelle))
  // Les choix partent dans l'ordre des options, pas dans celui des touchers.
  const selection = question.options.map((o) => o.libelle).filter((l) => coches.includes(l))

  const toucher = (libelle: string) => {
    if (!active) return
    if (!choixMultiple) { onRepondre({ choix: [libelle] }); return }
    setCoches((c) => (c.includes(libelle) ? c.filter((x) => x !== libelle) : [...c, libelle]))
  }

  const soumettre = (e: React.FormEvent) => {
    e.preventDefault()
    if (!active) return
    const texte = autre.trim()
    // En choix multiple, ce qui est écrit s'ajoute aux cases cochées ; sinon,
    // c'est une réponse à part entière.
    if (choixMultiple) {
      if (selection.length === 0 && !texte) return
      onRepondre(texte ? { choix: selection, autre: texte } : { choix: selection })
    } else if (texte) {
      onRepondre({ choix: [], autre: texte })
    }
  }

  return (
    <div className="flex justify-start">
      <div
        role="group"
        aria-labelledby={`${id}-q`}
        className="w-full max-w-[90%] rounded-2xl border bg-white p-4 shadow-sm sm:max-w-[85%]"
        // La question qui attend une réponse se détache à peine des autres.
        style={active ? { borderColor: 'rgba(1, 103, 234, 0.3)' } : undefined}
      >
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#0167EA]/10 px-2.5 py-1 text-[11px] font-semibold uppercase leading-none tracking-wider text-[#0167EA]">
            {question.etiquette}
          </span>
          {active && choixMultiple && <span className="text-[12px] text-muted-foreground">Plusieurs choix possibles</span>}
          {reponse && (
            <span className="ml-auto flex items-center gap-1 text-[12px] text-muted-foreground">
              <Check className="h-3.5 w-3.5" aria-hidden />Répondu
            </span>
          )}
        </div>
        <p id={`${id}-q`} className="mt-2.5 text-[15px] font-semibold leading-snug text-neutral-900">{question.question}</p>

        <div className="mt-3 space-y-2">
          {question.options.map((o, i) => {
            const pris = choisi(o.libelle)
            return (
              <button
                key={o.libelle}
                type="button"
                disabled={!active}
                onClick={() => toucher(o.libelle)}
                role={choixMultiple ? 'checkbox' : undefined}
                aria-checked={choixMultiple ? pris : undefined}
                aria-labelledby={`${id}-l${i}`}
                aria-describedby={`${id}-d${i}`}
                style={pris ? BORD_BLEU : undefined}
                className={cn('flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors', FOCUS,
                  pris ? 'bg-[#0167EA]/[0.06]' : 'bg-white',
                  active && !pris && 'hover:bg-[#0167EA]/[0.04] active:bg-[#0167EA]/[0.08]',
                  !active && !pris && 'opacity-60')}
              >
                {choixMultiple && (
                  <span
                    aria-hidden
                    style={pris ? BORD_BLEU : { borderColor: '#d4d4d4' }}
                    className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border',
                      pris ? 'bg-[#0167EA] text-white' : 'bg-white')}
                  >
                    {pris && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span id={`${id}-l${i}`} className="block text-[15px] font-medium leading-snug text-neutral-900">
                    {o.libelle}
                    {o.recommande && <span className="ml-1.5 text-[12px] font-normal text-[#0167EA]/80">(recommandé)</span>}
                    {!active && pris && <span className="sr-only"> (votre choix)</span>}
                  </span>
                  <span id={`${id}-d${i}`} className="mt-0.5 block text-[13px] leading-snug text-neutral-500">{o.description}</span>
                </span>
                {!choixMultiple && pris && <Check className="mt-0.5 h-5 w-5 shrink-0 text-[#0167EA]" aria-hidden />}
              </button>
            )
          })}
        </div>

        {reponse?.autre && (
          <p style={BORD_BLEU} className="mt-2 rounded-xl border bg-[#0167EA]/[0.06] px-3.5 py-2.5 text-[14px] leading-snug text-neutral-800">
            <span className="font-medium text-[#0167EA]">Autre réponse : </span>{reponse.autre}
          </p>
        )}

        {active && (
          <form onSubmit={soumettre} className="mt-3">
            {/* 16 px : en dessous, Safari zoome sur le champ dès qu'on y tape. */}
            <div className="flex items-center gap-1 rounded-xl border bg-neutral-50 pl-3.5 pr-1 transition-colors focus-within:bg-white focus-within:ring-2 focus-within:ring-[#0167EA]">
              <input
                value={autre}
                onChange={(e) => setAutre(e.target.value)}
                placeholder="Autre réponse…"
                aria-label={choixMultiple ? 'Autre réponse, ajoutée aux choix cochés' : 'Autre réponse'}
                enterKeyHint="send"
                maxLength={2000}
                className="h-11 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-neutral-400"
              />
              {!choixMultiple && (
                <button
                  type="submit"
                  disabled={!autre.trim()}
                  aria-label="Envoyer cette réponse"
                  title="Envoyer cette réponse"
                  className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0167EA] text-white transition-colors hover:bg-[#0154c4] disabled:opacity-30', FOCUS)}
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              )}
            </div>
            {choixMultiple && (
              <button
                type="submit"
                disabled={selection.length === 0 && !autre.trim()}
                className={cn('mt-2 h-11 w-full rounded-xl bg-[#0167EA] text-[15px] font-semibold text-white transition-colors hover:bg-[#0154c4] disabled:opacity-40', FOCUS)}
              >
                Valider{selection.length > 0 ? ` (${selection.length})` : ''}
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  )
}

/**
 * La réponse de l'assistant, mise en forme.
 *
 * Le modèle répond en Markdown léger. Affiché brut, cela donnait des
 * « **mot** » au milieu des phrases : la réponse avait l'air bâclée alors
 * qu'elle était juste.
 */
function Reponse({ texte }: { texte: string }) {
  const blocs = useMemo(() => analyser(texte), [texte])
  return (
    <div className="space-y-2.5 text-[15px] leading-relaxed">
      {blocs.map((b, i) => <BlocRendu key={i} bloc={b} />)}
    </div>
  )
}

function BlocRendu({ bloc }: { bloc: Bloc }) {
  if (bloc.type === 'titre') {
    return <p className="font-semibold">{bloc.segments.map((s, i) => <SegmentRendu key={i} segment={s} />)}</p>
  }
  if (bloc.type === 'paragraphe') {
    return (
      <p>
        {bloc.lignes.map((ligne, i) => (
          <span key={i}>
            {i > 0 && <br />}
            {ligne.map((s, j) => <SegmentRendu key={j} segment={s} />)}
          </span>
        ))}
      </p>
    )
  }
  const Balise = bloc.type === 'numerotee' ? 'ol' : 'ul'
  return (
    <Balise className={cn('space-y-1 pl-1', bloc.type === 'numerotee' && 'list-inside list-decimal')}>
      {bloc.items.map((item, i) => (
        <li key={i} className={cn(bloc.type === 'liste' && 'flex gap-2')}>
          {bloc.type === 'liste' && <span className="mt-[0.6rem] h-1 w-1 shrink-0 rounded-full bg-neutral-400" aria-hidden />}
          <span>{item.map((s, j) => <SegmentRendu key={j} segment={s} />)}</span>
        </li>
      ))}
    </Balise>
  )
}

function SegmentRendu({ segment }: { segment: Segment }) {
  if (segment.type === 'gras') return <strong className="font-semibold">{segment.texte}</strong>
  if (segment.type === 'italique') return <em>{segment.texte}</em>
  if (segment.type === 'code') return <code className="rounded bg-neutral-100 px-1 py-0.5 text-[13px]">{segment.texte}</code>
  return <>{segment.texte}</>
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
