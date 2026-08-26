import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, Loader2, Plus, Copy, Check, Trash2, Mail, Shield, Crown, Eye, UserPlus } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Input, Button, Badge, Select } from '@/components/ui'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/stores/auth'
import type { OrgRole, OrgMember } from '@/lib/api-types'

const ROLE_LABEL: Record<OrgRole, string> = { OWNER: 'Propriétaire', ADMIN: 'Administrateur', MEMBER: 'Membre', VIEWER: 'Lecture seule' }
const ROLE_ICON: Record<OrgRole, typeof Shield> = { OWNER: Crown, ADMIN: Shield, MEMBER: Users, VIEWER: Eye }
const ASSIGNABLE: OrgRole[] = ['ADMIN', 'MEMBER', 'VIEWER']

export function TeamManagement() {
  const qc = useQueryClient()
  const myEmail = useAuth((s) => s.user?.email)
  const orgQuery = useQuery({ queryKey: ['org'], queryFn: () => api.org.get() })
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (orgQuery.isLoading) return <div className="flex justify-center py-32"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>

  const org = orgQuery.data?.organization
  const role = orgQuery.data?.role
  const isAdmin = role === 'OWNER' || role === 'ADMIN'

  const create = async () => {
    if (!name.trim()) return
    setCreating(true); setError(null)
    try { await api.org.create(name.trim()); await qc.invalidateQueries({ queryKey: ['org'] }); await qc.invalidateQueries({ queryKey: ['projects'] }) }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Erreur') } finally { setCreating(false) }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold">Gestion d'équipe</h1>
        <p className="text-sm text-muted-foreground">Votre organisation, ses membres et leurs rôles. Les membres partagent les mêmes diagnostics.</p>
      </div>

      {!org ? (
        <Card>
          <CardHeader><CardTitle>Créer votre organisation</CardTitle>
            <p className="text-sm text-muted-foreground">Regroupez votre équipe : les membres invités accèdent aux mêmes diagnostics. Vos diagnostics actuels deviennent ceux de l'organisation.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <Input placeholder="Nom de l'organisation (ex. Régie Dupont SA)" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} />
              <Button onClick={create} disabled={creating || !name.trim()} className="shrink-0">{creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Créer</Button>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="p-5 flex items-center gap-3">
              <div className="flex-1">
                <p className="font-semibold">{org.name}</p>
                <p className="text-xs text-muted-foreground">{org._count?.members ?? 1} membre{(org._count?.members ?? 1) > 1 ? 's' : ''}</p>
              </div>
              {role && <RoleBadge role={role} />}
            </CardContent>
          </Card>

          {isAdmin ? <AdminPanel myEmail={myEmail} /> : (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
              Vous êtes membre de <b>{org.name}</b>{role ? ` (${ROLE_LABEL[role]})` : ''}. La gestion des membres est réservée aux administrateurs.
            </CardContent></Card>
          )}
        </>
      )}
    </div>
  )
}

function RoleBadge({ role }: { role: OrgRole }) {
  const Icon = ROLE_ICON[role]
  return <Badge variant="outline" className="gap-1"><Icon className="h-3 w-3" />{ROLE_LABEL[role]}</Badge>
}

function AdminPanel({ myEmail }: { myEmail?: string }) {
  const qc = useQueryClient()
  const membersQuery = useQuery({ queryKey: ['org-members'], queryFn: () => api.org.members() })
  const invitesQuery = useQuery({ queryKey: ['org-invites'], queryFn: () => api.org.invitations() })
  const [email, setEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<OrgRole>('MEMBER')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastLink, setLastLink] = useState<{ url: string; sent: boolean } | null>(null)
  const [copied, setCopied] = useState(false)

  const refresh = () => { qc.invalidateQueries({ queryKey: ['org-members'] }); qc.invalidateQueries({ queryKey: ['org-invites'] }) }

  const invite = async () => {
    if (!email.trim()) return
    setBusy(true); setError(null); setLastLink(null)
    try {
      const r = await api.org.invite(email.trim(), inviteRole)
      setLastLink({ url: r.acceptUrl, sent: r.emailSent }); setEmail(''); refresh()
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Erreur') } finally { setBusy(false) }
  }
  const setRole = useMutation({ mutationFn: (v: { id: string; role: OrgRole }) => api.org.setRole(v.id, v.role), onSuccess: refresh })
  const removeMember = useMutation({ mutationFn: (id: string) => api.org.removeMember(id), onSuccess: refresh })
  const revoke = useMutation({ mutationFn: (id: string) => api.org.revokeInvite(id), onSuccess: refresh })
  const copy = async (v: string) => { try { await navigator.clipboard.writeText(v); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* ignore */ } }

  const members = membersQuery.data?.members ?? []
  const invites = invitesQuery.data?.invitations ?? []

  return (
    <>
      {/* Inviter */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" />Inviter un membre</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input type="email" placeholder="email@organisation.ch" value={email} onChange={(e) => setEmail(e.target.value)} className="flex-1" />
            <Select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as OrgRole)} className="sm:w-44">
              {ASSIGNABLE.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </Select>
            <Button onClick={invite} disabled={busy || !email.trim()} className="shrink-0">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}Inviter</Button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {lastLink && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
              <p className="text-sm text-blue-800">{lastLink.sent ? 'Invitation envoyée par email.' : 'Email non configuré — copiez et transmettez ce lien d\'invitation :'}</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-white border rounded px-2 py-1.5 break-all">{lastLink.url}</code>
                <Button size="sm" variant="outline" onClick={() => copy(lastLink.url)}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</Button>
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">Rôles — <b>Administrateur</b> : gère membres + diagnostics · <b>Membre</b> : édite les diagnostics · <b>Lecture seule</b> : consulte uniquement.</p>
        </CardContent>
      </Card>

      {/* Membres */}
      <Card>
        <CardHeader><CardTitle>Membres</CardTitle></CardHeader>
        <CardContent className="p-0">
          {membersQuery.isLoading ? <div className="py-6 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div> : (
            <div className="divide-y">
              {members.map((m: OrgMember) => {
                const isOwner = m.orgRole === 'OWNER'
                const isMe = m.email === myEmail
                return (
                  <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{[m.firstName, m.lastName].filter(Boolean).join(' ') || m.email}{isMe && <span className="text-xs text-muted-foreground"> (vous)</span>}</p>
                      <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                    </div>
                    {isOwner ? <RoleBadge role="OWNER" /> : (
                      <Select value={m.orgRole ?? 'MEMBER'} onChange={(e) => setRole.mutate({ id: m.id, role: e.target.value as OrgRole })} className="h-8 w-40 text-xs">
                        {ASSIGNABLE.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                      </Select>
                    )}
                    {!isOwner && <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:text-red-700" onClick={() => { if (confirm('Retirer ce membre ? Il repassera en compte solo.')) removeMember.mutate(m.id) }}><Trash2 className="h-4 w-4" /></Button>}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invitations en attente */}
      {invites.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Invitations en attente</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {invites.map((inv) => (
                <div key={inv.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">{inv.email}</p>
                    <p className="text-xs text-muted-foreground">{ROLE_LABEL[inv.role]} · expire le {new Date(inv.expiresAt).toLocaleDateString('fr-CH')}</p>
                  </div>
                  <Button size="icon" variant="ghost" className="h-8 w-8" title="Copier le lien" onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/app/join/${inv.token}`)}><Copy className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:text-red-700" onClick={() => revoke.mutate(inv.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  )
}
