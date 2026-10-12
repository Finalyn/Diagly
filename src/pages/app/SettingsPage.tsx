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
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle, Bell, BellRing, Building2, Check, ChevronLeft, ChevronRight, CircleUser,
  CreditCard, KeyRound, Loader2, LogOut, Mail, Palette, ShieldCheck, ShieldOff, User as UserIcon, Users,
} from 'lucide-react'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from '@/components/ui'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/stores/auth'
import { cn } from '@/lib/utils'
import { getPushState, subscribePush, unsubscribePush, type PushState } from '@/lib/push-client'
import { logout as endSession, confirmerDeconnexion, apresSuppressionDuCompte } from '@/lib/session'
import { estAppNative } from '@/lib/plateforme'
import {
  aChange, champsManquantsDuBureau, etatDuProfil, initiales, nomAffiche,
} from '@/lib/reglages'
import type { UserPreferences } from '@/lib/api-types'
import { SectionEquipe, type IdSectionEquipe } from './Equipe'

type IdSection =
  | 'profil' | 'securite' | 'notifications' | 'compte'
  | 'bureau' | 'personnalisation' | 'facturation'
  | IdSectionEquipe

const TOUTES_LES_SECTIONS: {
  id: IdSection
  label: string
  aide: string
  icone: React.ComponentType<{ className?: string }>
  famille: 'Mon compte' | 'Mon travail' | 'Mon organisation'
}[] = [
  { id: 'profil', label: 'Profil', aide: 'Votre nom, votre téléphone', icone: UserIcon, famille: 'Mon compte' },
  { id: 'securite', label: 'Sécurité', aide: 'Mot de passe et double authentification', icone: ShieldCheck, famille: 'Mon compte' },
  { id: 'notifications', label: 'Notifications', aide: 'Ce que Diagly vous signale', icone: Bell, famille: 'Mon compte' },
  { id: 'compte', label: 'Compte', aide: 'Plan, équipe, déconnexion', icone: CircleUser, famille: 'Mon compte' },
  { id: 'bureau', label: 'Entreprise', aide: 'Identité et coordonnées du bureau', icone: Building2, famille: 'Mon travail' },
  { id: 'personnalisation', label: 'Personnalisation', aide: 'Logo et couleur de vos rapports', icone: Palette, famille: 'Mon travail' },
  { id: 'facturation', label: 'Facturation', aide: 'Plan et coordonnées de facturation', icone: CreditCard, famille: 'Mon travail' },
  // L'équipe se règle ici, avec le reste : elle n'a plus sa page dans le menu principal.
  { id: 'membres', label: 'Membres', aide: 'Les personnes de votre organisation et leur rôle', icone: Users, famille: 'Mon organisation' },
  { id: 'invitations', label: 'Invitations', aide: 'Invitations envoyées, pas encore acceptées', icone: Mail, famille: 'Mon organisation' },
  { id: 'roles', label: 'Rôles et droits', aide: 'Ce que chaque rôle peut faire', icone: KeyRound, famille: 'Mon organisation' },
]

// L'App Store refuse qu'une app parle d'abonnement payé hors de ses achats
// intégrés (règle 3.1.1) : la facturation reste sur le site.
const SECTIONS = TOUTES_LES_SECTIONS.filter((s) => !(estAppNative && s.id === 'facturation'))

const FAMILLES = ['Mon compte', 'Mon travail', 'Mon organisation'] as const

/**
 * Sous lg (1024 px), une section à la fois : le sommaire, puis la section.
 *
 * Les deux colonnes ne tiennent côte à côte qu'à partir de lg. Entre 768 et
 * 1023 px, un iPad à la verticale, le menu gardait toute la largeur et la
 * carte de la section, poussée à côté, tombait à zéro pixel : on touchait une
 * section et rien ne paraissait. Sur un iPad debout, menu de gauche ouvert,
 * il reste environ 550 px pour la page ; une colonne de menu en aurait pris
 * plus du tiers et laissé aux formulaires moins qu'un téléphone. Ils ont
 * toute la largeur, comme sur téléphone.
 *
 * `screen and` pour la même raison que dans use-mobile.ts : à l'impression,
 * la largeur de référence est celle de la page.
 */
const UNE_SECTION_A_LA_FOIS = 'screen and (max-width: 1023px)'

function useUneSectionALaFois() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(UNE_SECTION_A_LA_FOIS)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => window.matchMedia(UNE_SECTION_A_LA_FOIS).matches,
    () => false,
  )
}

export function SettingsPage() {
  const uneALaFois = useUneSectionALaFois()
  /**
   * La section ouverte vit dans l'adresse, et nulle part ailleurs.
   *
   * Le menu du compte peut ainsi ouvrir directement la bonne, un lien se
   * partage, et le bouton Retour du navigateur fait ce qu'on attend. Sur
   * téléphone et sur iPad à la verticale, l'absence de section montre le
   * sommaire : on y revient par la flèche, plutôt que de garder une barre
   * d'onglets qui déborde de l'écran.
   */
  const [parametres, setParametres] = useSearchParams()
  const demandee = SECTIONS.find((s) => s.id === parametres.get('s'))?.id ?? null
  const choisie = demandee ?? (uneALaFois ? null : 'profil')
  const choisir = (id: IdSection | null) => setParametres(id ? { s: id } : {}, { replace: true })

  const section = SECTIONS.find((s) => s.id === choisie)

  // Les deux panneaux suivent leur contenu : une hauteur figée laissait un
  // grand vide sous un formulaire court, et passait sous la barre de
  // navigation flottante du téléphone. C'est la page qui défile.
  return (
    <div className="space-y-4">
      {/* Le titre nomme la page, pas le menu : dans la carte de gauche, il
          servait d'étiquette à la colonne des sections, et la page elle-même
          n'avait plus de nom. Il se tient maintenant au-dessus des deux
          panneaux, comme sur les autres écrans. */}
      <div>
        <h1 className="text-xl font-bold">Paramètres</h1>
        <p className="text-sm text-muted-foreground">
          Votre compte, votre bureau, et ce que Diagly fait en votre nom.
        </p>
      </div>

      <div className={cn('flex gap-4', uneALaFois ? 'flex-col' : 'items-start')}>
        {/* ----- Le menu, à gauche ----- */}
        {(!uneALaFois || choisie === null) && (
          <Menu choisie={choisie} onChoisir={choisir} seul={uneALaFois} />
        )}

        {/* ----- Les réglages de la section, à droite ----- */}
        {section && (
          <Card className="min-w-0 flex-1 overflow-hidden">
            <CardHeader className="space-y-0 border-b border-black/[0.06] px-5 py-3.5">
              {uneALaFois && (
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
            <CardContent className="space-y-5 p-5">
              {choisie === 'profil' && <SectionProfil />}
              {choisie === 'securite' && <SectionSecurite />}
              {choisie === 'notifications' && <SectionNotifications />}
              {choisie === 'bureau' && <SectionBureau />}
              {choisie === 'personnalisation' && <SectionPersonnalisation />}
              {choisie === 'facturation' && <SectionFacturation />}
              {choisie === 'compte' && <SectionCompte />}
              {(choisie === 'membres' || choisie === 'invitations' || choisie === 'roles') && (
                <SectionEquipe section={choisie} onChoisir={choisir} />
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

/**
 * Le menu, dans sa carte.
 *
 * En tête le titre de la page et ce qu'il reste à regarder, puis la personne
 * connectée, puis les sections par famille, chacune avec ce qui lui manque.
 * Même carte et même colonne que les autres écrans à deux panneaux.
 *
 * `seul` : le menu tient l'écran à lui seul (téléphone, iPad à la verticale)
 * et mène à la section, qui le remplace. Ses lignes sont alors plus hautes,
 * portent leur aide et un chevron, et aucune n'est marquée comme ouverte.
 */
function Menu({ choisie, onChoisir, seul }: {
  choisie: IdSection | null
  onChoisir: (id: IdSection) => void
  seul: boolean
}) {
  const user = useAuth((s) => s.user)
  const bureau = user?.preferences?.company
  // Les invitations ne regardent que les administrateurs d'une organisation.
  const org = useQuery({ queryKey: ['org'], queryFn: () => api.org.get(), staleTime: 5 * 60_000 })
  const gereEquipe = !!org.data?.organization && (org.data.role === 'OWNER' || org.data.role === 'ADMIN')
  const visibles = SECTIONS.filter((s) => s.id !== 'invitations' || gereEquipe)
  return (
    <Card className="w-full shrink-0 overflow-hidden lg:w-72">
      <div className="flex items-center gap-3 border-b border-black/[0.06] px-4 py-3.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/[0.06] bg-secondary text-sm font-semibold text-foreground">
          {initiales(user ?? {})}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight">{nomAffiche(user ?? {})}</p>
          <p className="truncate text-xs text-muted-foreground">{bureau?.name || user?.companyName || user?.email}</p>
        </div>
      </div>

      <nav className="space-y-4 p-2">
        {FAMILLES.map((famille) => (
          <div key={famille}>
            <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{famille}</p>
            <div className="space-y-1">
              {visibles.filter((s) => s.famille === famille).map((s) => {
                const on = s.id === choisie
                return (
                  <button
                    key={s.id}
                    onClick={() => onChoisir(s.id)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-2xl px-3 text-left transition-colors',
                      seul ? 'py-3' : 'py-2.5',
                      on && !seul
                        ? 'border border-blue-100 bg-blue-50 text-blue-700'
                        : 'text-neutral-600 hover:bg-black/[0.03] hover:text-neutral-900',
                    )}
                  >
                    <s.icone className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className={cn('block truncate text-sm', on && !seul ? 'font-semibold' : 'font-medium')}>{s.label}</span>
                      {seul && <span className="block truncate text-[11px] text-muted-foreground">{s.aide}</span>}
                    </span>
                    {seul && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
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

/**
 * Ce qui manque, dit là où on peut le remplir.
 *
 * Les mentions vivaient dans le menu, en orange sous chaque entrée : on les
 * voyait sans pouvoir y faire quoi que ce soit, et elles finissaient par faire
 * partie du décor. Dans la section, la phrase est à côté du champ qu'elle
 * désigne.
 */
function Avertissement({ message }: { message: string }) {
  // Le bandeau s'arrête à sa phrase : étiré sur toute la largeur du panneau,
  // il barrait l'écran d'un trait jaune pour dire qu'un téléphone manque.
  return (
    <p className="mb-4 flex w-fit max-w-2xl items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
      <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0 text-amber-600" />{message}
    </p>
  )
}

function Erreur({ message }: { message: string }) {
  return (
    <p className="flex w-fit max-w-2xl items-start gap-1.5 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-800">
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

  const manque = etatDuProfil({ firstName: f.firstName, lastName: f.lastName, phone: f.phone })

  return (
    <>
      <Bloc titre="Profil" aide="Votre nom signe les rapports que vous éditez.">
        {manque.etat === 'incomplet' && (
          <Avertissement message="Sans nom, les rapports que vous éditez partent anonymes." />
        )}
        {manque.etat === 'attention' && (
          <Avertissement message="Aucun téléphone : vos clients n'auront pas de quoi vous rappeler." />
        )}
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
      <div className={cn('mb-5 flex w-fit max-w-2xl items-start gap-3 rounded-2xl border p-4',
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
              : 'Vos dossiers contiennent des adresses, des plans et des montants. Un code à usage unique, par une application ou par email, prend une minute à activer.'}
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
  // Un compte activé avant l'email n'a pas de méthode enregistrée : c'est l'application.
  const [methode, setMethode] = useState<'TOTP' | 'EMAIL'>(user?.twoFactorMethod === 'EMAIL' ? 'EMAIL' : 'TOTP')
  const [options, setOptions] = useState<{ email: boolean; adresse: string | null } | null>(null)
  const [choix, setChoix] = useState<'TOTP' | 'EMAIL'>('TOTP')
  const [installation, setInstallation] = useState<{ qr: string; secret: string } | null>(null)
  /** Le code de confirmation envoyé par email : son ticket, et l'adresse masquée. */
  const [envoi, setEnvoi] = useState<{ ticket: string; email: string } | null>(null)
  const [retrait, setRetrait] = useState(false)
  const [code, setCode] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const synchroniser = (valeur: boolean, m: 'TOTP' | 'EMAIL' | null) => {
    setActif(valeur)
    if (m) setMethode(m)
    if (user && accessToken && refreshToken) setAuth({ ...user, twoFactorEnabled: valeur, twoFactorMethod: valeur ? m : null }, accessToken, refreshToken)
  }

  // L'état réel est celui du serveur : revenir sur la page ne doit pas montrer
  // une protection active qui ne l'est plus.
  useEffect(() => {
    api.auth.me().then((r) => {
      if (!r.user) return
      setActif(!!r.user.twoFactorEnabled)
      setMethode(r.user.twoFactorMethod === 'EMAIL' ? 'EMAIL' : 'TOTP')
      if (accessToken && refreshToken) setAuth(r.user, accessToken, refreshToken)
    }).catch(() => undefined)
    api.auth.twoFactorOptions().then(setOptions).catch(() => setOptions({ email: false, adresse: null }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const chiffres = (v: string) => v.replace(/[^0-9]/g, '').slice(0, 6)
  const faire = async (action: () => Promise<void>, defaut: string) => {
    setErreur(null); setEnCours(true)
    try { await action() } catch (e) { setErreur(e instanceof ApiError ? e.message : defaut) } finally { setEnCours(false) }
  }
  const annuler = () => { setInstallation(null); setEnvoi(null); setRetrait(false); setCode(''); setErreur(null) }
  const envoyerCode = () => faire(async () => { setEnvoi(await api.auth.twoFactorEmailCode()); setCode('') }, 'Le code n’a pas pu partir.')

  const champCode = (
    <Input
      value={code} onChange={(e) => setCode(chiffres(e.target.value))} inputMode="numeric" autoFocus
      placeholder="000000" className="max-w-xs text-center font-semibold tracking-[0.3em]"
    />
  )

  const METHODES: { id: 'TOTP' | 'EMAIL'; titre: string; aide: string; indisponible?: string }[] = [
    { id: 'TOTP', titre: 'Application d’authentification', aide: 'Un code change toutes les trente secondes dans une application du téléphone (Google Authenticator, Microsoft Authenticator…). Fonctionne sans réseau.' },
    {
      id: 'EMAIL', titre: 'Code par email',
      aide: `Un code à six chiffres vous est envoyé à chaque connexion${options?.adresse ? `, à ${options.adresse}` : ''}. Rien à installer.`,
      indisponible: options && !options.email ? 'L’envoi d’emails n’est pas configuré sur ce serveur.' : undefined,
    },
  ]

  return (
    <Bloc
      titre="Double authentification"
      aide={actif
        ? (methode === 'EMAIL' ? 'Un code envoyé par email est demandé à chaque connexion.' : 'Un code de votre application est demandé à chaque connexion.')
        : 'Un code à usage unique demandé après le mot de passe, à chaque connexion.'}
      action={actif
        ? <Badge className="shrink-0 bg-green-600 text-white">Active</Badge>
        : <Badge variant="outline" className="shrink-0">Inactive</Badge>}
    >
      {erreur && <div className="mb-3"><Erreur message={erreur} /></div>}

      {/* ----- Choisir la méthode ----- */}
      {!actif && !installation && !envoi && (
        <div className="space-y-3">
          <div className="grid max-w-2xl gap-2 sm:grid-cols-2">
            {METHODES.map((m) => (
              <label key={m.id} className={cn(
                'flex items-start gap-2.5 rounded-xl border p-3 transition-colors',
                m.indisponible ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
                choix === m.id && !m.indisponible ? 'border-blue-300 bg-white' : 'border-black/[0.08] bg-white/50 hover:bg-white',
              )}>
                <input type="radio" name="methode-2fa" checked={choix === m.id} disabled={!!m.indisponible} onChange={() => setChoix(m.id)} className="mt-0.5 accent-blue-600" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{m.titre}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{m.indisponible ?? m.aide}</span>
                </span>
              </label>
            ))}
          </div>
          <Button
            disabled={enCours}
            onClick={() => (choix === 'EMAIL'
              ? envoyerCode()
              : faire(async () => { const r = await api.auth.twoFactorSetup(); setInstallation({ qr: r.qr, secret: r.secret }) }, 'Impossible de démarrer.'))}
          >
            {enCours ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
            {choix === 'EMAIL' ? 'Recevoir un code de confirmation' : 'Activer'}
          </Button>
        </div>
      )}

      {/* ----- Activer par l'application ----- */}
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
            {champCode}
            <div className="flex gap-2">
              <Button
                disabled={enCours || code.length < 6}
                onClick={() => faire(async () => {
                  await api.auth.twoFactorEnable(code)
                  synchroniser(true, 'TOTP'); annuler()
                }, 'Code invalide.')}
              >
                {enCours ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="mr-2 h-4 w-4" />Activer</>}
              </Button>
              <Button variant="outline" onClick={annuler}>Annuler</Button>
            </div>
          </div>
        </div>
      )}

      {/* ----- Activer par email, ou désactiver une 2FA par email : le code reçu ----- */}
      {envoi && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Un code à six chiffres vient de partir à <span className="font-medium text-foreground">{envoi.email}</span>. Il est valable 10 minutes.
          </p>
          {champCode}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={actif ? 'outline' : 'default'}
              className={actif ? 'text-red-600 hover:text-red-700' : undefined}
              disabled={enCours || code.length < 6}
              onClick={() => faire(async () => {
                if (actif) { await api.auth.twoFactorDisable(code, envoi.ticket); synchroniser(false, null) }
                else { await api.auth.twoFactorEmailEnable(envoi.ticket, code); synchroniser(true, 'EMAIL') }
                annuler()
              }, 'Code invalide.')}
            >
              {enCours ? <Loader2 className="h-4 w-4 animate-spin" /> : actif ? 'Désactiver' : <><Check className="mr-2 h-4 w-4" />Activer</>}
            </Button>
            <Button variant="ghost" onClick={envoyerCode} disabled={enCours}>Renvoyer un code</Button>
            <Button variant="ghost" onClick={annuler}>Annuler</Button>
          </div>
        </div>
      )}

      {/* ----- Active ----- */}
      {actif && !retrait && !envoi && (
        <div className="space-y-3">
          <p className="text-sm">
            Méthode : <span className="font-medium">{methode === 'EMAIL' ? `code par email${options?.adresse ? ` (${options.adresse})` : ''}` : 'application d’authentification'}</span>
          </p>
          <Button variant="outline" className="text-red-600 hover:text-red-700" disabled={enCours}
            onClick={() => { setErreur(null); if (methode === 'EMAIL') envoyerCode(); else setRetrait(true) }}>
            {enCours ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldOff className="mr-2 h-4 w-4" />}Désactiver
          </Button>
        </div>
      )}

      {actif && retrait && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Entrez un code de votre application pour confirmer.</p>
          {champCode}
          <div className="flex gap-2">
            <Button
              variant="outline" className="text-red-600 hover:text-red-700"
              disabled={enCours || code.length < 6}
              onClick={() => faire(async () => {
                await api.auth.twoFactorDisable(code)
                synchroniser(false, null); annuler()
              }, 'Code invalide.')}
            >
              {enCours ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmer'}
            </Button>
            <Button variant="ghost" onClick={annuler}>Annuler</Button>
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
    relances: n.relances ?? true,
  })
  const [occupe, setOccupe] = useState<string | null>(null)

  const basculer = async (k: keyof typeof etat) => {
    const suivant = { ...etat, [k]: !etat[k] }
    setEtat(suivant); setOccupe(k)
    try { await enregistrer({ notifications: suivant }) } finally { setOccupe(null) }
  }

  const lignes: { k: keyof typeof etat; titre: string; aide: string }[] = [
    { k: 'priorityAlerts', titre: 'Urgences', aide: "À la clôture d'un relevé, le compte des ouvrages en priorité I." },
    { k: 'calendarReminders', titre: 'Rappels de visite', aide: 'Une demi-heure avant un rendez-vous du calendrier.' },
    { k: 'emailDiagnostic', titre: 'Diagnostic ouvert', aide: "À l'ouverture d'un diagnostic sur un de vos bâtiments." },
    { k: 'weeklyDigest', titre: 'Résumé du lundi', aide: 'Ce qui a avancé, et les visites de la semaine qui vient.' },
    { k: 'relances', titre: "Rappels d'absence", aide: "Après une semaine sans venir, le dossier qui vous attend. Deux rappels au plus, en semaine, le matin." },
  ]

  return (
    <>
      <Bloc titre="Les trois canaux" aide="Ils ne jouent pas le même rôle.">
        <Canaux />
      </Bloc>

      <Bloc
        titre="Ce que Diagly vous signale"
        aide="Chaque réglage s'enregistre aussitôt. Décoché, l'événement reste dans la cloche mais ne vous poursuit plus."
      >
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

/**
 * Ce que chaque canal fait, et s'il est disponible.
 *
 * Dire « notifications activées » sans dire par où elles passent ne renseigne
 * personne : le push se refuse au niveau du navigateur, le courriel demande un
 * serveur d'envoi. Quand l'un manque, mieux vaut l'écrire que laisser croire à
 * un message qui n'arrivera jamais.
 */
function Canaux() {
  const centre = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.notifications.list({ limite: 1 }),
    staleTime: 60_000,
  })
  const courrielPret = centre.data?.canaux.email ?? null

  return (
    <div className="divide-y divide-black/[0.06]">
      <div className="flex items-start gap-3 pb-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
          <Bell className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">La cloche, en haut à droite</p>
          <p className="text-xs text-muted-foreground">
            Elle reçoit tout et garde la trace. C'est le seul canal qu'on ne coupe pas : une
            notification qu'on ne reçoit pas par courriel doit rester consultable quelque part.
          </p>
        </div>
      </div>

      <NotificationsPoussees />

      <div className="flex items-start gap-3 pt-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600">
          <Mail className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Le courriel</p>
          <p className="text-xs text-muted-foreground">
            {courrielPret === null
              ? 'Vérification…'
              : courrielPret
                ? 'Envoyé à votre adresse de connexion, pour ce que vous avez coché ci-dessous.'
                : "L'envoi de courriels n'est pas configuré sur ce serveur : rien ne partira tant qu'il ne l'est pas."}
          </p>
        </div>
        {courrielPret !== null && (
          <Badge
            variant="outline"
            className={cn('shrink-0', courrielPret ? 'border-green-200 text-green-700' : 'text-muted-foreground')}
          >
            {courrielPret ? 'Prêt' : 'Non configuré'}
          </Badge>
        )}
      </div>
    </div>
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
      // Dans l'app, ce sont les notifications d'Apple : le serveur doit avoir sa clé APNs.
      try { const v = await api.push.vapid(); setServeur(estAppNative ? !!v.ios : v.enabled); setCle(v.publicKey) } catch { setServeur(false) }
      try { setEtat(await getPushState()) } catch { setEtat('unsupported') }
    })()
  }, [])

  const basculer = async () => {
    if (occupe) return
    setOccupe(true); setMessage(null)
    try {
      if (etat === 'subscribed') { await unsubscribePush(); setEtat('unsubscribed') }
      else if (cle || estAppNative) { await subscribePush(cle); setEtat('subscribed') }
    } catch {
      setMessage(estAppNative
        ? "iOS a refusé : autorisez Diagly dans Réglages > Notifications de l'iPhone."
        : 'Le navigateur a refusé la permission.')
    } finally { setOccupe(false) }
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
      : etat === 'denied' ? (estAppNative ? "Bloquées dans Réglages > Notifications de l'iPhone." : 'Bloquées dans les réglages du navigateur.')
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

/**
 * L'entreprise : qui édite le rapport.
 *
 * Ces lignes paraissent en tête du rapport partagé et sur chaque page du
 * document imprimé. Un rapport de diagnostic engage celui qui le signe : sans
 * raison sociale ni adresse, le client ne sait pas à qui il parle, et la pièce
 * ne vaut rien devant une régie.
 *
 * Le logo et la couleur ne sont pas ici : ils relèvent de l'apparence, pas de
 * l'identité, et ils ont leur propre section.
 */
function SectionBureau() {
  const queryClient = useQueryClient()
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
    phone: c.phone ?? '',
    email: c.email ?? '',
    web: c.web ?? '',
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [user])
  const [f, setF] = useState(depart)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const modifie = aChange(f, depart)
  const poser = (p: Partial<typeof f>) => setF((v) => ({ ...v, ...p }))

  const enregistrer = async () => {
    setEnCours(true); setErreur(null)
    try {
      await enregistrerPrefs({ company: f })
      // La raison sociale vivait en double, sur le profil et sur l'entreprise.
      // Une seule saisie, désormais, et elle tient les deux à jour.
      if ((f.name.trim() || null) !== (user?.companyName ?? null)) {
        const r = await api.auth.updateProfile({ companyName: f.name.trim() || null })
        if (accessToken && refreshToken) {
          setAuth({ ...r.user, preferences: { ...r.user.preferences, company: { ...c, ...f } } }, accessToken, refreshToken)
        }
      }
      // L'équipe porte le nom de la société : elle le suit. Seul un administrateur
      // peut la renommer, et sans organisation il n'y a rien à suivre.
      if (f.name.trim()) {
        const { organization, role } = await api.org.get()
        if (organization && (role === 'OWNER' || role === 'ADMIN') && organization.name !== f.name.trim()) {
          await api.org.rename(f.name.trim())
          queryClient.invalidateQueries({ queryKey: ['org'] })
        }
      }
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Enregistrement impossible.')
    } finally { setEnCours(false) }
  }

  const manquants = champsManquantsDuBureau(f)

  return (
    <>
      <Bloc titre="Identité" aide="Ce qui paraît en tête de vos rapports et sur vos devis.">
        {manquants.length > 0 && (
          <Avertissement
            message={`À compléter pour que vos rapports disent qui les a écrits : ${manquants.join(', ')}.`}
          />
        )}
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
        </div>
      </Bloc>

      <Bloc titre="Comment vous joindre" aide="Imprimé sous votre raison sociale sur le rapport partagé.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Champ label="Téléphone">
            <Input value={f.phone} onChange={(e) => poser({ phone: e.target.value })} placeholder="+41 27 000 00 00" />
          </Champ>
          <Champ label="Courriel">
            <Input value={f.email} onChange={(e) => poser({ email: e.target.value })} placeholder="bureau@exemple.ch" />
          </Champ>
          <div className="sm:col-span-2">
            <Champ label="Site" aide="Sans https, il s'affiche tel quel.">
              <Input value={f.web} onChange={(e) => poser({ web: e.target.value })} placeholder="www.exemple.ch" />
            </Champ>
          </div>
        </div>
      </Bloc>

      <Bloc titre="Mentions légales" aide="Reprises sur les devis et les factures.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Champ label="Numéro de TVA">
            <Input value={f.vatNumber} onChange={(e) => poser({ vatNumber: e.target.value })} placeholder="CHE-000.000.000 TVA" />
          </Champ>
          <Champ label="IBAN">
            <Input value={f.iban} onChange={(e) => poser({ iban: e.target.value })} placeholder="CH00 0000 0000 0000 0000 0" />
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

/**
 * La personnalisation : l'apparence des documents.
 *
 * Deux réglages seulement, mais ce sont les deux que le client voit. L'aperçu
 * est là parce qu'un sélecteur de couleur ne dit rien de ce qu'il fait : on
 * choisit un bleu en pensant à son logo, et c'est un trait sous un titre de
 * rapport qui en sort.
 */
function SectionPersonnalisation() {
  const user = useAuth((s) => s.user)
  const enregistrerPrefs = usePreferences()
  const c = user?.preferences?.company ?? {}

  const depart = useMemo(() => ({
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
      await enregistrerPrefs({ company: { logo: f.logo || null, accentColor: f.accentColor } })
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Enregistrement impossible.')
    } finally { setEnCours(false) }
  }

  return (
    <>
      <Bloc titre="Aperçu" aide="L'en-tête de vos rapports, tel qu'il partira.">
        <ApercuEnTete
          bureau={{
            name: c.name || user?.companyName || '',
            address: c.address ?? '',
            postalCode: c.postalCode ?? '',
            city: c.city ?? '',
            logo: f.logo,
            accentColor: f.accentColor,
          }}
          auteur={nomAffiche(user ?? {})}
        />
      </Bloc>

      <Bloc titre="Logo" aide="Il paraît en tête du rapport partagé et en haut de chaque page imprimée.">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-20 w-32 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-white">
            {f.logo
              ? <img src={f.logo} alt="" className="max-h-full max-w-full object-contain p-2" />
              : <span className="text-xs text-muted-foreground">Aucun logo</span>}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground">
              PNG, JPG ou SVG. L'image est réduite à 320 pixels et conserve sa transparence.
              Un logo en largeur passe mieux qu'un logo en hauteur : la place est celle d'une ligne.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <label className="cursor-pointer text-sm font-medium text-blue-700 hover:underline">
                <input type="file" accept="image/*" onChange={choisirLogo} className="hidden" />
                {f.logo ? 'Changer le logo' : 'Importer un logo'}
              </label>
              {f.logo && (
                <button onClick={() => poser({ logo: '' })} className="text-sm text-red-600 hover:underline">
                  Retirer
                </button>
              )}
            </div>
            {!f.logo && (
              <p className="mt-2 text-xs text-muted-foreground">
                Sans logo, les rapports portent celui de Diagly.
              </p>
            )}
          </div>
        </div>
      </Bloc>

      <Bloc titre="Couleur" aide="Le trait sous le titre, et les repères du rapport partagé.">
        <div className="flex flex-wrap items-center gap-4">
          <input
            type="color" value={f.accentColor} onChange={(e) => poser({ accentColor: e.target.value })}
            aria-label="Couleur d'accent"
            className="h-11 w-20 cursor-pointer rounded-lg border bg-white"
          />
          <Input
            value={f.accentColor.toUpperCase()}
            onChange={(e) => {
              const v = e.target.value.trim()
              if (/^#[0-9a-fA-F]{0,6}$/.test(v)) poser({ accentColor: v.toLowerCase() })
            }}
            className="w-32 font-mono text-sm"
          />
          <div className="flex flex-wrap gap-1.5">
            {COULEURS.map((couleur) => (
              <button
                key={couleur}
                onClick={() => poser({ accentColor: couleur })}
                aria-label={`Couleur ${couleur}`}
                className={cn('h-7 w-7 rounded-full border-2 transition-transform hover:scale-110',
                  f.accentColor === couleur ? 'border-neutral-900' : 'border-white')}
                style={{ backgroundColor: couleur }}
              />
            ))}
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

/** Quelques couleurs sobres, pour ne pas partir d'un sélecteur vide. */
const COULEURS = ['#3b82f6', '#0f172a', '#0e7490', '#15803d', '#b45309', '#b91c1c', '#7c3aed']

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

// --------------------------------------------------------- facturation

/**
 * La facturation.
 *
 * Deux choses distinctes : ce que coûte l'abonnement, et à qui la facture doit
 * être adressée. La seconde n'est pas l'entreprise : une facture part souvent à
 * une comptabilité, à une autre adresse, avec une référence que le client exige
 * sur ses documents. Les saisir ici évite de les redemander à chaque échéance.
 *
 * Il n'y a pas d'historique de factures : elles ne sont pas encore émises
 * depuis l'application. Le dire est plus honnête qu'un tableau vide.
 */
function SectionFacturation() {
  const user = useAuth((s) => s.user)
  const enregistrerPrefs = usePreferences()
  const org = useQuery({ queryKey: ['org'], queryFn: () => api.org.get(), staleTime: 5 * 60_000 })
  const membres = useQuery({
    queryKey: ['org-membres'],
    queryFn: () => api.org.members(),
    staleTime: 5 * 60_000,
    retry: false,
  })
  const c = user?.preferences?.company ?? {}
  const b = user?.preferences?.billing ?? {}

  const depart = useMemo(() => ({
    memeAdresse: b.memeAdresse ?? true,
    destinataire: b.destinataire ?? '',
    email: b.email ?? '',
    reference: b.reference ?? '',
    address: b.address ?? '',
    postalCode: b.postalCode ?? '',
    city: b.city ?? '',
    canton: b.canton ?? '',
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [user])
  const [f, setF] = useState(depart)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const modifie = aChange(f, depart)
  const poser = (p: Partial<typeof f>) => setF((v) => ({ ...v, ...p }))

  const enregistrer = async () => {
    setEnCours(true); setErreur(null)
    try { await enregistrerPrefs({ billing: f }) }
    catch (e) { setErreur(e instanceof ApiError ? e.message : 'Enregistrement impossible.') }
    finally { setEnCours(false) }
  }

  const sieges = membres.data?.members.length ?? null
  const adresseDuBureau = [c.address, [c.postalCode, c.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')

  return (
    <>
      <Bloc
        titre="Votre abonnement"
        aide="Diagly Pro, sans limite de diagnostics ni de bâtiments."
        action={<Badge className="shrink-0 border border-blue-100 bg-blue-50 text-blue-700">Actif</Badge>}
      >
        <dl className="divide-y divide-black/[0.06] text-sm">
          <Ligne terme="Plan">Diagly Pro</Ligne>
          <Ligne terme="Organisation">{org.data?.organization?.name ?? 'Compte individuel'}</Ligne>
          <Ligne terme="Comptes">
            {sieges === null ? 'Vous seul' : `${sieges} personne${sieges > 1 ? 's' : ''}`}
          </Ligne>
          <Ligne terme="Ouvert le">
            {user?.createdAt
              ? new Date(user.createdAt).toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' })
              : 'Inconnu'}
          </Ligne>
        </dl>
        <p className="mt-3 text-sm text-muted-foreground">
          Les factures sont établies par Finalyn et envoyées par courriel. Il n'y a pas encore de
          paiement en ligne ni d'historique consultable ici : pour une copie, une modification de
          plan ou une question sur un montant, passez par le support.
        </p>
      </Bloc>

      <Bloc titre="Coordonnées de facturation" aide="Ce qui figurera sur vos factures.">
        <Bascule
          actif={f.memeAdresse}
          onChange={() => poser({ memeAdresse: !f.memeAdresse })}
          titre="Les mêmes que l'entreprise"
          aide={adresseDuBureau || "L'adresse de l'entreprise n'est pas encore remplie."}
        />

        {!f.memeAdresse && (
          <div className="mt-3 grid gap-3 border-t border-black/[0.06] pt-4">
            <Champ label="Destinataire" aide="Le service ou la personne qui reçoit la facture.">
              <Input
                value={f.destinataire} onChange={(e) => poser({ destinataire: e.target.value })}
                placeholder="Comptabilité"
              />
            </Champ>
            <Champ label="Adresse">
              <Input value={f.address} onChange={(e) => poser({ address: e.target.value })} />
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
          </div>
        )}

        <div className="mt-3 grid gap-3 border-t border-black/[0.06] pt-4 sm:grid-cols-2">
          <Champ label="Courriel de facturation" aide="À défaut, votre adresse de connexion.">
            <Input
              type="email" value={f.email} onChange={(e) => poser({ email: e.target.value })}
              placeholder={user?.email ?? 'compta@exemple.ch'}
            />
          </Champ>
          <Champ label="Référence" aide="Bon de commande ou référence interne, reprise sur la facture.">
            <Input value={f.reference} onChange={(e) => poser({ reference: e.target.value })} placeholder="BC-2026-014" />
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
    if (!confirmerDeconnexion()) return
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
            <Button variant="outline" size="sm" onClick={() => navigate('/app/settings?s=membres')}>
              <Users className="mr-2 h-4 w-4" />Gérer l'équipe
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Vous travaillez seul, sans organisation.</p>
            <Button variant="outline" size="sm" onClick={() => navigate('/app/settings?s=membres')}>Créer l'équipe</Button>
          </div>
        )}
      </Bloc>

      <Bloc titre="Session" aide="La déconnexion efface aussi les dossiers gardés sur cet appareil pour le hors-réseau.">
        <Button variant="outline" onClick={seDeconnecter}>
          <LogOut className="mr-2 h-4 w-4" />Se déconnecter
        </Button>
      </Bloc>

      <SuppressionDuCompte />
    </>
  )
}

/**
 * Supprimer son compte, depuis l'app comme depuis le site. Apple l'exige de
 * toute app où l'on peut créer un compte, et la nLPD le doit à chacun. Avant,
 * la fermeture passait par une demande au support : Apple ne l'accepte pas.
 *
 * On tape SUPPRIMER pour confirmer : un toucher de trop ne doit pas effacer des
 * années de diagnostics.
 */
function SuppressionDuCompte() {
  const navigate = useNavigate()
  const [ouvert, setOuvert] = useState(false)
  const [saisie, setSaisie] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const confirme = saisie.trim().toUpperCase() === 'SUPPRIMER'

  const supprimer = async () => {
    if (!confirme || enCours) return
    setEnCours(true); setErreur(null)
    try {
      await api.auth.supprimerCompte()
      await apresSuppressionDuCompte()
      navigate('/login', { replace: true })
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'La suppression a échoué. Réessayez.')
      setEnCours(false)
    }
  }

  return (
    <section className="max-w-2xl rounded-2xl border border-red-200 bg-red-50/40 p-4">
      <h3 className="text-sm font-semibold text-red-800">Supprimer le compte</h3>
      <p className="mt-0.5 text-sm text-red-700">
        Vos diagnostics, relevés, photos, plans et rapports sont effacés définitivement, sans retour possible.
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        Exportez d'abord ce que vous voulez garder. Si vous êtes propriétaire d'une équipe, retirez d'abord ses membres.
      </p>
      {!ouvert ? (
        <Button variant="outline" size="sm" className="mt-3 border-red-200 text-red-700 hover:bg-red-50" onClick={() => setOuvert(true)}>
          Supprimer mon compte
        </Button>
      ) : (
        <div className="mt-3 space-y-2">
          <label htmlFor="confirmer-suppression" className="block text-sm">
            Tapez <strong>SUPPRIMER</strong> pour confirmer
          </label>
          <Input
            id="confirmer-suppression"
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            autoCapitalize="characters"
            autoCorrect="off"
            autoComplete="off"
            className="max-w-xs"
          />
          {erreur && <p className="text-sm text-red-700">{erreur}</p>}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={supprimer}
              disabled={!confirme || enCours}
              className="border-red-600 bg-red-600 text-white hover:bg-red-700 hover:border-red-700"
            >
              {enCours && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Supprimer définitivement
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setOuvert(false); setSaisie(''); setErreur(null) }}>
              Annuler
            </Button>
          </div>
        </div>
      )}
    </section>
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
