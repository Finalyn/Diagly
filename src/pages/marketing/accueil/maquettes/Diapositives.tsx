import type { ReactNode } from 'react'
import { PlanEtage } from './Plan'
import { PIECES, nombreFr, surface } from './donnees'

/**
 * Deux diapositives de la présentation « Plans de repérage et métrés », à
 * 1280 × 720 : le repérage des pièces de l'étage type sur son plan, et le
 * tableau par niveau avec le total général. La mise en page suit
 * components/metres/PresentationMetres.tsx.
 */

const INDIGO = '#6366f1'
const parEtage = PIECES.reduce((s, p) => s + surface(p), 0)

function Cadre({ numero, children }: { numero: string; children: ReactNode }) {
  return (
    <div className="relative h-[720px] w-[1280px] overflow-hidden bg-white text-[#111827]">
      <div className="absolute inset-x-12 top-6 flex h-8 items-center justify-between gap-8">
        <p className="truncate text-[14px] text-neutral-500"><span className="font-semibold text-neutral-700">Les Tilleuls</span> · Rue des Alpes 12, 1003 Lausanne</p>
        <img src="/diagly-logo.svg" alt="" className="h-7 w-auto" />
      </div>
      <div className="absolute inset-x-12 bottom-[52px] top-[76px] flex flex-col">{children}</div>
      <div className="absolute inset-x-12 bottom-4 flex items-center justify-between border-t border-neutral-200 pt-2 text-[12px] text-neutral-500">
        <span>Plans de repérage et métrés</span>
        <span className="tabular-nums">{numero}</span>
      </div>
    </div>
  )
}

function Titre({ titre, sousTitre }: { titre: string; sousTitre: string }) {
  return (
    <div className="flex h-[64px] shrink-0 items-start gap-3">
      <span className="mt-[10px] h-4 w-4 shrink-0 rounded-full" style={{ background: INDIGO }} />
      <div className="min-w-0">
        <p className="truncate text-[28px] font-semibold leading-[36px] tracking-[-0.01em] text-neutral-900">{titre}</p>
        <p className="truncate text-[15px] leading-5 text-neutral-500">{sousTitre}</p>
      </div>
    </div>
  )
}

export function DiapoReperage() {
  return (
    <Cadre numero="3 / 11">
      <Titre titre="Pièces · Étage type (1er au 3e)" sousTitre="A-101 · Plan d’étage · × 3 étages" />
      <div className="mt-2 flex min-h-0 flex-1 gap-6">
        <div className="flex w-[790px] shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-white p-4">
          <PlanEtage pieces numeros retrait />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="rounded-xl bg-neutral-50 px-5 py-4">
            <p className="flex items-center gap-2 text-[15px] font-semibold text-neutral-800"><span className="h-3 w-3 rounded-full" style={{ background: INDIGO }} />Pièces</p>
            <p className="mt-3 text-[34px] font-semibold leading-none tracking-[-0.01em] tabular-nums text-neutral-900">{nombreFr(parEtage)} m²</p>
            <p className="mt-1.5 text-[13px] text-neutral-500">par étage, sur cette feuille</p>
            <p className="mt-2 text-[15px] font-medium tabular-nums text-neutral-800">{nombreFr(parEtage * 3)} m² sur 3 étages</p>
            <p className="mt-2 text-[13px] text-neutral-500">N° 1 à 9, repris au tableau</p>
          </div>
          <ol className="mt-3 space-y-[3px]">
            {PIECES.map((p) => (
              <li key={p.numero} className="flex items-center gap-2 text-[13px] leading-[20px]">
                <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1 text-[11px] font-bold text-white" style={{ background: INDIGO }}>{p.numero}</span>
                <span className="min-w-0 flex-1 truncate text-neutral-800">{p.nom}</span>
                <span className="shrink-0 tabular-nums text-neutral-600">{nombreFr(surface(p))} m²</span>
              </li>
            ))}
          </ol>
          <p className="mt-auto text-[12px] leading-4 text-neutral-500">Feuille au 1:100. Plan en retrait, seul l’élément en couleur.</p>
        </div>
      </div>
    </Cadre>
  )
}

const NIVEAUX = [
  { niveau: 'Rez', feuille: 'A-100 · Plan du rez', numeros: '1 à 7', etages: '1', total: 158.3 },
  { niveau: '1er au 3e', feuille: 'A-101 · Étage type (1er au 3e)', numeros: '8 à 16', etages: '× 3', total: parEtage * 3, parEtage },
  { niveau: 'Attique', feuille: 'A-102 · Attique', numeros: '17 à 22', etages: '1', total: 121.6 },
]
const TOTAL = NIVEAUX.reduce((s, n) => s + n.total, 0)

export function DiapoTableau() {
  return (
    <Cadre numero="4 / 11">
      <Titre titre="Pièces" sousTitre="Par niveau, étages identiques compris" />
      <div className="flex min-h-0 flex-1 items-center gap-8">
        <table className="min-w-0 flex-1 table-fixed border-collapse text-left tabular-nums">
          <thead>
            <tr className="border-b-2 border-neutral-900 py-3 text-[15px] font-semibold uppercase tracking-[0.06em] text-neutral-500">
              <th className="w-[40%] py-3 pr-4 font-semibold">Niveau</th>
              <th className="w-[16%] py-3 pr-4 font-semibold">N°</th>
              <th className="w-[14%] py-3 pr-4 text-right font-semibold">Étages</th>
              <th className="py-3 pl-4 text-right font-semibold">Surface</th>
            </tr>
          </thead>
          <tbody>
            {NIVEAUX.map((n) => (
              <tr key={n.niveau} className="border-b border-neutral-200 align-top">
                <td className="py-3 pr-4">
                  <p className="truncate text-[25px] font-semibold leading-8 text-neutral-900">{n.niveau}</p>
                  <p className="truncate text-[15px] leading-5 text-neutral-500">{n.feuille}</p>
                </td>
                <td className="whitespace-nowrap py-3 pr-4 text-[20px] leading-8 text-neutral-600">{n.numeros}</td>
                <td className="whitespace-nowrap py-3 pr-4 text-right text-[20px] leading-8 text-neutral-700">{n.etages}</td>
                <td className="py-3 pl-4 text-right">
                  <p className="text-[25px] font-semibold leading-8 text-neutral-900">{nombreFr(n.total)} m²</p>
                  {n.parEtage && <p className="text-[15px] leading-5 text-neutral-500">{nombreFr(n.parEtage)} m² par étage</p>}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-neutral-900">
              <td colSpan={3} className="py-4 pr-4 text-[28px] font-bold leading-9">Total général</td>
              <td className="py-4 pl-4 text-right text-[28px] font-bold leading-9">{nombreFr(TOTAL)} m²</td>
            </tr>
          </tfoot>
        </table>
        <div className="flex w-[360px] shrink-0 flex-col justify-between rounded-2xl p-6 text-white" style={{ background: INDIGO }}>
          <p className="text-[14px] font-semibold uppercase tracking-[0.12em] text-white/80">Total général</p>
          <p className="mt-2 text-[52px] font-bold leading-none tracking-[-0.02em] tabular-nums">{nombreFr(TOTAL)}</p>
          <p className="mt-3 text-[15px] text-white/85">m² de pièces, étages identiques compris</p>
          <ul className="mt-6 space-y-3.5">
            {NIVEAUX.map((n) => (
              <li key={n.niveau}>
                <div className="flex items-baseline justify-between gap-3 text-[16px]">
                  <span className="font-medium">{n.niveau}{n.etages !== '1' ? ` · ${n.etages}` : ''}</span>
                  <span className="font-semibold tabular-nums">{nombreFr(n.total)}</span>
                </div>
                <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white/25">
                  <div className="h-full rounded-full bg-white" style={{ width: `${(n.total / TOTAL) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Cadre>
  )
}
