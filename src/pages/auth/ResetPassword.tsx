import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Check, Lock, Loader2 } from 'lucide-react'
import { Button, Input } from '@/components/ui'
import { AuthCard } from '@/components/auth/AuthCard'
import { api, ApiError } from '@/lib/api'

export function ResetPassword() {
  // Le jeton vient du lien reçu par email (valable 30 minutes, à usage unique).
  const { token } = useParams<{ token: string }>()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tooShort = password.length > 0 && password.length < 8
  const mismatch = confirm.length > 0 && password !== confirm

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!token) return setError('Lien invalide. Demandez un nouveau lien de réinitialisation.')
    if (password !== confirm) return setError('Les deux mots de passe ne correspondent pas.')
    setError(null)
    setLoading(true)
    try {
      await api.auth.resetPassword({ token, password })
      setDone(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur de connexion au serveur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCard
      title={done ? 'Mot de passe modifié' : 'Nouveau mot de passe'}
      subtitle={done ? undefined : 'Choisissez un mot de passe de 8 caractères au minimum.'}
    >
      {done ? (
        <div className="text-center">
          <div className="h-16 w-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            Votre mot de passe a été réinitialisé. Les autres sessions ouvertes ont été déconnectées.
          </p>
          <Link to="/login"><Button className="w-full">Se connecter</Button></Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block text-slate-700">Nouveau mot de passe</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input type="password" placeholder="Minimum 8 caractères" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" className="pl-9" />
            </div>
            {tooShort && <p className="mt-1 text-xs text-red-600">8 caractères au minimum.</p>}
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block text-slate-700">Confirmer le mot de passe</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input type="password" placeholder="Répétez le mot de passe" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" className="pl-9" />
            </div>
            {mismatch && <p className="mt-1 text-xs text-red-600">Les deux mots de passe ne correspondent pas.</p>}
          </div>
          {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <Button type="submit" className="w-full" disabled={loading || password.length < 8 || password !== confirm}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enregistrement…</> : 'Réinitialiser le mot de passe'}
          </Button>
          <Link to="/login" className="block text-center text-sm text-muted-foreground hover:text-foreground">Retour à la connexion</Link>
        </form>
      )}
    </AuthCard>
  )
}
