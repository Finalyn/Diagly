import { Link, useNavigate } from 'react-router-dom'
import { ClipboardCheck, Check } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardContent, Input } from '@/components/ui'
import { useState } from 'react'

export function ResetPassword() {
  const navigate = useNavigate()
  const [done, setDone] = useState(false)

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50/50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
              <ClipboardCheck className="h-7 w-7 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl">{done ? 'Mot de passe modifie' : 'Nouveau mot de passe'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {done ? (
            <div className="text-center py-4">
              <div className="h-16 w-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <p className="text-sm text-muted-foreground mb-4">Votre mot de passe a ete reinitialise avec succes.</p>
              <Link to="/login"><Button className="w-full">Se connecter</Button></Link>
            </div>
          ) : (
            <>
              <div>
                <label className="text-sm font-medium mb-1 block">Nouveau mot de passe</label>
                <Input type="password" placeholder="Minimum 8 caracteres" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Confirmer le mot de passe</label>
                <Input type="password" placeholder="Repetez le mot de passe" />
              </div>
              <Button className="w-full" onClick={() => setDone(true)}>Reinitialiser le mot de passe</Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
