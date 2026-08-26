import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { LayoutGrid, Building2, DollarSign, Layers, Ruler, FileText, Zap, Trash2 } from 'lucide-react'

/** Menu « Sections » d'un projet : accès rapide (surtout mobile) à Coûts / Plans / Rapports… depuis l'éditeur. */
export function ProjectSectionsMenu({ projectId, onDeleteDiagnostic }: { projectId: string; onDeleteDiagnostic?: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const items = [
    { label: 'Fiche du projet', to: `/app/projects/${projectId}`, icon: Building2 },
    { label: 'Coûts', to: `/app/projects/${projectId}/couts`, icon: DollarSign },
    { label: 'Plans', to: `/app/projects/${projectId}/plans`, icon: Ruler },
    { label: 'Variantes', to: `/app/projects/${projectId}/variantes`, icon: Layers },
    { label: 'Rapports', to: `/app/projects/${projectId}/rapports`, icon: FileText },
    { label: 'Étiquette énergétique', to: `/app/projects/${projectId}/cecb`, icon: Zap },
  ]

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 h-9 px-3 rounded-lg border text-sm font-medium hover:bg-muted/50 transition-colors"
      >
        <LayoutGrid className="h-4 w-4" /><span className="hidden sm:inline">Sections</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-52 bg-popover border rounded-lg shadow-lg z-50 py-1">
          {items.map((i) => {
            const Icon = i.icon
            return (
              <Link
                key={i.to}
                to={i.to}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/60"
              >
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />{i.label}
              </Link>
            )
          })}
          {onDeleteDiagnostic && (
            <>
              <div className="my-1 border-t" />
              <button
                onClick={() => { setOpen(false); onDeleteDiagnostic() }}
                className="flex items-center gap-2.5 px-3 py-2 text-sm w-full text-left text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4 shrink-0" />Supprimer le diagnostic
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
