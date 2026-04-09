import { Link } from 'react-router-dom'
import { ClipboardCheck, ArrowLeft, Mail } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardContent, Input } from '@/components/ui'
import { useState } from 'react'

export function ForgotPassword() {
  const [sent, setSent] = useState(false)

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50/50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
              <ClipboardCheck className="h-7 w-7 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl">Mot de passe oublie</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {sent ? 'Un email de reinitialisation a ete envoye.' : 'Entrez votre email pour recevoir un lien de reinitialisation.'}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {sent ? (
            <div className="text-center py-6">
              <div className="h-16 w-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
                <Mail className="h-8 w-8 text-green-600" />
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Si un compte existe avec cette adresse, vous recevrez un email avec les instructions pour reinitialiser votre mot de passe.
              </p>
              <Link to="/login"><Button variant="outline" className="w-full">Retour a la connexion</Button></Link>
            </div>
          ) : (
            <>
              <div>
                <label className="text-sm font-medium mb-1 block">Email</label>
                <Input type="email" placeholder="votre@email.ch" />
              </div>
              <Button className="w-full" onClick={() => setSent(true)}>Envoyer le lien</Button>
              <Link to="/login" className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" />Retour a la connexion
              </Link>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
