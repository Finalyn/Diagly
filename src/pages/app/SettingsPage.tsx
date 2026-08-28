import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, ShieldOff, Loader2, Check, Building2, Bell, BellRing, SlidersHorizontal, User as UserIcon, CircleUser, LogOut } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Input, Badge, Button, Select } from '@/components/ui'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/stores/auth'
import { useIsMobile } from '@/lib/use-mobile'
import { cn } from '@/lib/utils'
import { getPushState, subscribePush, unsubscribePush, type PushState } from '@/lib/push-client'
import { logout as endSession } from '@/lib/session'
import type { UserPreferences } from '@/lib/api-types'

/** Enregistre des préférences côté serveur et met à jour le store. */
function usePrefsSaver() {
  const setAuth = useAuth((s) => s.setAuth)
  const accessToken = useAuth((s) => s.accessToken)
  const refreshToken = useAuth((s) => s.refreshToken)
  return async (patch: Partial<UserPreferences>) => {
    const r = await api.auth.updatePreferences(patch)
    if (accessToken && refreshToken) setAuth(r.user, accessToken, refreshToken)
  }
}

function SavedFlag({ show }: { show: boolean }) {
  return show ? <span className="text-sm text-green-600 flex items-center gap-1"><Check className="h-4 w-4" />Enregistré</span> : null
}


const SECTIONS = [
  { id: 'profile', label: 'Profil', icon: UserIcon, desc: 'Vos informations personnelles' },
  { id: 'company', label: 'Entreprise', icon: Building2, desc: 'Identité et logo repris sur vos rapports' },
  { id: 'prefs', label: 'Préférences', icon: SlidersHorizontal, desc: 'Valeurs par défaut métier' },
  { id: 'notif', label: 'Notifications', icon: Bell, desc: 'Alertes, rappels et push' },
  { id: 'security', label: 'Sécurité', icon: ShieldCheck, desc: 'Double authentification et mot de passe' },
  { id: 'account', label: 'Compte', icon: CircleUser, desc: 'Plan et gestion du compte' },
] as const

// Sur mobile on ne garde que l'essentiel terrain : notifications, sécurité, compte.
// Profil / Entreprise / Préférences sont de la config desktop.
const MOBILE_SECTION_IDS: readonly (typeof SECTIONS)[number]['id'][] = ['notif', 'security', 'account']

export function SettingsPage() {
  const user = useAuth((s) => s.user)
  const isMobile = useIsMobile()
  const [active, setActive] = useState<(typeof SECTIONS)[number]['id']>('profile')

  const sections = isMobile ? SECTIONS.filter((s) => MOBILE_SECTION_IDS.includes(s.id)) : SECTIONS
  // Si la section choisie n'existe pas dans cette vue (bascule desktop -> mobile),
  // on affiche la première disponible. Valeur dérivée : pas d'état à resynchroniser.
  const activeId = sections.some((s) => s.id === active) ? active : sections[0].id

  const initials = ((user?.firstName?.[0] ?? '') + (user?.lastName?.[0] ?? '')).toUpperCase() || (user?.email?.[0] ?? 'U').toUpperCase()
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Mon compte'
  const current = sections.find((s) => s.id === activeId) ?? sections[0]

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* En-tête profil */}
      <div className="flex items-center gap-4 rounded-2xl border bg-card p-5">
        <div className="h-14 w-14 rounded-full bg-primary text-white flex items-center justify-center text-lg font-semibold shrink-0">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-bold truncate">{fullName}</h1>
            <Badge className="bg-primary text-white">Pro</Badge>
          </div>
          <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-[220px_1fr] gap-6">
        {/* Navigation des sections */}
        <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0 -mx-1 px-1 lg:mx-0 lg:px-0 lg:sticky lg:top-2 self-start">
          {sections.map((s) => {
            const Icon = s.icon
            const on = s.id === activeId
            return (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className={cn(
                  'flex items-center gap-2.5 whitespace-nowrap rounded-full lg:rounded-lg px-3.5 py-2 text-sm font-medium transition-colors shrink-0 lg:w-full',
                  on ? 'bg-primary/10 text-primary' : 'border lg:border-0 text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />{s.label}
              </button>
            )
          })}
        </nav>

        {/* Contenu de la section */}
        <div className="min-w-0 space-y-5">
          {/* Sur mobile, les pastilles au-dessus indiquent deja la section : ce titre
              faisait doublon avec celui de la carte juste en dessous. */}
          <div className="hidden lg:block">
            <h2 className="text-lg font-semibold">{current.label}</h2>
            <p className="text-sm text-muted-foreground">{current.desc}</p>
          </div>
          {activeId === 'profile' && <ProfileCard />}
          {activeId === 'company' && <CompanyCard />}
          {activeId === 'prefs' && <PreferencesCard />}
          {activeId === 'notif' && <NotificationsCard />}
          {activeId === 'security' && <div className="space-y-5"><TwoFactorCard /><ChangePasswordCard /></div>}
          {activeId === 'account' && <AccountCard />}
        </div>
      </div>
    </div>
  )
}

function ProfileCard() {
  const user = useAuth((s) => s.user)
  const setAuth = useAuth((s) => s.setAuth)
  const accessToken = useAuth((s) => s.accessToken)
  const refreshToken = useAuth((s) => s.refreshToken)

  const [firstName, setFirstName] = useState(user?.firstName ?? '')
  const [lastName, setLastName] = useState(user?.lastName ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [companyName, setCompanyName] = useState(user?.companyName ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    setSaving(true); setError(null); setSaved(false)
    try {
      const r = await api.auth.updateProfile({ firstName: firstName.trim() || null, lastName: lastName.trim() || null, phone: phone.trim() || null, companyName: companyName.trim() || null })
      if (accessToken && refreshToken) setAuth(r.user, accessToken, refreshToken)
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Erreur') } finally { setSaving(false) }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Informations personnelles</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Prénom"><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Prénom" /></Field>
          <Field label="Nom"><Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Nom" /></Field>
          <Field label="Email"><Input value={user?.email ?? ''} readOnly disabled /></Field>
          <Field label="Téléphone"><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+41 …" /></Field>
          <div className="sm:col-span-2"><Field label="Entreprise"><Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Nom de l'entreprise" /></Field></div>
        </div>
        {error && <ErrBox msg={error} />}
        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={saving}>{saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enregistrement…</> : 'Enregistrer'}</Button>
          <SavedFlag show={saved} />
        </div>
      </CardContent>
    </Card>
  )
}

/** Charge une image, la redimensionne (max 320px) et renvoie un data URL léger. */
async function loadLogo(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(file)
  })
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new window.Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl
  })
  const max = 320
  const scale = Math.min(1, max / Math.max(img.width, img.height))
  const w = Math.round(img.width * scale), h = Math.round(img.height * scale)
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, w, h)
  // PNG pour préserver la transparence des logos.
  return canvas.toDataURL('image/png')
}

function CompanyCard() {
  const user = useAuth((s) => s.user)
  const savePrefs = usePrefsSaver()
  const c = user?.preferences?.company ?? {}
  const [f, setF] = useState({ name: c.name ?? '', address: c.address ?? '', postalCode: c.postalCode ?? '', city: c.city ?? '', canton: c.canton ?? '', vatNumber: c.vatNumber ?? '', iban: c.iban ?? '' })
  const [logo, setLogo] = useState<string>(c.logo ?? '')
  const [accent, setAccent] = useState<string>(c.accentColor ?? '#3b82f6')
  const [saving, setSaving] = useState(false); const [saved, setSaved] = useState(false); const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })
  const onLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setError(null)
    try { setLogo(await loadLogo(file)) } catch { setError("Impossible de charger l'image.") }
    e.target.value = ''
  }
  const save = async () => {
    setSaving(true); setError(null); setSaved(false)
    try { await savePrefs({ company: { ...f, logo: logo || undefined, accentColor: accent } }); setSaved(true); setTimeout(() => setSaved(false), 2500) }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Erreur') } finally { setSaving(false) }
  }
  return (
    <Card>
      <CardHeader><CardTitle>Entreprise</CardTitle><p className="text-sm text-muted-foreground">Ces informations et votre logo apparaîtront sur vos rapports.</p></CardHeader>
      <CardContent className="space-y-4">
        {/* Logo + couleur d'accent (identité des rapports) */}
        <div className="flex flex-col sm:flex-row gap-4 sm:items-center p-4 rounded-lg border bg-muted/30">
          <div className="h-20 w-20 rounded-lg border bg-white flex items-center justify-center overflow-hidden shrink-0">
            {logo ? <img src={logo} alt="Logo" className="max-h-full max-w-full object-contain" /> : <Building2 className="h-8 w-8 text-muted-foreground" />}
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <p className="text-sm font-medium">Logo de l'entreprise</p>
            <p className="text-xs text-muted-foreground">PNG ou JPG. Il apparaît en en-tête de vos rapports.</p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1.5 text-sm font-medium text-primary cursor-pointer hover:underline">
                <input type="file" accept="image/*" onChange={onLogo} className="hidden" />
                {logo ? 'Changer le logo' : 'Importer un logo'}
              </label>
              {logo && <button onClick={() => setLogo('')} className="text-sm text-red-600 hover:underline">Retirer</button>}
            </div>
          </div>
          <div className="shrink-0">
            <label className="text-xs font-medium mb-1 block">Couleur d'accent</label>
            <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-9 w-16 rounded border cursor-pointer bg-white" />
          </div>
        </div>
        <Field label="Raison sociale"><Input value={f.name} onChange={set('name')} placeholder="Berger & Fils SA" /></Field>
        <Field label="Adresse"><Input value={f.address} onChange={set('address')} placeholder="Rue, n°" /></Field>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Field label="NPA"><Input value={f.postalCode} onChange={set('postalCode')} maxLength={4} /></Field>
          <Field label="Ville"><Input value={f.city} onChange={set('city')} /></Field>
          <Field label="Canton"><Input value={f.canton} onChange={set('canton')} maxLength={2} /></Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="N° TVA"><Input value={f.vatNumber} onChange={set('vatNumber')} placeholder="CHE-000.000.000 TVA" /></Field>
          <Field label="IBAN"><Input value={f.iban} onChange={set('iban')} placeholder="CH.." /></Field>
        </div>
        {error && <ErrBox msg={error} />}
        <div className="flex items-center gap-3"><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enregistrer'}</Button><SavedFlag show={saved} /></div>
      </CardContent>
    </Card>
  )
}

function PreferencesCard() {
  const user = useAuth((s) => s.user)
  const savePrefs = usePrefsSaver()
  const d = user?.preferences?.defaults ?? {}
  const [honorary, setHonorary] = useState(String(d.honoraryPct ?? 12))
  const [reserve, setReserve] = useState(String(d.reservePct ?? 10))
  const [vat, setVat] = useState(String(d.vatPct ?? 8.1))
  const [unit, setUnit] = useState<'m' | 'cm' | 'mm'>(d.unit ?? 'm')
  const [saving, setSaving] = useState(false); const [saved, setSaved] = useState(false)
  const save = async () => {
    setSaving(true); setSaved(false)
    try { await savePrefs({ defaults: { honoraryPct: Number(honorary), reservePct: Number(reserve), vatPct: Number(vat), unit } }); setSaved(true); setTimeout(() => setSaved(false), 2500) } finally { setSaving(false) }
  }
  return (
    <Card>
      <CardHeader><CardTitle>Valeurs par défaut</CardTitle><p className="text-sm text-muted-foreground">Appliquées aux nouveaux diagnostics et aux calculs de coûts.</p></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Honoraires (%)"><Input type="number" value={honorary} onChange={(e) => setHonorary(e.target.value)} /></Field>
          <Field label="Réserve (%)"><Input type="number" value={reserve} onChange={(e) => setReserve(e.target.value)} /></Field>
          <Field label="TVA (%)"><Input type="number" step="0.1" value={vat} onChange={(e) => setVat(e.target.value)} /></Field>
        </div>
        <Field label="Unité de mesure (plans)">
          <Select value={unit} onChange={(e) => setUnit(e.target.value as 'm' | 'cm' | 'mm')} className="sm:w-40">
            <option value="m">Mètres (m)</option><option value="cm">Centimètres (cm)</option><option value="mm">Millimètres (mm)</option>
          </Select>
        </Field>
        <div className="flex items-center gap-3"><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enregistrer'}</Button><SavedFlag show={saved} /></div>
      </CardContent>
    </Card>
  )
}

function NotificationsCard() {
  const user = useAuth((s) => s.user)
  const savePrefs = usePrefsSaver()
  const n = user?.preferences?.notifications ?? {}
  const [state, setState] = useState({ emailDiagnostic: n.emailDiagnostic ?? true, calendarReminders: n.calendarReminders ?? true, priorityAlerts: n.priorityAlerts ?? true, weeklyDigest: n.weeklyDigest ?? false })
  const [busy, setBusy] = useState<string | null>(null)
  const toggle = async (k: keyof typeof state) => {
    const next = { ...state, [k]: !state[k] }
    setState(next); setBusy(k)
    try { await savePrefs({ notifications: next }) } finally { setBusy(null) }
  }
  const rows: { k: keyof typeof state; label: string; desc: string }[] = [
    { k: 'emailDiagnostic', label: 'Nouveau diagnostic', desc: 'Recevoir un email à la création d’un diagnostic.' },
    { k: 'calendarReminders', label: 'Rappels de calendrier', desc: 'Rappel avant vos visites et échéances.' },
    { k: 'priorityAlerts', label: 'Alertes priorité I', desc: 'Être alerté quand un élément urgent est détecté.' },
    { k: 'weeklyDigest', label: 'Résumé hebdomadaire', desc: 'Un récapitulatif de votre activité chaque lundi.' },
  ]
  return (
    <Card>
      <CardHeader><CardTitle>Notifications</CardTitle></CardHeader>
      <CardContent className="divide-y">
        <PushToggle />
        {rows.map((r) => (
          <div key={r.k} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0"><p className="text-sm font-medium">{r.label}</p><p className="text-xs text-muted-foreground">{r.desc}</p></div>
            <button onClick={() => toggle(r.k)} disabled={busy === r.k} className={`relative h-6 w-11 rounded-full transition-colors shrink-0 ${state[r.k] ? 'bg-primary' : 'bg-muted'}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${state[r.k] ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function PushToggle() {
  const [state, setState] = useState<PushState | 'loading'>('loading')
  const [serverEnabled, setServerEnabled] = useState<boolean | null>(null)
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      try { const v = await api.push.vapid(); setServerEnabled(v.enabled); setPublicKey(v.publicKey) }
      catch { setServerEnabled(false) }
      try { setState(await getPushState()) } catch { setState('unsupported') }
    })()
  }, [])

  const toggle = async () => {
    if (busy) return
    setBusy(true); setMsg(null)
    try {
      if (state === 'subscribed') { await unsubscribePush(); setState('unsubscribed') }
      else if (publicKey) { await subscribePush(publicKey); setState('subscribed') }
    } catch { setMsg('Activation refusée (permission du navigateur).') }
    finally { setBusy(false) }
  }

  const sendTest = async () => {
    setBusy(true); setMsg(null)
    try { const r = await api.push.test(); setMsg(r.sent > 0 ? 'Notification envoyée.' : 'Aucun appareil abonné.') }
    catch { setMsg("Échec de l'envoi.") }
    finally { setBusy(false) }
  }

  const unavailable = state === 'unsupported' || serverEnabled === false || state === 'denied'
  const subtitle =
    state === 'unsupported' ? 'Non supporté par ce navigateur.'
    : serverEnabled === false ? 'Non configuré sur le serveur.'
    : state === 'denied' ? 'Bloqué dans les réglages du navigateur.'
    : 'Recevoir rappels et alertes sur cet appareil.'

  return (
    <div className="py-3 first:pt-0">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium flex items-center gap-1.5"><BellRing className="h-4 w-4 text-primary" />Notifications push (cet appareil)</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <button
          onClick={toggle}
          disabled={busy || unavailable || state === 'loading'}
          className={cn('relative h-6 w-11 rounded-full transition-colors shrink-0 disabled:opacity-40', state === 'subscribed' ? 'bg-primary' : 'bg-muted')}
        >
          <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', state === 'subscribed' ? 'left-[22px]' : 'left-0.5')} />
        </button>
      </div>
      {(state === 'subscribed' || msg) && (
        <div className="mt-2 flex items-center gap-3">
          {state === 'subscribed' && <button onClick={sendTest} disabled={busy} className="text-xs font-medium text-primary hover:underline">Envoyer une notification test</button>}
          {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
        </div>
      )}
    </div>
  )
}

function ChangePasswordCard() {
  const [cur, setCur] = useState(''); const [nw, setNw] = useState(''); const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false); const [ok, setOk] = useState(false); const [error, setError] = useState<string | null>(null)
  const submit = async () => {
    setError(null); setOk(false)
    if (nw.length < 8) { setError('Le nouveau mot de passe doit faire au moins 8 caractères.'); return }
    if (nw !== confirm) { setError('Les mots de passe ne correspondent pas.'); return }
    setBusy(true)
    try { await api.auth.changePassword({ currentPassword: cur, newPassword: nw }); setOk(true); setCur(''); setNw(''); setConfirm(''); setTimeout(() => setOk(false), 3000) }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Erreur') } finally { setBusy(false) }
  }
  return (
    <Card>
      <CardHeader><CardTitle>Mot de passe</CardTitle></CardHeader>
      <CardContent className="space-y-4 max-w-md">
        <Field label="Mot de passe actuel"><Input type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" /></Field>
        <Field label="Nouveau mot de passe"><Input type="password" value={nw} onChange={(e) => setNw(e.target.value)} autoComplete="new-password" placeholder="Min. 8 caractères" /></Field>
        <Field label="Confirmer"><Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" /></Field>
        {error && <ErrBox msg={error} />}
        <div className="flex items-center gap-3">
          <Button onClick={submit} disabled={busy || !cur || !nw}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Changer le mot de passe'}</Button>
          {ok && <SavedFlag show />}
        </div>
      </CardContent>
    </Card>
  )
}

function AccountCard() {
  const user = useAuth((s) => s.user)
  const navigate = useNavigate()
  // Revoque la session cote serveur ET efface les donnees mises en cache sur l'appareil
  // (diagnostics, photos, file de synchro) avant de rendre la main a l'ecran de connexion.
  const logout = async () => {
    await endSession()
    navigate('/login', { replace: true })
  }
  return (
    <Card>
      <CardHeader><CardTitle>Compte</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <Row label="Plan"><Badge className="bg-primary text-white">Diagly Pro</Badge></Row>
        <Row label="Rôle"><Badge variant="outline">{user?.role ?? '—'}</Badge></Row>
        <Row label="Email"><span className="text-sm">{user?.email}</span></Row>
        <Row label="Membre depuis"><span className="text-sm">{user?.createdAt ? new Date(user.createdAt).toLocaleDateString('fr-CH') : '—'}</span></Row>
        <div className="pt-4 border-t">
          <Button variant="outline" onClick={logout} className="w-full sm:w-auto"><LogOut className="mr-2 h-4 w-4" />Se déconnecter</Button>
        </div>
        <div className="pt-4 border-t">
          <p className="text-sm font-medium text-red-600 mb-1">Zone de danger</p>
          <p className="text-xs text-muted-foreground mb-3">La suppression du compte est définitive. Contactez le support pour supprimer votre compte et vos données.</p>
          <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" disabled>Supprimer le compte</Button>
        </div>
      </CardContent>
    </Card>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="text-sm font-medium mb-1 block">{label}</label>{children}</div>
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">{label}</span>{children}</div>
}
function ErrBox({ msg }: { msg: string }) {
  return <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{msg}</div>
}

function TwoFactorCard() {
  const user = useAuth((s) => s.user)
  const setAuth = useAuth((s) => s.setAuth)
  const accessToken = useAuth((s) => s.accessToken)
  const refreshToken = useAuth((s) => s.refreshToken)
  const [enabled, setEnabled] = useState(!!user?.twoFactorEnabled)
  // Sync du store : sinon la 2FA "repasse" désactivée en revenant sur la page.
  const syncEnabled = (val: boolean) => {
    setEnabled(val)
    if (user && accessToken && refreshToken) setAuth({ ...user, twoFactorEnabled: val }, accessToken, refreshToken)
  }
  const [setup, setSetup] = useState<{ qr: string; secret: string } | null>(null)
  const [disabling, setDisabling] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Au montage, on lit l'état RÉEL côté serveur (évite un affichage périmé après navigation).
  useEffect(() => {
    api.auth.me().then((r) => {
      if (!r.user) return
      setEnabled(!!r.user.twoFactorEnabled)
      if (accessToken && refreshToken) setAuth(r.user, accessToken, refreshToken)
    }).catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onlyDigits = (v: string) => v.replace(/[^0-9]/g, '').slice(0, 6)

  const startSetup = async () => {
    setError(null); setBusy(true)
    try { const r = await api.auth.twoFactorSetup(); setSetup({ qr: r.qr, secret: r.secret }) }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Erreur') } finally { setBusy(false) }
  }
  const confirmEnable = async () => {
    setError(null); setBusy(true)
    try { await api.auth.twoFactorEnable(code); syncEnabled(true); setSetup(null); setCode('') }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Code invalide') } finally { setBusy(false) }
  }
  const confirmDisable = async () => {
    setError(null); setBusy(true)
    try { await api.auth.twoFactorDisable(code); syncEnabled(false); setDisabling(false); setCode('') }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Code invalide') } finally { setBusy(false) }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Double authentification (2FA)</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Un code à usage unique via une application d'authentification.</p>
          {enabled ? <Badge className="bg-green-600 text-white shrink-0">Activée</Badge> : <Badge variant="outline" className="shrink-0">Désactivée</Badge>}
        </div>
        {error && <ErrBox msg={error} />}
        {!enabled && !setup && (
          <Button onClick={startSetup} disabled={busy}>{busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />…</> : <><ShieldCheck className="mr-2 h-4 w-4" />Activer la 2FA</>}</Button>
        )}
        {!enabled && setup && (
          <div className="space-y-3">
            <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
              <li>Ouvre ton application d'authentification.</li><li>Scanne ce QR code (ou saisis la clé).</li><li>Entre le code à 6 chiffres.</li>
            </ol>
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <img src={setup.qr} alt="QR 2FA" className="h-40 w-40 rounded-lg border bg-white" />
              <div className="flex-1 w-full space-y-3">
                <div><p className="text-xs text-muted-foreground mb-1">Clé manuelle</p><code className="block text-xs bg-muted rounded px-2 py-1.5 break-all">{setup.secret}</code></div>
                <Input value={code} onChange={(e) => setCode(onlyDigits(e.target.value))} inputMode="numeric" placeholder="Code à 6 chiffres" className="text-center tracking-widest font-semibold" />
                <div className="flex gap-2">
                  <Button onClick={confirmEnable} disabled={busy || code.length < 6} className="flex-1">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="mr-2 h-4 w-4" />Activer</>}</Button>
                  <Button variant="outline" onClick={() => { setSetup(null); setCode(''); setError(null) }}>Annuler</Button>
                </div>
              </div>
            </div>
          </div>
        )}
        {enabled && !disabling && (
          <Button variant="outline" onClick={() => { setDisabling(true); setError(null) }} className="text-red-600 hover:text-red-700"><ShieldOff className="mr-2 h-4 w-4" />Désactiver la 2FA</Button>
        )}
        {enabled && disabling && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Entre un code de ton application pour confirmer.</p>
            <Input value={code} onChange={(e) => setCode(onlyDigits(e.target.value))} inputMode="numeric" placeholder="Code à 6 chiffres" className="text-center tracking-widest font-semibold max-w-xs" />
            <div className="flex gap-2">
              <Button variant="outline" onClick={confirmDisable} disabled={busy || code.length < 6} className="text-red-600 hover:text-red-700">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmer'}</Button>
              <Button variant="ghost" onClick={() => { setDisabling(false); setCode(''); setError(null) }}>Annuler</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
