import {
  ChevronLeft, ChevronRight, ClipboardCheck, Database, Layers, MessageCircle, Plus, Search, Settings, type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * L'accueil de l'app sur iPhone, la liste des diagnostics, et la barre du
 * bas de l'application (components/layout/MobileNav.tsx) : une pilule en
 * verre au centre et l'Assistant à droite ; dans l'app, iOS la dessine
 * lui-même. Les autres écrans de l'iPhone sont dans EcranApp.tsx.
 */

const STATUTS = {
  EN_COURS: { libelle: 'En cours', pilule: 'bg-blue-50 text-blue-700', point: 'bg-blue-500' },
  PLANIFIE: { libelle: 'Planifié', pilule: 'bg-violet-50 text-violet-700', point: 'bg-violet-500' },
  EN_REVUE: { libelle: 'En revue', pilule: 'bg-amber-50 text-amber-700', point: 'bg-amber-500' },
  TERMINE: { libelle: 'Terminé', pilule: 'bg-emerald-50 text-emerald-700', point: 'bg-emerald-500' },
  NON_PLANIFIE: { libelle: 'Non planifié', pilule: 'bg-neutral-100 text-neutral-600', point: 'bg-neutral-400' },
} as const

const TEINTES = ['bg-blue-50 text-blue-600', 'bg-violet-50 text-violet-600', 'bg-amber-50 text-amber-600', 'bg-emerald-50 text-emerald-600', 'bg-rose-50 text-rose-600', 'bg-sky-50 text-sky-600']

const DOSSIERS: { nom: string; adresse: string; type: string; statut: keyof typeof STATUTS }[] = [
  { nom: 'Les Tilleuls', adresse: 'Rue des Alpes 12, Lausanne', type: 'Immeuble locatif · 1 020 m²', statut: 'EN_COURS' },
  { nom: 'Résidence du Lac', adresse: 'Quai du Lac 3, Vevey', type: 'Immeuble locatif · 860 m²', statut: 'PLANIFIE' },
  { nom: 'Villa Belvédère', adresse: 'Chemin des Vignes 8, Pully', type: 'Villa · 240 m²', statut: 'EN_REVUE' },
  { nom: 'Les Platanes', adresse: 'Avenue de la Gare 21, Fribourg', type: 'Mixte · 1 480 m²', statut: 'EN_COURS' },
  { nom: 'Collège du Centre', adresse: 'Place du Collège 1, Bulle', type: 'Administratif · 2 100 m²', statut: 'TERMINE' },
  { nom: 'Le Verger', adresse: 'Route du Verger 5, Morges', type: 'Immeuble locatif · 690 m²', statut: 'NON_PLANIFIE' },
  { nom: 'Les Cèdres', adresse: 'Rue du Midi 9, Sion', type: 'Immeuble locatif · 1 150 m²', statut: 'PLANIFIE' },
]

/** La barre du bas en verre : la pilule de navigation, l'Assistant à droite, le retour à gauche dans un dossier. */
export function BarreVerre({ entrees, retour }: { entrees: { icone: LucideIcon; actif?: boolean }[]; retour?: boolean }) {
  const rond = 'liquid-nav flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full'
  const icone = (Icone: LucideIcon, actif?: boolean) => (
    <span className="relative flex h-11 w-11 items-center justify-center rounded-full">
      {actif && <span className="absolute inset-0 rounded-full bg-[#DBEFFF]/80 shadow-[0_2px_10px_-2px_rgba(120,180,255,0.7)]" />}
      <Icone className={cn('relative h-[22px] w-[22px]', actif ? 'text-[#1d1d1f]' : 'text-neutral-700')} strokeWidth={actif ? 2.2 : 1.8} />
    </span>
  )
  return (
    <div className="absolute inset-x-0 bottom-0 z-10 px-5 pb-[30px]">
      <div className="flex items-center gap-4">
        {retour && <span className={rond}><ChevronLeft className="h-[22px] w-[22px] text-neutral-700" strokeWidth={1.8} /></span>}
        <div className="liquid-nav mx-auto flex items-center gap-3 overflow-hidden rounded-full px-3 py-1.5">
          {entrees.map((e, i) => <span key={i}>{icone(e.icone, e.actif)}</span>)}
        </div>
        <span className={rond}>{icone(MessageCircle)}</span>
      </div>
      <span className="absolute bottom-[8px] left-1/2 h-[5px] w-[134px] -translate-x-1/2 rounded-full bg-black" />
    </div>
  )
}

/** L'accueil de l'app sur iPhone : la liste des diagnostics. */
export function EcranDiagnostics() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#f5f5f7] text-[#1d1d1f]">
      <div className="barre-verre absolute inset-x-0 top-0 z-[5] h-[104px]">
        <div className="flex items-end justify-between px-5 pt-[60px]">
          <p className="text-[28px] font-bold tracking-[-0.02em]">Diagnostics</p>
          <span className="mb-1 flex h-9 w-9 items-center justify-center rounded-full bg-[#1d1d1f] text-white"><Plus className="h-5 w-5" /></span>
        </div>
      </div>
      <div className="px-4 pt-[116px]">
        <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-[15px] text-[#8e8e93] shadow-[0_0_0_1px_rgba(0,0,0,0.04)]">
          <Search className="h-4 w-4" />Rechercher un diagnostic...
        </div>
        <div className="mt-3 flex gap-1.5">
          {['Tous', 'En cours', 'À traiter', 'Terminés'].map((t, i) => (
            <span key={t} className={cn('rounded-full px-3 py-1.5 text-[13px] font-medium', i === 0 ? 'bg-[#1d1d1f] text-white' : 'bg-white text-[#48484a]')}>{t}</span>
          ))}
        </div>
        <div className="mt-3 divide-y divide-[#f0f0f3] overflow-hidden rounded-2xl bg-white">
          {DOSSIERS.map((d, i) => (
            <div key={d.nom} className="flex items-center gap-3 p-3">
              <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', TEINTES[i % TEINTES.length])}><Layers className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', STATUTS[d.statut].pilule)}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', STATUTS[d.statut].point)} />{STATUTS[d.statut].libelle}
                  </span>
                  <p className="truncate text-[14px] font-semibold">{d.nom}</p>
                </div>
                <p className="mt-0.5 truncate text-[12px] text-[#6e6e73]">{d.adresse}</p>
                <p className="text-[11px] text-[#6e6e73]">{d.type}</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-[#aeaeb2]" />
            </div>
          ))}
        </div>
      </div>
      <BarreVerre entrees={[{ icone: ClipboardCheck, actif: true }, { icone: Database }, { icone: Settings }]} />
    </div>
  )
}
