import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Loader2, Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { Button, Input } from '@/components/ui'
import { AuthCard } from '@/components/auth/AuthCard'
import { GoogleButton, OrDivider } from '@/components/auth/Social'
import { estAppNative } from '@/lib/plateforme'
import { ConnexionNative } from '@/components/auth/ConnexionNative'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/stores/auth'
import type { AuthResponse } from '@/lib/api-types'

export function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const setAuth = useAuth((s) => s.setAuth)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState<string | null>(() => new URLSearchParams(location.search).get('error'))
  const [loading, setLoading] = useState(false)

  // Le retour Google d'un compte protege par 2FA nous renvoie ici avec le ticket :
  // on reprend directement a l'etape 2 (saisie du code).
  const [ticket, setTicket] = useState<string | null>(
    () => (location.state as { ticket?: string } | null)?.ticket ?? null,
  )
  // Code par email : l'adresse (masquée) où il est parti, et le renvoi.
  const [parEmail, setParEmail] = useState<string | null>(() => {
    const st = location.state as { method?: string; email?: string } | null
    return st?.method === 'email' ? st.email ?? 'votre adresse' : null
  })
  const [renvoye, setRenvoye] = useState(false)
  const [code, setCode] = useState('')

  const finishAuth = (res: AuthResponse) => {
    setAuth(res.user, res.accessToken, res.refreshToken)
    const redirectTo = (location.state as { from?: string } | null)?.from ?? '/app/dashboard'
    navigate(redirectTo, { replace: true })
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await api.auth.login({ email, password })
      if ('twoFactorRequired' in res) {
        setTicket(res.ticket)
        setParEmail(res.method === 'email' ? res.email ?? 'votre adresse' : null)
      } else finishAuth(res)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur de connexion au serveur')
    } finally {
      setLoading(false)
    }
  }

  const onVerify = async (e: FormEvent) => {
    e.preventDefault()
    if (!ticket) return
    setError(null)
    setLoading(true)
    try {
      const res = await api.auth.twoFactorVerify({ ticket, code: code.trim() })
      finishAuth(res)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Code invalide')
    } finally {
      setLoading(false)
    }
  }

  const renvoyer = async () => {
    if (!ticket) return
    setError(null); setRenvoye(false)
    try {
      const res = await api.auth.twoFactorResend(ticket)
      setTicket(res.ticket); setCode(''); setRenvoye(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Renvoi impossible')
    }
  }

  // ===== Étape 2 : code 2FA =====
  if (ticket) {
    return (
      <AuthCard
        title="Vérification en deux étapes"
        subtitle={parEmail
          ? `Entrez le code à 6 chiffres envoyé à ${parEmail}. Il est valable 10 minutes.`
          : 'Entrez le code à 6 chiffres de votre application d’authentification.'}
      >
        <form onSubmit={onVerify} className="space-y-4">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
            inputMode="numeric"
            autoFocus
            placeholder="000000"
            className="h-12 text-center text-xl tracking-[0.4em] font-semibold"
          />
          {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <Button type="submit" className="w-full h-11 rounded-xl bg-white border border-black/[0.12] text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)] hover:bg-muted/60" disabled={loading || code.length < 6}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Vérification…</> : 'Vérifier'}
          </Button>
          {parEmail && (
            <p className="text-center text-sm text-muted-foreground">
              {renvoye ? 'Un nouveau code vient de partir. ' : 'Rien reçu ? Regardez les courriers indésirables, ou '}
              <button type="button" onClick={renvoyer} className="font-medium text-foreground underline-offset-2 hover:underline">
                {renvoye ? 'renvoyer encore' : 'renvoyez le code'}
              </button>
            </p>
          )}
          <button
            type="button"
            onClick={() => { setTicket(null); setParEmail(null); setRenvoye(false); setCode(''); setError(null) }}
            className="w-full text-sm text-muted-foreground hover:text-foreground"
          >
            Utiliser un autre compte
          </button>
        </form>
      </AuthCard>
    )
  }

  // ===== Étape 1 : Google + email / mot de passe =====
  return (
    <AuthCard title="Bienvenue" subtitle="Connectez-vous à votre espace Diagly">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-1.5 block text-neutral-700">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input type="email" placeholder="vous@exemple.ch" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className="pl-9 h-11 rounded-xl bg-white/70 border-neutral-200" />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block text-neutral-700">Mot de passe</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input type={showPw ? 'text' : 'password'} placeholder="Votre mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" className="pl-9 pr-10 h-11 rounded-xl bg-white/70 border-neutral-200" />
            <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={showPw ? 'Masquer' : 'Afficher'}>
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-neutral-600"><input type="checkbox" defaultChecked className="rounded border-neutral-300 accent-neutral-900" />Se souvenir de moi</label>
          <Link to="/forgot-password" className="text-neutral-900 font-medium hover:underline">Mot de passe oublié ?</Link>
        </div>

        <Button type="submit" className="w-full h-11 rounded-xl bg-white border border-black/[0.12] text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)] hover:bg-muted/60" disabled={loading}>
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Connexion…</> : 'Se connecter'}
        </Button>
      </form>

      {/* Dans l'app, Apple et Google passent par les fenêtres d'iOS : le flux web
          de Google ne fonctionne pas dans la vue d'une app. */}
      <OrDivider label="ou continuer avec" />
      {estAppNative ? (
        <ConnexionNative
          onCompte={finishAuth}
          onDoubleAuth={(etape) => {
            setTicket(etape.ticket)
            setParEmail(etape.method === 'email' ? etape.email ?? 'votre adresse' : null)
          }}
          onErreur={setError}
        />
      ) : (
        <GoogleButton />
      )}

      <p className="text-center text-sm text-muted-foreground mt-6">
        Pas encore de compte ? <Link to="/register" className="text-neutral-900 font-medium hover:underline">Créer un compte</Link>
      </p>
    </AuthCard>
  )
}
