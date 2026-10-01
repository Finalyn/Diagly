import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ClipboardCheck, Plus, Loader2, AlertCircle } from 'lucide-react'
import { Button, Card, CardContent } from '@/components/ui'
import { api, ApiError } from '@/lib/api'
import { DiagnosticDetail } from './DiagnosticDetail'

/**
 * L'onglet Diagnostic : l'éditeur, et rien d'autre.
 *
 * Il portait jusqu'ici un résumé chiffré du dossier, des graphiques, la liste des
 * ouvrages, et un bouton « Ouvrir l'éditeur » qui menait ailleurs. L'onglet
 * répondait donc à deux questions a des moments differents : où en est ce
 * bâtiment, et comment le modifier. Les chiffres sont partis dans le résumé du
 * projet, où l'on vient justement pour la première ; ici reste la seconde.
 *
 * L'éditeur n'est plus une destination séparée depuis cet onglet : il s'ouvre sur
 * place, sous la barre d'onglets, et garde donc le contexte du projet.
 */
export function ProjectDiagnostic() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()

  const projectQuery = useQuery({
    queryKey: ['project', id],
    queryFn: () => api.projects.get(id!),
    enabled: !!id,
  })

  const creer = useMutation({
    mutationFn: () => api.projects.createDiagnostic(id!, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project', id] }),
  })

  if (projectQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="mr-2 h-6 w-6 animate-spin" />Chargement…
      </div>
    )
  }

  if (projectQuery.isError || !projectQuery.data) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <AlertCircle className="mx-auto mb-2 h-8 w-8 text-red-500" />
          <p className="text-sm text-red-700">
            {(projectQuery.error as ApiError | null)?.message ?? 'Projet introuvable'}
          </p>
        </CardContent>
      </Card>
    )
  }

  const diagnostic = projectQuery.data.diagnostics[0]

  if (!diagnostic) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <ClipboardCheck className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-1 text-lg font-semibold">Aucun diagnostic</h3>
          <p className="mb-4 text-sm text-muted-foreground">Commencez par créer un diagnostic du bâtiment.</p>
          <Button onClick={() => creer.mutate()} disabled={creer.isPending}>
            {creer.isPending
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Création…</>
              : <><Plus className="mr-2 h-4 w-4" />Démarrer un diagnostic</>}
          </Button>
        </CardContent>
      </Card>
    )
  }

  return <DiagnosticDetail diagnosticId={diagnostic.id} encastre />
}
