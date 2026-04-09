import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, FolderKanban, Settings, Zap, Calendar, ChevronLeft,
  ChevronRight, Database, ArrowLeft, FileText, ClipboardCheck, Ruler,
  Send, BarChart3, MapPin, Building2, Search
} from 'lucide-react'
import { useState } from 'react'
import { mockProjects, statusColors } from '@/data/mock'

const bottomNav = [
  { to: '/app/planning', icon: Calendar, label: 'Planning global' },
  { to: '/app/cfc', icon: Database, label: 'CFC / Prix' },
  { to: '/app/cecb', icon: Zap, label: 'CECB' },
  { to: '/app/buildings', icon: Building2, label: 'Parc immobilier' },
  { to: '/app/settings', icon: Settings, label: 'Parametres' },
]

function getProjectNav(projectId: string) {
  return [
    { to: `/app/projects/${projectId}`, icon: MapPin, label: 'Resume', end: true },
    { to: `/app/projects/${projectId}/diagnostic`, icon: ClipboardCheck, label: 'Diagnostic' },
    { to: `/app/projects/${projectId}/metres`, icon: BarChart3, label: 'Metres' },
    { to: `/app/projects/${projectId}/plans`, icon: Ruler, label: 'Plans' },
    { to: `/app/projects/${projectId}/rapports`, icon: FileText, label: 'Rapports' },
    { to: `/app/projects/${projectId}/ao`, icon: Send, label: "Appels d'offres" },
    { to: `/app/projects/${projectId}/cecb`, icon: Zap, label: 'CECB' },
    { to: `/app/projects/${projectId}/planning`, icon: Calendar, label: 'Planning' },
  ]
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [projectSearch, setProjectSearch] = useState('')
  const location = useLocation()

  const projectMatch = location.pathname.match(/\/app\/projects\/([^/]+)/)
  const projectId = projectMatch ? projectMatch[1] : null
  const isInProject = projectId && projectId !== 'new'
  const project = isInProject ? mockProjects.find(p => p.id === projectId) : null

  const filteredProjects = mockProjects.filter(p =>
    !projectSearch || p.name.toLowerCase().includes(projectSearch.toLowerCase()) || p.city.toLowerCase().includes(projectSearch.toLowerCase())
  )

  const renderLink = (item: { to: string; icon: React.ComponentType<{ className?: string }>; label: string; end?: boolean }) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.end}
      className={({ isActive }) => cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        isActive
          ? 'bg-primary/10 text-primary'
          : 'text-sidebar-foreground hover:bg-accent hover:text-accent-foreground',
        collapsed && 'justify-center px-2'
      )}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span>{item.label}</span>}
    </NavLink>
  )

  const collapsedLink = (to: string, icon: React.ComponentType<{ className?: string }>, end?: boolean) => {
    const Icon = icon
    return (
      <NavLink key={to} to={to} end={end} className={({ isActive }) => cn('flex items-center justify-center rounded-md w-10 h-10 mx-auto transition-colors', isActive ? 'bg-primary/10 text-primary' : 'text-sidebar-foreground hover:bg-accent')}>
        <Icon className="h-4 w-4" />
      </NavLink>
    )
  }

  if (collapsed) {
    return (
      <aside className="flex flex-col w-14 border-r bg-sidebar text-sidebar-foreground">
        <div className="flex h-14 items-center justify-center border-b border-sidebar-border">
          <span className="text-sm font-bold text-foreground">D</span>
        </div>

        <nav className="p-1 space-y-0.5 shrink-0">
          {collapsedLink('/app/dashboard', LayoutDashboard)}
          {collapsedLink('/app/projects', FolderKanban)}
        </nav>

        {isInProject && (
          <nav className="p-1 space-y-0.5 border-t border-sidebar-border shrink-0">
            {getProjectNav(projectId!).map(item => collapsedLink(item.to, item.icon, item.end))}
          </nav>
        )}

        <div className="flex-1" />

        <nav className="p-1 space-y-0.5 border-t border-sidebar-border shrink-0">
          {bottomNav.map(item => collapsedLink(item.to, item.icon))}
        </nav>

        <div className="p-1 border-t border-sidebar-border">
          <button onClick={() => setCollapsed(false)} className="flex items-center justify-center rounded-md w-10 h-10 mx-auto text-muted-foreground hover:bg-accent">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </aside>
    )
  }

  return (
    <aside className="flex flex-col w-72 border-r bg-sidebar text-sidebar-foreground">
      {/* Header */}
      <div className="flex h-14 items-center px-4 border-b border-sidebar-border shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-foreground">Diagly</span>
          <span className="text-[10px] font-bold uppercase bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full leading-none">Pro</span>
        </div>
      </div>

      {/* Top nav */}
      <nav className="p-2 space-y-0.5 shrink-0">
        {renderLink({ to: '/app/dashboard', icon: LayoutDashboard, label: 'Tableau de bord' })}
      </nav>

      {/* Project tools if inside a project */}
      {isInProject && project && (
        <div className="px-2 pb-2 flex-1 overflow-y-auto border-b border-sidebar-border">
          <NavLink to="/app/projects" className="flex items-center gap-2 rounded-md px-3 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors mb-1">
            <ArrowLeft className="h-3 w-3" />Tous les projets
          </NavLink>
          <div className="px-3 py-2 mb-1 rounded-lg bg-primary/5 border border-primary/15">
            <p className="font-semibold text-xs truncate">{project.name}</p>
            <p className="text-[10px] text-muted-foreground truncate">{project.city} ({project.canton})</p>
          </div>
          <div className="space-y-0.5">
            {getProjectNav(projectId!).map(renderLink)}
          </div>
        </div>
      )}

      {/* Projects list - hidden when inside a project */}
      {!isInProject && <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-2 pt-2 pb-1 shrink-0">
          <p className="px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Projets</p>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={projectSearch}
              onChange={e => setProjectSearch(e.target.value)}
              placeholder="Rechercher..."
              className="w-full h-7 pl-8 pr-3 rounded-md border border-input bg-background text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
          {filteredProjects.map(p => (
            <NavLink
              key={p.id}
              to={`/app/projects/${p.id}`}
              className={() => cn(
                'flex items-start gap-2 rounded-md px-3 py-2 transition-colors',
                p.id === projectId ? 'bg-primary/10 text-primary' : 'hover:bg-accent'
              )}
            >
              <div className={cn('h-2 w-2 rounded-full mt-1.5 shrink-0', statusColors[p.status])} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate leading-tight">{p.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{p.city} ({p.canton})</p>
              </div>
            </NavLink>
          ))}
        </div>
      </div>
      }

      {/* Bottom nav */}
      <nav className="p-2 border-t border-sidebar-border space-y-0.5 shrink-0">
        {bottomNav.map(renderLink)}
      </nav>

      {/* Collapse */}
      <div className="p-2 border-t border-sidebar-border shrink-0">
        <button
          onClick={() => setCollapsed(true)}
          className="flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <ChevronLeft className="h-4 w-4" /><span>Reduire</span>
        </button>
      </div>
    </aside>
  )
}
