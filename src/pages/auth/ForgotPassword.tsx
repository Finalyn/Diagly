import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Mail, MailCheck, Loader2 } from 'lucide-react'
import { Button, Input } from '@/components/ui'
import { AuthCard } from '@/components/auth/AuthCard'
import { api, ApiError } from '@/lib/api'

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  /** false = le serveur n'a aucun SMTP : inutile de promettre un email. */
  const [mailPossible, setMailPossible] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      // Le serveur répond pareil que l'adresse existe ou non : on affiche le même
      // message dans tous les cas, pour ne pas révéler qui a un compte.
      const r = await api.auth.forgotPassword(email.trim().toLowerCase())
      setMailPossible(r.mailConfigured)
      setSent(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur de connexion au serveur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCard
      title="Mot de passe oublié"
      subtitle={sent
        ? (mailPossible ? 'Vérifiez votre boîte mail.' : undefined)
        : 'Entrez votre email pour recevoir un lien de réinitialisation.'}
    >
      {sent ? (
        <div className="text-center">
          <div className={`h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4 ${mailPossible ? 'bg-green-50' : 'bg-amber-50'}`}>
            {mailPossible
              ? <MailCheck className="h-8 w-8 text-green-600" />
              : <AlertTriangle className="h-8 w-8 text-amber-600" />}
          </div>
          {mailPossible ? (
            <p className="text-sm text-muted-foreground mb-6">
              Si un compte existe avec cette adresse, vous recevrez un email avec les instructions pour réinitialiser votre mot de passe. Le lien est valable 30 minutes.
            </p>
          ) : (
            /* Sans SMTP, annoncer un email qui n'arrivera jamais laisse l'utilisateur
               attendre indéfiniment : on le dit et on donne la marche à suivre. */
            <p className="text-sm text-muted-foreground mb-6">
              L'envoi d'emails n'est pas activé sur ce serveur, aucun message ne partira.
              Contactez <a href="mailto:contact@finalyn.com" className="font-medium text-foreground underline">contact@finalyn.com</a> pour
              faire réinitialiser votre mot de passe.
            </p>
          )}
          <Link to="/login"><Button variant="outline" className="w-full">Retour à la connexion</Button></Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block text-slate-700">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input type="email" placeholder="vous@exemple.ch" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className="pl-9" />
            </div>
          </div>
          {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <Button type="submit" className="w-full" disabled={loading || !email}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Envoi…</> : 'Envoyer le lien'}
          </Button>
          <Link to="/login" className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />Retour à la connexion
          </Link>
        </form>
      )}
    </AuthCard>
  )
}
