import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPin, Search, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Recherche d'adresse et carte réelle, sur la page publique.
 *
 * Une capture d'écran ne prouve rien : le visiteur doit pouvoir taper sa propre
 * adresse et voir son bâtiment. La recherche interroge le service fédéral
 * geo.admin.ch, public et sans clé, celui-là même que l'application utilise.
 *
 * Les valeurs du relevé restent floutées, y compris pour une adresse cherchée par
 * le visiteur. Afficher une année de construction que nous n'avons pas interrogée
 * serait un mensonge ; montrer qu'elle existe et d'où elle vient ne l'est pas.
 */

const RECHERCHE = 'https://api3.geo.admin.ch/rest/services/api/SearchServer?type=locations&origins=address&limit=6&sr=4326&searchText='

interface Lieu {
  label: string
  lat: number
  lon: number
}

/** Le service rend du HTML dans ses libellés : on le retire avant de l'afficher. */
function nettoyer(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

async function chercher(q: string): Promise<Lieu[]> {
  try {
    const j = await (await fetch(RECHERCHE + encodeURIComponent(q))).json()
    return (j?.results ?? [])
      .map((r: { attrs?: { label?: string; lat?: number; lon?: number } }) => r.attrs)
      .filter((a: { lat?: number; lon?: number }) => typeof a?.lat === 'number' && typeof a?.lon === 'number')
      .map((a: { label?: string; lat: number; lon: number }) => ({ label: nettoyer(a.label ?? ''), lat: a.lat, lon: a.lon }))
  } catch {
    return []
  }
}

/** Marqueur aux couleurs de la marque, identique à celui de l'application. */
const pin = L.divIcon({
  className: '',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  html: `<div style="position:relative;width:28px;height:28px">
    <span style="position:absolute;inset:0;border-radius:9999px;background:rgba(1,103,234,.22)"></span>
    <span style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:14px;height:14px;border-radius:9999px;background:#0167EA;border:3px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.4)"></span>
  </div>`,
})

/** Quelques immeubles pour démarrer sans rien taper. */
const EXEMPLES: Lieu[] = [
  { label: 'Avenue de la Gare 12, 1700 Fribourg', lat: 46.8033, lon: 7.1512 },
  { label: 'Chemin de Boston 8, 1004 Lausanne', lat: 46.5265, lon: 6.6167 },
  { label: 'Rue du Rhône 40, 1204 Genève', lat: 46.2044, lon: 6.1470 },
]

export function CarteAdresse({ onLieu }: { onLieu?: (l: Lieu) => void }) {
  const boite = useRef<HTMLDivElement>(null)
  const carte = useRef<L.Map | null>(null)
  const marqueur = useRef<L.Marker | null>(null)

  const [choisi, setChoisi] = useState<Lieu>(EXEMPLES[0])
  const [saisie, setSaisie] = useState('')
  const [resultats, setResultats] = useState<Lieu[]>([])
  const [cherche, setCherche] = useState(false)

  // Création de la carte, une seule fois.
  useEffect(() => {
    if (!boite.current || carte.current) return
    const cle = import.meta.env.VITE_CARTO_KEY as string | undefined
    const m = L.map(boite.current, { zoomControl: true, scrollWheelZoom: false, attributionControl: false })
      .setView([choisi.lat, choisi.lon], 16)
    L.tileLayer(
      `https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}{r}.png${cle ? `?key=${cle}` : ''}`,
      { subdomains: 'abcd', maxZoom: 20 },
    ).addTo(m)
    marqueur.current = L.marker([choisi.lat, choisi.lon], { icon: pin }).addTo(m)
    carte.current = m
    return () => { m.remove(); carte.current = null; marqueur.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Déplacement vers le lieu retenu.
  useEffect(() => {
    if (!carte.current) return
    carte.current.flyTo([choisi.lat, choisi.lon], 17, { duration: 0.9 })
    marqueur.current?.setLatLng([choisi.lat, choisi.lon])
    onLieu?.(choisi)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choisi])

  // Recherche différée : on laisse le doigt finir de taper avant d'interroger.
  useEffect(() => {
    const q = saisie.trim()
    if (q.length < 3) { setResultats([]); setCherche(false); return }
    setCherche(true)
    const t = setTimeout(async () => {
      setResultats(await chercher(q))
      setCherche(false)
    }, 320)
    return () => clearTimeout(t)
  }, [saisie])

  const retenir = (l: Lieu) => {
    setChoisi(l)
    setSaisie('')
    setResultats([])
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <label htmlFor="adresse-vitrine" className="sr-only">Chercher une adresse en Suisse</label>
        <div className="flex items-center gap-3 rounded-full border border-black/[0.08] bg-white px-5 py-3 shadow-[0_10px_30px_-16px_rgba(20,45,90,0.4)] focus-within:border-[#0167EA]/40">
          <MapPin className="h-4 w-4 shrink-0 text-[#0167EA]" aria-hidden="true" />
          <input
            id="adresse-vitrine"
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            placeholder={choisi.label}
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-[#1d1d1f] outline-none placeholder:text-[#1d1d1f]/55"
          />
          {cherche
            ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#86868b]" aria-hidden="true" />
            : <Search className="h-4 w-4 shrink-0 text-[#86868b]" aria-hidden="true" />}
        </div>

        {resultats.length > 0 && (
          <ul className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-[0_20px_50px_-20px_rgba(20,45,90,0.45)]">
            {resultats.map((r) => (
              <li key={`${r.lat}-${r.lon}-${r.label}`}>
                <button
                  onClick={() => retenir(r)}
                  className="block w-full px-5 py-2.5 text-left text-[14px] text-[#1d1d1f]/85 transition-colors hover:bg-[#f5f7fa]"
                >
                  {r.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Adresses de depart, pour voir la carte bouger sans rien taper. */}
      <div className="flex flex-wrap gap-2">
        {EXEMPLES.map((e) => (
          <button
            key={e.label}
            onClick={() => retenir(e)}
            aria-pressed={choisi.label === e.label}
            className={cn('rounded-full border px-3 py-1.5 text-[13px] transition-colors',
              choisi.label === e.label
                ? 'border-[#0167EA] bg-[#0167EA]/[0.07] text-[#0167EA]'
                : 'border-black/[0.09] text-[#1d1d1f]/70 hover:border-black/20')}
          >
            {e.label.split(',')[1]?.trim() ?? e.label}
          </button>
        ))}
      </div>

      <div className="relative overflow-hidden rounded-[20px] border border-black/[0.07] shadow-[0_20px_60px_-30px_rgba(20,45,90,0.5)]">
        <div ref={boite} className="h-[340px] w-full bg-[#eef1f5] md:h-[420px]" />
        {/* Credit exige par les conditions d'usage des fonds de carte. */}
        <span className="pointer-events-none absolute right-2 top-2 rounded-md bg-white/85 px-2 py-0.5 text-[10px] text-[#6e6e73]">
          © OpenStreetMap · CARTO
        </span>
      </div>
    </div>
  )
}
