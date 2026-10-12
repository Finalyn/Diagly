/**
 * L'onglet Visite d'un dossier : tout ce qu'il faut pour que la visite ait lieu.
 *
 * Il remplace le bouton « Organiser la visite », qui ouvrait un seul message à
 * copier. Ici on tient les interlocuteurs du bâtiment, on fixe le rendez-vous
 * (il part dans le calendrier et dans la date de visite du diagnostic), on
 * prépare documents, accès et matériel, et l'on envoie les mails de chaque
 * étape, pré-remplis, avec leur historique.
 *
 * L'envoi passe par le serveur quand il sait envoyer des emails ; sinon le mail
 * s'ouvre dans la messagerie de l'utilisateur. Dans les deux cas il est noté.
 */
import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Loader2, AlertCircle, Plus, Pencil, Trash2, Mail, Phone, Check, Copy, Printer, Send, X, ChevronDown, CalendarCheck,
} from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select, Textarea } from '@/components/ui'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/stores/auth'
import { cn } from '@/lib/utils'
import { imprimerHtml } from '@/lib/impression'
import type { ApiProject, VisitContact, VisitContactRole, VisitMail, VisitPlan } from '@/lib/api-types'
import {
  MODELES, MOMENTS, PREPARATION, ROLE_LABEL, dateLongue, destinatairesParDefaut, duree, heure, modele,
  type ContexteVisite, type Expediteur, type Modele,
} from '@/lib/visite-mails'

const ROLES: VisitContactRole[] = ['GERANCE', 'PROPRIETAIRE', 'CONCIERGE', 'LOCATAIRE', 'ENTREPRISE', 'AUTRE']
const DUREES = [60, 90, 120, 180, 240, 480]
const STATUT: Record<VisitMail['status'], string> = { ENVOYE: 'Envoyé', MESSAGERIE: 'Ouvert dans la messagerie', ECHEC: 'Échec de l’envoi' }

const pad = (n: number) => String(n).padStart(2, '0')
const versDate = (iso?: string | null) => { if (!iso) return ''; const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
const versHeure = (iso?: string | null) => { if (!iso) return ''; const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}` }
const versLocal = (iso: string) => `${versDate(iso)}T${versHeure(iso)}`
const dateHeure = (iso: string) => new Date(iso).toLocaleString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export function ProjectVisite() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const user = useAuth((s) => s.user)
  const projectQuery = useQuery({ queryKey: ['project', id], queryFn: () => api.projects.get(id!), enabled: !!id })
  const visiteQuery = useQuery({ queryKey: ['visite', id], queryFn: () => api.visite.get(id!), enabled: !!id })
  const [composer, setComposer] = useState<Modele | null>(null)

  const expediteur: Expediteur = useMemo(() => ({
    nom: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || '',
    societe: user?.preferences?.company?.name || user?.companyName || null,
    telephone: user?.phone || user?.preferences?.company?.phone || null,
    email: user?.email || null,
    logo: user?.preferences?.company?.logo || null,
  }), [user])

  if (projectQuery.isLoading || visiteQuery.isLoading) {
    return <div className="flex items-center justify-center py-32 text-muted-foreground"><Loader2 className="mr-2 h-6 w-6 animate-spin" />Chargement…</div>
  }
  if (!projectQuery.data || !visiteQuery.data) {
    return (
      <Card><CardContent className="py-16 text-center">
        <AlertCircle className="mx-auto mb-2 h-8 w-8 text-red-500" />
        <p className="text-sm text-red-700">{((projectQuery.error || visiteQuery.error) as ApiError | null)?.message ?? 'Dossier introuvable'}</p>
      </CardContent></Card>
    )
  }

  const projet = projectQuery.data.project
  const { contacts, mails, mailConfigured } = visiteQuery.data
  const plan: VisitPlan = visiteQuery.data.plan ?? {}
  const ctx: ContexteVisite = { projet, plan, contacts, expediteur }

  const rafraichir = () => {
    qc.invalidateQueries({ queryKey: ['visite', id] })
  }
  const enregistrerPlan = async (patch: Partial<VisitPlan>) => {
    // Optimiste : la case se coche tout de suite.
    qc.setQueryData(['visite', id], (old: typeof visiteQuery.data) => old ? { ...old, plan: { ...(old.plan ?? {}), ...patch } } : old)
    await api.visite.savePlan(id!, patch)
    rafraichir()
    // Le rendez-vous se recopie dans la date de visite et le calendrier.
    if ('startAt' in patch) {
      qc.invalidateQueries({ queryKey: ['project', id] })
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: ['events'] })
    }
  }

  const rdv = plan.startAt ? new Date(plan.startAt) : null
  // Une date de visite saisie ailleurs (fiche du diagnostic), sans rendez-vous ici.
  const dateDiagnostic = !rdv ? projectQuery.data.diagnostics.find((d) => d.visitDate)?.visitDate ?? null : null
  const envoyes = (ids: string[]) => mails.some((m) => ids.includes(m.template) && m.status !== 'ECHEC')
  const ETAPES = [
    { titre: 'Interlocuteurs', aide: contacts.length ? `${contacts.length} enregistré${contacts.length > 1 ? 's' : ''}` : 'Gérance, propriétaire…', fait: contacts.length > 0 },
    { titre: 'Prise de contact', aide: envoyes(['demande', 'creneaux', 'documents']) ? 'Demande envoyée' : 'Demande à envoyer', fait: envoyes(['demande', 'creneaux', 'documents']) },
    { titre: 'Rendez-vous', aide: rdv ? `${rdv.toLocaleDateString('fr-CH', { day: 'numeric', month: 'long' })} à ${heure(rdv)}` : 'À fixer', fait: !!rdv },
    { titre: 'Occupants prévenus', aide: envoyes(['confirmation', 'avis-locataires', 'acces-logement']) ? 'Confirmation envoyée' : 'Confirmation et avis', fait: envoyes(['confirmation', 'avis-locataires', 'acces-logement']) },
    { titre: 'Visite', aide: rdv && rdv < new Date() ? 'Effectuée' : 'À venir', fait: !!rdv && rdv < new Date() },
  ]
  const courante = ETAPES.findIndex((e) => !e.fait)

  return (
    <div className="space-y-4 pb-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold md:text-2xl">Visite</h1>
          <p className="text-sm text-muted-foreground">
            {rdv
              ? `Rendez-vous le ${dateLongue(rdv)} à ${heure(rdv)}, durée ${duree(plan.durationMin ?? 120)}.`
              : dateDiagnostic
                ? `Le diagnostic indique une visite le ${dateLongue(new Date(dateDiagnostic))}. Précisez l’heure pour en faire un rendez-vous.`
                : 'Pas encore de rendez-vous. Commencez par les interlocuteurs, puis la demande de visite.'}
          </p>
        </div>
      </div>

      {/* Où en est l'organisation */}
      <Card className="overflow-hidden" data-visite="visite-etapes">
        <ol className="grid grid-cols-2 divide-black/[0.06] sm:grid-cols-5 sm:divide-x">
          {ETAPES.map((e, i) => (
            <li key={e.titre} className={cn('flex items-center gap-3 px-4 py-3.5', i === courante && 'bg-blue-50/60')}>
              <span className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                e.fait ? 'border-blue-600 bg-blue-600 text-white' : i === courante ? 'border-blue-300 bg-white text-blue-700' : 'border-black/10 bg-white text-muted-foreground',
              )}>
                {e.fait ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{e.titre}</span>
                <span className="block truncate text-xs text-muted-foreground">{e.aide}</span>
              </span>
            </li>
          ))}
        </ol>
      </Card>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-4">
          <RendezVous key={JSON.stringify([plan.startAt, plan.durationMin, plan.meetingPoint, plan.openerContactId, plan.notes, plan.creneaux])}
            plan={plan} dateDiagnostic={dateDiagnostic} contacts={contacts} onEnregistrer={enregistrerPlan} />
          <MailsCard ctx={ctx} mails={mails} onPreparer={setComposer} />
          <Historique mails={mails} />
        </div>
        <div className="min-w-0 space-y-4">
          <Interlocuteurs projectId={id!} contacts={contacts} onChange={rafraichir} />
          <Preparation plan={plan} onCocher={(cle, v) => enregistrerPlan({ checklist: { ...(plan.checklist ?? {}), [cle]: v } })} />
        </div>
      </div>

      {composer && (
        <Composer
          key={composer.id}
          modele={composer}
          ctx={ctx}
          projet={projet}
          mailConfigured={mailConfigured}
          onFermer={() => setComposer(null)}
          onEnvoye={() => { setComposer(null); rafraichir() }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------- briques

function Panneau({ titre, aide, action, children, className, visite }: { titre: string; aide?: string; action?: React.ReactNode; children: React.ReactNode; className?: string; visite?: string }) {
  return (
    <Card className={cn('overflow-hidden', className)} data-visite={visite}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 border-b border-black/[0.06] px-5 py-3.5">
        <div className="min-w-0">
          <CardTitle className="text-base">{titre}</CardTitle>
          {aide && <p className="mt-0.5 text-sm text-muted-foreground">{aide}</p>}
        </div>
        {action}
      </CardHeader>
      <CardContent className="p-5">{children}</CardContent>
    </Card>
  )
}

function Champ({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

// ---------------------------------------------------------------- rendez-vous

function RendezVous({ plan, dateDiagnostic, contacts, onEnregistrer }: {
  plan: VisitPlan; dateDiagnostic: string | null; contacts: VisitContact[]; onEnregistrer: (p: Partial<VisitPlan>) => Promise<void>
}) {
  const [date, setDate] = useState(versDate(plan.startAt ?? dateDiagnostic))
  const [h, setH] = useState(versHeure(plan.startAt) || '09:00')
  const [min, setMin] = useState(plan.durationMin ?? 120)
  const [lieu, setLieu] = useState(plan.meetingPoint ?? '')
  const [ouvreur, setOuvreur] = useState(plan.openerContactId ?? '')
  const [notes, setNotes] = useState(plan.notes ?? '')
  const [creneaux, setCreneaux] = useState<string[]>((plan.creneaux ?? []).map((c) => versLocal(c.startAt)))
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const startAt = date ? new Date(`${date}T${h || '09:00'}`).toISOString() : null
  const modifie =
    startAt !== (plan.startAt ? new Date(plan.startAt).toISOString() : null)
    || min !== (plan.durationMin ?? 120) || lieu !== (plan.meetingPoint ?? '')
    || ouvreur !== (plan.openerContactId ?? '') || notes !== (plan.notes ?? '')
    || JSON.stringify(creneaux) !== JSON.stringify((plan.creneaux ?? []).map((c) => versLocal(c.startAt)))

  const enregistrer = async (patch?: Partial<VisitPlan>) => {
    setEnCours(true); setErreur(null)
    try {
      await onEnregistrer(patch ?? {
        startAt, durationMin: min, meetingPoint: lieu.trim() || null, openerContactId: ouvreur || null, notes: notes.trim() || null,
        creneaux: creneaux.filter(Boolean).map((c) => ({ startAt: new Date(c).toISOString() })),
      })
    } catch (e) { setErreur(e instanceof ApiError ? e.message : 'Enregistrement impossible.') } finally { setEnCours(false) }
  }

  return (
    <Panneau
      visite="visite-rdv"
      titre="Rendez-vous"
      aide="Il s’inscrit dans votre calendrier, avec un rappel, et devient la date de visite du diagnostic."
      action={plan.startAt ? (
        <Button size="sm" variant="ghost" className="shrink-0 text-muted-foreground" onClick={() => { if (confirm('Retirer le rendez-vous ? Il disparaît aussi du calendrier.')) enregistrer({ startAt: null }) }}>
          Retirer
        </Button>
      ) : undefined}
    >
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <Champ label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Champ>
          <Champ label="Heure"><Input type="time" value={h} onChange={(e) => setH(e.target.value)} step={900} /></Champ>
          <Champ label="Durée">
            <Select value={min} onChange={(e) => setMin(Number(e.target.value))}>
              {DUREES.map((d) => <option key={d} value={d}>{duree(d)}</option>)}
            </Select>
          </Champ>
          <Champ label="Lieu de rendez-vous" className="sm:col-span-2">
            <Input placeholder="Devant l’entrée principale" value={lieu} onChange={(e) => setLieu(e.target.value)} />
          </Champ>
          <Champ label="Qui ouvre les locaux">
            <Select value={ouvreur} onChange={(e) => setOuvreur(e.target.value)}>
              <option value="">Non précisé</option>
              {contacts.map((c) => <option key={c.id} value={c.id}>{c.name} ({ROLE_LABEL[c.role].toLowerCase()})</option>)}
            </Select>
          </Champ>
          <Champ label="Notes internes" className="sm:col-span-3">
            <Input placeholder="Code de la porte, place de parc, clé chez le concierge…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Champ>
        </div>

        <div className="border-t border-black/[0.06] pt-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Créneaux à proposer</p>
              <p className="text-xs text-muted-foreground">Avant que la date soit fixée : ils remplissent le mail « Proposition de créneaux ».</p>
            </div>
            {creneaux.length < 3 && (
              <Button size="sm" variant="outline" className="shrink-0" onClick={() => setCreneaux((c) => [...c, ''])}><Plus className="h-3.5 w-3.5" />Ajouter</Button>
            )}
          </div>
          {creneaux.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aucun créneau.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-3">
              {creneaux.map((c, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <Input type="datetime-local" value={c} step={900} onChange={(e) => setCreneaux((l) => l.map((x, j) => (j === i ? e.target.value : x)))} />
                  <button title="Retirer" onClick={() => setCreneaux((l) => l.filter((_, j) => j !== i))} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-black/[0.04] hover:text-foreground"><X className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {(modifie || erreur) && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/[0.06] pt-4">
            {erreur ? <p className="text-xs text-red-600">{erreur}</p> : <p className="text-xs text-muted-foreground">Modifications non enregistrées.</p>}
            <Button size="sm" onClick={() => enregistrer()} disabled={enCours || !modifie}>
              {enCours ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarCheck className="h-3.5 w-3.5" />}Enregistrer
            </Button>
          </div>
        )}
      </div>
    </Panneau>
  )
}

// ---------------------------------------------------------------- mails

function MailsCard({ ctx, mails, onPreparer }: { ctx: ContexteVisite; mails: VisitMail[]; onPreparer: (m: Modele) => void }) {
  return (
    <Panneau visite="visite-mails" titre="Mails" aide="Un mail par étape, pré-rempli avec le dossier. Vous le relisez et l’ajustez avant de l’envoyer.">
      <div className="space-y-5">
        {MOMENTS.map((moment) => (
          <section key={moment}>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{moment}</p>
            <div className="divide-y divide-black/[0.05] overflow-hidden rounded-xl border border-black/[0.06]">
              {MODELES.filter((m) => m.moment === moment).map((m) => {
                const dernier = mails.find((x) => x.template === m.id && x.status !== 'ECHEC')
                const manque = m.manque(ctx)
                return (
                  <div key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        {m.titre}
                        {dernier && <span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground"><Check className="h-3.5 w-3.5 text-blue-600" />{dernier.status === 'ENVOYE' ? 'envoyé' : 'préparé'} le {new Date(dernier.createdAt).toLocaleDateString('fr-CH', { day: 'numeric', month: 'long' })}</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">{manque ?? m.description}</p>
                    </div>
                    <Button size="sm" variant="outline" disabled={!!manque} onClick={() => onPreparer(m)} className="shrink-0">
                      <Mail className="h-3.5 w-3.5" />{dernier ? 'Renvoyer' : 'Préparer'}
                    </Button>
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </Panneau>
  )
}

function Historique({ mails }: { mails: VisitMail[] }) {
  const [ouvert, setOuvert] = useState<string | null>(null)
  return (
    <Panneau titre="Historique" aide="Tout ce qui est parti pour ce dossier.">
      {mails.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">Aucun mail pour l’instant.</p>
      ) : (
        <div className="divide-y divide-black/[0.05] overflow-hidden rounded-xl border border-black/[0.06]">
          {mails.map((m) => (
            <div key={m.id}>
              <button onClick={() => setOuvert((o) => (o === m.id ? null : m.id))} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-black/[0.02]">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{modele(m.template)?.titre ?? m.subject}</p>
                  <p className="truncate text-xs text-muted-foreground">À {m.recipients.map((r) => r.name || r.email).join(', ')}</p>
                </div>
                <div className="hidden shrink-0 text-right sm:block">
                  <p className={cn('text-xs', m.status === 'ECHEC' ? 'font-medium text-red-600' : 'text-foreground')}>{STATUT[m.status]}</p>
                  <p className="text-xs text-muted-foreground">{dateHeure(m.createdAt)}</p>
                </div>
                <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', ouvert === m.id && 'rotate-180')} />
              </button>
              {ouvert === m.id && (
                <div className="border-t border-black/[0.05] bg-neutral-50/70 px-4 py-3">
                  <p className="text-xs text-muted-foreground">Objet : <span className="text-foreground">{m.subject}</span></p>
                  <p className="text-xs text-muted-foreground">Par {m.authorName}, {dateHeure(m.createdAt)} · {STATUT[m.status]}</p>
                  <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed">{m.body}</pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Panneau>
  )
}

// ---------------------------------------------------------------- composition d'un mail

function Composer({ modele: m, ctx, projet, mailConfigured, onFermer, onEnvoye }: {
  modele: Modele; ctx: ContexteVisite; projet: ApiProject; mailConfigured: boolean; onFermer: () => void; onEnvoye: () => void
}) {
  const depart = useMemo(() => m.composer(ctx), [m, ctx])
  const avecEmail = ctx.contacts.filter((c) => c.email)
  const [choisis, setChoisis] = useState<string[]>(() => destinatairesParDefaut(m, ctx.contacts))
  const [autres, setAutres] = useState('')
  const [objet, setObjet] = useState(depart.objet)
  const [corps, setCorps] = useState(depart.corps)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [copie, setCopie] = useState(false)

  const libres = autres.split(/[,;\s]+/).map((x) => x.trim()).filter((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x))
  const destinataires = [
    ...avecEmail.filter((c) => choisis.includes(c.id)).map((c) => ({ name: c.name, email: c.email! })),
    ...libres.map((e) => ({ name: '', email: e })),
  ]
  const toggle = (idc: string) => setChoisis((l) => (l.includes(idc) ? l.filter((x) => x !== idc) : [...l, idc]))

  const noter = async (mode: 'send' | 'messagerie') => {
    setEnCours(true); setErreur(null)
    try {
      const r = await api.visite.sendMail(projet.id, { template: m.id, subject: objet, body: corps, recipients: destinataires, mode })
      if (r.mail.status === 'ECHEC') { setErreur('L’envoi a échoué. Le mail est noté dans l’historique ; vous pouvez l’ouvrir dans votre messagerie.'); return }
      onEnvoye()
    } catch (e) { setErreur(e instanceof ApiError ? e.message : 'Envoi impossible.') } finally { setEnCours(false) }
  }

  const ouvrirMessagerie = async () => {
    const to = destinataires.map((d) => d.email).join(',')
    window.location.href = `mailto:${to}?subject=${encodeURIComponent(objet)}&body=${encodeURIComponent(corps)}`
    await noter('messagerie')
  }

  const copier = async () => {
    try { await navigator.clipboard.writeText(`${objet}\n\n${corps}`); setCopie(true); setTimeout(() => setCopie(false), 2000) } catch { /* texte sélectionnable */ }
  }

  /** L'avis s'imprime aussi, pour l'afficher dans l'entrée de l'immeuble. */
  const imprimer = () => {
    const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const logo = ctx.expediteur.logo
    void imprimerHtml(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Avis aux locataires</title>
      <style>body{font-family:Arial,Helvetica,sans-serif;color:#1d1d1f;max-width:640px;margin:56px auto;line-height:1.6;font-size:15px}
      h1{font-size:26px;margin:0 0 6px}p.sous{color:#6e6e73;margin:0 0 32px}pre{white-space:pre-wrap;font-family:inherit;margin:0}
      img{max-height:56px;margin-bottom:28px}@page{margin:18mm}</style></head><body>
      ${logo ? `<img src="${esc(String(logo))}" alt="">` : ''}
      <h1>Avis aux locataires</h1><p class="sous">${esc(objet)}</p><pre>${esc(corps)}</pre>
      </body></html>`, 'Avis aux locataires').catch(() => undefined)
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onFermer() }}>
      <DialogContent className="flex max-h-[90vh] w-[min(760px,calc(100vw-32px))] max-w-none flex-col overflow-hidden p-0">
        <div className="flex items-start justify-between gap-3 border-b border-black/[0.06] px-5 py-3.5">
          <div>
            <p className="text-base font-semibold">{m.titre}</p>
            <p className="text-sm text-muted-foreground">{m.description}</p>
          </div>
          <button onClick={onFermer} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Destinataires</p>
            {avecEmail.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucun interlocuteur avec une adresse email. Ajoutez-en un, ou saisissez une adresse ci-dessous.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {avecEmail.map((c) => {
                  const on = choisis.includes(c.id)
                  return (
                    <button key={c.id} type="button" onClick={() => toggle(c.id)}
                      className={cn('inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors', on ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-black/10 bg-white text-muted-foreground hover:text-foreground')}>
                      {on && <Check className="h-3 w-3" />}{c.name}<span className="opacity-70">· {ROLE_LABEL[c.role]}{c.unit ? `, ${c.unit}` : ''}</span>
                    </button>
                  )
                })}
              </div>
            )}
            <Input className="mt-2" placeholder="Autres adresses, séparées par une virgule" value={autres} onChange={(e) => setAutres(e.target.value)} />
            {destinataires.length > 1 && mailConfigured && (
              <p className="mt-1 text-[11px] text-muted-foreground">Un envoi par destinataire : personne ne voit l’adresse des autres.</p>
            )}
          </div>
          <Champ label="Objet"><Input value={objet} onChange={(e) => setObjet(e.target.value)} /></Champ>
          <Champ label="Message"><Textarea value={corps} onChange={(e) => setCorps(e.target.value)} rows={16} className="text-sm leading-relaxed" /></Champ>
          {!mailConfigured && (
            <p className="rounded-xl bg-neutral-50 px-3 py-2 text-xs text-muted-foreground">
              L’envoi direct n’est pas configuré sur ce serveur : le mail s’ouvre dans votre messagerie, prêt à partir, et il est noté dans l’historique.
            </p>
          )}
          {erreur && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-800">{erreur}</p>}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-black/[0.06] px-5 py-3">
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={copier}>{copie ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copie ? 'Copié' : 'Copier'}</Button>
            {m.id === 'avis-locataires' && <Button size="sm" variant="ghost" onClick={imprimer}><Printer className="h-3.5 w-3.5" />Imprimer l’avis</Button>}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={ouvrirMessagerie} disabled={enCours || destinataires.length === 0}>
              <Mail className="h-3.5 w-3.5" />Ouvrir dans la messagerie
            </Button>
            {mailConfigured && (
              <Button size="sm" onClick={() => noter('send')} disabled={enCours || destinataires.length === 0}>
                {enCours ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}Envoyer{destinataires.length > 1 ? ` à ${destinataires.length}` : ''}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------- interlocuteurs

type Brouillon = { role: VisitContactRole; name: string; company: string; email: string; phone: string; unit: string }
const VIDE: Brouillon = { role: 'GERANCE', name: '', company: '', email: '', phone: '', unit: '' }

function Interlocuteurs({ projectId, contacts, onChange }: { projectId: string; contacts: VisitContact[]; onChange: () => void }) {
  const [edition, setEdition] = useState<string | 'nouveau' | null>(contacts.length ? null : 'nouveau')
  const tries = [...contacts].sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role))

  const retirer = async (c: VisitContact) => {
    if (!confirm(`Retirer ${c.name} des interlocuteurs ?`)) return
    await api.visite.removeContact(c.id); onChange()
  }

  return (
    <Panneau
      visite="visite-interlocuteurs"
      titre="Interlocuteurs"
      aide="Les personnes à qui écrire pour ce bâtiment."
      action={edition === null ? <Button size="sm" variant="outline" className="shrink-0" onClick={() => setEdition('nouveau')}><Plus className="h-3.5 w-3.5" />Ajouter</Button> : undefined}
    >
      <div className="space-y-3">
        {edition === 'nouveau' && (
          <FormContact key="nouveau" depart={VIDE} onAnnuler={contacts.length ? () => setEdition(null) : undefined}
            onEnregistrer={async (b) => { await api.visite.addContact(projectId, b); setEdition(null); onChange() }} />
        )}
        {tries.length === 0 && edition !== 'nouveau' && <p className="text-sm text-muted-foreground">Aucun interlocuteur.</p>}
        {tries.map((c) => edition === c.id ? (
          <FormContact key={c.id} depart={{ role: c.role, name: c.name, company: c.company ?? '', email: c.email ?? '', phone: c.phone ?? '', unit: c.unit ?? '' }}
            onAnnuler={() => setEdition(null)}
            onEnregistrer={async (b) => { await api.visite.updateContact(c.id, b); setEdition(null); onChange() }} />
        ) : (
          <div key={c.id} className="group rounded-xl border border-black/[0.06] px-3.5 py-3">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{c.name}</p>
                <p className="truncate text-xs text-muted-foreground">{[ROLE_LABEL[c.role], c.company, c.unit].filter(Boolean).join(' · ')}</p>
              </div>
              <div className="flex shrink-0 gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
                <button title="Modifier" onClick={() => setEdition(c.id)} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-black/[0.04] hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                <button title="Retirer" onClick={() => retirer(c)} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            {(c.email || c.phone) && (
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                {c.email && <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"><Mail className="h-3 w-3" />{c.email}</a>}
                {c.phone && <a href={`tel:${c.phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"><Phone className="h-3 w-3" />{c.phone}</a>}
              </div>
            )}
          </div>
        ))}
      </div>
    </Panneau>
  )
}

function FormContact({ depart, onEnregistrer, onAnnuler }: { depart: Brouillon; onEnregistrer: (b: Brouillon) => Promise<void>; onAnnuler?: () => void }) {
  const [b, setB] = useState(depart)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const poser = (p: Partial<Brouillon>) => setB((v) => ({ ...v, ...p }))
  const valider = async () => {
    if (!b.name.trim()) return
    setEnCours(true); setErreur(null)
    try { await onEnregistrer(b) } catch (e) { setErreur(e instanceof ApiError ? e.message : 'Enregistrement impossible.') } finally { setEnCours(false) }
  }
  return (
    <div className="space-y-2.5 rounded-xl border border-blue-200 bg-blue-50/30 p-3">
      <div className="grid grid-cols-2 gap-2">
        <Champ label="Rôle">
          <Select value={b.role} onChange={(e) => poser({ role: e.target.value as VisitContactRole })}>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </Select>
        </Champ>
        <Champ label="Nom"><Input value={b.name} onChange={(e) => poser({ name: e.target.value })} placeholder="Nom et prénom" /></Champ>
        <Champ label={b.role === 'LOCATAIRE' ? 'Logement' : 'Société'} className="col-span-2">
          {b.role === 'LOCATAIRE'
            ? <Input value={b.unit} onChange={(e) => poser({ unit: e.target.value })} placeholder="3e étage gauche" />
            : <Input value={b.company} onChange={(e) => poser({ company: e.target.value })} placeholder="Régie Dupont SA" />}
        </Champ>
        <Champ label="Email"><Input type="email" value={b.email} onChange={(e) => poser({ email: e.target.value })} /></Champ>
        <Champ label="Téléphone"><Input value={b.phone} onChange={(e) => poser({ phone: e.target.value })} /></Champ>
      </div>
      {erreur && <p className="text-xs text-red-600">{erreur}</p>}
      <div className="flex justify-end gap-2">
        {onAnnuler && <Button size="sm" variant="ghost" onClick={onAnnuler}>Annuler</Button>}
        <Button size="sm" onClick={valider} disabled={enCours || !b.name.trim()}>{enCours ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}Enregistrer</Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- préparation

function Preparation({ plan, onCocher }: { plan: VisitPlan; onCocher: (cle: string, v: boolean) => void }) {
  const coches = plan.checklist ?? {}
  return (
    <Panneau visite="visite-preparation" titre="Préparation" aide="Les documents, les accès et le matériel. Les documents non reçus remplissent les mails.">
      <div className="space-y-5">
        {PREPARATION.map((g) => {
          const n = g.elements.filter((e) => coches[e.cle]).length
          return (
            <section key={g.id}>
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <p className="text-sm font-semibold">{g.titre}</p>
                <p className="text-xs text-muted-foreground">{n}/{g.elements.length} {g.coche.toLowerCase()}{n > 1 ? 's' : ''}</p>
              </div>
              <p className="mb-2 text-xs text-muted-foreground">{g.aide}</p>
              <div className="space-y-0.5">
                {g.elements.map((e) => (
                  <label key={e.cle} className="flex cursor-pointer items-start gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-black/[0.02]">
                    <input type="checkbox" checked={!!coches[e.cle]} onChange={(ev) => onCocher(e.cle, ev.target.checked)} className="mt-0.5 h-4 w-4 accent-blue-600" />
                    <span className={cn('text-sm', coches[e.cle] && 'text-muted-foreground line-through')}>{e.label}</span>
                  </label>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </Panneau>
  )
}
