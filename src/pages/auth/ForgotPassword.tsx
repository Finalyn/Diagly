import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Mail, MailCheck } from 'lucide-react'
import { Button, Input } from '@/components/ui'
import { AuthCard } from '@/components/auth/AuthCard'

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setSent(true)
  }

  return (
    <AuthCard
      title="Mot de passe oublié"
      subtitle={sent ? 'Vérifiez votre boîte mail.' : 'Entrez votre email pour recevoir un lien de réinitialisation.'}
    >
      {sent ? (
        <div className="text-center">
          <div className="h-16 w-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
            <MailCheck className="h-8 w-8 text-green-600" />
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            Si un compte existe avec cette adresse, vous recevrez un email avec les instructions pour réinitialiser votre mot de passe.
          </p>
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
          <Button type="submit" className="w-full">Envoyer le lien</Button>
          <Link to="/login" className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />Retour à la connexion
          </Link>
        </form>
      )}
    </AuthCard>
  )
}
