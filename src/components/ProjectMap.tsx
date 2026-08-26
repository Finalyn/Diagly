import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Loader2, MapPin, ExternalLink } from 'lucide-react'

type Props = { address?: string | null; postalCode?: string | null; city?: string | null; canton?: string | null }
type Geo = { lat: number; lon: number; fuzzy: boolean }

const SEARCH = 'https://api3.geo.admin.ch/rest/services/api/SearchServer?type=locations&limit=1&sr=4326&searchText='

async function geocode(q: string): Promise<Geo | null> {
  try {
    const j = await (await fetch(SEARCH + encodeURIComponent(q))).json()
    const a = j?.results?.[0]?.attrs
    if (a && typeof a.lat === 'number' && typeof a.lon === 'number') {
      return { lat: a.lat, lon: a.lon, fuzzy: j?.fuzzy === 'true' }
    }
  } catch { /* réseau indisponible */ }
  return null
}

// Marqueur maison (pastille bleue + halo), aux couleurs de l'app.
const pin = L.divIcon({
  className: '',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  html: `<div style="position:relative;width:28px;height:28px">
    <span style="position:absolute;inset:0;border-radius:9999px;background:rgba(37,99,235,.22)"></span>
    <span style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:14px;height:14px;border-radius:9999px;background:#2563eb;border:3px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.4)"></span>
  </div>`,
})

/** Carte de localisation plein cadre (Leaflet + fond CARTO Positron, style épuré). */
export function ProjectMap({ address, postalCode, city, canton }: Props) {
  const full = [address, postalCode, city].filter(Boolean).join(' ').trim()
  const cityQ = [postalCode, city].filter(Boolean).join(' ').trim()
  const regionQ = [city, canton].filter(Boolean).join(' ').trim()

  const boxRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)

  // Géocodage : adresse exacte (si non floue) → NPA + ville → ville + canton.
  // Passé en requête : le résultat est mis en cache (une adresse ne bouge pas), donc
  // rouvrir la fiche n'appelle plus le service, et il n'y a plus d'état à resynchroniser.
  const geoQuery = useQuery({
    queryKey: ['geocode', full, cityQ, regionQ],
    queryFn: async (): Promise<Geo | null> => {
      let hit: Geo | null = null
      if (full) { const r = await geocode(full); if (r && !r.fuzzy) hit = r }
      if (!hit && cityQ) hit = await geocode(cityQ)
      if (!hit && regionQ && regionQ !== cityQ) hit = await geocode(regionQ)
      return hit
    },
    staleTime: 24 * 60 * 60 * 1000,
  })
  const coords = geoQuery.data ?? null
  const status: 'loading' | 'ok' | 'error' = geoQuery.isPending ? 'loading' : coords ? 'ok' : 'error'

  // Carte Leaflet
  useEffect(() => {
    if (status !== 'ok' || !coords || !boxRef.current || mapRef.current) return
    // Clé CARTO (gratuite, demandée sur carto.com/basemaps/apikey) : sans elle, les tuiles
    // sont tamponnées « API KEY REQUIRED ».
    const cartoKey = import.meta.env.VITE_CARTO_KEY as string | undefined
    // Pas de bandeau Leaflet : le credit « OpenStreetMap · CARTO » exige par les conditions
    // d'usage est deja affiche en haut a droite de la carte (voir plus bas dans le rendu).
    const map = L.map(boxRef.current, { zoomControl: false, scrollWheelZoom: true, attributionControl: false }).setView([coords.lat, coords.lon], 16)
    // Chemin `rastertiles/` : c'est la forme documentee par CARTO pour les cles.
    // `light_all` = style Positron (le fond clair d'origine), `{r}` = tuiles @2x sur ecran retina.
    L.tileLayer(
      `https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}{r}.png${cartoKey ? `?key=${cartoKey}` : ''}`,
      { subdomains: 'abcd', maxZoom: 20 },
    ).addTo(map)
    L.marker([coords.lat, coords.lon], { icon: pin }).addTo(map)
    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, [status, coords])

  const label = [address, [postalCode, city].filter(Boolean).join(' ')].filter(Boolean).join(', ') + (canton ? ` (${canton})` : '')
  const mapsHref = coords
    ? `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lon}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(full || label)}`

  const chip = 'rounded-xl bg-white shadow-[0_2px_10px_-2px_rgba(0,0,0,0.25)]'

  return (
    <div className="absolute inset-0">
      <div ref={boxRef} className="absolute inset-0 bg-slate-100" />

      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center text-slate-400">
          <MapPin className="h-6 w-6" />
          <p className="text-xs">Localisation indisponible pour cette adresse.</p>
        </div>
      )}

      {status !== 'loading' && (
        <>
          {/* Crédit tuiles */}
          {status === 'ok' && (
            <span className="pointer-events-none absolute right-2 top-2.5 z-[1000] text-[9px] leading-none text-slate-400/80">© OpenStreetMap · CARTO</span>
          )}
          {/* Adresse flottante */}
          <div className={`absolute bottom-3 left-3 z-[1000] flex max-w-[62%] items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-800 ${chip}`}>
            <MapPin className="h-4 w-4 shrink-0 text-blue-600" />
            <span className="truncate">{label || 'Adresse non renseignée'}</span>
          </div>
          {/* Bouton ouvrir */}
          <a
            href={mapsHref}
            target="_blank"
            rel="noreferrer"
            className={`absolute bottom-3 right-3 z-[1000] inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-primary transition-transform hover:scale-[1.03] ${chip}`}
          >
            Ouvrir <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </>
      )}
    </div>
  )
}
