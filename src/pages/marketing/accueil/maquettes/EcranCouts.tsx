import { ClipboardCheck, Download, FileDown } from 'lucide-react'
import { cn, formatCHF } from '@/lib/utils'
import { GROUPES_COUTS as GROUPES, POINT_ETAT as POINT, SYNTHESE, montant, totalGroupe } from './donnees'

/**
 * La page Coûts d'un dossier (pages/app/ProjectMetres.tsx) : les postes par
 * priorité, et la synthèse en cascade, honoraires, réserve puis TVA. Les
 * montants sont calculés ici comme dans l'application, quantité fois prix de
 * l'état, pour que la maquette tienne ses comptes.
 */

const quantite = (v: number) => v.toLocaleString('fr-CH', { maximumFractionDigits: 2 })

export function EcranCouts() {
  return (
    <div className="h-full w-full bg-[#f7f7f9] p-7 text-[#1d1d1f]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[24px] font-bold tracking-[-0.01em]">Coûts</p>
          <p className="text-[13px] text-[#6e6e73]">Les Tilleuls · 42 éléments relevés</p>
        </div>
        <div className="flex gap-2">
          {([[Download, 'Exporter'], [FileDown, 'PDF'], [ClipboardCheck, 'Ouvrir le relevé']] as const).map(([Icone, texte]) => (
            <span key={texte} className="flex items-center gap-2 rounded-lg border border-[#e8e8ed] bg-white px-3 py-2 text-[13px] font-medium"><Icone className="h-4 w-4" />{texte}</span>
          ))}
        </div>
      </div>
      <div className="mt-5 grid grid-cols-[1fr_330px] gap-5">
        <div className="space-y-3">
          {GROUPES.map((g) => (
            <div key={g.p} className="overflow-hidden rounded-xl border border-[#e8e8ed] bg-white">
              <div className="flex items-center justify-between px-4 py-3">
                <p className="flex items-center gap-2 text-[15px] font-semibold">
                  <span className={cn('rounded-full px-2 py-0.5 text-[12px] font-bold', g.pastille)}>{g.p}</span>Priorité {g.p}
                </p>
                <p className="text-[15px] font-bold tabular-nums">{formatCHF(totalGroupe(g))}</p>
              </div>
              <div className="divide-y divide-[#f0f0f3] border-t border-[#f0f0f3]">
                {g.lignes.map((l) => (
                  <div key={l.nom} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
                    <span className="w-12 shrink-0 font-mono text-[12px] text-[#6e6e73]">{l.cfc}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{l.nom}</p>
                      <p className="flex items-center gap-1.5 text-[12px] text-[#6e6e73]">
                        <span className={cn('h-2 w-2 rounded-full', POINT[l.etat])} />{l.etat}<span>· {quantite(l.quantite)} {l.unite}</span>
                      </p>
                    </div>
                    <span className="shrink-0 font-semibold tabular-nums">{montant(l) ? formatCHF(montant(l)) : '0 CHF'}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="self-start rounded-xl border border-[#e8e8ed] bg-white p-5 text-[13px]">
          <p className="text-[16px] font-semibold">Synthèse</p>
          <div className="mt-4 space-y-3">
            <Rang libelle="Réparation (HT)" valeur={SYNTHESE.ht} />
            <Rang libelle="Travaux (HT)" valeur={SYNTHESE.ht} fort />
            <Rang libelle="Honoraires" taux="12" valeur={SYNTHESE.honoraires} />
            <Rang libelle="Réserve" taux="10" valeur={SYNTHESE.reserve} />
            <Rang libelle="Sous-total" valeur={SYNTHESE.ht + SYNTHESE.honoraires + SYNTHESE.reserve} />
            <Rang libelle="TVA 8.1%" valeur={SYNTHESE.tva} />
            <div className="flex items-center justify-between border-t border-[#e8e8ed] pt-3">
              <span className="font-semibold">Total TTC</span>
              <span className="text-[20px] font-bold tabular-nums">{formatCHF(SYNTHESE.total)}</span>
            </div>
            <p className="pt-1 text-[11px] text-[#6e6e73]">Total = HT × (1 + honoraires) × (1 + réserve) × 1.081. Estimation ±15%.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function Rang({ libelle, valeur, taux, fort }: { libelle: string; valeur: number; taux?: string; fort?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={cn('flex items-center gap-1', fort ? 'font-semibold' : 'text-[#6e6e73]')}>
        {libelle}
        {taux && <span className="ml-1 rounded-md border border-[#dcdce1] px-2 py-0.5 text-[12px] text-[#1d1d1f]">{taux}</span>}
        {taux && '%'}
      </span>
      <span className={cn('tabular-nums', fort ? 'font-semibold' : 'font-medium')}>{formatCHF(valeur)}</span>
    </div>
  )
}
