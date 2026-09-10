import { NavLink, Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { MapPin, ClipboardCheck, DollarSign, Layers, Ruler, FileText, Zap, ChevronLeft, Image } from 'lucide-react'

function tabs(projectId: string) {
  return [
    { to: `/app/projects/${projectId}`, icon: MapPin, label: 'Résumé', end: true },
    { to: `/app/projects/${projectId}/diagnostic`, icon: ClipboardCheck, label: 'Diagnostic' },
    { to: `/app/projects/${projectId}/photos`, icon: Image, label: 'Photos' },
    { to: `/app/projects/${projectId}/couts`, icon: DollarSign, label: 'Coûts' },
    { to: `/app/projects/${projectId}/variantes`, icon: Layers, label: 'Variantes' },
    { to: `/app/projects/${projectId}/rapports`, icon: FileText, label: 'Rapports' },
    { to: `/app/projects/${projectId}/plans`, icon: Ruler, label: 'Plans' },
    { to: `/app/projects/${projectId}/cecb`, icon: Zap, label: 'Étiquette énergétique' },
  ]
}

/** Sous-navigation d'un diagnostic (onglets « segmented control »), en haut du contenu. */
export function DiagnosticTabs({ projectId }: { projectId: string }) {
  return (
    <div className="mt-3 shrink-0">
      {/* Retour à la liste */}
      <Link to="/app/projects" className="mb-2.5 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground">
        <ChevronLeft className="h-4 w-4" />Diagnostics
      </Link>

      {/* Onglets (largeur ajustée au contenu, défile si trop étroit) */}
      <div className="max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <nav className="inline-flex gap-1 rounded-[20px] border border-black/[0.05] bg-neutral-100/70 p-1.5">
          {tabs(projectId).map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end}>
              {({ isActive }) => (
                <span
                  className={cn(
                    'flex shrink-0 items-center gap-2.5 rounded-2xl px-4 py-2.5 text-[14.5px] font-semibold transition-all',
                    isActive
                      ? 'bg-white text-neutral-900 shadow-[0_1px_3px_rgba(0,0,0,0.12),0_1px_1px_rgba(0,0,0,0.04)]'
                      : 'text-neutral-500 hover:text-neutral-900',
                  )}
                >
                  <t.icon className={cn('h-[19px] w-[19px] shrink-0 transition-colors', isActive ? 'text-blue-600' : 'text-neutral-400')} strokeWidth={1.9} />
                  <span className="whitespace-nowrap">{t.label}</span>
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
