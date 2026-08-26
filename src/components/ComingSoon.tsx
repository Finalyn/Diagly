import { Link } from 'react-router-dom'
import { Construction, ArrowLeft } from 'lucide-react'
import { Button, Card, CardContent } from '@/components/ui'

interface Props {
  title: string
  description?: string
  /** Lien de retour (par défaut /app/dashboard). */
  backTo?: string
  backLabel?: string
}

export function ComingSoon({
  title,
  description = 'Cette fonctionnalité est en cours de développement. Le cœur diagnostique est déjà fonctionnel, accède-y depuis la liste des diagnostics.',
  backTo = '/app/dashboard',
  backLabel = 'Retour au tableau de bord',
}: Props) {
  return (
    <div className="flex items-center justify-center py-16">
      <Card className="w-full max-w-lg">
        <CardContent className="py-12 text-center space-y-4">
          <div className="h-14 w-14 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
            <Construction className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold">{title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">{description}</p>
          </div>
          <p className="text-xs text-muted-foreground">Bientôt disponible</p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
            <Link to={backTo}>
              <Button variant="outline" className="w-full sm:w-auto">
                <ArrowLeft className="mr-2 h-4 w-4" />{backLabel}
              </Button>
            </Link>
            <Link to="/app/projects">
              <Button className="w-full sm:w-auto">Voir mes diagnostics</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
