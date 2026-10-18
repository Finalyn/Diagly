import { ChevronDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * La vue Tableau des Métrés (components/metres/TableauMetres.tsx) : toutes
 * les formes du jeu, une par ligne, groupées par classification, avec leur
 * statut. Format 1200 × 700.
 */

interface Ligne { local: string; etage: string; quantite: string; ouvrage: string; sia?: string; confiance: 'haute' | 'moyenne'; valide: boolean }

const GROUPES: { titre: string; couleur: string; total: string; lignes: Ligne[] }[] = [
  { titre: 'Pièces', couleur: '#6366f1', total: '577,20 m²', lignes: [
    { local: 'Séjour et cuisine A', etage: '1er au 3e · × 3', quantite: '46,74 m²', ouvrage: '281 Revêtements de sol', sia: 'SUP', confiance: 'haute', valide: true },
    { local: 'Chambre A1', etage: '1er au 3e · × 3', quantite: '14,66 m²', ouvrage: '281 Revêtements de sol', sia: 'SUP', confiance: 'haute', valide: true },
    { local: 'Bain A', etage: '1er au 3e · × 3', quantite: '8,61 m²', ouvrage: '251 Appareils sanitaires', sia: 'SUS', confiance: 'haute', valide: true },
    { local: 'Chambre A2', etage: '1er au 3e · × 3', quantite: '13,19 m²', ouvrage: '281 Revêtements de sol', sia: 'SUP', confiance: 'haute', valide: true },
    { local: 'Palier et escalier', etage: '1er au 3e · × 3', quantite: '26,00 m²', ouvrage: '285 Traitement des surfaces', sia: 'SD', confiance: 'moyenne', valide: true },
  ] },
  { titre: 'Fenêtres', couleur: '#f59e0b', total: '36 pce', lignes: [
    { local: 'Fenêtre sud, 1re depuis la gauche', etage: '1er au 3e · × 3', quantite: '1 pce', ouvrage: '221.0 Fenêtres en bois', confiance: 'haute', valide: true },
    { local: 'Fenêtre nord, 2e depuis la gauche', etage: '1er au 3e · × 3', quantite: '1 pce', ouvrage: '221.0 Fenêtres en bois', confiance: 'moyenne', valide: true },
  ] },
  { titre: 'Éléments comptés', couleur: '#0f766e', total: '15 pce', lignes: [
    { local: 'Porte palière, logement A', etage: '1er au 3e · × 3', quantite: '1 pce', ouvrage: '273 Portes palières en bois', confiance: 'haute', valide: true },
    { local: 'Porte palière, logement B', etage: '1er au 3e · × 3', quantite: '1 pce', ouvrage: '273 Portes palières en bois', confiance: 'haute', valide: true },
    { local: 'Logement B, porte de la chambre', etage: '1er au 3e · × 3', quantite: '1 pce', ouvrage: '', confiance: 'haute', valide: false },
    { local: 'Logement B, porte du bain', etage: '1er au 3e · × 3', quantite: '1 pce', ouvrage: '', confiance: 'moyenne', valide: false },
  ] },
]

const CONFIANCE = { haute: 'bg-emerald-50 text-emerald-700', moyenne: 'bg-amber-50 text-amber-700' }

export function EcranTableau() {
  return (
    <div className="flex h-full w-full flex-col bg-white text-[#1d1d1f]">
      <div className="flex shrink-0 items-center gap-2 border-b border-[#e8e8ed] px-4 py-2.5">
        <span className="flex h-9 w-[260px] items-center gap-2 rounded-lg border border-[#e8e8ed] px-2.5 text-[13px] text-[#8e8e93]"><Search className="h-3.5 w-3.5" />Local, feuille, CFC…</span>
        <span className="flex items-center gap-1.5 text-[12px] text-[#6e6e73]">Regrouper par
          <span className="flex h-9 items-center gap-1.5 rounded-lg border border-[#e8e8ed] px-2.5 text-[13px] text-[#1d1d1f]">Classification<ChevronDown className="h-3.5 w-3.5" /></span>
        </span>
        <span className="flex rounded-lg bg-[#f5f5f7] p-0.5 text-[12px] font-medium">
          <span className="rounded-md bg-white px-2.5 py-1 shadow-sm">Tout</span>
          <span className="px-2.5 py-1 text-[#6e6e73]">À valider</span>
          <span className="px-2.5 py-1 text-[#6e6e73]">Validé</span>
        </span>
        <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[12px] font-medium text-sky-900">Feuille A-101 · Étage type (1er au 3e)</span>
        <p className="ml-auto text-[12px] text-[#6e6e73]">31 formes<span className="text-teal-700"> · 3 à valider, hors totaux</span></p>
      </div>
      <table className="w-full table-fixed border-collapse text-left text-[13px]">
        <thead>
          <tr className="border-b border-[#e8e8ed] bg-[#fafafb] text-[11px] font-semibold uppercase tracking-wide text-[#6e6e73]">
            <th className="w-[250px] px-4 py-2.5 font-semibold">Local / libellé</th>
            <th className="w-[80px] px-2 py-2.5 font-semibold">Feuille</th>
            <th className="w-[130px] px-2 py-2.5 font-semibold">Étage</th>
            <th className="w-[100px] px-2 py-2.5 text-right font-semibold">Quantité</th>
            <th className="w-[230px] px-4 py-2.5 font-semibold">Ouvrage CFC</th>
            <th className="w-[80px] px-2 py-2.5 font-semibold">SIA 416</th>
            <th className="w-[130px] px-2 py-2.5 font-semibold">Confiance</th>
            <th className="px-2 py-2.5 font-semibold">Statut</th>
          </tr>
        </thead>
        <tbody>
          {GROUPES.flatMap((g) => [
            <tr key={g.titre} className="border-b border-[#f0f0f3] bg-[#f8f8fa]">
              <td colSpan={3} className="px-4 py-2 font-semibold">
                <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: g.couleur }} />{g.titre}
              </td>
              <td className="px-2 py-2 text-right font-semibold tabular-nums">{g.total}</td>
              <td colSpan={4} />
            </tr>,
            ...g.lignes.map((l) => (
              <tr key={g.titre + l.local} className={cn('border-b border-[#f4f4f6]', !l.valide && 'bg-teal-50/40')}>
                <td className="truncate px-4 py-2.5 font-medium">{l.local}</td>
                <td className="px-2 py-2.5 text-[#6e6e73]">A-101</td>
                <td className="truncate px-2 py-2.5 text-[#48484a]">{l.etage}</td>
                <td className="px-2 py-2.5 text-right tabular-nums">{l.quantite}</td>
                <td className="truncate px-4 py-2.5 text-[#48484a]">{l.ouvrage || <span className="text-[#aeaeb2]">À rattacher</span>}</td>
                <td className="px-2 py-2.5">{l.sia && <span className="rounded bg-[#eef0ff] px-1.5 py-0.5 text-[11px] font-semibold text-[#4f46e5]">{l.sia}</span>}</td>
                <td className="px-2 py-2.5"><span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', CONFIANCE[l.confiance])}>{l.confiance === 'haute' ? 'Haute' : 'Moyenne'}</span></td>
                <td className="px-2 py-2.5">
                  {l.valide
                    ? <span className="text-[12px] text-[#48484a]">Validé</span>
                    : <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-700">À valider</span>}
                </td>
              </tr>
            )),
          ])}
        </tbody>
      </table>
    </div>
  )
}
