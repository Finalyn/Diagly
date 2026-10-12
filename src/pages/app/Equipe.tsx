/**
 * L'équipe : qui travaille dans l'organisation, avec quels droits.
 *
 * Ce n'est plus une page : ses sections vivent dans les Paramètres, famille
 * « Mon organisation ». On y règle l'équipe quelques fois par an, comme le
 * reste des réglages ; le menu principal garde ce qu'on ouvre chaque jour.
 * Le tableau des droits reprend exactement ce que le serveur autorise.
 */
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Users, Loader2, Plus, Copy, Check, Trash2, Mail, Shield, UserPlus, Clock, Minus,
} from 'lucide-react'
import { Input, Button } from '@/components/ui'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/stores/auth'
import { cn, formatDate } from '@/lib/utils'
import { ORIGINE_PUBLIQUE } from '@/lib/plateforme'
import type { OrgRole, OrgMember, OrgInvitation } from '@/lib/api-types'

const ROLE_LABEL: Record<OrgRole, string> = { OWNER: 'Propriétaire', ADMIN: 'Administrateur', MEMBER: 'Membre', VIEWER: 'Lecture seule' }
const ROLE_AIDE: Record<OrgRole, string> = {
  OWNER: 'A créé l’organisation. Ne peut être ni retiré ni rétrogradé.',
  ADMIN: 'Gère l’équipe et la base de données, en plus des diagnostics.',
  MEMBER: 'Crée et modifie les diagnostics de l’organisation.',
  VIEWER: 'Consulte les diagnostics et les rapports, sans rien modifier.',
}
const ROLES: OrgRole[] = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']
const ASSIGNABLE: OrgRole[] = ['ADMIN', 'MEMBER', 'VIEWER']

/**
 * Les droits, tels que le serveur les applique : les lectures sont ouvertes à
 * tous, toute écriture est refusée à la lecture seule (blockViewerWrites), la
 * gestion de l'équipe et l'écriture de la base exigent Administrateur.
 */
const DROITS: { label: string; roles: OrgRole[] }[] = [
  { label: 'Consulter les diagnostics, rapports et plans', roles: ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'] },
  { label: 'Créer et modifier les diagnostics', roles: ['OWNER', 'ADMIN', 'MEMBER'] },
  { label: 'Ajouter des plans et des photos', roles: ['OWNER', 'ADMIN', 'MEMBER'] },
  { label: 'Modifier la base de données (articles et prix)', roles: ['OWNER', 'ADMIN'] },
  { label: 'Inviter des membres et changer leurs rôles', roles: ['OWNER', 'ADMIN'] },
  { label: 'Retirer un membre de l’organisation', roles: ['OWNER', 'ADMIN'] },
]

export type IdSectionEquipe = 'membres' | 'invitations' | 'roles'

const initialesDe = (m: { firstName?: string | null; lastName?: string | null; email?: string }) => {
  const i = `${m.firstName?.[0] ?? ''}${m.lastName?.[0] ?? ''}`.toUpperCase()
  return i || (m.email?.[0] ?? '?').toUpperCase()
}

/**
 * Le contenu d'une section « Mon organisation » des Paramètres.
 *
 * Le menu et l'en-tête du panneau appartiennent aux Paramètres ; ici vit ce qui
 * dépend de l'organisation : sa création, ses membres, ses invitations, et le
 * tableau des droits.
 */
export function SectionEquipe({ section, onChoisir }: { section: IdSectionEquipe; onChoisir: (id: IdSectionEquipe) => void }) {
  const qc = useQueryClient()
  const orgQuery = useQuery({ queryKey: ['org'], queryFn: () => api.org.get() })
  const org = orgQuery.data?.organization
  const role = orgQuery.data?.role
  const isAdmin = role === 'OWNER' || role === 'ADMIN'

  // Les listes ne sont servies qu'aux administrateurs (requireOrgRole côté serveur).
  const membersQuery = useQuery({ queryKey: ['org-members'], queryFn: () => api.org.members(), enabled: !!org && isAdmin })
  const invitesQuery = useQuery({ queryKey: ['org-invites'], queryFn: () => api.org.invitations(), enabled: !!org && isAdmin })
  const members = membersQuery.data?.members ?? []
  const invites = invitesQuery.data?.invitations ?? []

  // L'équipe porte le nom de la société, celui des Paramètres > Entreprise.
  const user = useAuth((s) => s.user)
  const societe = (user?.preferences?.company?.name || user?.companyName || '').trim()

  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const create = async () => {
    if (!societe) return
    setCreating(true); setError(null)
    try { await api.org.create(societe); await qc.invalidateQueries({ queryKey: ['org'] }); await qc.invalidateQueries({ queryKey: ['projects'] }) }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Erreur') } finally { setCreating(false) }
  }

  // Une équipe créée sous un autre nom (avant cette règle) reprend celui de la
  // société, une fois, à l'ouverture de la section.
  const renommee = useRef(false)
  useEffect(() => {
    if (renommee.current || !org || !isAdmin || !societe || org.name === societe) return
    renommee.current = true
    api.org.rename(societe).then(() => qc.invalidateQueries({ queryKey: ['org'] })).catch(() => { renommee.current = false })
  }, [org, isAdmin, societe, qc])

  if (orgQuery.isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>

  if (section === 'roles') return <TableDroits />

  // ----- Pas encore d'organisation : on explique, puis on la crée -----
  if (!org) {
    return (
      <>
        <Bloc titre="Créer l’équipe de votre société" aide="Regroupez votre bureau pour travailler à plusieurs sur les mêmes dossiers.">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { icone: Users, titre: 'Dossiers partagés', texte: 'Vos diagnostics actuels deviennent ceux de l’organisation.' },
              { icone: UserPlus, titre: 'Invitations par email', texte: 'Chaque personne invitée rejoint avec le rôle choisi.' },
              { icone: Shield, titre: 'Droits par rôle', texte: 'Administrateur, membre ou lecture seule.' },
            ].map((b) => (
              <div key={b.titre} className="rounded-2xl border border-black/[0.06] bg-white/50 p-4">
                <b.icone className="h-4 w-4 text-muted-foreground" />
                <p className="mt-2.5 text-sm font-semibold">{b.titre}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{b.texte}</p>
              </div>
            ))}
          </div>
        </Bloc>
        <Bloc titre="Nom de l’équipe" aide="Celui de votre société, repris des réglages de l’entreprise.">
          {societe ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/[0.06] bg-white/50 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{societe}</p>
                <p className="text-xs text-muted-foreground">Se modifie dans <Link to="/app/settings?s=bureau" className="underline">Entreprise</Link>.</p>
              </div>
              <Button onClick={create} disabled={creating} className="shrink-0">{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Créer l’équipe</Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm text-amber-900">Renseignez d’abord le nom de votre société.</p>
              <Link to="/app/settings?s=bureau"><Button className="shrink-0">Renseigner la société</Button></Link>
            </div>
          )}
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </Bloc>
      </>
    )
  }

  if (!isAdmin) {
    return (
      <p className="flex w-fit items-start gap-2 rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-900">
        <Shield className="mt-px h-3.5 w-3.5 shrink-0 text-blue-600" />
        Vous êtes {role ? ROLE_LABEL[role].toLowerCase() : 'membre'} de {org.name}. La gestion de l’équipe est réservée aux administrateurs.
      </p>
    )
  }

  if (section === 'invitations') return <SectionInvitations invites={invites} loading={invitesQuery.isLoading} />

  return (
    <>
      <Bloc titre="L’équipe">
        <dl className="divide-y divide-black/[0.06] text-sm">
          <div className="flex items-center justify-between gap-4 py-2.5">
            <dt className="text-muted-foreground">Nom</dt>
            <dd className="text-right">{org.name} <Link to="/app/settings?s=bureau" className="ml-1 text-xs text-muted-foreground underline">modifier</Link></dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-2.5">
            <dt className="text-muted-foreground">Votre rôle</dt>
            <dd>{role ? ROLE_LABEL[role] : ''}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-2.5">
            <dt className="text-muted-foreground">Répartition</dt>
            <dd className="text-right">
              {ROLES.map((r) => {
                const n = members.filter((m) => (m.orgRole ?? 'MEMBER') === r).length
                return n ? `${n} ${ROLE_LABEL[r].toLowerCase()}` : null
              }).filter(Boolean).join(' · ') || '…'}
            </dd>
          </div>
        </dl>
      </Bloc>
      <SectionMembres members={members} loading={membersQuery.isLoading} onInvited={() => onChoisir('invitations')} />
    </>
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

/** Le rôle s'écrit, il ne se décore pas : un logiciel de bureau, pas un salon de discussion. */
function RoleLabel({ role }: { role: OrgRole }) {
  return <span className="text-sm text-foreground">{ROLE_LABEL[role]}</span>
}

function useCopie() {
  const [copie, setCopie] = useState<string | null>(null)
  const copier = async (v: string) => {
    try { await navigator.clipboard.writeText(v); setCopie(v); setTimeout(() => setCopie(null), 2000) } catch { /* presse-papiers refusé */ }
  }
  return { copie, copier }
}

// ---------------------------------------------------------------- membres

function SectionMembres({ members, loading, onInvited }: { members: OrgMember[]; loading: boolean; onInvited: () => void }) {
  const qc = useQueryClient()
  const myEmail = useAuth((s) => s.user?.email)
  const refresh = () => { qc.invalidateQueries({ queryKey: ['org-members'] }); qc.invalidateQueries({ queryKey: ['org-invites'] }); qc.invalidateQueries({ queryKey: ['org'] }) }
  const setRole = useMutation({ mutationFn: (v: { id: string; role: OrgRole }) => api.org.setRole(v.id, v.role), onSuccess: refresh })
  const removeMember = useMutation({ mutationFn: (id: string) => api.org.removeMember(id), onSuccess: refresh })

  return (
    <>
      <Bloc titre="Inviter un membre" aide="La personne reçoit un lien par email et rejoint l’organisation avec le rôle choisi.">
        <FormulaireInvitation onInvited={onInvited} />
      </Bloc>

      <Bloc titre="Membres de l’organisation" aide={members.length > 1 ? `${members.length} personnes ont accès aux diagnostics.` : 'Vous êtes seul pour l’instant : invitez vos collègues ci-dessus.'}>
        {loading ? <div className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div> : (
          <div className="overflow-hidden rounded-2xl border border-black/[0.06]">
            <div className="hidden grid-cols-[minmax(0,1fr)_200px_40px] gap-3 border-b border-black/[0.06] bg-neutral-50/70 px-4 py-2.5 text-xs font-medium text-muted-foreground sm:grid">
              <span>Membre</span><span>Rôle</span><span />
            </div>
            <div className="divide-y divide-black/[0.05]">
              {members.map((m) => {
                const isOwner = m.orgRole === 'OWNER'
                const isMe = m.email === myEmail
                const nom = [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email
                return (
                  <div key={m.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_200px_40px]">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/[0.06] bg-secondary text-xs font-semibold">{initialesDe(m)}</span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{nom}{isMe && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(vous)</span>}</p>
                        <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                      </div>
                    </div>
                    <div>
                      {isOwner || isMe ? <RoleLabel role={m.orgRole ?? 'MEMBER'} /> : (
                        <select
                          value={m.orgRole ?? 'MEMBER'}
                          onChange={(e) => setRole.mutate({ id: m.id, role: e.target.value as OrgRole })}
                          className="h-9 w-full rounded-xl border border-black/10 bg-white/80 px-3 text-sm"
                        >
                          {ASSIGNABLE.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                        </select>
                      )}
                    </div>
                    <div className="hidden justify-end sm:flex">
                      {!isOwner && !isMe && (
                        <button
                          title="Retirer de l’organisation"
                          onClick={() => { if (confirm(`Retirer ${nom} de l’organisation ? Ses accès aux diagnostics partagés seront coupés.`)) removeMember.mutate(m.id) }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
        {(setRole.error || removeMember.error) && (
          <p className="mt-2 text-sm text-red-600">{((setRole.error || removeMember.error) as ApiError).message}</p>
        )}
      </Bloc>
    </>
  )
}

function FormulaireInvitation({ onInvited }: { onInvited: () => void }) {
  const qc = useQueryClient()
  const [email, setEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<OrgRole>('MEMBER')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastLink, setLastLink] = useState<{ url: string; sent: boolean } | null>(null)
  const { copie, copier } = useCopie()

  const invite = async () => {
    if (!email.trim()) return
    setBusy(true); setError(null); setLastLink(null)
    try {
      const r = await api.org.invite(email.trim(), inviteRole)
      setLastLink({ url: r.acceptUrl, sent: r.emailSent }); setEmail('')
      qc.invalidateQueries({ queryKey: ['org-invites'] })
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Erreur') } finally { setBusy(false) }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        {ASSIGNABLE.map((r) => {
          const on = r === inviteRole
          return (
            <label
              key={r}
              className={cn(
                'flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition-colors',
                on ? 'border-blue-300 bg-white' : 'border-black/[0.08] bg-white/50 hover:bg-white',
              )}
            >
              <input type="radio" name="role-invitation" checked={on} onChange={() => setInviteRole(r)} className="mt-0.5 accent-blue-600" />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground">{ROLE_LABEL[r]}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{ROLE_AIDE[r]}</span>
              </span>
            </label>
          )
        })}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input type="email" placeholder="email@organisation.ch" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && invite()} className="flex-1" />
        <Button onClick={invite} disabled={busy || !email.trim()} className="shrink-0">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}Envoyer l’invitation
        </Button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {lastLink && (
        <div className="space-y-2 rounded-2xl border border-blue-100 bg-blue-50/70 p-3">
          <p className="text-sm text-blue-900">{lastLink.sent ? 'Invitation envoyée par email. Le lien reste copiable ci-dessous.' : 'L’email n’est pas configuré : transmettez ce lien d’invitation vous-même.'}</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all rounded-lg border border-black/[0.06] bg-white px-2 py-1.5 text-xs">{lastLink.url}</code>
            <Button size="sm" variant="outline" onClick={() => copier(lastLink.url)}>{copie === lastLink.url ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</Button>
          </div>
          <button onClick={onInvited} className="text-xs font-medium text-blue-700 hover:underline">Voir les invitations en attente</button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- invitations

function SectionInvitations({ invites, loading }: { invites: OrgInvitation[]; loading: boolean }) {
  const qc = useQueryClient()
  const revoke = useMutation({ mutationFn: (id: string) => api.org.revokeInvite(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['org-invites'] }) })
  const { copie, copier } = useCopie()
  // Figé au montage : l'expiration se lit à l'ouverture de la section.
  const [maintenant] = useState(() => Date.now())

  if (loading) return <div className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>

  return (
    <>
      <Bloc titre="Inviter un membre" aide="La personne reçoit un lien par email et rejoint l’organisation avec le rôle choisi.">
        <FormulaireInvitation onInvited={() => { /* déjà sur cette section */ }} />
      </Bloc>

      <Bloc titre="En attente d’acceptation" aide="Un lien d’invitation ne sert qu’une fois. Révoquez-le si la personne ne doit plus rejoindre.">
        {invites.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/[0.1] px-4 py-10 text-center">
            <p className="text-sm font-medium">Aucune invitation en attente</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Les invitations envoyées apparaissent ici jusqu’à leur acceptation.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-black/[0.06]">
            <div className="hidden grid-cols-[minmax(0,1fr)_150px_150px_80px] gap-3 border-b border-black/[0.06] bg-neutral-50/70 px-4 py-2.5 text-xs font-medium text-muted-foreground md:grid">
              <span>Adresse</span><span>Rôle</span><span>Expiration</span><span />
            </div>
            <div className="divide-y divide-black/[0.05]">
              {invites.map((inv) => {
                const expiree = new Date(inv.expiresAt).getTime() < maintenant
                const lien = `${ORIGINE_PUBLIQUE}/app/join/${inv.token}`
                return (
                  <div key={inv.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_150px_150px_80px]">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{inv.email}</p>
                      <p className="text-xs text-muted-foreground">Envoyée le {formatDate(new Date(inv.createdAt))}</p>
                    </div>
                    <div className="hidden md:block"><RoleLabel role={inv.role} /></div>
                    <p className={cn('hidden items-center gap-1.5 text-xs md:flex', expiree ? 'text-red-600' : 'text-muted-foreground')}>
                      <Clock className="h-3.5 w-3.5" />{expiree ? 'Expirée' : formatDate(new Date(inv.expiresAt))}
                    </p>
                    <div className="flex justify-end gap-1">
                      <button title="Copier le lien" onClick={() => copier(lien)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-black/[0.04] hover:text-foreground">
                        {copie === lien ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </button>
                      <button title="Révoquer" onClick={() => revoke.mutate(inv.id)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Bloc>
    </>
  )
}

// ---------------------------------------------------------------- rôles

function TableDroits() {
  return (
    <>
      <Bloc titre="Les rôles" aide="Un rôle se choisit à l’invitation et se change ensuite depuis la liste des membres.">
        <div className="overflow-hidden rounded-xl border border-black/[0.06]">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-black/[0.05]">
              {ROLES.map((r) => (
                <tr key={r}>
                  <td className="w-44 px-4 py-3 align-top font-medium">{ROLE_LABEL[r]}</td>
                  <td className="px-4 py-3 text-muted-foreground">{ROLE_AIDE[r]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Bloc>
      <Bloc titre="Ce que chaque rôle peut faire" aide="Le serveur applique ces règles : un bouton masqué ne suffit pas à protéger une donnée, le refus vient de là.">
        <MatriceDroits />
      </Bloc>
    </>
  )
}

function MatriceDroits() {
  return (
    <div className="overflow-x-auto rounded-2xl border border-black/[0.06]">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-black/[0.06] bg-neutral-50/70 text-xs text-muted-foreground">
            <th className="px-4 py-2.5 text-left font-medium">Droit</th>
            {ROLES.map((r) => <th key={r} className="w-28 px-2 py-2.5 text-center font-medium">{ROLE_LABEL[r]}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-black/[0.05]">
          {DROITS.map((d) => (
            <tr key={d.label}>
              <td className="px-4 py-3">{d.label}</td>
              {ROLES.map((r) => (
                <td key={r} className="px-2 py-3 text-center">
                  {d.roles.includes(r)
                    ? <Check className="mx-auto h-4 w-4 text-foreground" />
                    : <Minus className="mx-auto h-4 w-4 text-muted-foreground/40" />}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
