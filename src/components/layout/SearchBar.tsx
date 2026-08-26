import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, ClipboardCheck, Tag } from 'lucide-react'
import { api } from '@/lib/api'

/** Recherche globale : diagnostics (projets) + catalogue CFC, avec menu de résultats. */
export function SearchBar() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: () => api.projects.list(), staleTime: 30_000 })
  const cfcQuery = useQuery({ queryKey: ['cfc-items'], queryFn: () => api.cfc.items(), staleTime: 60 * 60 * 1000 })

  const query = q.trim().toLowerCase()
  const results = useMemo(() => {
    if (!query) return { projects: [], cfc: [] }
    const projects = (projectsQuery.data?.projects ?? [])
      .filter((p) =>
        p.name.toLowerCase().includes(query) ||
        (p.city?.toLowerCase().includes(query) ?? false) ||
        (p.address?.toLowerCase().includes(query) ?? false),
      )
      .slice(0, 6)
    const cfc = (cfcQuery.data?.items ?? [])
      .filter((c) =>
        (c.description?.toLowerCase().includes(query) ?? false) ||
        (c.cfcCode?.toLowerCase().includes(query) ?? false) ||
        (c.category?.toLowerCase().includes(query) ?? false),
      )
      .slice(0, 5)
    return { projects, cfc }
  }, [query, projectsQuery.data, cfcQuery.data])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const go = (to: string) => { setOpen(false); setQ(''); navigate(to) }
  const hasResults = results.projects.length > 0 || results.cfc.length > 0

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false)
    if (e.key === 'Enter') {
      if (results.projects[0]) go(`/app/projects/${results.projects[0].id}`)
      else if (results.cfc[0]) go('/app/cfc')
    }
  }

  return (
    <div ref={ref} className="relative min-w-0 flex-1 sm:w-[380px] sm:flex-none">
      <div className="liquid-glass lg-55 flex h-[52px] w-full items-center gap-3 rounded-2xl px-5">
        <Search className="h-[19px] w-[19px] shrink-0 text-neutral-400" strokeWidth={1.6} />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Rechercher un diagnostic, bâtiment, CFC..."
          className="h-full min-w-0 flex-1 bg-transparent text-[14px] text-neutral-800 placeholder:text-neutral-400 focus:outline-none"
        />
      </div>

      {open && query.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 max-h-96 overflow-y-auto rounded-2xl border border-black/[0.06] bg-white py-2 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.35)] z-50">
          {!hasResults && <p className="px-3 py-4 text-sm text-muted-foreground text-center">Aucun résultat pour « {q} »</p>}

          {results.projects.length > 0 && (
            <div>
              <p className="px-3 py-1 text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Diagnostics</p>
              {results.projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => go(`/app/projects/${p.id}`)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-muted/60 text-left"
                >
                  <ClipboardCheck className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{[p.address, p.city].filter(Boolean).join(', ')}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {results.cfc.length > 0 && (
            <div>
              <p className="px-3 py-1 mt-1 text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Catalogue CFC</p>
              {results.cfc.map((c) => (
                <button
                  key={c.id}
                  onClick={() => go('/app/cfc')}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-muted/60 text-left"
                >
                  <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex items-center gap-2">
                    {c.cfcCode && <span className="text-xs font-mono text-muted-foreground shrink-0">{c.cfcCode}</span>}
                    <span className="text-sm truncate">{c.description}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
