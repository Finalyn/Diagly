import { SYNTHESE } from './donnees'
import { PhotoImmeuble } from './Illustrations'

/**
 * Deux pages A4 du rapport complet, à 595 × 842 (le point typographique) :
 * la page de garde, avec sa photo, le bandeau de couleur du dossier et
 * l'identité du bureau, et une page du devis par priorité. Mise en page de
 * components/report/RapportComplet.tsx.
 */

const ACCENT = '#0167EA'
const francs = (v: number) => v.toLocaleString('fr-CH', { maximumFractionDigits: 0 })

function EnTete() {
  return (
    <div className="flex h-[40px] items-start justify-end">
      <span className="flex h-[26px] items-center rounded border border-dashed border-neutral-300 px-2.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-400">Votre logo</span>
    </div>
  )
}

function Pied({ page }: { page: string }) {
  return (
    <div className="flex h-[20px] items-end justify-between border-t border-neutral-200 pt-1 text-[8px] text-neutral-500">
      <span>Les Tilleuls · Rapport de diagnostic</span>
      <span>{page}</span>
    </div>
  )
}

export function PageDeGarde() {
  return (
    <div className="flex h-[842px] w-[595px] flex-col bg-white px-[40px] py-[45px] text-black" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
      <EnTete />
      <div className="flex flex-1 flex-col">
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">Diagnostic de bâtiment</p>
          <p className="mt-2 text-[34px] font-bold leading-tight">Rapport de diagnostic</p>
          <div className="mt-3 h-1 w-24" style={{ background: ACCENT }} />
          <p className="mt-6 text-[18px]">Les Tilleuls</p>
          <p className="text-[14px] text-neutral-500">Rue des Alpes 12, 1003 Lausanne</p>
          <div className="mt-7 h-[270px] overflow-hidden rounded border border-neutral-200"><PhotoImmeuble id="garde" /></div>
        </div>
        <div className="mt-6 flex items-end justify-between gap-6 border-t border-neutral-200 pt-3 text-[10px] text-neutral-500">
          <p>Édité par votre bureau</p>
          <div className="text-right">
            <p className="font-semibold text-neutral-900">Votre bureau</p>
            <p>Votre adresse</p>
            <p>NPA Localité</p>
          </div>
        </div>
      </div>
      <Pied page="1 / 24" />
    </div>
  )
}

const POSTES = [
  { cfc: '242', nom: 'Chauffage, distribution', q: '1 020 m²', m: '86 700' },
  { cfc: '224.1', nom: 'Couverture en toiture plate', q: '236 m²', m: '28 320' },
  { cfc: '281', nom: 'Revêtement des marches', q: '64 m²', m: '11 840' },
]
const POSTES_III = [
  { cfc: '271', nom: 'Crépis et enduits intérieurs', q: '310 m²', m: '5 580' },
  { cfc: '233', nom: 'Lustrerie des paliers', q: '5 pce', m: '0' },
]
const POSTES_II = [
  { cfc: '226.1', nom: 'Façade en crépi non isolée', q: '837 m²', m: '37 665' },
  { cfc: '221.0', nom: 'Fenêtres en bois', q: '196,8 m²', m: '15 744' },
  { cfc: '273', nom: 'Portes palières en bois', q: '2 pce', m: '1 860' },
]

export function PageDevis() {
  const ligne = (p: { cfc: string; nom: string; q: string; m: string }) => (
    <tr key={p.nom} className="border-b border-neutral-200">
      <td className="py-[5px] pr-2 font-mono text-[9px] text-neutral-500">{p.cfc}</td>
      <td className="py-[5px] pr-2 text-[10px]">{p.nom}</td>
      <td className="py-[5px] pr-2 text-right text-[10px] tabular-nums">{p.q}</td>
      <td className="py-[5px] text-right text-[10px] font-semibold tabular-nums">{p.m}</td>
    </tr>
  )
  const titre = (t: string, couleur: string) => (
    <tr><td colSpan={4} className="pb-1 pt-4 text-[11px] font-bold" style={{ color: couleur }}>{t}</td></tr>
  )
  return (
    <div className="flex h-[842px] w-[595px] flex-col bg-white px-[40px] py-[45px] text-black" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
      <EnTete />
      <div className="flex-1">
        <p className="text-[18px] font-bold"><span style={{ color: ACCENT }}>4</span> Devis estimatif ±15 %</p>
        <p className="mt-1 text-[10px] text-neutral-600">Par priorité, prix de la base du bureau, quantités du bâtiment.</p>
        <table className="mt-2 w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-black text-left text-[9px] uppercase tracking-wide text-neutral-500">
              <th className="py-1 pr-2 font-semibold">CFC</th><th className="py-1 pr-2 font-semibold">Poste</th>
              <th className="py-1 pr-2 text-right font-semibold">Quantité</th><th className="py-1 text-right font-semibold">CHF</th>
            </tr>
          </thead>
          <tbody>
            {titre('Priorité I · 0 à 5 ans', '#dc2626')}
            {POSTES.map(ligne)}
            {titre('Priorité II · 5 à 10 ans', '#ea580c')}
            {POSTES_II.map(ligne)}
            {titre('Priorité III · au-delà de 10 ans', '#16a34a')}
            {POSTES_III.map(ligne)}
          </tbody>
        </table>
        <div className="ml-auto mt-6 w-[250px] space-y-1 text-[10px]">
          {([['Travaux HT', SYNTHESE.ht], ['Honoraires 12 %', SYNTHESE.honoraires], ['Réserve 10 %', SYNTHESE.reserve], ['TVA 8,1 %', SYNTHESE.tva]] as const).map(([a, b]) => (
            <div key={a} className="flex justify-between"><span className="text-neutral-600">{a}</span><span className="tabular-nums">{francs(b)}</span></div>
          ))}
          <div className="flex justify-between border-t-2 border-black pt-1 text-[12px] font-bold"><span>Total TTC</span><span className="tabular-nums">{francs(SYNTHESE.total)}</span></div>
        </div>
        <p className="mt-8 border-l-2 border-neutral-300 pl-3 text-[9px] leading-relaxed text-neutral-600">
          Estimation indicative à plus ou moins 15 %, établie avec les prix de la base du bureau et les quantités du
          bâtiment. Elle ne remplace pas le devis d’une entreprise.
        </p>
      </div>
      <Pied page="14 / 24" />
    </div>
  )
}
