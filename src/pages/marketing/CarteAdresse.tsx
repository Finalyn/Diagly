import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPin, Search, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { chercher, EXEMPLES } from './registre'
import type { Lieu } from './registre'

/**
 * Recherche d'adresse et carte réelle, sur la page publique.
 *
 * Une capture d'écran ne prouve rien : le visiteur doit pouvoir taper sa propre
 * adresse et voir son bâtiment. La recherche interroge le service fédéral
 * geo.admin.ch, public et sans clé, celui-là même que l'application utilise.
 *
 * Ce composant ne fait que la carte. Les interrogations vivent dans registre.ts,
 * avec la raison pour laquelle l’une d’elles passe par notre serveur.
 */

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

  // Au premier rendu, annoncer le lieu de départ pour que le relevé le suive.
  useEffect(() => {
    onLieu?.(choisi)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      {/* Leaflet empile ses calques très haut, jusqu'à 800 pour ses commandes :
          sans rang explicite, la liste des propositions passait dessous. Elle est
          donc posée au-dessus, et la carte enfermée dans son propre contexte. */}
      <div className="relative z-[1200]">
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
          <ul className="absolute inset-x-0 top-full z-[1201] mt-2 overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-[0_20px_50px_-20px_rgba(20,45,90,0.45)]">
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

      <div className="relative z-0 overflow-hidden rounded-[20px] border border-black/[0.07] shadow-[0_20px_60px_-30px_rgba(20,45,90,0.5)]">
        <div ref={boite} className="h-[340px] w-full bg-[#eef1f5] md:h-[420px]" />
        {/* Credit exige par les conditions d'usage des fonds de carte. */}
        <span className="pointer-events-none absolute right-2 top-2 rounded-md bg-white/85 px-2 py-0.5 text-[10px] text-[#6e6e73]">
          © OpenStreetMap · CARTO
        </span>
      </div>
    </div>
  )
}
