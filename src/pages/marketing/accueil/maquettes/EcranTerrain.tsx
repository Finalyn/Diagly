import { ArrowLeft, ArrowRight, Check, ChevronRight, PanelLeft, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Etape, Repartition } from './EcranReleve'
import { PhotoPorte } from './Illustrations'

/**
 * Le relevé vu de la visite (section « Relevé sur le terrain ») : le parcours
 * par étapes sur iPad, le compteur au palier sur iPhone. Séparé de la fiche
 * du héros pour que le haut de la page ne charge pas ces écrans.
 */

const ETAPES_VISITE = [
  { nom: 'Façade', fait: 9, total: 9 },
  { nom: 'Cage d’escalier', fait: 5, total: 8, courante: true },
  { nom: 'Structure', fait: 0, total: 4 },
  { nom: 'Locaux techniques', fait: 0, total: 7 },
  { nom: 'Appartements', fait: 4, total: 9 },
  { nom: 'Aménagements extérieurs', fait: 0, total: 3 },
  { nom: 'Autres', fait: 0, total: 2 },
]

const OUVRAGES = [
  { cfc: '271', nom: 'Crépis et enduits intérieurs', etat: 'Bon', point: 'bg-green-400' },
  { cfc: '273', nom: 'Portes palières en bois', etat: 'Moyen', point: 'bg-orange-400' },
  { cfc: '272', nom: 'Portes en métal', etat: 'Bon', point: 'bg-green-400' },
  { cfc: '281', nom: 'Revêtement des marches', etat: 'Mauvais', point: 'bg-red-500' },
  { cfc: '233', nom: 'Lustrerie des paliers', etat: 'Très bon', point: 'bg-green-500' },
  { cfc: '272', nom: 'Main courante métallique', etat: null, point: '' },
  { cfc: '285', nom: 'Peinture intérieure plafond', etat: null, point: '' },
  { cfc: '275', nom: 'Systèmes de verrouillage', etat: null, point: '' },
]

/** Le parcours de la visite, étape par étape, ouvrage par ouvrage (iPad, 820 × 1180). */
export function EcranParcours() {
  return (
    <div className="flex h-full w-full flex-col bg-[#f7f7f9] text-[#1d1d1f]">
      <div className="h-[24px] shrink-0 bg-white" />
      <header className="flex h-[56px] shrink-0 items-center gap-3 border-b border-[#ededf1] bg-white px-5">
        <PanelLeft className="h-5 w-5 text-[#6e6e73]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">Les Tilleuls</p>
          <p className="truncate text-[12px] text-[#6e6e73]">Relevé · Rue des Alpes 12, Lausanne</p>
        </div>
        <span className="rounded-full bg-[#eef5ff] px-2.5 py-1 text-[12px] font-medium text-[#0167EA]">18 / 42 relevés</span>
      </header>
      <div className="px-6 pt-5">
        <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#6e6e73]">Étapes de la visite</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {ETAPES_VISITE.map((e) => (
            <span
              key={e.nom}
              className={cn('flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium',
                e.courante ? 'border-[#0167EA] bg-[#0167EA] text-white' : 'border-[#e8e8ed] bg-white')}
            >
              {e.fait === e.total && <Check className="h-3.5 w-3.5 text-emerald-600" />}
              {e.nom}
              <span className={cn('tabular-nums', e.courante ? 'text-white/80' : 'text-[#6e6e73]')}>{e.fait}/{e.total}</span>
            </span>
          ))}
        </div>
      </div>
      <div className="mx-6 mt-5 overflow-hidden rounded-2xl border border-[#e8e8ed] bg-white">
        <p className="border-b border-[#f0f0f3] px-4 py-3 text-[15px] font-semibold">Cage d’escalier</p>
        <ul>
          {OUVRAGES.map((o) => (
            <li key={o.nom} className="flex items-center gap-3 border-b border-[#f4f4f6] px-4 py-3 last:border-0">
              <span className="w-9 shrink-0 font-mono text-[12px] text-[#6e6e73]">{o.cfc}</span>
              <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{o.nom}</span>
              {o.etat
                ? <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-medium text-white', o.point)}>{o.etat}</span>
                : <span className="text-[12px] text-[#8e8e93]">À relever</span>}
              <ChevronRight className="h-4 w-4 text-[#aeaeb2]" />
            </li>
          ))}
        </ul>
      </div>
      <div className="mx-6 mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-[14px] font-semibold text-amber-900">Cet élément est-il présent dans le bâtiment ?</p>
        <p className="mt-0.5 text-[13px] text-amber-900/80">Main courante métallique</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <span className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-[#0167EA] text-[14px] font-semibold text-white"><Check className="h-4 w-4" />Présent, je le relève</span>
          <span className="flex h-11 items-center justify-center rounded-xl border border-amber-300 bg-white text-[14px] font-medium">Absent, passer</span>
        </div>
      </div>
      {/* Le récapitulatif des oublis, relu avant de dire la visite terminée. */}
      <div className="mx-6 mt-4 overflow-hidden rounded-2xl border border-[#e8e8ed] bg-white">
        <div className="border-b border-[#f0f0f3] px-4 py-3">
          <p className="text-[15px] font-semibold">Ce qui reste à faire</p>
          <p className="text-[13px] text-[#6e6e73]">Touchez une ligne pour aller à l’ouvrage.</p>
        </div>
        {[
          ['Revêtement des marches', 'Aucune photo.'],
          ['Crépis et enduits intérieurs', 'Quantité manquante, alors que l’ouvrage se compte en m².'],
        ].map(([nom, raison]) => (
          <div key={nom} className="flex items-center gap-3 border-b border-[#f4f4f6] px-4 py-3 last:border-0">
            <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium">{nom}</p>
              <p className="truncate text-[12px] text-[#6e6e73]">{raison}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-[#aeaeb2]" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Le compteur au palier, sur iPhone (393 × 852). */
export function EcranCompteur() {
  return (
    <div className="flex h-full w-full flex-col bg-white px-5 pt-[64px] text-[#1d1d1f]">
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1 text-[14px] font-medium text-[#6e6e73]"><ArrowLeft className="h-5 w-5" />Retour</span>
        <div className="min-w-0 flex-1 text-center">
          <p className="text-[14px] font-semibold">Portes palières en bois</p>
          <p className="text-[11px] text-[#6e6e73]">273 Menuiserie</p>
        </div>
        <Trash2 className="h-5 w-5 text-red-600" />
      </div>
      <div className="mt-5 h-[220px] overflow-hidden rounded-2xl"><PhotoPorte id="tel" /></div>
      <div className="mt-5 space-y-3">
        <Etape n={4} titre="Combien de ce type ?" />
        <Repartition />
      </div>
      <div className="mt-auto pb-[34px]">
        <span className="flex h-[52px] items-center justify-center gap-2 rounded-xl bg-[#0167EA] text-[16px] font-semibold text-white">
          Suivant <ArrowRight className="h-5 w-5" />
        </span>
      </div>
    </div>
  )
}
