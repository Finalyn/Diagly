/**
 * Sur téléphone, en tête d'un outil du dossier : le retour au sommaire et le
 * nom du bâtiment. Sans elle, on ouvrait la visite ou les coûts sans savoir
 * de quel dossier, ni comment revenir ailleurs que par la liste.
 */
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react'
import { api } from '@/lib/api'

export function DossierMobileBar({ projectId }: { projectId: string }) {
  const { data } = useQuery({ queryKey: ['project', projectId], queryFn: () => api.projects.get(projectId) })
  return (
    <Link
      to={`/app/projects/${projectId}/sommaire`}
      className="mt-2 flex items-center gap-2 rounded-2xl border border-black/[0.06] bg-white px-3 py-2.5"
    >
      <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] text-muted-foreground">Dossier</span>
        <span className="block truncate text-sm font-semibold">{data?.project.name ?? '…'}</span>
      </span>
    </Link>
  )
}
