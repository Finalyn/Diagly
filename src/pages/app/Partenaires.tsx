/**
 * Les prestataires : à qui confier la suite d'un diagnostic.
 *
 * L'annuaire est tenu par Finalyn. On y entre par son besoin (un certificat
 * énergétique, un projet de rénovation, des offres pour les travaux…), pas
 * par une liste de métiers. Deux sortes de prestataires y répondent :
 *
 * - des professionnels (architectes, experts CECB®, entreprises générales),
 *   qu'on contacte depuis Diagly, le dossier en résumé si on le souhaite. La
 *   demande reste ici pour en suivre l'issue, et la réponse arrive directement
 *   dans la messagerie de l'utilisateur ;
 * - des outils (Arkia pour les images), qu'on rejoint par un lien, souvent
 *   avec une offre réservée aux utilisateurs de Diagly.
 *
 * Même disposition que les Intégrations : un menu à gauche, la section dans
 * un grand panneau à droite, qui défile seul.
 */
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Users, Send, Settings2, Inbox, Loader2, Plus, Search, ShieldCheck, Globe, Phone, Mail, X, Check, ChevronDown,
  MapPin, Languages, Pencil, RotateCcw, Trash2, FolderOpen, ExternalLink, Gift, } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Input, Button, Select, Textarea } from '@/components/ui'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/stores/auth'
import { nomAffiche } from '@/lib/reglages'
import { useIsMobile } from '@/lib/use-mobile'
import { cn, formatDate } from '@/lib/utils'
import {
  METIERS, LIBELLE_METIER, CANTONS, LANGUES, LIBELLE_LANGUE, STATUT_DEMANDE, BESOINS,
  objetPropose, messagePropose, corpsPourMessagerie, metierDeContact, repondA, type Besoin,
} from '@/lib/partenaires'
import type { Partenaire, DemandePartenaire, MetierPartenaire } from '@/lib/api-types'

type IdSection = 'annuaire' | 'demandes' | 'gestion' | 'toutes'

const EN_COURS: DemandePartenaire['statut'][] = ['ENVOYEE', 'MESSAGERIE', 'ECHEC', 'EN_COURS']

const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`

export function Partenaires() {
  const isMobile = useIsMobile()
  const qc = useQueryClient()
  const config = useQuery({ queryKey: ['partenaires', 'config'], queryFn: () => api.partenaires.config() })
  const annuaire = useQuery({ queryKey: ['partenaires', 'annuaire'], queryFn: () => api.partenaires.list() })
  const demandesQ = useQuery({ queryKey: ['partenaires', 'demandes'], queryFn: () => api.partenaires.demandes() })
  const admin = !!config.data?.admin
  const partenaires = annuaire.data?.partenaires ?? []
  const demandes = demandesQ.data?.demandes ?? []
  const ouvertes = demandes.filter((d) => EN_COURS.includes(d.statut))

  const [besoin, setBesoin] = useState<Besoin | null>(null)
  const [aContacter, setAContacter] = useState<Partenaire | null>(null)
  const [confirmation, setConfirmation] = useState<string | null>(null)

  const SECTIONS: { id: IdSection; label: string; aide: string; icone: typeof Users; etat?: string; finalyn?: boolean }[] = [
    {
      id: 'annuaire', label: 'Trouver un prestataire', icone: Users,
      aide: 'Des professionnels et des outils choisis par Finalyn, pour la suite de vos diagnostics',
      etat: annuaire.isLoading ? '…' : String(partenaires.length),
    },
    {
      id: 'demandes', label: 'Mes demandes', icone: Send,
      aide: 'Les prestataires que vous avez contactés, et où en est chaque échange',
      etat: demandesQ.isLoading ? '…' : ouvertes.length ? `${ouvertes.length} en cours` : String(demandes.length),
    },
    ...(admin ? [
      { id: 'gestion' as const, label: 'Gérer l’annuaire', icone: Settings2, finalyn: true, aide: 'Ajouter, modifier, vérifier et retirer les prestataires. Réservé à Finalyn.' },
      { id: 'toutes' as const, label: 'Toutes les demandes', icone: Inbox, finalyn: true, aide: 'Les mises en relation de tous les comptes, pour suivre l’usage de l’annuaire' },
    ] : []),
  ]

  const [parametres, setParametres] = useSearchParams()
  const choisie = (SECTIONS.find((s) => s.id === parametres.get('s'))?.id ?? 'annuaire') as IdSection
  const choisir = (id: IdSection) => setParametres({ s: id }, { replace: true })
  const section = SECTIONS.find((s) => s.id === choisie)!

  const menuItem = (on: boolean) => cn(
    'flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left transition-colors',
    on ? 'border border-blue-100 bg-blue-50 text-blue-700' : 'text-neutral-600 hover:bg-black/[0.03] hover:text-neutral-900',
  )

  return (
    <div className={cn('space-y-4', !isMobile && 'flex h-full min-h-0 flex-col space-y-0 gap-4')}>
      <div className="shrink-0">
        <h1 className="text-xl font-bold">Prestataires</h1>
        <p className="text-sm text-muted-foreground">L’expert, l’architecte ou l’outil qui prendra la suite de votre diagnostic, choisis par Finalyn.</p>
      </div>

      <div className={cn('flex gap-4', isMobile ? 'flex-col' : 'min-h-0 flex-1 items-start')}>
        {/* ----- Le menu, à gauche ----- */}
        <div className="w-full shrink-0 space-y-4 lg:w-72">
          <Card className="overflow-hidden">
            <div className="border-b border-black/[0.06] px-4 py-3.5">
              <p className="text-sm font-semibold">Mise en relation</p>
              <p className="text-xs text-muted-foreground">Annuaire tenu et vérifié par Finalyn</p>
            </div>
            <nav className="space-y-1 p-2">
              {SECTIONS.map((s, i) => (
                <div key={s.id}>
                  {s.finalyn && !SECTIONS[i - 1]?.finalyn && (
                    <p className="px-3 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Finalyn</p>
                  )}
                  <button onClick={() => choisir(s.id)} data-visite={`partenaires-${s.id}`} className={menuItem(s.id === choisie)}>
                    <s.icone className="h-4 w-4 shrink-0" />
                    <span className={cn('min-w-0 flex-1 truncate text-sm', s.id === choisie ? 'font-semibold' : 'font-medium')}>{s.label}</span>
                    {s.etat && <span className="shrink-0 text-[11px] text-muted-foreground">{s.etat}</span>}
                  </button>
                </div>
              ))}
            </nav>
          </Card>
        </div>

        {/* ----- Le contenu, à droite ----- */}
        <Card className={cn('min-w-0 flex-1 overflow-hidden', !isMobile && 'flex max-h-full flex-col')}>
          <CardHeader className="shrink-0 space-y-0 border-b border-black/[0.06] px-5 py-3.5">
            <CardTitle className="text-base">{section.label}</CardTitle>
            <p className="mt-0.5 text-sm text-muted-foreground">{section.aide}</p>
          </CardHeader>
          <CardContent key={choisie} className={cn('space-y-5 p-5', !isMobile && 'min-h-0 flex-1 overflow-y-auto overscroll-contain')}>
            {choisie === 'annuaire' && (
              <SectionAnnuaire
                partenaires={annuaire.isLoading ? null : partenaires}
                besoin={besoin}
                onBesoin={setBesoin}
                demandes={demandes}
                admin={admin}
                onGerer={() => choisir('gestion')}
                onContacter={setAContacter}
              />
            )}
            {choisie === 'demandes' && (
              <SectionDemandes
                demandes={demandesQ.isLoading ? null : demandes}
                confirmation={confirmation}
                onFermerConfirmation={() => setConfirmation(null)}
                onAnnuaire={() => choisir('annuaire')}
                onChange={() => qc.invalidateQueries({ queryKey: ['partenaires', 'demandes'] })}
              />
            )}
            {choisie === 'gestion' && admin && (
              <SectionGestion onChange={() => qc.invalidateQueries({ queryKey: ['partenaires'] })} />
            )}
            {choisie === 'toutes' && admin && <SectionToutes />}
          </CardContent>
        </Card>
      </div>

      {aContacter && (
        <DialogueContact
          partenaire={aContacter}
          metier={metierDeContact(aContacter, besoin?.metiers ?? null)}
          mailConfigured={config.data?.mailConfigured ?? false}
          onFermer={() => setAContacter(null)}
          onEnvoyee={(d) => {
            setAContacter(null)
            setConfirmation(d.statut === 'ECHEC'
              ? `L’envoi à ${d.partner.nom} a échoué. La demande est notée : ouvrez-la dans votre messagerie pour l’envoyer vous-même.`
              : d.statut === 'MESSAGERIE'
                ? `Votre demande à ${d.partner.nom} s’est ouverte dans votre messagerie. Elle est notée ici pour en suivre l’issue.`
                : `Votre demande est partie chez ${d.partner.nom}. Sa réponse arrivera directement dans votre messagerie.`)
            qc.invalidateQueries({ queryKey: ['partenaires', 'demandes'] })
            choisir('demandes')
          }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------- briques

function Bloc({ titre, aide, children, action }: { titre: string; aide?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="border-t border-black/[0.06] pt-5 first:border-0 first:pt-0">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{titre}</h3>
          {aide && <p className="mt-0.5 text-sm text-muted-foreground">{aide}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}

function Vide({ titre, texte, action }: { titre: string; texte: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-black/[0.1] px-4 py-10 text-center">
      <p className="text-sm font-medium">{titre}</p>
      <p className="mx-auto mt-0.5 max-w-md text-xs text-muted-foreground">{texte}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

function Champ({ label, aide, children }: { label: string; aide?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-neutral-700">{label}</span>
      {children}
      {aide && <span className="block text-[11px] text-muted-foreground">{aide}</span>}
    </label>
  )
}

const Chargement = () => <div className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>

function Statut({ statut }: { statut: DemandePartenaire['statut'] }) {
  const s = STATUT_DEMANDE[statut]
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-neutral-600">
      <span className={cn('h-1.5 w-1.5 rounded-full', s.point)} />{s.label}
    </span>
  )
}

/** Un choix parmi plusieurs, en pastilles : métiers, cantons, langues. */
function Pastilles<T extends string>({ options, valeur, onChange }: { options: { id: T; label: string }[]; valeur: T[]; onChange: (v: T[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = valeur.includes(o.id)
        return (
          <button
            key={o.id} type="button"
            onClick={() => onChange(on ? valeur.filter((v) => v !== o.id) : [...valeur, o.id])}
            className={cn('inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs transition-colors', on ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-black/10 bg-white text-muted-foreground hover:text-foreground')}
          >
            {on && <Check className="h-3 w-3" />}{o.label}
          </button>
        )
      })}
    </div>
  )
}

const Initiales = ({ nom }: { nom: string }) => (
  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-sm font-semibold text-neutral-700">
    {nom.split(/\s+/).map((m) => m[0]).join('').toUpperCase().slice(0, 2)}
  </span>
)

const urlSite = (s: string) => (/^https?:\/\//i.test(s) ? s : `https://${s}`)
const lienDossier = (id: string) => `/app/projects/${id}/fiche`
const lienAction = 'inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs text-muted-foreground transition-colors hover:bg-black/[0.03] hover:text-foreground'

// ---------------------------------------------------------------- annuaire

function SectionAnnuaire({ partenaires, besoin, onBesoin, demandes, admin, onGerer, onContacter }: {
  partenaires: Partenaire[] | null
  besoin: Besoin | null
  onBesoin: (b: Besoin | null) => void
  demandes: DemandePartenaire[]
  admin: boolean
  onGerer: () => void
  onContacter: (p: Partenaire) => void
}) {
  const [recherche, setRecherche] = useState('')
  const [canton, setCanton] = useState('')
  const [langue, setLangue] = useState('')

  if (partenaires === null) return <Chargement />

  const q = recherche.trim().toLowerCase()
  const prosDuBesoin = partenaires.filter((p) => p.type === 'PRO' && repondA(p, besoin))
  const pros = prosDuBesoin.filter((p) => (!canton || p.cantons.includes(canton))
    && (!langue || p.langues.includes(langue))
    && (!q || [p.nom, p.localite, p.contact, p.description].some((t) => t?.toLowerCase().includes(q))))
  const outils = partenaires.filter((p) => p.type === 'OUTIL' && repondA(p, besoin))
  const avecPros = !besoin?.outils
  const avecOutils = !besoin || !!besoin.outils
  // La dernière demande à chacun : on voit d'un coup d'œil qui l'on a déjà contacté.
  const derniere = new Map<string, string>()
  for (const d of demandes) if (!derniere.has(d.partnerId)) derniere.set(d.partnerId, d.createdAt)
  const filtre = !!(canton || langue || q)
  const tuile = (on: boolean) => cn(
    'flex rounded-2xl border px-3.5 py-3 text-left transition-colors',
    on ? 'border-blue-200 bg-blue-50/70' : 'border-black/[0.06] bg-white hover:border-black/[0.12]',
  )

  return (
    <>
      <Bloc titre="De quoi avez-vous besoin ?">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" data-visite="partenaires-besoins">
          {BESOINS.map((b) => {
            const n = partenaires.filter((p) => repondA(p, b)).length
            const on = besoin?.id === b.id
            return (
              <button key={b.id} onClick={() => onBesoin(on ? null : b)} className={tuile(on)} aria-pressed={on}>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={cn('text-sm font-semibold', on && 'text-blue-800')}>{b.titre}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{n || 'Bientôt'}</span>
                  </span>
                  <span className="mt-0.5 line-clamp-2 block text-xs leading-snug text-muted-foreground">{b.texte}</span>
                </span>
              </button>
            )
          })}
          <button onClick={() => onBesoin(null)} className={tuile(besoin === null)} aria-pressed={besoin === null}>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className={cn('text-sm font-semibold', besoin === null && 'text-blue-800')}>Tout l’annuaire</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">{partenaires.length}</span>
              </span>
              <span className="mt-0.5 line-clamp-2 block text-xs leading-snug text-muted-foreground">Tous les professionnels et tous les outils.</span>
            </span>
          </button>
        </div>
      </Bloc>

      {partenaires.length === 0 ? (
        <Vide titre="L’annuaire est en préparation"
          texte="Finalyn sélectionne les premiers prestataires et vérifie leurs certifications. Ils apparaîtront ici dès qu’ils seront publiés."
          action={admin ? <Button size="sm" onClick={onGerer}><Plus className="h-3.5 w-3.5" />Ajouter un prestataire</Button> : undefined}
        />
      ) : (
        <>
          {avecPros && (
            <Bloc titre={besoin ? besoin.titre : 'Professionnels'} aide="Contactez-les depuis Diagly, avec votre dossier si vous le souhaitez.">
              {prosDuBesoin.length > 0 && <div className="mb-3 flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Nom, localité…" className="pl-9" />
                </div>
                <Select value={canton} onChange={(e) => setCanton(e.target.value)} className="sm:w-44" aria-label="Canton">
                  <option value="">Tous les cantons</option>
                  {CANTONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
                <Select value={langue} onChange={(e) => setLangue(e.target.value)} className="sm:w-44" aria-label="Langue">
                  <option value="">Toutes les langues</option>
                  {LANGUES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                </Select>
              </div>}
              {pros.length === 0 ? (
                <Vide titre={filtre ? 'Aucun prestataire ne correspond' : besoin ? 'Pas encore de prestataire pour ce besoin' : 'Les premiers professionnels arrivent bientôt'}
                  texte={filtre ? 'Élargissez la recherche : un autre canton ou une autre langue.' : 'Finalyn les sélectionne et vérifie leurs certifications. Ils apparaîtront ici dès leur publication.'}
                  action={filtre ? (
                    <Button size="sm" variant="outline" onClick={() => { setRecherche(''); setCanton(''); setLangue('') }}>
                      <RotateCcw className="h-3.5 w-3.5" />Effacer les filtres
                    </Button>
                  ) : undefined}
                />
              ) : (
                <div className="grid gap-3 xl:grid-cols-2">
                  {pros.map((p) => <FichePro key={p.id} p={p} contacteLe={derniere.get(p.id) ?? null} onContacter={() => onContacter(p)} />)}
                </div>
              )}
            </Bloc>
          )}

          {avecOutils && (outils.length > 0 || besoin?.outils) && (
            <Bloc titre={besoin?.outils ? besoin.titre : 'Outils'} aide="Des services en ligne qui prolongent Diagly, avec une offre réservée à ses utilisateurs.">
              {outils.length === 0 ? (
                <Vide titre="Pas encore d’outil pour ce besoin" texte="Finalyn recherche des outils pour y répondre." />
              ) : (
                <div className="grid gap-3 xl:grid-cols-2">{outils.map((p) => <FicheOutil key={p.id} p={p} />)}</div>
              )}
            </Bloc>
          )}

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            L’annuaire est tenu par Finalyn. Une certification marquée d’un écusson a été contrôlée par Finalyn auprès de l’organisme qui la délivre,
            comme la liste officielle des experts CECB®. CECB® est une marque de la Conférence des directeurs cantonaux de l’énergie (EnDK).
          </p>
        </>
      )}
    </>
  )
}

function FichePro({ p, contacteLe, onContacter }: { p: Partenaire; contacteLe: string | null; onContacter: () => void }) {
  return (
    <div className="flex flex-col rounded-2xl border border-black/[0.06] bg-white p-4" data-visite="partenaire-fiche">
      <div className="flex items-start gap-3">
        <Initiales nom={p.nom} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{p.nom}</p>
          <p className="text-xs text-muted-foreground">{p.metiers.map((m) => LIBELLE_METIER[m]).join(' · ')}</p>
        </div>
      </div>

      {p.verifie && p.certification && (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-emerald-700">
          <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0" />{p.certification}
        </p>
      )}
      {p.description && <p className="mt-2 line-clamp-3 text-sm text-neutral-600">{p.description}</p>}

      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
        <p className="flex items-start gap-1.5">
          <MapPin className="mt-px h-3.5 w-3.5 shrink-0" />
          <span>{[p.localite, p.cantons.length ? `intervient en ${p.cantons.join(', ')}` : null].filter(Boolean).join(', ')}</span>
        </p>
        {p.langues.length > 0 && (
          <p className="flex items-center gap-1.5"><Languages className="h-3.5 w-3.5 shrink-0" />{p.langues.map((l) => LIBELLE_LANGUE[l] ?? l).join(', ')}</p>
        )}
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
        <Button size="sm" onClick={onContacter} data-visite="partenaire-contacter"><Send className="h-3.5 w-3.5" />Contacter</Button>
        {p.telephone && <a href={`tel:${p.telephone.replace(/\s/g, '')}`} className={lienAction}><Phone className="h-3.5 w-3.5" />{p.telephone}</a>}
        {p.siteWeb && <a href={urlSite(p.siteWeb)} target="_blank" rel="noopener noreferrer" className={lienAction}><Globe className="h-3.5 w-3.5" />Site web</a>}
        {contacteLe && <span className="ml-auto text-[11px] text-muted-foreground">Contacté le {formatDate(new Date(contacteLe))}</span>}
      </div>
    </div>
  )
}

/** Un outil partenaire : on le rejoint par son lien, l'offre comprise. */
function FicheOutil({ p }: { p: Partenaire }) {
  const lien = p.lienOffre ?? (p.siteWeb ? urlSite(p.siteWeb) : null)
  // Le lien s'ouvre tout de suite ; l'ouverture est comptée à côté, sans la retarder.
  const compter = () => { api.partenaires.ouvrirOffre(p.id).catch(() => {}) }
  return (
    <div className="flex flex-col rounded-2xl border border-black/[0.06] bg-white p-4" data-visite="partenaire-outil">
      <div className="flex items-start gap-3">
        <Initiales nom={p.nom} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{p.nom}</p>
          <p className="text-xs text-muted-foreground">{p.categorie ?? 'Outil en ligne'}</p>
        </div>
      </div>
      {p.description && <p className="mt-3 text-sm text-neutral-600">{p.description}</p>}
      {p.offre && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          <Gift className="mt-px h-3.5 w-3.5 shrink-0" />{p.offre}
        </p>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
        {lien && (
          <a href={lien} target="_blank" rel="noopener" onClick={compter}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-black/10 bg-white/80 px-3 text-xs font-medium shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-colors hover:border-black/[0.14] hover:bg-white">
            <ExternalLink className="h-3.5 w-3.5" />{p.offre ? 'Profiter de l’offre' : 'Découvrir'}
          </a>
        )}
        {p.siteWeb && p.lienOffre && <a href={urlSite(p.siteWeb)} target="_blank" rel="noopener noreferrer" className={lienAction}><Globe className="h-3.5 w-3.5" />Site web</a>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- contact

function DialogueContact({ partenaire, metier, mailConfigured, onFermer, onEnvoyee }: {
  partenaire: Partenaire
  metier: MetierPartenaire
  mailConfigured: boolean
  onFermer: () => void
  onEnvoyee: (d: DemandePartenaire) => void
}) {
  const user = useAuth((s) => s.user)
  const auteur = user ? nomAffiche(user) : ''
  const projets = useQuery({ queryKey: ['projects'], queryFn: () => api.projects.list() })
  const [projectId, setProjectId] = useState('')
  const [partager, setPartager] = useState(false)
  const [objet, setObjet] = useState(() => objetPropose(metier))
  const [message, setMessage] = useState(() => messagePropose(metier, partenaire, auteur, false))
  const [touche, setTouche] = useState({ objet: false, message: false })
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  // Le premier jet suit le dossier choisi tant que l'utilisateur ne l'a pas réécrit.
  const choisirDossier = (id: string) => {
    setProjectId(id)
    if (!id) setPartager(false)
    const nom = projets.data?.projects.find((p) => p.id === id)?.name ?? null
    if (!touche.objet) setObjet(objetPropose(metier, nom))
    if (!touche.message) setMessage(messagePropose(metier, partenaire, auteur, !!id))
  }

  const envoyer = async (mode: 'send' | 'messagerie') => {
    if (!objet.trim() || !message.trim()) { setErreur('Donnez un objet et un message à votre demande.'); return }
    setEnCours(true); setErreur(null)
    let demande: DemandePartenaire
    try {
      ({ demande } = await api.partenaires.contacter(partenaire.id, { projectId: projectId || null, partagerRapport: partager, objet: objet.trim(), message: message.trim(), mode }))
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'La demande n’a pas pu partir. Réessayez dans un instant.')
      setEnCours(false)
      return
    }
    // La demande est enregistrée : la suite ne doit plus pouvoir la faire passer pour un échec.
    setEnCours(false)
    if (mode === 'messagerie' && partenaire.email) {
      window.location.href = `mailto:${partenaire.email}?subject=${encodeURIComponent(demande.objet)}&body=${encodeURIComponent(corpsPourMessagerie(demande))}`
    }
    onEnvoyee(demande)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-neutral-900/50" onClick={enCours ? undefined : onFermer} />
      <div role="dialog" aria-modal="true" aria-label={`Contacter ${partenaire.nom}`} className="relative flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-xl">
        <div className="flex items-start gap-3 border-b border-black/[0.06] px-5 py-3.5">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Contacter {partenaire.nom}</p>
            <p className="text-xs text-muted-foreground">{partenaire.metiers.map((m) => LIBELLE_METIER[m]).join(' · ')}</p>
          </div>
          <button onClick={onFermer} disabled={enCours} aria-label="Fermer" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <Champ label="Dossier joint (facultatif)" aide={projectId
            ? 'Le prestataire reçoit le résumé du bâtiment : adresse, type, année, éléments relevés, priorités et coût estimé.'
            : 'Joignez un dossier pour que le prestataire sache de quel bâtiment il s’agit.'}>
            <Select value={projectId} onChange={(e) => choisirDossier(e.target.value)} disabled={projets.isLoading}>
              <option value="">{projets.isLoading ? 'Chargement des dossiers…' : 'Aucun dossier'}</option>
              {(projets.data?.projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}{p.city ? `, ${p.city}` : ''}</option>)}
            </Select>
          </Champ>
          {projectId && (
            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-black/[0.06] px-3 py-2.5">
              <input type="checkbox" checked={partager} onChange={(e) => setPartager(e.target.checked)} className="mt-0.5 h-4 w-4 accent-neutral-900" />
              <span className="min-w-0">
                <span className="block text-sm font-medium">Joindre le rapport en lecture seule</span>
                <span className="block text-xs text-muted-foreground">Un lien vers le rapport complet, sans compte Diagly. Vous pourrez couper le partage depuis les rapports du dossier.</span>
              </span>
            </label>
          )}
          <Champ label="Objet">
            <Input value={objet} onChange={(e) => { setObjet(e.target.value); setTouche((t) => ({ ...t, objet: true })) }} />
          </Champ>
          <Champ label="Message">
            <Textarea value={message} onChange={(e) => { setMessage(e.target.value); setTouche((t) => ({ ...t, message: true })) }} rows={10} className="text-sm leading-relaxed" />
          </Champ>
          <p className="rounded-xl bg-neutral-50 px-3 py-2 text-xs text-muted-foreground">
            {mailConfigured
              ? <>Le message part à votre nom. {partenaire.nom} vous répond directement à <b className="font-medium text-neutral-700">{user?.email}</b>.</>
              : <>L’envoi direct n’est pas configuré sur ce serveur : la demande s’ouvre dans votre messagerie, prête à partir, et elle est notée dans vos demandes.</>}
          </p>
          {erreur && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-800">{erreur}</p>}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-black/[0.06] px-5 py-3">
          <Button size="sm" variant="outline" onClick={() => envoyer('messagerie')} disabled={enCours}>
            <Mail className="h-3.5 w-3.5" />Ouvrir dans la messagerie
          </Button>
          {mailConfigured && (
            <Button size="sm" onClick={() => envoyer('send')} disabled={enCours} data-visite="partenaire-envoyer">
              {enCours ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}Envoyer la demande
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- mes demandes

function SectionDemandes({ demandes, confirmation, onFermerConfirmation, onAnnuaire, onChange }: {
  demandes: DemandePartenaire[] | null
  confirmation: string | null
  onFermerConfirmation: () => void
  onAnnuaire: () => void
  onChange: () => void
}) {
  if (demandes === null) return <Chargement />
  const ouvertes = demandes.filter((d) => EN_COURS.includes(d.statut))
  const closes = demandes.filter((d) => !EN_COURS.includes(d.statut))

  return (
    <>
      {confirmation && (
        <div className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <Check className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="min-w-0 flex-1">{confirmation}</p>
          <button onClick={onFermerConfirmation} aria-label="Fermer" className="rounded-md p-0.5 text-emerald-800/70 hover:text-emerald-900"><X className="h-4 w-4" /></button>
        </div>
      )}
      {demandes.length === 0 ? (
        <Vide titre="Aucune demande pour l’instant"
          texte="Contactez un prestataire depuis l’annuaire : la demande apparaîtra ici, avec le dossier joint et son suivi."
          action={<Button size="sm" variant="outline" onClick={onAnnuaire}><Users className="h-3.5 w-3.5" />Trouver un prestataire</Button>}
        />
      ) : (
        <>
          <Bloc titre="En cours" aide={ouvertes.length ? 'Notez où en est l’échange : la liste reste à jour, pour vous et votre équipe.' : 'Aucun échange en cours.'}>
            <div className="space-y-2">{ouvertes.map((d) => <LigneDemande key={d.id} d={d} onChange={onChange} />)}</div>
          </Bloc>
          {closes.length > 0 && (
            <Bloc titre="Terminées">
              <div className="space-y-2">{closes.map((d) => <LigneDemande key={d.id} d={d} onChange={onChange} />)}</div>
            </Bloc>
          )}
        </>
      )}
    </>
  )
}

function LigneDemande({ d, onChange }: { d: DemandePartenaire; onChange: () => void }) {
  const [ouvert, setOuvert] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const suivre = async (statut: 'EN_COURS' | 'TERMINEE' | 'MESSAGERIE') => {
    setEnCours(true)
    try { await api.partenaires.suivre(d.id, statut); onChange() } finally { setEnCours(false) }
  }
  const rouvrir = async () => {
    if (!d.partner.email) return
    window.location.href = `mailto:${d.partner.email}?subject=${encodeURIComponent(d.objet)}&body=${encodeURIComponent(corpsPourMessagerie(d))}`
    await suivre('MESSAGERIE')
  }

  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white">
      <button onClick={() => setOuvert((o) => !o)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{d.objet}</p>
          <p className="truncate text-xs text-muted-foreground">
            {d.partner.nom} · {formatDate(new Date(d.createdAt))}{d.projet ? ` · ${d.projet}` : ''}
          </p>
        </div>
        <Statut statut={d.statut} />
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', ouvert && 'rotate-180')} />
      </button>
      {ouvert && (
        <div className="space-y-3 border-t border-black/[0.06] px-4 py-3">
          <p className="whitespace-pre-line text-sm leading-relaxed text-neutral-700">{d.message}</p>
          {d.dossier && (
            <div className="rounded-xl bg-neutral-50 px-3 py-2.5">
              <p className="mb-1 text-xs font-medium text-neutral-700">Dossier joint</p>
              <p className="whitespace-pre-line text-xs leading-relaxed text-neutral-600">{d.dossier}</p>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {d.partner.email && <a href={`mailto:${d.partner.email}`} className="inline-flex items-center gap-1 hover:text-foreground"><Mail className="h-3 w-3" />{d.partner.email}</a>}
            {d.partner.telephone && <a href={`tel:${d.partner.telephone.replace(/\s/g, '')}`} className="inline-flex items-center gap-1 hover:text-foreground"><Phone className="h-3 w-3" />{d.partner.telephone}</a>}
            {d.lienRapport && <a href={d.lienRapport} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-foreground"><ExternalLink className="h-3 w-3" />Rapport partagé</a>}
            {d.projectId && <Link to={lienDossier(d.projectId)} className="inline-flex items-center gap-1 hover:text-foreground"><FolderOpen className="h-3 w-3" />Ouvrir le dossier</Link>}
          </div>
          <div className="flex flex-wrap gap-2">
            {d.statut === 'ECHEC' && d.partner.email && <Button size="sm" variant="outline" onClick={rouvrir} disabled={enCours}><Mail className="h-3.5 w-3.5" />Ouvrir dans la messagerie</Button>}
            {(d.statut === 'ENVOYEE' || d.statut === 'MESSAGERIE') && <Button size="sm" variant="outline" onClick={() => suivre('EN_COURS')} disabled={enCours}>Le prestataire a répondu</Button>}
            {d.statut !== 'TERMINEE' && <Button size="sm" variant="outline" onClick={() => suivre('TERMINEE')} disabled={enCours}><Check className="h-3.5 w-3.5" />Marquer comme terminée</Button>}
            {d.statut === 'TERMINEE' && <Button size="sm" variant="ghost" onClick={() => suivre('EN_COURS')} disabled={enCours}><RotateCcw className="h-3.5 w-3.5" />Reprendre l’échange</Button>}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- gestion (Finalyn)

type Brouillon = Pick<Partenaire,
  'type' | 'nom' | 'contact' | 'metiers' | 'cantons' | 'langues' | 'description' | 'categorie' | 'offre' | 'lienOffre'
  | 'email' | 'telephone' | 'siteWeb' | 'localite' | 'verifie' | 'certification' | 'actif'>
const VIERGE: Brouillon = {
  type: 'PRO', nom: '', contact: '', metiers: [], cantons: [], langues: ['fr'], description: '', categorie: '', offre: '', lienOffre: '',
  email: '', telephone: '', siteWeb: '', localite: '', verifie: false, certification: '', actif: true,
}

function SectionGestion({ onChange }: { onChange: () => void }) {
  const tous = useQuery({ queryKey: ['partenaires', 'tous'], queryFn: () => api.partenaires.list(true) })
  const [edition, setEdition] = useState<Partenaire | 'nouveau' | null>(null)
  const liste = tous.data?.partenaires ?? []
  const rafraichir = async () => { await tous.refetch(); onChange() }

  if (edition) {
    return <FormulairePartenaire initial={edition === 'nouveau' ? null : edition} onFermer={() => setEdition(null)} onEnregistre={async () => { setEdition(null); await rafraichir() }} />
  }

  const retirer = async (p: Partenaire) => {
    const n = p._count?.demandes ?? 0
    const question = n > 0
      ? `Retirer « ${p.nom} » de l’annuaire ? ${pluriel(n, 'demande reste lisible', 'demandes restent lisibles')} par ceux qui l’ont contacté.`
      : `Supprimer « ${p.nom} » de l’annuaire ?`
    if (!confirm(question)) return
    await api.partenaires.remove(p.id); await rafraichir()
  }
  const republier = async (p: Partenaire) => { await api.partenaires.update(p.id, { actif: true }); await rafraichir() }
  const publies = liste.filter((p) => p.actif).length

  return (
    <Bloc
      titre="Prestataires"
      aide={tous.isLoading ? undefined : `${pluriel(publies, 'publié', 'publiés')}, ${pluriel(liste.length - publies, 'retiré', 'retirés')}`}
      action={<Button size="sm" onClick={() => setEdition('nouveau')} className="shrink-0"><Plus className="h-3.5 w-3.5" />Ajouter un prestataire</Button>}
    >
      {tous.isLoading ? <Chargement /> : liste.length === 0 ? (
        <Vide titre="Aucun prestataire" texte="Ajoutez le premier : il sera visible de tous les comptes dès sa publication." />
      ) : (
        <div className="divide-y divide-black/[0.06] overflow-hidden rounded-2xl border border-black/[0.06]">
          {liste.map((p) => (
            <div key={p.id} className={cn('flex items-center gap-3 px-4 py-3', !p.actif && 'bg-neutral-50')}>
              <div className="min-w-0 flex-1">
                <p className={cn('truncate text-sm font-semibold', !p.actif && 'text-muted-foreground')}>
                  {p.nom}{p.verifie && <ShieldCheck className="ml-1.5 inline h-3.5 w-3.5 text-emerald-600" aria-label="Vérifié" />}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {p.type === 'OUTIL'
                    ? `Outil · ${p.categorie ?? 'sans catégorie'} · ${pluriel(p.clics, 'ouverture de l’offre', 'ouvertures de l’offre')}`
                    : `${p.metiers.map((m) => LIBELLE_METIER[m]).join(' · ')} · ${p.cantons.join(', ') || 'aucun canton'} · ${pluriel(p._count?.demandes ?? 0, 'demande', 'demandes')}`}
                </p>
              </div>
              <span className="hidden shrink-0 items-center gap-1.5 text-xs text-neutral-600 sm:inline-flex">
                <span className={cn('h-1.5 w-1.5 rounded-full', p.actif ? 'bg-emerald-500' : 'bg-neutral-300')} />{p.actif ? 'Publié' : 'Retiré'}
              </span>
              <Button size="sm" variant="ghost" onClick={() => setEdition(p)} aria-label={`Modifier ${p.nom}`}><Pencil className="h-3.5 w-3.5" />Modifier</Button>
              {p.actif
                ? <Button size="sm" variant="ghost" onClick={() => retirer(p)} aria-label={`Retirer ${p.nom}`}><Trash2 className="h-3.5 w-3.5" /></Button>
                : <Button size="sm" variant="ghost" onClick={() => republier(p)}><RotateCcw className="h-3.5 w-3.5" />Republier</Button>}
            </div>
          ))}
        </div>
      )}
    </Bloc>
  )
}

function FormulairePartenaire({ initial, onFermer, onEnregistre }: { initial: Partenaire | null; onFermer: () => void; onEnregistre: () => Promise<void> }) {
  const [f, setF] = useState<Brouillon>(() => (initial ? {
    type: initial.type, nom: initial.nom, contact: initial.contact ?? '', metiers: initial.metiers, cantons: initial.cantons, langues: initial.langues,
    description: initial.description ?? '', categorie: initial.categorie ?? '', offre: initial.offre ?? '', lienOffre: initial.lienOffre ?? '',
    email: initial.email ?? '', telephone: initial.telephone ?? '', siteWeb: initial.siteWeb ?? '', localite: initial.localite ?? '',
    verifie: initial.verifie, certification: initial.certification ?? '', actif: initial.actif,
  } : VIERGE))
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const poser = (p: Partial<Brouillon>) => setF((v) => ({ ...v, ...p }))
  const outil = f.type === 'OUTIL'
  const expertCecb = f.metiers.includes('EXPERT_CECB')

  const enregistrer = async () => {
    if (!f.nom.trim()) { setErreur('Donnez un nom au prestataire.'); return }
    setEnCours(true); setErreur(null)
    try {
      // Un outil n'a ni métier ni canton : ce qui reste d'une saisie en professionnel part avec.
      const corps = outil ? { ...f, metiers: [], cantons: [], verifie: f.verifie && !!f.certification } : f
      if (initial) await api.partenaires.update(initial.id, corps)
      else await api.partenaires.create(corps)
      await onEnregistre()
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'L’enregistrement a échoué.')
    } finally {
      setEnCours(false)
    }
  }

  const TYPES = [
    { id: 'PRO' as const, titre: 'Professionnel', texte: 'Un bureau ou une entreprise. Il reçoit les demandes par email.' },
    { id: 'OUTIL' as const, titre: 'Outil ou service', texte: 'Un service en ligne. On le rejoint par un lien, souvent avec une offre.' },
  ]

  return (
    <>
      <Bloc titre={initial ? `Modifier ${initial.nom}` : 'Nouveau prestataire'} aide="Ce que voient tous les comptes Diagly dans l’annuaire.">
        <div className="mb-4 grid gap-2 sm:grid-cols-2">
          {TYPES.map((t) => (
            <button key={t.id} type="button" onClick={() => poser({ type: t.id })} aria-pressed={f.type === t.id}
              className={cn('rounded-2xl border px-3.5 py-3 text-left transition-colors', f.type === t.id ? 'border-blue-200 bg-blue-50/70' : 'border-black/[0.06] hover:border-black/[0.12]')}>
              <span><span className="block text-sm font-semibold">{t.titre}</span><span className="block text-xs text-muted-foreground">{t.texte}</span></span>
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Champ label={outil ? 'Nom de l’outil' : 'Nom du bureau'}><Input value={f.nom} onChange={(e) => poser({ nom: e.target.value })} /></Champ>
          {outil
            ? <Champ label="Catégorie" aide="En quelques mots, ce que fait l’outil."><Input value={f.categorie ?? ''} onChange={(e) => poser({ categorie: e.target.value })} placeholder="Images par IA" /></Champ>
            : <Champ label="Personne de contact" aide="Utilisée pour saluer dans les demandes."><Input value={f.contact ?? ''} onChange={(e) => poser({ contact: e.target.value })} /></Champ>}
          <Champ label={outil ? 'Email (facultatif)' : 'Email'} aide={outil ? 'Pour Finalyn, il n’est pas affiché.' : 'Les demandes y arrivent.'}>
            <Input type="email" value={f.email ?? ''} onChange={(e) => poser({ email: e.target.value })} />
          </Champ>
          {outil
            ? <Champ label="Site web"><Input value={f.siteWeb ?? ''} onChange={(e) => poser({ siteWeb: e.target.value })} placeholder="www.exemple.ch" /></Champ>
            : <Champ label="Téléphone"><Input value={f.telephone ?? ''} onChange={(e) => poser({ telephone: e.target.value })} /></Champ>}
          {!outil && (
            <>
              <Champ label="Localité"><Input value={f.localite ?? ''} onChange={(e) => poser({ localite: e.target.value })} placeholder="1003 Lausanne" /></Champ>
              <Champ label="Site web"><Input value={f.siteWeb ?? ''} onChange={(e) => poser({ siteWeb: e.target.value })} placeholder="www.exemple.ch" /></Champ>
            </>
          )}
        </div>
        <div className="mt-3">
          <Champ label="Présentation"><Textarea value={f.description ?? ''} onChange={(e) => poser({ description: e.target.value })} rows={4} className="text-sm" /></Champ>
        </div>
      </Bloc>

      {outil ? (
        <Bloc titre="Offre aux utilisateurs de Diagly" aide="Le lien qui donne l’offre (lien de parrainage ou d’affiliation), et ce qu’elle apporte. Les ouvertures du lien sont comptées.">
          <div className="grid gap-3">
            <Champ label="Lien de l’offre"><Input value={f.lienOffre ?? ''} onChange={(e) => poser({ lienOffre: e.target.value })} placeholder="https://…" /></Champ>
            <Champ label="L’offre, en une phrase"><Input value={f.offre ?? ''} onChange={(e) => poser({ offre: e.target.value })} placeholder="Des crédits offerts à l’inscription par ce lien" /></Champ>
          </div>
        </Bloc>
      ) : (
        <>
          <Bloc titre="Métiers">
            <Pastilles options={METIERS} valeur={f.metiers} onChange={(metiers) => poser({ metiers })} />
          </Bloc>
          <Bloc titre="Cantons couverts">
            <Pastilles options={CANTONS.map((c) => ({ id: c, label: c }))} valeur={f.cantons} onChange={(cantons) => poser({ cantons })} />
          </Bloc>
          <Bloc titre="Langues de travail">
            <Pastilles options={LANGUES} valeur={f.langues} onChange={(langues) => poser({ langues })} />
          </Bloc>
          <Bloc titre="Vérification" aide={expertCecb
            ? 'Un expert CECB® doit figurer sur la liste officielle de l’Association CECB. Le titre ne peut pas être publié sans cette vérification.'
            : 'Ce que Finalyn a contrôlé (une certification, une inscription à un registre), affiché tel quel avec un écusson.'}>
            <label className="flex cursor-pointer items-center gap-2.5 text-sm">
              <input type="checkbox" checked={f.verifie} onChange={(e) => poser({ verifie: e.target.checked })} className="h-4 w-4 accent-neutral-900" />
              Certification vérifiée par Finalyn
            </label>
            {f.verifie && (
              <div className="mt-3">
                <Champ label="Ce qui a été vérifié" aide="Par exemple : Expert CECB® certifié, liste officielle consultée le 12.10.2026.">
                  <Input value={f.certification ?? ''} onChange={(e) => poser({ certification: e.target.value })} />
                </Champ>
              </div>
            )}
          </Bloc>
        </>
      )}

      <Bloc titre="Publication">
        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <input type="checkbox" checked={f.actif} onChange={(e) => poser({ actif: e.target.checked })} className="h-4 w-4 accent-neutral-900" />
          Visible dans l’annuaire
        </label>
      </Bloc>

      {erreur && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-800">{erreur}</p>}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onFermer} disabled={enCours}>Annuler</Button>
        <Button size="sm" onClick={enregistrer} disabled={enCours}>
          {enCours ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}{initial ? 'Enregistrer' : 'Ajouter à l’annuaire'}
        </Button>
      </div>
    </>
  )
}

function SectionToutes() {
  const q = useQuery({ queryKey: ['partenaires', 'admin-demandes'], queryFn: () => api.partenaires.demandesAdmin() })
  if (q.isLoading) return <Chargement />
  const demandes = q.data?.demandes ?? []
  if (demandes.length === 0) return <Vide titre="Aucune demande" texte="Les mises en relation de tous les comptes apparaîtront ici." />
  return (
    <div className="overflow-hidden rounded-2xl border border-black/[0.06]">
      <table className="w-full text-sm">
        <thead className="bg-neutral-50 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-2 font-medium">Date</th>
            <th className="px-4 py-2 font-medium">De</th>
            <th className="px-4 py-2 font-medium">Prestataire</th>
            <th className="px-4 py-2 font-medium">Objet</th>
            <th className="px-4 py-2 font-medium">Statut</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/[0.06]">
          {demandes.map((d) => (
            <tr key={d.id}>
              <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">{new Date(d.createdAt).toLocaleDateString('fr-CH')}</td>
              <td className="px-4 py-2.5"><span className="block">{d.auteur}</span>{d.societe && <span className="block text-xs text-muted-foreground">{d.societe}</span>}</td>
              <td className="px-4 py-2.5">{d.partenaire}</td>
              <td className="max-w-[260px] truncate px-4 py-2.5">{d.objet}</td>
              <td className="px-4 py-2.5"><Statut statut={d.statut} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
