/**
 * Les réglages, et l'espace du compte.
 *
 * L'écran précédent empilait six cartes derrière une barre de navigation, avec
 * le même mot répété trois fois de haut en bas : un bandeau « Compte », un
 * titre « Compte », une carte « Compte ». Il fallait ouvrir chaque section pour
 * savoir ce qui y manquait, et la moitié de l'écran restait vide.
 *
 * Celui-ci répond d'abord à la question qu'on se pose en arrivant : qu'est-ce
 * qui n'est pas réglé ? Chaque section porte sa mention, « sans logo », « mot
 * de passe seul », et l'on va droit à celle qui le demande. Ensuite seulement
 * viennent les formulaires, et ils montrent leur effet : l'en-tête du rapport
 * tel qu'il partira chez le client, la cascade des pourcentages sur cent mille
 * francs.
 *
 * Deux principes de saisie. Ce qui se décide d'un geste, les notifications,
 * s'enregistre aussitôt. Ce qui se compose, un formulaire, attend une barre
 * d'enregistrement qui ne paraît que si quelque chose a changé, et qui propose
 * d'annuler : on ne modifie pas une adresse de facturation par inadvertance.
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle, Bell, BellRing, Building2, Check, ChevronLeft, ChevronRight, CircleUser,
  Loader2, LogOut, ShieldCheck, ShieldOff, SlidersHorizontal, User as UserIcon, Users,
} from 'lucide-react'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from '@/components/ui'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/stores/auth'
import { useIsMobile } from '@/lib/use-mobile'
import { cn, formatCHF } from '@/lib/utils'
import { getPushState, subscribePush, unsubscribePush, type PushState } from '@/lib/push-client'
import { logout as endSession } from '@/lib/session'
import {
  aChange, apercuDesValeurs, etatDeLaSecurite, etatDuBureau, etatDuProfil, initiales, nomAffiche,
  type Pastille,
} from '@/lib/reglages'
import type { UserPreferences } from '@/lib/api-types'

type IdSection = 'profil' | 'securite' | 'notifications' | 'bureau' | 'valeurs' | 'compte'

const SECTIONS: {
  id: IdSection
  label: string
  aide: string
  icone: React.ComponentType<{ className?: string }>
  famille: 'Mon compte' | 'Mon travail'
}[] = [
  { id: 'profil', label: 'Profil', aide: 'Votre nom, votre téléphone', icone: UserIcon, famille: 'Mon compte' },
  { id: 'securite', label: 'Sécurité', aide: 'Mot de passe et double authentification', icone: ShieldCheck, famille: 'Mon compte' },
  { id: 'notifications', label: 'Notifications', aide: 'Ce que Diagly vous signale', icone: Bell, famille: 'Mon compte' },
  { id: 'compte', label: 'Compte', aide: 'Plan, équipe, déconnexion', icone: CircleUser, famille: 'Mon compte' },
  { id: 'bureau', label: 'Entreprise', aide: 'Ce qui paraît en tête des rapports', icone: Building2, famille: 'Mon travail' },
  { id: 'valeurs', label: 'Valeurs par défaut', aide: 'Honoraires, réserve, TVA', icone: SlidersHorizontal, famille: 'Mon travail' },
]

const FAMILLES = ['Mon compte', 'Mon travail'] as const

export function SettingsPage() {
  const user = useAuth((s) => s.user)
  const isMobile = useIsMobile()
  /**
   * La section ouverte vit dans l'adresse, et nulle part ailleurs.
   *
   * Le menu du compte peut ainsi ouvrir directement la bonne, un lien se
   * partage, et le bouton Retour du navigateur fait ce qu'on attend. Sur
   * téléphone, l'absence de section montre le sommaire : on y revient par la
   * flèche, plutôt que de garder une barre d'onglets qui déborde de l'écran.
   */
  const [parametres, setParametres] = useSearchParams()
  const demandee = SECTIONS.find((s) => s.id === parametres.get('s'))?.id ?? null
  const choisie = demandee ?? (isMobile ? null : 'profil')
  const choisir = (id: IdSection | null) => setParametres(id ? { s: id } : {}, { replace: true })

  const doubleAuth = !!user?.twoFactorEnabled
  const pastilles: Record<IdSection, Pastille> = {
    profil: etatDuProfil(user ?? undefined),
    securite: etatDeLaSecurite(doubleAuth),
    notifications: { etat: 'complet', mention: null },
    // Même repli que le formulaire : la raison sociale peut encore venir du
    // profil, et la pastille doit dire la même chose que la section.
    bureau: etatDuBureau({
      ...user?.preferences?.company,
      name: user?.preferences?.company?.name || user?.companyName || '',
    }),
    valeurs: { etat: 'complet', mention: null },
    compte: { etat: 'complet', mention: null },
  }
  const aRegler = SECTIONS.filter((s) => pastilles[s.id].etat !== 'complet')

  const section = SECTIONS.find((s) => s.id === choisie)

  return (
    <div className={cn(
      'flex gap-4',
      // Sur grand écran, deux panneaux qui tiennent la hauteur et défilent
      // chacun. Sur téléphone, la carte suit son contenu : une hauteur figée
      // passerait sous la barre de navigation flottante.
      isMobile ? 'flex-col' : 'h-[calc(100dvh-7rem)]',
    )}>
      {/* ----- Le menu, à gauche ----- */}
      {(!isMobile || choisie === null) && (
        <Menu
          choisie={choisie}
          pastilles={pastilles}
          aRegler={aRegler.length}
          onChoisir={choisir}
          mobile={isMobile}
        />
      )}

      {/* ----- Les réglages de la section, à droite ----- */}
      {section && (
        <Card className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <CardHeader className="shrink-0 space-y-0 border-b border-black/[0.06] px-5 py-3.5">
            {isMobile && (
              <button
                onClick={() => choisir(null)}
                className="mb-1.5 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" />Paramètres
              </button>
            )}
            <CardTitle className="text-base">{section.label}</CardTitle>
            <p className="mt-0.5 text-sm text-muted-foreground">{section.aide}</p>
          </CardHeader>
          <CardContent className="flex-1 space-y-5 overflow-y-auto p-5">
            {choisie === 'profil' && <SectionProfil />}
            {choisie === 'securite' && <SectionSecurite />}
            {choisie === 'notifications' && <SectionNotifications />}
            {choisie === 'bureau' && <SectionBureau />}
            {choisie === 'valeurs' && <SectionValeurs />}
            {choisie === 'compte' && <SectionCompte />}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

/**
 * Le menu, dans sa carte.
 *
 * En tête le titre de la page et ce qu'il reste à regarder, puis la personne
 * connectée, puis les sections par famille, chacune avec ce qui lui manque.
 * Même carte et même colonne que les autres écrans à deux panneaux.
 */
function Menu({ choisie, pastilles, aRegler, onChoisir, mobile }: {
  choisie: IdSection | null
  pastilles: Record<IdSection, Pastille>
  aRegler: number
  onChoisir: (id: IdSection) => void
  mobile: boolean
}) {
  const user = useAuth((s) => s.user)
  const bureau = user?.preferences?.company
  return (
    <Card className="flex w-full shrink-0 flex-col overflow-hidden lg:w-72">
      <CardHeader className="shrink-0 space-y-0 border-b border-black/[0.06] px-4 py-3.5">
        <CardTitle className="text-base">Paramètres</CardTitle>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {aRegler === 0 ? 'Tout est réglé.' : `${aRegler} point${aRegler > 1 ? 's' : ''} à regarder.`}
        </p>
      </CardHeader>

      <div className="flex shrink-0 items-center gap-3 border-b border-black/[0.06] px-4 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/[0.06] bg-secondary text-sm font-semibold text-foreground">
          {initiales(user ?? {})}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight">{nomAffiche(user ?? {})}</p>
          <p className="truncate text-xs text-muted-foreground">{bureau?.name || user?.companyName || user?.email}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto p-2">
        {FAMILLES.map((famille) => (
          <div key={famille}>
            <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{famille}</p>
            <div className="space-y-1">
              {SECTIONS.filter((s) => s.famille === famille).map((s) => {
                const p = pastilles[s.id]
                const on = s.id === choisie
                return (
                  <button
                    key={s.id}
                    onClick={() => onChoisir(s.id)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-2xl px-3 text-left transition-colors',
                      mobile ? 'py-3' : 'py-2.5',
                      on && !mobile
                        ? 'border border-blue-100 bg-blue-50 text-blue-700'
                        : 'text-neutral-600 hover:bg-black/[0.03] hover:text-neutral-900',
                    )}
                  >
                    <s.icone className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className={cn('block truncate text-sm', on && !mobile ? 'font-semibold' : 'font-medium')}>{s.label}</span>
                      {(p.mention || mobile) && (
                        <span className={cn('block truncate text-[11px]',
                          p.etat === 'incomplet' ? 'text-red-600'
                            : p.etat === 'attention' ? 'text-amber-600'
                              : 'text-muted-foreground')}>
                          {p.mention ?? s.aide}
                        </span>
                      )}
                    </span>
                    {p.etat !== 'complet' && (
                      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full',
                        p.etat === 'incomplet' ? 'bg-red-500' : 'bg-amber-500')} />
                    )}
                    {mobile && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>
    </Card>
  )
}

// ---------------------------------------------------------------- briques

/** Un bloc de réglages : un titre, une phrase, du contenu. */
function Bloc({ titre, aide, children, action }: {
  titre: string
  aide?: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
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

function Champ({ label, aide, children }: { label: string; aide?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {aide && <span className="mt-1 block text-[11px] text-muted-foreground">{aide}</span>}
    </label>
  )
}

function Erreur({ message }: { message: string }) {
  return (
    <p className="flex items-start gap-1.5 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-800">
      <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />{message}
    </p>
  )
}

/**
 * La barre d'enregistrement.
 *
 * Elle ne paraît que si quelque chose a changé, et elle propose d'annuler :
 * c'est ce qui permet d'essayer une valeur sans la garder. Collée en bas de la
 * colonne, elle reste atteignable sur un formulaire long.
 */
function BarreEnregistrement({ modifie, enCours, erreur, onAnnuler, onEnregistrer }: {
  modifie: boolean
  enCours: boolean
  erreur: string | null
  onAnnuler: () => void
  onEnregistrer: () => void
}) {
  if (!modifie && !erreur) return null
  return (
    <div className="sticky bottom-0 z-10 -mx-5 -mb-5 mt-5 border-t border-black/[0.08] bg-card/95 px-5 py-3 backdrop-blur">
      {erreur && <div className="mb-2"><Erreur message={erreur} /></div>}
      {modifie && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">Modifications non enregistrées.</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onAnnuler} disabled={enCours}>Annuler</Button>
            <Button size="sm" onClick={onEnregistrer} disabled={enCours}>
              {enCours ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Enregistrement</> : 'Enregistrer'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Une bascule qui s'enregistre aussitôt : le geste est sa propre validation. */
function Bascule({ actif, onChange, titre, aide, occupe, indisponible }: {
  actif: boolean
  onChange: () => void
  titre: React.ReactNode
  aide?: string
  occupe?: boolean
  indisponible?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{titre}</p>
        {aide && <p className="text-xs text-muted-foreground">{aide}</p>}
      </div>
      <button
        onClick={onChange}
        disabled={occupe || indisponible}
        aria-pressed={actif}
        className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40',
          actif ? 'bg-blue-600' : 'bg-neutral-200')}
      >
        <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
          actif ? 'left-[22px]' : 'left-0.5')} />
      </button>
    </div>
  )
}

/** Enregistre des préférences côté serveur et met à jour le store. */
function usePreferences() {
  const setAuth = useAuth((s) => s.setAuth)
  const accessToken = useAuth((s) => s.accessToken)
  const refreshToken = useAuth((s) => s.refreshToken)
  return async (patch: Partial<UserPreferences>) => {
    const r = await api.auth.updatePreferences(patch)
    if (accessToken && refreshToken) setAuth(r.user, accessToken, refreshToken)
  }
}

// ---------------------------------------------------------------- profil

function SectionProfil() {
  const user = useAuth((s) => s.user)
  const setAuth = useAuth((s) => s.setAuth)
  const accessToken = useAuth((s) => s.accessToken)
  const refreshToken = useAuth((s) => s.refreshToken)

  const depart = useMemo(() => ({
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    phone: user?.phone ?? '',
  }), [user])
  const [f, setF] = useState(depart)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const modifie = aChange(f, depart)
  const poser = (p: Partial<typeof f>) => setF((v) => ({ ...v, ...p }))

  const enregistrer = async () => {
    setEnCours(true); setErreur(null)
    try {
      const r = await api.auth.updateProfile({
        firstName: f.firstName.trim() || null,
        lastName: f.lastName.trim() || null,
        phone: f.phone.trim() || null,
      })
      if (accessToken && refreshToken) setAuth(r.user, accessToken, refreshToken)
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Enregistrement impossible.')
    } finally { setEnCours(false) }
  }

  return (
    <>
      <Bloc titre="Profil" aide="Votre nom signe les rapports que vous éditez.">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-black/[0.06] bg-secondary text-base font-semibold text-foreground">
            {initiales({ firstName: f.firstName, lastName: f.lastName, email: user?.email })}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{nomAffiche({ firstName: f.firstName, lastName: f.lastName, email: user?.email })}</p>
            <p className="text-xs text-muted-foreground">Les initiales se composent de votre nom.</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Champ label="Prénom">
            <Input value={f.firstName} onChange={(e) => poser({ firstName: e.target.value })} />
          </Champ>
          <Champ label="Nom">
            <Input value={f.lastName} onChange={(e) => poser({ lastName: e.target.value })} />
          </Champ>
          <Champ label="Téléphone" aide="Imprimé sous votre nom, pour être rappelé.">
            <Input value={f.phone} onChange={(e) => poser({ phone: e.target.value })} placeholder="+41 27 000 00 00" />
          </Champ>
          <Champ label="Adresse de connexion" aide="Elle se change depuis le support, pour qu'un compte ne se perde pas.">
            <Input value={user?.email ?? ''} readOnly disabled />
          </Champ>
        </div>
      </Bloc>
      <BarreEnregistrement
        modifie={modifie} enCours={enCours} erreur={erreur}
        onAnnuler={() => { setF(depart); setErreur(null) }}
        onEnregistrer={enregistrer}
      />
    </>
  )
}

// -------------------------------------------------------------- sécurité

function SectionSecurite() {
  const user = useAuth((s) => s.user)
  const doubleAuth = !!user?.twoFactorEnabled
  return (
    <>
      <div className={cn('mb-5 flex items-start gap-3 rounded-2xl border p-4',
        doubleAuth ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50')}>
        {doubleAuth
          ? <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-green-700" />
          : <ShieldOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />}
        <div className="min-w-0">
          <p className={cn('text-sm font-semibold', doubleAuth ? 'text-green-900' : 'text-amber-900')}>
            {doubleAuth ? 'Votre compte demande un code à chaque connexion.' : 'Votre compte n’est protégé que par un mot de passe.'}
          </p>
          <p className={cn('mt-0.5 text-xs', doubleAuth ? 'text-green-800' : 'text-amber-800')}>
            {doubleAuth
              ? 'Un mot de passe volé ne suffit plus à ouvrir vos dossiers.'
              : 'Vos dossiers contiennent des adresses, des plans et des montants. Un code à usage unique prend une minute à activer.'}
          </p>
        </div>
      </div>
      <DoubleAuthentification />
      <MotDePasse />
    </>
  )
}

function DoubleAuthentification() {
  const user = useAuth((s) => s.user)
  const setAuth = useAuth((s) => s.setAuth)
  const accessToken = useAuth((s) => s.accessToken)
  const refreshToken = useAuth((s) => s.refreshToken)
  const [actif, setActif] = useState(!!user?.twoFactorEnabled)
  const [installation, setInstallation] = useState<{ qr: string; secret: string } | null>(null)
  const [retrait, setRetrait] = useState(false)
  const [code, setCode] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const synchroniser = (valeur: boolean) => {
    setActif(valeur)
    if (user && accessToken && refreshToken) setAuth({ ...user, twoFactorEnabled: valeur }, accessToken, refreshToken)
  }

  // L'état réel est celui du serveur : revenir sur la page ne doit pas montrer
  // une protection active qui ne l'est plus.
  useEffect(() => {
    api.auth.me().then((r) => {
      if (!r.user) return
      setActif(!!r.user.twoFactorEnabled)
      if (accessToken && refreshToken) setAuth(r.user, accessToken, refreshToken)
    }).catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const chiffres = (v: string) => v.replace(/[^0-9]/g, '').slice(0, 6)
  const faire = async (action: () => Promise<void>, defaut: string) => {
    setErreur(null); setEnCours(true)
    try { await action() } catch (e) { setErreur(e instanceof ApiError ? e.message : defaut) } finally { setEnCours(false) }
  }

  return (
    <Bloc
      titre="Double authentification"
      aide="Un code à usage unique, donné par une application sur votre téléphone."
      action={actif
        ? <Badge className="shrink-0 bg-green-600 text-white">Active</Badge>
        : <Badge variant="outline" className="shrink-0">Inactive</Badge>}
    >
      {erreur && <div className="mb-3"><Erreur message={erreur} /></div>}

      {!actif && !installation && (
        <Button onClick={() => faire(async () => {
          const r = await api.auth.twoFactorSetup()
          setInstallation({ qr: r.qr, secret: r.secret })
        }, 'Impossible de démarrer.')} disabled={enCours}>
          {enCours ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
          Activer
        </Button>
      )}

      {!actif && installation && (
        <div className="flex flex-col gap-4 sm:flex-row">
          <img src={installation.qr} alt="Code à scanner" className="h-40 w-40 shrink-0 rounded-xl border bg-white" />
          <div className="min-w-0 flex-1 space-y-3">
            <ol className="list-inside list-decimal space-y-0.5 text-xs text-muted-foreground">
              <li>Ouvrez votre application d'authentification.</li>
              <li>Scannez le code, ou saisissez la clé ci-dessous.</li>
              <li>Entrez les six chiffres affichés.</li>
            </ol>
            <code className="block break-all rounded-lg bg-muted px-2 py-1.5 text-[11px]">{installation.secret}</code>
            <Input
              value={code} onChange={(e) => setCode(chiffres(e.target.value))} inputMode="numeric"
              placeholder="000000" className="text-center font-semibold tracking-[0.3em]"
            />
            <div className="flex gap-2">
              <Button
                className="flex-1"
                disabled={enCours || code.length < 6}
                onClick={() => faire(async () => {
                  await api.auth.twoFactorEnable(code)
                  synchroniser(true); setInstallation(null); setCode('')
                }, 'Code invalide.')}
              >
                {enCours ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="mr-2 h-4 w-4" />Activer</>}
              </Button>
              <Button variant="outline" onClick={() => { setInstallation(null); setCode(''); setErreur(null) }}>Annuler</Button>
            </div>
          </div>
        </div>
      )}

      {actif && !retrait && (
        <Button variant="outline" className="text-red-600 hover:text-red-700" onClick={() => { setRetrait(true); setErreur(null) }}>
          <ShieldOff className="mr-2 h-4 w-4" />Désactiver
        </Button>
      )}

      {actif && retrait && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Entrez un code de votre application pour confirmer.</p>
          <Input
            value={code} onChange={(e) => setCode(chiffres(e.target.value))} inputMode="numeric"
            placeholder="000000" className="max-w-xs text-center font-semibold tracking-[0.3em]"
          />
          <div className="flex gap-2">
            <Button
              variant="outline" className="text-red-600 hover:text-red-700"
              disabled={enCours || code.length < 6}
              onClick={() => faire(async () => {
                await api.auth.twoFactorDisable(code)
                synchroniser(false); setRetrait(false); setCode('')
              }, 'Code invalide.')}
            >
              {enCours ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmer'}
            </Button>
            <Button variant="ghost" onClick={() => { setRetrait(false); setCode(''); setErreur(null) }}>Annuler</Button>
          </div>
        </div>
      )}
    </Bloc>
  )
}

function MotDePasse() {
  const [f, setF] = useState({ actuel: '', nouveau: '', confirmation: '' })
  const [enCours, setEnCours] = useState(false)
  const [fait, setFait] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const poser = (p: Partial<typeof f>) => setF((v) => ({ ...v, ...p }))

  const changer = async () => {
    setErreur(null); setFait(false)
    if (f.nouveau.length < 8) { setErreur('Le nouveau mot de passe doit faire au moins huit caractères.'); return }
    if (f.nouveau !== f.confirmation) { setErreur('Les deux saisies ne correspondent pas.'); return }
    setEnCours(true)
    try {
      await api.auth.changePassword({ currentPassword: f.actuel, newPassword: f.nouveau })
      setF({ actuel: '', nouveau: '', confirmation: '' })
      setFait(true); setTimeout(() => setFait(false), 4000)
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Changement impossible.')
    } finally { setEnCours(false) }
  }

  return (
    <Bloc titre="Mot de passe" aide="Huit caractères au minimum.">
      <div className="grid max-w-md gap-3">
        <Champ label="Mot de passe actuel">
          <Input type="password" autoComplete="current-password" value={f.actuel} onChange={(e) => poser({ actuel: e.target.value })} />
        </Champ>
        <Champ label="Nouveau mot de passe">
          <Input type="password" autoComplete="new-password" value={f.nouveau} onChange={(e) => poser({ nouveau: e.target.value })} />
        </Champ>
        <Champ label="Confirmation">
          <Input type="password" autoComplete="new-password" value={f.confirmation} onChange={(e) => poser({ confirmation: e.target.value })} />
        </Champ>
        {erreur && <Erreur message={erreur} />}
        <div className="flex items-center gap-3">
          <Button onClick={changer} disabled={enCours || !f.actuel || !f.nouveau}>
            {enCours ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Changer le mot de passe'}
          </Button>
          {fait && (
            <span className="flex items-center gap-1 text-sm text-green-700">
              <Check className="h-4 w-4" />Mot de passe changé
            </span>
          )}
        </div>
      </div>
    </Bloc>
  )
}

// --------------------------------------------------------- notifications

function SectionNotifications() {
  const user = useAuth((s) => s.user)
  const enregistrer = usePreferences()
  const n = user?.preferences?.notifications ?? {}
  const [etat, setEtat] = useState({
    emailDiagnostic: n.emailDiagnostic ?? true,
    calendarReminders: n.calendarReminders ?? true,
    priorityAlerts: n.priorityAlerts ?? true,
    weeklyDigest: n.weeklyDigest ?? false,
  })
  const [occupe, setOccupe] = useState<string | null>(null)

  const basculer = async (k: keyof typeof etat) => {
    const suivant = { ...etat, [k]: !etat[k] }
    setEtat(suivant); setOccupe(k)
    try { await enregistrer({ notifications: suivant }) } finally { setOccupe(null) }
  }

  const lignes: { k: keyof typeof etat; titre: string; aide: string }[] = [
    { k: 'priorityAlerts', titre: 'Urgences', aide: 'Quand un ouvrage relevé appelle une intervention sous cinq ans.' },
    { k: 'calendarReminders', titre: 'Rappels de visite', aide: 'La veille d’une visite ou d’une échéance.' },
    { k: 'emailDiagnostic', titre: 'Nouveau diagnostic', aide: 'À la création d’un diagnostic sur un de vos bâtiments.' },
    { k: 'weeklyDigest', titre: 'Résumé du lundi', aide: 'Ce qui a avancé la semaine passée, en un message.' },
  ]

  return (
    <>
      <Bloc titre="Sur cet appareil" aide="Les notifications poussées s'arrêtent à ce navigateur.">
        <NotificationsPoussees />
      </Bloc>
      <Bloc titre="Par courriel" aide="Un réglage par type de message, enregistré aussitôt.">
        <div className="divide-y divide-black/[0.06]">
          {lignes.map((l) => (
            <Bascule
              key={l.k}
              actif={etat[l.k]}
              occupe={occupe === l.k}
              onChange={() => basculer(l.k)}
              titre={l.titre}
              aide={l.aide}
            />
          ))}
        </div>
      </Bloc>
    </>
  )
}

function NotificationsPoussees() {
  const [etat, setEtat] = useState<PushState | 'chargement'>('chargement')
  const [serveur, setServeur] = useState<boolean | null>(null)
  const [cle, setCle] = useState<string | null>(null)
  const [occupe, setOccupe] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      try { const v = await api.push.vapid(); setServeur(v.enabled); setCle(v.publicKey) } catch { setServeur(false) }
      try { setEtat(await getPushState()) } catch { setEtat('unsupported') }
    })()
  }, [])

  const basculer = async () => {
    if (occupe) return
    setOccupe(true); setMessage(null)
    try {
      if (etat === 'subscribed') { await unsubscribePush(); setEtat('unsubscribed') }
      else if (cle) { await subscribePush(cle); setEtat('subscribed') }
    } catch { setMessage('Le navigateur a refusé la permission.') } finally { setOccupe(false) }
  }

  const essai = async () => {
    setOccupe(true); setMessage(null)
    try {
      const r = await api.push.test()
      setMessage(r.sent > 0 ? 'Notification envoyée.' : 'Aucun appareil abonné.')
    } catch { setMessage("L'envoi a échoué.") } finally { setOccupe(false) }
  }

  const indisponible = etat === 'unsupported' || serveur === false || etat === 'denied'
  const aide = etat === 'unsupported' ? 'Ce navigateur ne les gère pas.'
    : serveur === false ? 'Le serveur ne les a pas configurées.'
      : etat === 'denied' ? 'Bloquées dans les réglages du navigateur.'
        : 'Rappels et urgences, même quand Diagly est fermé.'

  return (
    <>
      <Bascule
        actif={etat === 'subscribed'}
        occupe={occupe || etat === 'chargement'}
        indisponible={indisponible}
        onChange={basculer}
        titre={<span className="flex items-center gap-1.5"><BellRing className="h-4 w-4 text-blue-600" />Notifications poussées</span>}
        aide={aide}
      />
      {(etat === 'subscribed' || message) && (
        <div className="flex items-center gap-3 pb-1">
          {etat === 'subscribed' && (
            <button onClick={essai} disabled={occupe} className="text-xs font-medium text-blue-700 hover:underline">
              Envoyer un essai
            </button>
          )}
          {message && <span className="text-xs text-muted-foreground">{message}</span>}
        </div>
      )}
    </>
  )
}

// ------------------------------------------------------------- entreprise

/** Charge une image, la réduit à 320 px et rend un data URL léger. */
async function lireLogo(fichier: File): Promise<string> {
  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(fichier)
  })
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new window.Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl
  })
  const max = 320
  const echelle = Math.min(1, max / Math.max(img.width, img.height))
  const l = Math.round(img.width * echelle)
  const h = Math.round(img.height * echelle)
  const toile = document.createElement('canvas')
  toile.width = l; toile.height = h
  toile.getContext('2d')!.drawImage(img, 0, 0, l, h)
  // PNG, pour garder la transparence des logos.
  return toile.toDataURL('image/png')
}

function SectionBureau() {
  const user = useAuth((s) => s.user)
  const setAuth = useAuth((s) => s.setAuth)
  const accessToken = useAuth((s) => s.accessToken)
  const refreshToken = useAuth((s) => s.refreshToken)
  const enregistrerPrefs = usePreferences()
  const c = user?.preferences?.company ?? {}

  const depart = useMemo(() => ({
    // `||` et non `??` : une raison sociale enregistrée vide doit laisser
    // reparaître celle du profil, et non rester vide.
    name: c.name || user?.companyName || '',
    address: c.address ?? '',
    postalCode: c.postalCode ?? '',
    city: c.city ?? '',
    canton: c.canton ?? '',
    vatNumber: c.vatNumber ?? '',
    iban: c.iban ?? '',
    logo: c.logo ?? '',
    accentColor: c.accentColor ?? '#3b82f6',
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [user])
  const [f, setF] = useState(depart)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const modifie = aChange(f, depart)
  const poser = (p: Partial<typeof f>) => setF((v) => ({ ...v, ...p }))

  const choisirLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fichier = e.target.files?.[0]
    e.target.value = ''
    if (!fichier) return
    setErreur(null)
    try { poser({ logo: await lireLogo(fichier) }) } catch { setErreur("Cette image n'a pas pu être lue.") }
  }

  const enregistrer = async () => {
    setEnCours(true); setErreur(null)
    try {
      // `undefined` disparaît du JSON : le serveur, qui fusionne, garderait
      // l'ancien logo. On envoie donc explicitement `null` pour l'effacer.
      await enregistrerPrefs({ company: { ...f, logo: f.logo || null } })
      // La raison sociale vivait en double, sur le profil et sur l'entreprise.
      // Une seule saisie, désormais, et elle tient les deux à jour.
      if ((f.name.trim() || null) !== (user?.companyName ?? null)) {
        const r = await api.auth.updateProfile({ companyName: f.name.trim() || null })
        if (accessToken && refreshToken) setAuth({ ...r.user, preferences: { ...r.user.preferences, company: { ...f, logo: f.logo || null } } }, accessToken, refreshToken)
      }
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Enregistrement impossible.')
    } finally { setEnCours(false) }
  }

  return (
    <>
      <Bloc titre="En-tête des rapports" aide="Ce que votre client voit en premier.">
        <ApercuEnTete bureau={f} auteur={nomAffiche(user ?? {})} />
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-white">
            {f.logo
              ? <img src={f.logo} alt="" className="max-h-full max-w-full object-contain" />
              : <Building2 className="h-7 w-7 text-muted-foreground" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Logo</p>
            <p className="text-xs text-muted-foreground">PNG ou JPG. Réduit automatiquement à 320 pixels.</p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <label className="cursor-pointer text-sm font-medium text-blue-700 hover:underline">
                <input type="file" accept="image/*" onChange={choisirLogo} className="hidden" />
                {f.logo ? 'Changer' : 'Importer'}
              </label>
              {f.logo && (
                <button onClick={() => poser({ logo: '' })} className="text-sm text-red-600 hover:underline">Retirer</button>
              )}
            </div>
          </div>
          <Champ label="Couleur d'accent">
            <input
              type="color" value={f.accentColor} onChange={(e) => poser({ accentColor: e.target.value })}
              className="h-9 w-20 cursor-pointer rounded-lg border bg-white"
            />
          </Champ>
        </div>
      </Bloc>

      <Bloc titre="Identité" aide="Reprise sur les rapports, les devis et les exports.">
        <div className="grid gap-3">
          <Champ label="Raison sociale">
            <Input value={f.name} onChange={(e) => poser({ name: e.target.value })} placeholder="Berger & Fils SA" />
          </Champ>
          <Champ label="Adresse">
            <Input value={f.address} onChange={(e) => poser({ address: e.target.value })} placeholder="Rue de la Gare 10" />
          </Champ>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Champ label="NPA">
              <Input value={f.postalCode} onChange={(e) => poser({ postalCode: e.target.value })} maxLength={4} />
            </Champ>
            <Champ label="Ville">
              <Input value={f.city} onChange={(e) => poser({ city: e.target.value })} />
            </Champ>
            <Champ label="Canton">
              <Input value={f.canton} onChange={(e) => poser({ canton: e.target.value.toUpperCase() })} maxLength={2} />
            </Champ>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Champ label="Numéro de TVA">
              <Input value={f.vatNumber} onChange={(e) => poser({ vatNumber: e.target.value })} placeholder="CHE-000.000.000 TVA" />
            </Champ>
            <Champ label="IBAN" aide="Pour les devis et les factures.">
              <Input value={f.iban} onChange={(e) => poser({ iban: e.target.value })} placeholder="CH00 0000 0000 0000 0000 0" />
            </Champ>
          </div>
        </div>
      </Bloc>

      <BarreEnregistrement
        modifie={modifie} enCours={enCours} erreur={erreur}
        onAnnuler={() => { setF(depart); setErreur(null) }}
        onEnregistrer={enregistrer}
      />
    </>
  )
}

/** L'en-tête d'un rapport, tel qu'il partira. */
function ApercuEnTete({ bureau, auteur }: {
  bureau: { name: string; address: string; postalCode: string; city: string; logo: string; accentColor: string }
  auteur: string
}) {
  const adresse = [bureau.address, [bureau.postalCode, bureau.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="flex items-start justify-between gap-4 border-b-2 pb-3" style={{ borderColor: bureau.accentColor }}>
        <div className="min-w-0">
          <p className="text-[13px] font-bold leading-tight text-neutral-900">
            {bureau.name || <span className="text-red-500">Raison sociale à renseigner</span>}
          </p>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            {adresse || <span className="text-red-500">Adresse à renseigner</span>}
          </p>
        </div>
        {bureau.logo
          ? <img src={bureau.logo} alt="" className="h-10 max-w-32 shrink-0 object-contain" />
          : <div className="flex h-10 w-24 shrink-0 items-center justify-center rounded border border-dashed text-[10px] text-neutral-400">logo</div>}
      </div>
      <p className="mt-3 text-[15px] font-bold" style={{ color: bureau.accentColor }}>Rapport de diagnostic</p>
      <p className="text-[11px] text-neutral-500">Avenue de la Gare 10, 1003 Lausanne · établi par {auteur}</p>
    </div>
  )
}

// ----------------------------------------------------------- valeurs

function SectionValeurs() {
  const user = useAuth((s) => s.user)
  const enregistrerPrefs = usePreferences()
  const d = user?.preferences?.defaults ?? {}

  const depart = useMemo(() => ({
    honoraryPct: String(d.honoraryPct ?? 12),
    reservePct: String(d.reservePct ?? 10),
    vatPct: String(d.vatPct ?? 8.1),
    unit: (d.unit ?? 'm') as 'm' | 'cm' | 'mm',
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [user])
  const [f, setF] = useState(depart)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const modifie = aChange(f, depart)
  const poser = (p: Partial<typeof f>) => setF((v) => ({ ...v, ...p }))

  const nombre = (v: string, defaut: number) => {
    const n = Number(v.replace(',', '.'))
    return Number.isFinite(n) && n >= 0 ? n : defaut
  }
  const etapes = apercuDesValeurs({
    honoraryPct: nombre(f.honoraryPct, 0),
    reservePct: nombre(f.reservePct, 0),
    vatPct: nombre(f.vatPct, 0),
  })

  const enregistrer = async () => {
    setEnCours(true); setErreur(null)
    try {
      await enregistrerPrefs({
        defaults: {
          honoraryPct: nombre(f.honoraryPct, 12),
          reservePct: nombre(f.reservePct, 10),
          vatPct: nombre(f.vatPct, 8.1),
          unit: f.unit,
        },
      })
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Enregistrement impossible.')
    } finally { setEnCours(false) }
  }

  return (
    <>
      <Bloc titre="Chiffrage" aide="Appliqué aux nouveaux diagnostics. Un dossier déjà ouvert garde les siennes.">
        <div className="grid gap-3 sm:grid-cols-3">
          <Champ label="Honoraires (%)">
            <Input type="number" min="0" step="0.5" value={f.honoraryPct} onChange={(e) => poser({ honoraryPct: e.target.value })} />
          </Champ>
          <Champ label="Réserve (%)">
            <Input type="number" min="0" step="0.5" value={f.reservePct} onChange={(e) => poser({ reservePct: e.target.value })} />
          </Champ>
          <Champ label="TVA (%)">
            <Input type="number" min="0" step="0.1" value={f.vatPct} onChange={(e) => poser({ vatPct: e.target.value })} />
          </Champ>
        </div>

        <div className="mt-4 rounded-xl bg-muted/50 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Sur 100 000 francs de travaux
          </p>
          <dl className="space-y-1 text-sm">
            {etapes.map((e, i) => (
              <div
                key={e.libelle}
                className={cn('flex justify-between gap-4',
                  i === etapes.length - 1 && 'border-t pt-1 font-semibold')}
              >
                <dt className={cn(i > 0 && i < etapes.length - 1 && 'text-muted-foreground')}>{e.libelle}</dt>
                <dd className="tabular-nums">{formatCHF(e.montant)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Bloc>

      <Bloc titre="Plans" aide="L'unité dans laquelle les mesures se saisissent.">
        <Champ label="Unité de mesure">
          <Select value={f.unit} onChange={(e) => poser({ unit: e.target.value as 'm' | 'cm' | 'mm' })} className="sm:w-48">
            <option value="m">Mètres</option>
            <option value="cm">Centimètres</option>
            <option value="mm">Millimètres</option>
          </Select>
        </Champ>
      </Bloc>

      <BarreEnregistrement
        modifie={modifie} enCours={enCours} erreur={erreur}
        onAnnuler={() => { setF(depart); setErreur(null) }}
        onEnregistrer={enregistrer}
      />
    </>
  )
}

// -------------------------------------------------------------- compte

const ROLES: Record<string, string> = {
  DT: 'Direction des travaux',
  REGIE: 'Régie',
  ARCHITECT: 'Architecte',
  PARTICULIER: 'Particulier',
  ADMIN: 'Administrateur',
}

const ROLES_ORG: Record<string, string> = {
  OWNER: 'Propriétaire',
  ADMIN: 'Responsable',
  MEMBER: 'Membre',
  VIEWER: 'Lecture seule',
}

function SectionCompte() {
  const user = useAuth((s) => s.user)
  const navigate = useNavigate()
  const org = useQuery({ queryKey: ['org'], queryFn: () => api.org.get(), staleTime: 5 * 60_000 })

  // Révoque la session côté serveur ET efface ce qui a été mis en cache sur
  // l'appareil (diagnostics, photos, file d'attente) avant de rendre la main.
  const seDeconnecter = async () => {
    await endSession()
    navigate('/login', { replace: true })
  }

  return (
    <>
      <Bloc titre="Votre compte">
        <dl className="divide-y divide-black/[0.06] text-sm">
          <Ligne terme="Adresse de connexion">{user?.email}</Ligne>
          <Ligne terme="Rôle">{ROLES[user?.role ?? ''] ?? user?.role ?? 'Non précisé'}</Ligne>
          <Ligne terme="Plan"><Badge className="border border-blue-100 bg-blue-50 text-blue-700">Diagly Pro</Badge></Ligne>
          <Ligne terme="Compte ouvert le">
            {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Inconnu'}
          </Ligne>
        </dl>
      </Bloc>

      <Bloc titre="Organisation" aide="Les dossiers et la base CFC se partagent à l'intérieur d'une organisation.">
        {org.isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : org.data?.organization ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{org.data.organization.name}</p>
              <p className="text-xs text-muted-foreground">
                Vous y êtes {ROLES_ORG[org.data.role ?? ''] ?? org.data.role ?? 'membre'}.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/app/team')}>
              <Users className="mr-2 h-4 w-4" />Gérer l'équipe
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Vous travaillez seul, sans organisation.</p>
            <Button variant="outline" size="sm" onClick={() => navigate('/app/team')}>Créer une organisation</Button>
          </div>
        )}
      </Bloc>

      <Bloc titre="Session" aide="La déconnexion efface aussi les dossiers gardés sur cet appareil pour le hors-réseau.">
        <Button variant="outline" onClick={seDeconnecter}>
          <LogOut className="mr-2 h-4 w-4" />Se déconnecter
        </Button>
      </Bloc>

      <section className="rounded-2xl border border-red-200 bg-red-50/40 p-4">
        <h3 className="text-sm font-semibold text-red-800">Fermer le compte</h3>
        <p className="mt-0.5 text-sm text-red-700">
          La fermeture supprime vos diagnostics, vos photos et vos rapports, sans retour possible.
        </p>
        <div className="mt-3">
          <p className="mb-3 text-sm text-muted-foreground">
            Elle passe par le support, qui vérifie d'abord qu'aucun dossier partagé n'en dépend et vous
            laisse exporter ce que vous voulez garder.
          </p>
          <Button variant="outline" size="sm" className="border-red-200 text-red-700 hover:bg-red-50" onClick={() => navigate('/app/support/new')}>
            Demander la fermeture
          </Button>
        </div>
      </section>
    </>
  )
}

function Ligne({ terme, children }: { terme: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
      <dt className="text-muted-foreground">{terme}</dt>
      <dd className="min-w-0 truncate text-right font-medium">{children}</dd>
    </div>
  )
}
