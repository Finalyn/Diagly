import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Button, Input, Select } from '@/components/ui'
import { AuthCard } from '@/components/auth/AuthCard'
import { GoogleButton, OrDivider } from '@/components/auth/Social'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/stores/auth'

export function Register() {
  const navigate = useNavigate()
  const setAuth = useAuth((s) => s.setAuth)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [role, setRole] = useState('DT')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await api.auth.register({
        email,
        password,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        companyName: companyName || undefined,
      })
      setAuth(res.user, res.accessToken, res.refreshToken)
      navigate('/app/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur lors de la création du compte')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCard title="Créer un compte" subtitle="Commencez à utiliser Diagly">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block text-slate-700">Prénom</label>
            <Input placeholder="Sophie" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block text-slate-700">Nom</label>
            <Input placeholder="Berger" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block text-slate-700">Email professionnel</label>
          <Input type="email" placeholder="sophie@entreprise.ch" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block text-slate-700">Entreprise</label>
          <Input placeholder="Berger & Fils SA" value={companyName} onChange={(e) => setCompanyName(e.target.value)} autoComplete="organization" />
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block text-slate-700">Rôle</label>
          <Select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="DT">Directeur de travaux</option>
            <option value="REGIE">Régie immobilière</option>
            <option value="ARCHITECT">Architecte</option>
            <option value="PARTICULIER">Particulier</option>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block text-slate-700">Mot de passe</label>
          <Input type="password" placeholder="Minimum 8 caractères" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
        </div>

        {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Création…</> : 'Créer mon compte'}
        </Button>
      </form>

      <OrDivider label="ou continuer avec" />
      <GoogleButton label="S’inscrire avec Google" />

      <p className="text-center text-sm text-muted-foreground mt-6">
        Déjà un compte ? <Link to="/login" className="text-primary font-medium hover:underline">Se connecter</Link>
      </p>
    </AuthCard>
  )
}
