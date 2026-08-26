import { useEffect, useRef, useState, type ReactNode } from 'react'
import { MapPin, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui'
import { cn } from '@/lib/utils'

export interface AddressSelection {
  address: string
  postalCode: string
  city: string
  canton: string
  /** Coordonnées LV95 (EPSG:2056) — east/north — pour enrichir via les registres. */
  east?: number
  north?: number
}

interface GeoResult {
  attrs: { label: string; detail: string; x?: number; y?: number }
}

interface Props {
  value: string
  /** Saisie libre de la ligne d'adresse. */
  onChange: (value: string) => void
  /** Sélection d'une adresse dans la liste : remplit adresse + NPA + ville + canton. */
  onSelect: (selection: AddressSelection) => void
  invalid?: boolean
  placeholder?: string
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

/**
 * Rendu SÛR du label geo.admin.ch (qui contient des balises <b>) : on met en gras les
 * portions <b>, tout le reste passe en texte (React échappe) -> aucune injection HTML/JS
 * possible même si l'API renvoyait du contenu piégé. Remplace dangerouslySetInnerHTML.
 */
function renderLabel(label: string): ReactNode[] {
  const parts = label.split(/(<b>|<\/b>)/i)
  let bold = false
  const nodes: ReactNode[] = []
  parts.forEach((p, i) => {
    if (/^<b>$/i.test(p)) { bold = true; return }
    if (/^<\/b>$/i.test(p)) { bold = false; return }
    if (!p) return
    const text = p.replace(/<[^>]*>/g, '') // retire toute balise résiduelle
    nodes.push(bold ? <strong key={i}>{text}</strong> : <span key={i}>{text}</span>)
  })
  return nodes
}

/** Extrait adresse / NPA / ville / canton d'un résultat geo.admin.ch. */
function parseResult(attrs: { label: string; detail: string }): AddressSelection {
  const full = stripHtml(attrs.label)
  let postalCode = ''
  let city = ''
  let address = full

  // La partie en gras du label contient « NPA Ville » (ex. "1003 Lausanne").
  const bold = attrs.label.match(/<b>(.*?)<\/b>/i)
  if (bold) {
    const boldText = stripHtml(bold[1])
    const m = boldText.match(/(\d{4})\s+(.+)/)
    if (m) {
      postalCode = m[1]
      city = m[2]
    }
    address = stripHtml(attrs.label.replace(bold[0], '')).trim()
  }

  // Le canton (2 lettres) est présent dans `detail` : "... ch vd ...".
  const cantonMatch = (attrs.detail || '').match(/\bch\s+([a-z]{2})\b/i)
  const canton = cantonMatch ? cantonMatch[1].toUpperCase() : ''

  return { address, postalCode, city, canton }
}

const SEARCH_URL = 'https://api3.geo.admin.ch/rest/services/api/SearchServer'

export function AddressAutocomplete({ value, onChange, onSelect, invalid, placeholder }: Props) {
  const [results, setResults] = useState<GeoResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const skipFetch = useRef(false) // évite une requête juste après une sélection

  useEffect(() => {
    if (skipFetch.current) { skipFetch.current = false; return }
    const q = value.trim()
    if (q.length < 3) { setResults([]); setOpen(false); return }

    setLoading(true)
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const url = `${SEARCH_URL}?searchText=${encodeURIComponent(q)}&type=locations&origins=address&limit=8&sr=2056`
        const res = await fetch(url, { signal: ctrl.signal })
        const data = await res.json()
        setResults(data.results ?? [])
        setOpen(true)
      } catch {
        /* abort ou réseau : on ignore */
      } finally {
        setLoading(false)
      }
    }, 250)

    return () => { clearTimeout(timer); ctrl.abort() }
  }, [value])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const choose = (r: GeoResult) => {
    skipFetch.current = true
    // En sr=2056, attrs.y = est (E) et attrs.x = nord (N).
    onSelect({ ...parseResult(r.attrs), east: r.attrs.y, north: r.attrs.x })
    setOpen(false)
    setResults([])
  }

  return (
    <div className="relative" ref={boxRef}>
      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => { if (results.length) setOpen(true) }}
        placeholder={placeholder ?? 'Rechercher une adresse…'}
        className={cn('pl-10', invalid && 'border-red-400 focus-visible:ring-red-300')}
        autoComplete="off"
      />
      {loading && (
        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
      )}
      {open && results.length > 0 && (
        <ul className="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto rounded-md border bg-white shadow-lg">
          {results.map((r, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => choose(r)}
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
              >
                <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                <span>{renderLabel(r.attrs.label)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
