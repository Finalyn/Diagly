import { useState } from 'react'
import { cn } from '@/lib/utils'
import { GrandTitre, Chapo, Etape } from './elements'
import { computeProjectMetrics } from '@/lib/formulas'
import { STATE_PRIORITY } from '@/lib/diagnostic-auto'
import type { ElementState, RoofType } from '@/lib/api-types'

/**
 * Les étapes du parcours, chacune avec de quoi l'essayer.
 *
 * Une capture d'écran ne prouve rien et une liste à puces encore moins. Ces trois
 * sections font tourner le calcul de l'application dans la page : la géométrie
 * passe par computeProjectMetrics, la priorité par STATE_PRIORITY, et la cascade
 * de coûts suit la formule du serveur. Si un jour l'application change, la page
 * change avec elle ou le typage casse au build.
 *
 * Une chose n'est pas montrée : les prix du catalogue du bureau. Ils ne sont pas
 * à nous, et une page publique n'est pas l'endroit. Le visiteur pose le sien.
 */

const fr = (n: number, dec = 0) =>
  n.toLocaleString('fr-CH', { minimumFractionDigits: dec, maximumFractionDigits: dec }).replace(/[\u202f\u00a0]/g, '’')

/* ------------------------------------------------------------- commandes */

function Curseur({ libelle, valeur, min, max, pas, suffixe, onChange }: {
  libelle: string; valeur: number; min: number; max: number; pas: number
  suffixe: string; onChange: (n: number) => void
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-4">
        <span className="text-[14px] text-[#1d1d1f]/75">{libelle}</span>
        <span className="text-[15px] font-semibold tabular-nums text-[#0167EA]">
          {valeur.toLocaleString('fr-CH')} <span className="text-[12px] font-normal text-[#86868b]">{suffixe}</span>
        </span>
      </span>
      <input
        type="range" min={min} max={max} step={pas} value={valeur}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-black/[0.09] accent-[#0167EA]"
      />
    </label>
  )
}

function Resultat({ libelle, valeur, note, fort }: {
  libelle: string; valeur: string; note?: string; fort?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-black/[0.06] py-2.5 last:border-0">
      <span className={cn('text-[15px]', fort ? 'font-medium text-[#1d1d1f]' : 'text-[#1d1d1f]/70')}>
        {libelle}
        {note && <span className="ml-2 text-[11px] text-[#86868b]">{note}</span>}
      </span>
      <span className={cn('shrink-0 tabular-nums', fort ? 'text-[17px] font-semibold' : 'text-[15px] font-semibold')}>
        {valeur}
      </span>
    </div>
  )
}

function Panneau({ titre, children, className }: { titre: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-[20px] border border-black/[0.07] bg-white p-6 shadow-[0_20px_60px_-34px_rgba(20,45,90,0.4)] sm:p-7', className)}>
      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#86868b]">{titre}</p>
      <div className="mt-5">{children}</div>
    </div>
  )
}

/* ---------------------------------------------------- en deux : géométrie */

const TOITURES: { cle: RoofType; libelle: string }[] = [
  { cle: 'PLATE', libelle: 'Plate' },
  { cle: 'PENTE', libelle: 'En pente' },
  { cle: 'MIXTE', libelle: 'Mixte' },
]

export function EtapeGeometrie() {
  const [perimeter, setPerimetre] = useState(88)
  const [nbFloors, setEtages] = useState(6)
  const [builtArea, setEmprise] = useState(420)
  const [windowPct, setPartVitree] = useState(30)
  const [roofType, setToiture] = useState<RoofType>('PLATE')

  // La surface de plancher se déduit de l'emprise et des étages, comme le fait le
  // registre quand il ne la porte pas. C'est elle qui donne la part des communs.
  const floorArea = builtArea * nbFloors
  const m = computeProjectMetrics({
    perimeter, nbFloors, builtArea, floorArea, windowPct: windowPct / 100, roofType, floorHeight: 2.7,
  })

  return (
    <section className="bg-[#f5f7fa] px-5 py-24 md:py-32">
      <Etape rang="deux" />
      <GrandTitre>Vous posez vos ratios,<br className="hidden sm:block" /> les métrés suivent.</GrandTitre>
      <Chapo>
        Rien n'est deviné. La surface de façade, la surface vitrée, l'échafaudage et les
        communs sortent de coefficients que vous voyez et que vous changez.
      </Chapo>

      <div className="mx-auto mt-14 grid max-w-[980px] items-start gap-6 md:grid-cols-2 md:gap-8">
        <Panneau titre="Le bâtiment">
          <div className="space-y-6">
            <Curseur libelle="Périmètre" valeur={perimeter} min={30} max={200} pas={1} suffixe="ml" onChange={setPerimetre} />
            <Curseur libelle="Étages" valeur={nbFloors} min={1} max={14} pas={1} suffixe="niveaux" onChange={setEtages} />
            <Curseur libelle="Emprise au sol" valeur={builtArea} min={100} max={1200} pas={10} suffixe="m²" onChange={setEmprise} />
            <Curseur libelle="Part vitrée de la façade" valeur={windowPct} min={5} max={60} pas={1} suffixe="%" onChange={setPartVitree} />
            <div>
              <span className="text-[14px] text-[#1d1d1f]/75">Toiture</span>
              <div className="mt-2 inline-flex rounded-full bg-[#f5f7fa] p-0.5">
                {TOITURES.map((t) => (
                  <button
                    key={t.cle}
                    onClick={() => setToiture(t.cle)}
                    aria-pressed={roofType === t.cle}
                    className={cn('rounded-full px-3.5 py-1.5 text-[13px] transition-colors',
                      roofType === t.cle ? 'bg-white font-medium shadow-sm' : 'text-[#86868b] hover:text-[#1d1d1f]')}
                  >
                    {t.libelle}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Panneau>

        <Panneau titre="Ce que Diagly en tire">
          <Resultat libelle="Surface de façade" valeur={`${fr(m.facade)} m²`} note="périmètre × étages × 2.70 m" fort />
          <Resultat libelle="Surface vitrée" valeur={`${fr(m.windows)} m²`} />
          <Resultat libelle="Façade à traiter" valeur={`${fr(m.opaqueFacade)} m²`} note="hors vitrage" />
          <Resultat libelle="Échafaudage" valeur={`${fr(m.scaffolding)} m²`} note="× 1.10" />
          <Resultat libelle="Toiture" valeur={m.roof == null ? 'à préciser' : `${fr(m.roof)} m²`} />
          <Resultat libelle="Communs" valeur={`${fr(m.commons)} m²`} note="10 % du plancher" />
          <p className="mt-5 text-[12px] leading-relaxed text-[#86868b]">
            Ces six valeurs sont calculées par la fonction de l'application, appelée ici telle
            quelle. Dans un dossier, chacune se reprend à la main quand le terrain dit autre chose.
          </p>
        </Panneau>
      </div>
    </section>
  )
}

/* -------------------------------------------------- en quatre : les états */

/**
 * Le poste CFC 226 du catalogue, avec ses quatre constats tels qu'ils sont écrits.
 * Ce ne sont pas des exemples rédigés pour la page : c'est le texte que le
 * diagnostiqueur lit sur son téléphone devant la façade.
 */
const POSTE = {
  code: '226',
  nom: 'Parois extérieures - Crépi',
  unite: 'CHF/m²',
}

const ETATS: { cle: ElementState; libelle: string; couleur: string; constat: string }[] = [
  {
    cle: 'TRES_BON', libelle: 'Très bon', couleur: 'bg-emerald-500',
    constat: "Absence de dommage visible. Absence de décollement en formation. Crépi propre. Poursuite des travaux d'entretien non comptabilisée.",
  },
  {
    cle: 'BON', libelle: 'Bon', couleur: 'bg-emerald-500',
    constat: 'Enduit dégradé, détériorations du crépi (< 20% de la surface de la façade). Piquage et nouveau crépi de fond sur les zones dégradées. Nettoyage et peinture de toute la façade.',
  },
  {
    cle: 'MOYEN', libelle: 'Moyen', couleur: 'bg-amber-500',
    constat: 'Enduit dégradé, détériorations du crépi (20% à 50% de la surface de la façade). Piquage et nouveau crépi de fond et de finition sur les zones dégradées. Nettoyage et peinture de toute la façade.',
  },
  {
    cle: 'MAUVAIS', libelle: 'Mauvais', couleur: 'bg-red-500',
    constat: 'Enduit dégradé, détériorations du crépi (50% à 100% de la surface de façade). Piquage complet du crépi existant. Nettoyage de la maçonnerie, nouveau crépi de fond et de finition sur toute la façade.',
  },
]

const PRIORITE_TEXTE: Record<string, string> = {
  I: 'à traiter sans attendre',
  II: 'à planifier',
  III: 'à surveiller',
}

export function EtapeEtat() {
  const [choisi, setChoisi] = useState<ElementState>('MOYEN')
  const etat = ETATS.find((e) => e.cle === choisi)!
  const priorite = STATE_PRIORITY[choisi]

  return (
    <section className="px-5 py-24 md:py-32">
      <Etape rang="quatre" />
      <GrandTitre>Un état, et tout<br className="hidden sm:block" /> ce qu'il engage.</GrandTitre>
      <Chapo>
        Devant la façade, personne ne tranche entre « bon » et « moyen » sur quatre boutons nus.
        Chaque état porte son constat, ses travaux et la priorité qu'il déclenche.
      </Chapo>

      <div className="mx-auto mt-14 max-w-[860px]">
        <div className="rounded-[20px] border border-black/[0.07] bg-white p-6 shadow-[0_20px_60px_-34px_rgba(20,45,90,0.4)] sm:p-8">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[15px] font-semibold">
              <span className="mr-2 font-mono text-[13px] text-[#86868b]">{POSTE.code}</span>
              {POSTE.nom}
            </p>
            <span className="text-[12px] text-[#86868b]">{POSTE.unite}</span>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ETATS.map((e) => (
              <button
                key={e.cle}
                onClick={() => setChoisi(e.cle)}
                aria-pressed={choisi === e.cle}
                className={cn('flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-2.5 text-[14px] font-medium transition-colors',
                  choisi === e.cle ? 'border-[#0167EA] bg-[#0167EA]/[0.06] text-[#0167EA]' : 'border-black/[0.08] text-[#1d1d1f]/70 hover:border-black/20')}
              >
                <span className={cn('h-2 w-2 shrink-0 rounded-full', e.couleur)} aria-hidden="true" />
                {e.libelle}
              </button>
            ))}
          </div>

          <div className="mt-6 rounded-xl bg-[#f5f7fa] p-5">
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#86868b]">
              Constat et travaux, au catalogue
            </p>
            <p className="mt-2.5 text-[16px] leading-relaxed text-[#1d1d1f]/85">{etat.constat}</p>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
            <span className="inline-flex items-center gap-2 text-[15px]">
              <span className={cn('rounded-md px-2 py-0.5 text-[13px] font-semibold text-white',
                priorite === 'I' ? 'bg-red-500' : priorite === 'II' ? 'bg-amber-500' : 'bg-[#64748b]')}>
                Priorité {priorite}
              </span>
              <span className="text-[#6e6e73]">{PRIORITE_TEXTE[priorite]}</span>
            </span>
            <span className="text-[13px] text-[#86868b]">Déduite de l'état, modifiable à la main.</span>
          </div>
        </div>

        <p className="mx-auto mt-8 max-w-2xl text-center text-[14px] leading-relaxed text-[#6e6e73]">
          Ces quatre textes viennent du catalogue d'un bureau romand, tels qu'il les a écrits.
          Le vôtre les remplace, poste par poste.
        </p>
      </div>
    </section>
  )
}

/* ------------------------------------------------ en cinq : le chiffrage */

const TVA = 8.1

export function EtapeChiffrage() {
  const [quantite, setQuantite] = useState(1188)
  const [prix, setPrix] = useState(95)
  const [honoraryPct, setHonoraires] = useState(12)
  const [reservePct, setReserve] = useState(12)

  // La cascade du serveur : honoraires sur le hors taxes, réserve sur le total
  // majoré des honoraires, TVA sur le sous-total. Jamais l'une sur l'autre.
  const ht = quantite * prix
  const honoraires = (ht * honoraryPct) / 100
  const apresHonoraires = ht + honoraires
  const reserve = (apresHonoraires * reservePct) / 100
  const sousTotal = apresHonoraires + reserve
  const tva = (sousTotal * TVA) / 100
  const total = sousTotal + tva

  return (
    <section className="bg-[#f5f7fa] px-5 py-24 md:py-32">
      <Etape rang="cinq" />
      <GrandTitre>Chaque montant<br className="hidden sm:block" /> dit d'où il vient.</GrandTitre>
      <Chapo>
        Prix du catalogue multiplié par la quantité, puis vos honoraires, votre réserve et la
        TVA suisse. Aucune majoration cachée, aucun coefficient maison.
      </Chapo>

      <div className="mx-auto mt-14 grid max-w-[980px] items-start gap-6 md:grid-cols-2 md:gap-8">
        <Panneau titre="Le poste">
          <div className="space-y-6">
            <Curseur libelle="Quantité" valeur={quantite} min={50} max={4000} pas={10} suffixe="m²" onChange={setQuantite} />
            <Curseur libelle="Prix unitaire" valeur={prix} min={10} max={400} pas={5} suffixe="CHF/m²" onChange={setPrix} />
            <Curseur libelle="Honoraires" valeur={honoraryPct} min={0} max={25} pas={1} suffixe="%" onChange={setHonoraires} />
            <Curseur libelle="Réserve" valeur={reservePct} min={0} max={25} pas={1} suffixe="%" onChange={setReserve} />
          </div>
          <p className="mt-6 text-[12px] leading-relaxed text-[#86868b]">
            Le prix unitaire est le vôtre : dans un dossier, il vient de votre catalogue. Les
            prix d'un bureau ne se publient pas sur une page comme celle-ci.
          </p>
        </Panneau>

        <Panneau titre="La cascade">
          <Resultat libelle="Hors taxes" valeur={`${fr(ht)} CHF`} note={`${fr(quantite)} × ${prix}`} />
          <Resultat libelle={`Honoraires ${honoraryPct} %`} valeur={`${fr(honoraires)} CHF`} />
          <Resultat libelle={`Réserve ${reservePct} %`} valeur={`${fr(reserve)} CHF`} note="sur HT + honoraires" />
          <Resultat libelle="Sous-total" valeur={`${fr(sousTotal)} CHF`} />
          <Resultat libelle={`TVA ${TVA} %`} valeur={`${fr(tva)} CHF`} />
          <Resultat libelle="Total TTC" valeur={`${fr(total)} CHF`} fort />
          <p className="mt-5 rounded-xl bg-[#0167EA]/[0.06] px-4 py-3 font-mono text-[12px] leading-relaxed text-[#0167EA]">
            Total = HT × (1 + honoraires) × (1 + réserve) × 1.081
          </p>
          <p className="mt-3 text-[12px] leading-relaxed text-[#86868b]">
            La même formule est affichée sous le total dans l'application, et l'estimation
            est annoncée à ±15 %.
          </p>
        </Panneau>
      </div>
    </section>
  )
}
