import { Link, useNavigate } from 'react-router-dom'
import { ClipboardCheck } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardContent, Input, Select } from '@/components/ui'

export function Register() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50/50 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
              <ClipboardCheck className="h-7 w-7 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl">Creer un compte</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Commencez votre essai gratuit de 14 jours</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-sm font-medium mb-1 block">Prenom</label><Input placeholder="Sophie" /></div>
            <div><label className="text-sm font-medium mb-1 block">Nom</label><Input placeholder="Berger" /></div>
          </div>
          <div><label className="text-sm font-medium mb-1 block">Email professionnel</label><Input type="email" placeholder="sophie@entreprise.ch" /></div>
          <div><label className="text-sm font-medium mb-1 block">Entreprise</label><Input placeholder="Berger & Fils SA" /></div>
          <div><label className="text-sm font-medium mb-1 block">Role</label>
            <Select>
              <option value="DT">Directeur de travaux</option>
              <option value="REGIE">Regie immobiliere</option>
              <option value="ARCHITECT">Architecte</option>
            </Select>
          </div>
          <div><label className="text-sm font-medium mb-1 block">Mot de passe</label><Input type="password" placeholder="Minimum 8 caracteres" /></div>
          <Button className="w-full" onClick={() => navigate('/app/dashboard')}>Creer mon compte</Button>
          <p className="text-center text-sm text-muted-foreground">
            Deja un compte ? <Link to="/login" className="text-primary hover:underline">Se connecter</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
