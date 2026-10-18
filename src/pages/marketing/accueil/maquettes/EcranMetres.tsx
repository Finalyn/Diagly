import {
  ChevronDown, ChevronLeft, ChevronRight, Compass, Eye, FileSpreadsheet, FolderOpen, Hand, ListChecks, Map as Carte,
  Minus, MousePointer2, Pentagon, Plus, Presentation, Ruler, ScanLine, Search, SendHorizontal, Table2, Type,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MarqueIA } from '../ui'
import { CarteFeuille } from './Feuilles'
import { FEUILLES } from './donnees'
import { PlanEtage } from './Plan'
import { CarteRevue } from './Revue'

/**
 * L'espace de travail des Métrés, à 1440 × 900 : la barre du dossier, les
 * feuilles du jeu à gauche, le plan au centre avec ce que l'IA a dessiné, et
 * le panneau des quantités à droite. Les libellés sont ceux de l'application
 * (pages/app/EspaceMetres.tsx, components/metres/).
 */
export function EcranMetres() {
  return (
    <div className="flex h-full w-full flex-col bg-white text-[#1d1d1f]">
      <Barre />
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[284px] shrink-0 flex-col border-r border-[#e8e8ed] bg-white p-3">
          <div className="mb-3 flex items-center gap-1">
            <p className="flex-1 text-[13px] font-semibold">Feuilles</p>
            <span className="rounded-lg p-1.5 text-[#6e6e73]"><Plus className="h-4 w-4" /></span>
            <span className="rounded-lg p-1.5 text-[#6e6e73]"><ScanLine className="h-4 w-4" /></span>
          </div>
          <div className="mb-2 flex items-center gap-2 rounded-xl bg-[#f5f5f7] px-3 py-2 text-[13px] font-medium">
            <span className="flex-1">Tout le jeu</span>
            <span className="text-[11px] text-[#6e6e73]">6 feuilles</span>
          </div>
          <p className="mb-1.5 px-1 text-[11px] font-medium uppercase tracking-wide text-[#6e6e73]">Jeu de plans.pdf · 6 pages</p>
          <div className="space-y-1.5">
            {FEUILLES.map((f) => <CarteFeuille key={f.numero} f={f} choisie={f.numero === 'A-101'} />)}
          </div>
        </aside>

        <section className="relative min-w-0 flex-1 overflow-hidden bg-[#eef0f3]">
          {/* La feuille A3, son plan, ses formes. */}
          <div className="absolute left-[78px] right-[30px] top-[24px] rounded-[3px] bg-white p-6 shadow-[0_2px_10px_rgba(0,0,0,0.08)]">
            <div className="relative rounded-[2px] border border-[#cfd2d8] px-6 pb-14 pt-5">
              <p className="text-[13px] font-semibold tracking-[0.04em] text-[#374151]">ÉTAGE TYPE (1ER AU 3E)</p>
              <p className="text-[9px] text-[#6b7280]">Plan des 1er, 2e et 3e étages, identiques. État existant.</p>
              <PlanEtage pieces fenetres portes aValider className="mt-2" />
              {/* Cartouche, en bas à droite comme sur la feuille d'origine. */}
              <div className="absolute bottom-2 right-2 grid w-[200px] grid-cols-[1fr_auto] border border-[#9ca3af] text-[8px] text-[#374151]">
                <span className="border-b border-r border-[#9ca3af] px-1.5 py-0.5 font-semibold">Étage type (1er au 3e)</span>
                <span className="border-b border-[#9ca3af] px-1.5 py-0.5">1:100</span>
                <span className="border-r border-[#9ca3af] px-1.5 py-0.5">Les Tilleuls</span>
                <span className="px-1.5 py-0.5 font-semibold">A-101</span>
              </div>
            </div>
          </div>

          {/* Les outils du plan. */}
          <div className="absolute left-4 top-[24px] flex flex-col gap-1 rounded-xl border border-[#e8e8ed] bg-white p-1 shadow-sm">
            {[MousePointer2, Hand, Pentagon, Ruler, Plus, Type].map((Icone, i) => (
              <span key={i} className={cn('flex h-9 w-9 items-center justify-center rounded-lg', i === 0 ? 'bg-[#1d1d1f] text-white' : 'text-[#48484a]')}>
                <Icone className="h-[18px] w-[18px]" />
              </span>
            ))}
          </div>
          <div className="absolute left-[78px] top-[574px] flex items-center gap-2 rounded-full border border-[#e8e8ed] bg-white px-3 py-1.5 text-[12px] shadow-sm">
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">Échelle vérifiée</span>
            1:100, contrôlée sur la cote de 20,00 m
          </div>
          <div className="absolute right-[30px] top-[574px] flex items-center gap-3 rounded-full border border-[#e8e8ed] bg-white px-3 py-1.5 text-[12px] font-medium shadow-sm">
            <Minus className="h-3.5 w-3.5" />82 %<Plus className="h-3.5 w-3.5" />
          </div>
          {/* La revue : un élément proposé à la fois, validé ou rejeté. */}
          <CarteRevue className="absolute bottom-5 left-1/2 -translate-x-1/2" />
        </section>

        <aside className="w-[352px] shrink-0 overflow-hidden border-l border-[#e8e8ed] bg-white">
          <PanneauQuantites />
        </aside>
      </div>
    </div>
  )
}

function Barre() {
  const bouton = 'flex shrink-0 items-center gap-1.5 rounded-lg border border-[#e8e8ed] px-2.5 py-1.5 text-[13px] font-medium'
  return (
    <header className="flex h-[58px] shrink-0 items-center gap-3 border-b border-[#e8e8ed] px-3">
      <ChevronLeft className="h-5 w-5 text-[#6e6e73]" />
      <img src="/diagly-logo.svg" alt="" className="h-6" />
      <span className="h-6 w-px bg-[#e8e8ed]" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold">Les Tilleuls</p>
        <p className="truncate text-[12px] text-[#6e6e73]">Rue des Alpes 12, 1003 Lausanne</p>
      </div>
      <div className="flex shrink-0 rounded-lg bg-[#f5f5f7] p-0.5">
        <span className="flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1 text-[13px] font-medium shadow-sm"><Carte className="h-4 w-4" />Plan</span>
        <span className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[13px] font-medium text-[#6e6e73]"><Table2 className="h-4 w-4" />Tableau</span>
      </div>
      <div className="w-[190px] shrink-0">
        <p className="flex items-center gap-1.5 text-[12px] text-[#6e6e73]"><MarqueIA className="h-3.5 w-3.5" />6/6 feuilles analysées</p>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#f5f5f7]"><div className="h-full w-full rounded-full bg-emerald-500" /></div>
      </div>
      <span className={cn(bouton, 'border-teal-300 bg-teal-50 text-teal-900')}><ListChecks className="h-4 w-4" />Revoir (3)</span>
      <span className={bouton}><FileSpreadsheet className="h-4 w-4" />Excel</span>
      <span className={bouton}><Presentation className="h-4 w-4" />Présentation</span>
      <span className={bouton}><SendHorizontal className="h-4 w-4" />Reporter au dossier</span>
      <span className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#1d1d1f] px-3 py-1.5 text-[13px] font-semibold text-white">
        <MarqueIA className="h-4 w-4 brightness-0 invert" />Analyser tout
      </span>
      <Compass className="h-4 w-4 text-[#6e6e73]" />
      <FolderOpen className="h-4 w-4 text-[#6e6e73]" />
    </header>
  )
}

const CLASSES: { titre: string; couleur: string; total: string; ouvert?: boolean; aValider?: number }[] = [
  { titre: 'Pièces', couleur: '#6366f1', total: '857,10 m²', ouvert: true },
  { titre: 'Façades', couleur: '#3b82f6', total: '837,00 m²' },
  { titre: 'Fenêtres', couleur: '#f59e0b', total: '41 pce' },
  { titre: 'Éléments comptés', couleur: '#0f766e', total: '21 pce', aValider: 3 },
]

const ETAGES = [
  { nom: 'Rez', valeur: '158,30 m²' },
  { nom: '1er au 3e · × 3', valeur: '577,20 m²', detail: '192,40 m² par étage' },
  { nom: 'Attique', valeur: '121,60 m²' },
]

const SIA = [
  { nom: 'Rez', sp: '220,00', sn: '158,30', sc: '61,70' },
  { nom: '1er au 3e × 3', sp: '660,00', sn: '577,20', sc: '82,80' },
  { nom: 'Attique', sp: '140,00', sn: '121,60', sc: '18,40' },
]

function PanneauQuantites() {
  return (
    <div className="p-3">
      <div className="mb-3 flex gap-1 rounded-xl bg-[#f5f5f7] p-1">
        <span className="flex-1 rounded-lg bg-white py-1.5 text-center text-[13px] font-medium shadow-sm">Quantités</span>
        <span className="flex-1 py-1.5 text-center text-[13px] font-medium text-[#6e6e73]">Feuille</span>
      </div>
      <div className="mb-3 flex items-center gap-2 rounded-lg border border-[#e8e8ed] px-2.5 py-1.5 text-[13px] text-[#8e8e93]">
        <Search className="h-3.5 w-3.5" />Rechercher
      </div>
      <ul className="space-y-1">
        {CLASSES.map((c) => (
          <li key={c.titre} className={cn('rounded-xl', c.ouvert && 'bg-[#f8f8fa] pb-2')}>
            <div className="flex items-center gap-2 px-2 py-2">
              {c.ouvert ? <ChevronDown className="h-3.5 w-3.5 text-[#6e6e73]" /> : <ChevronRight className="h-3.5 w-3.5 text-[#6e6e73]" />}
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.couleur }} />
              <span className="flex-1 text-[13px] font-semibold">{c.titre}</span>
              <span className="text-[13px] font-semibold tabular-nums">{c.total}</span>
              <Eye className="h-3.5 w-3.5 text-[#aeaeb2]" />
            </div>
            {c.ouvert && (
              <div className="space-y-1 pl-9 pr-3">
                {ETAGES.map((e) => (
                  <div key={e.nom}>
                    <div className="flex justify-between text-[12px]">
                      <span className="text-[#48484a]">{e.nom}</span>
                      <span className="tabular-nums text-[#1d1d1f]">{e.valeur}</span>
                    </div>
                    {e.detail && <p className="text-[11px] text-[#6e6e73]">{e.detail}</p>}
                  </div>
                ))}
              </div>
            )}
            {c.aValider ? (
              <p className="pb-2 pl-9"><span className="rounded-full bg-teal-50 px-1.5 py-0.5 text-[10px] font-medium text-teal-700">{c.aValider} à valider, hors totaux</span></p>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="mt-4 rounded-xl border border-[#e8e8ed] p-3">
        <p className="text-[13px] font-semibold">Surfaces SIA 416</p>
        <p className="text-[11px] text-amber-700">À vérifier, selon SIA 416:2003</p>
        <table className="mt-2 w-full text-[11px] tabular-nums">
          <thead>
            <tr className="text-[#6e6e73]">
              <th className="pb-1 text-left font-medium">Étage</th>
              <th className="pb-1 text-right font-medium">SP</th>
              <th className="pb-1 text-right font-medium">SN</th>
              <th className="pb-1 text-right font-medium">SC</th>
            </tr>
          </thead>
          <tbody>
            {SIA.map((l) => (
              <tr key={l.nom} className="border-t border-[#f0f0f3]">
                <td className="py-1">{l.nom}</td>
                <td className="py-1 text-right">{l.sp}</td>
                <td className="py-1 text-right">{l.sn}</td>
                <td className="py-1 text-right">{l.sc}</td>
              </tr>
            ))}
            <tr className="border-t border-[#1d1d1f] font-semibold">
              <td className="py-1">Total</td>
              <td className="py-1 text-right">1 020,00</td>
              <td className="py-1 text-right">857,10</td>
              <td className="py-1 text-right">162,90</td>
            </tr>
          </tbody>
        </table>
        <div className="mt-2 grid grid-cols-4 gap-1 text-center text-[10px]">
          {[['SUP', '149,18'], ['SUS', '17,22'], ['SD', '26,00'], ['SI', '0,00']].map(([c, v]) => (
            <div key={c} className="rounded-md bg-[#f5f5f7] py-1">
              <p className="font-semibold">{c}</p>
              <p className="tabular-nums text-[#6e6e73]">{v}</p>
            </div>
          ))}
        </div>
        <p className="mt-1 text-[10px] text-[#6e6e73]">Étage type, par étage, en m²</p>
      </div>
    </div>
  )
}
