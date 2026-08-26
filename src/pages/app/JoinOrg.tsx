import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Users, Check, AlertCircle } from 'lucide-react'
import { Card, CardContent, Button, Badge } from '@/components/ui'
import { api, ApiError } from '@/lib/api'

const ROLE_LABEL: Record<string, string> = { OWNER: 'Propriétaire', ADMIN: 'Administrateur', MEMBER: 'Membre', VIEWER: 'Lecture seule' }

export function JoinOrg() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const info = useQuery({ queryKey: ['invite', token], queryFn: () => api.org.inviteInfo(token!), enabled: !!token, retry: false })

  const join = async () => {
    setJoining(true); setError(null)
    try {
      await api.org.accept(token!)
      await qc.invalidateQueries({ queryKey: ['org'] })
      await qc.invalidateQueries({ queryKey: ['projects'] })
      navigate('/app/team')
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Erreur'); setJoining(false) }
  }

  return (
    <div className="max-w-md mx-auto py-16">
      <Card>
        <CardContent className="p-8 text-center space-y-4">
          {info.isLoading ? <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
            : info.isError || !info.data ? (
              <>
                <AlertCircle className="h-10 w-10 text-red-500 mx-auto" />
                <p className="font-medium">Invitation invalide ou expirée</p>
                <Button variant="outline" onClick={() => navigate('/app/dashboard')}>Retour</Button>
              </>
            ) : (
              <>
                <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mx-auto"><Users className="h-6 w-6" /></div>
                <div>
                  <h1 className="text-lg font-bold">Rejoindre {info.data.organizationName}</h1>
                  <p className="text-sm text-muted-foreground mt-1">Vous êtes invité·e à rejoindre cette organisation sur Diagly.</p>
                </div>
                <Badge variant="outline">Rôle : {ROLE_LABEL[info.data.role] ?? info.data.role}</Badge>
                <p className="text-xs text-muted-foreground">Invitation pour <b>{info.data.email}</b> — vous devez être connecté avec cette adresse.</p>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <Button className="w-full" onClick={join} disabled={joining}>
                  {joining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}Rejoindre l'organisation
                </Button>
              </>
            )}
        </CardContent>
      </Card>
    </div>
  )
}
