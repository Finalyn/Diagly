import { Link, useNavigate } from 'react-router-dom'
import { ClipboardCheck } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardContent, Input } from '@/components/ui'

export function Login() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50/50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
              <ClipboardCheck className="h-7 w-7 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl">Connexion</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Entrez vos identifiants pour acceder a Diagly</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Email</label>
            <Input type="email" placeholder="sophie.berger@diagly-demo.ch" defaultValue="sophie.berger@diagly-demo.ch" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Mot de passe</label>
            <Input type="password" placeholder="Votre mot de passe" defaultValue="Demo1234!" />
          </div>
          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" defaultChecked className="rounded" />Se souvenir de moi</label>
            <Link to="/forgot-password" className="text-primary hover:underline">Mot de passe oublie ?</Link>
          </div>
          <Button className="w-full" onClick={() => navigate('/app/dashboard')}>Se connecter</Button>
          <p className="text-center text-sm text-muted-foreground">
            Pas encore de compte ? <Link to="/register" className="text-primary hover:underline">Creer un compte</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
