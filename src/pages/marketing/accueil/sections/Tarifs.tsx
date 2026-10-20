import { useId, useState } from 'react'
import { ArrowUpRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  CONTACT, ENGAGEMENT_MOIS, PLUS, PRIX_DIAGNOSTIC, PRO, SEUIL_PLUS, SEUIL_PRO,
  coutAbonnement, coutUnite, francs, remise,
} from '../contenu'
import { Apparition, Bouton, Conteneur, EnTeteCentre, FOCUS } from '../ui'
import { typo } from '../typo'

/**
 * Les tarifs : le diagnostic à l'unité, les abonnements Plus et Pro (des
 * diagnostics compris chaque mois, les suivants moins chers ; souscrits pour
 * un an, affichés par mois) et l'offre Entreprise sur devis. Les montants
 * viennent de contenu.ts ; rien n'est écrit en dur ici.
 *
 * Dessous, un calculateur : on choisit combien de diagnostics on fait par
 * mois, et il dit quelle formule revient le moins cher, et de combien.
 */

interface Offre {
  nom: string
  prix: string
  unite?: string
  /** Une précision sous le prix : la durée d'engagement. */
  condition?: string
  accroche: string
  points: string[]
  phare?: boolean
  action: { libelle: string; href: string }
}

const OFFRES: Offre[] = [
  {
    nom: 'À l’unité',
    prix: francs(PRIX_DIAGNOSTIC),
    unite: 'par diagnostic',
    accroche: 'Pour un diagnostic de temps en temps.',
    points: ['Un diagnostic complet, des plans au rapport', 'Métrés par l’IA, relevé et chiffrage', 'Sans abonnement'],
    action: { libelle: 'Réserver une démo', href: '#demo' },
  },
  {
    nom: PLUS.nom,
    prix: francs(PLUS.prixMois),
    unite: 'par mois',
    condition: `Engagement d’un an, soit ${francs(PLUS.prixMois * ENGAGEMENT_MOIS)} par an`,
    accroche: 'Pour un bureau qui diagnostique chaque mois.',
    points: [
      `${PLUS.inclus} diagnostics compris chaque mois`,
      `Les suivants à ${francs(PLUS.prixSuivant)}, ${remise(PLUS)} % de moins`,
      `Moins cher que l’unité dès ${SEUIL_PLUS} diagnostics par mois`,
      'Une heure de formation incluse la première année',
    ],
    phare: true,
    action: { libelle: 'Réserver une démo', href: '#demo' },
  },
  {
    nom: PRO.nom,
    prix: francs(PRO.prixMois),
    unite: 'par mois',
    condition: `Engagement d’un an, soit ${francs(PRO.prixMois * ENGAGEMENT_MOIS)} par an`,
    accroche: 'Pour un bureau dont le diagnostic est le métier.',
    points: [
      `${PRO.inclus} diagnostics compris chaque mois`,
      `Les suivants à ${francs(PRO.prixSuivant)}, ${remise(PRO)} % de moins`,
      `Plus avantageux que ${PLUS.nom} dès ${SEUIL_PRO} diagnostics par mois`,
      'Une heure de formation incluse la première année',
    ],
    action: { libelle: 'Réserver une démo', href: '#demo' },
  },
  {
    nom: 'Entreprise',
    prix: 'Sur devis',
    accroche: 'Pour un parc immobilier ou plusieurs équipes.',
    points: ['Un volume de diagnostics sur mesure', 'Plusieurs équipes dans un même compte', 'Relié à vos outils par l’API et les webhooks'],
    action: { libelle: 'Demander un devis', href: CONTACT },
  },
]

export function Tarifs() {
  return (
    <section id="tarifs" aria-labelledby="titre-tarifs" className="scroll-mt-16 bg-[#f5f7fa] py-20 sm:py-28">
      <Conteneur>
        <EnTeteCentre
          id="titre-tarifs"
          titre="Payez au diagnostic, ou abonnez-vous"
          sousTitre={`Un diagnostic à ${francs(PRIX_DIAGNOSTIC)}, ou un abonnement qui en comprend chaque mois : ${PLUS.nom} dès ${francs(PLUS.prixMois)} par mois, ${PRO.nom} pour les gros volumes, Entreprise sur devis. La démo est offerte.`}
        />

        <ul className="mx-auto mt-12 grid max-w-[1200px] gap-4 sm:mt-16 md:grid-cols-2 xl:grid-cols-4">
          {OFFRES.map((o, i) => (
            <Apparition as="li" key={o.nom} delai={i * 60} className="flex">
              <CarteOffre offre={o} />
            </Apparition>
          ))}
        </ul>

        <Calculateur />
      </Conteneur>
    </section>
  )
}

function CarteOffre({ offre: o }: { offre: Offre }) {
  return (
    <article className={cn('flex w-full flex-col rounded-[24px] bg-white p-7',
      o.phare ? 'ring-2 ring-[#0167EA] shadow-[0_24px_60px_-34px_rgba(1,103,234,0.6)]' : 'ring-1 ring-black/[0.08]')}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[19px] font-semibold tracking-[-0.015em]">{typo(o.nom)}</h3>
        {o.phare && <span className="rounded-full bg-[#0167EA] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">Recommandé</span>}
      </div>
      <p className="mt-1.5 text-[14px] leading-snug text-[#545458] sm:min-h-[2.6rem]">{typo(o.accroche)}</p>

      <p className="mt-6 flex flex-wrap items-baseline gap-x-1.5">
        <span className="text-[38px] font-semibold leading-none tracking-[-0.035em] tabular-nums">{o.prix}</span>
        {o.unite && <span className="text-[15px] text-[#545458]">{o.unite}</span>}
      </p>
      {o.condition && <p className="mt-2 text-[13px] text-[#6b7280]">{typo(o.condition)}</p>}

      <ul className="mt-6 flex-1 space-y-3">
        {o.points.map((pt) => (
          <li key={pt} className="flex gap-3">
            <Check className="mt-[3px] h-4 w-4 shrink-0 text-[#0167EA]" aria-hidden="true" />
            <span className="text-[15px] leading-snug">{typo(pt)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-8">
        {o.action.href.startsWith('mailto:') ? (
          <a href={o.action.href} className={cn('flex min-h-11 w-full items-center justify-center gap-2 rounded-full text-[15px] font-medium text-[#0167EA] ring-1 ring-inset ring-[#0167EA] transition-colors hover:bg-[#0167EA]/[0.06]', FOCUS)}>
            {o.action.libelle}<ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </a>
        ) : (
          <Bouton href={o.action.href} variante={o.phare ? 'plein' : 'contour'} className="w-full">{o.action.libelle}</Bouton>
        )}
      </div>
    </article>
  )
}

/**
 * Le calculateur : combien de diagnostics par mois, et ce que coûte chaque
 * formule ce mois-là. La moins chère est mise en avant, avec ce qu'elle fait
 * économiser par rapport à l'unité.
 */
function Calculateur() {
  const [n, setN] = useState(SEUIL_PLUS)
  const id = useId()
  const formules = [
    { nom: 'À l’unité', detail: `${n} × ${francs(PRIX_DIAGNOSTIC)}`, montant: coutUnite(n) },
    { nom: PLUS.nom, detail: n > PLUS.inclus ? `${PLUS.inclus} compris, ${n - PLUS.inclus} × ${francs(PLUS.prixSuivant)}` : `${PLUS.inclus} compris`, montant: coutAbonnement(PLUS, n) },
    { nom: PRO.nom, detail: n > PRO.inclus ? `${PRO.inclus} compris, ${n - PRO.inclus} × ${francs(PRO.prixSuivant)}` : `${PRO.inclus} compris`, montant: coutAbonnement(PRO, n) },
  ]
  const meilleure = formules.reduce((a, b) => (b.montant < a.montant ? b : a))
  const economie = coutUnite(n) - meilleure.montant
  const max = Math.max(...formules.map((f) => f.montant))

  return (
    <Apparition className="mx-auto mt-6 max-w-[1200px] rounded-[24px] bg-white p-6 ring-1 ring-black/[0.08] sm:p-8">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:gap-12">
        <div>
          <label htmlFor={id} className="block text-[17px] font-semibold tracking-[-0.01em] text-[#0b1220]">
            Combien de diagnostics faites-vous par mois&nbsp;?
          </label>
          <div className="mt-5 flex items-center gap-4">
            <input
              id={id}
              type="range"
              min={1}
              max={30}
              value={n}
              onChange={(e) => setN(Number(e.target.value))}
              className="h-2 w-full cursor-pointer accent-[#0167EA]"
            />
            <output htmlFor={id} className="w-12 shrink-0 text-right text-[28px] font-semibold tabular-nums tracking-[-0.03em] text-[#0b1220]">{n}</output>
          </div>
          <p aria-live="polite" className="mt-5 text-pretty text-[15px] leading-[1.6] text-[#545458]">
            {economie > 0
              ? <>{typo(`${meilleure.nom} revient le moins cher : `)}<strong className="font-semibold text-[#0b1220]">{francs(economie)}</strong>{typo(' de moins par mois qu’à l’unité.')}</>
              : typo('À ce rythme, l’unité revient le moins cher.')}
          </p>
        </div>

        <div className="space-y-4">
          {formules.map((f) => (
            <Barre key={f.nom} libelle={f.nom} detail={f.detail} montant={f.montant} max={max} gagne={f === meilleure} />
          ))}
          <p className="text-[12.5px] text-[#8a8f98]">{typo('Les abonnements se souscrivent pour un an ; leur prix est donné par mois. Au-delà de 30 diagnostics par mois, l’offre Entreprise est sur devis.')}</p>
        </div>
      </div>
    </Apparition>
  )
}

function Barre({ libelle, detail, montant, max, gagne }: { libelle: string; detail: string; montant: number; max: number; gagne: boolean }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-[14px]">
        <span className="min-w-0">
          <span className="font-medium text-[#0b1220]">{libelle}</span>
          <span className="ml-2 text-[13px] text-[#8a8f98]">{detail}</span>
        </span>
        <span className={cn('font-semibold tabular-nums', gagne ? 'text-[#0167EA]' : 'text-[#0b1220]')}>{francs(montant)} / mois</span>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-[#eef0f3]">
        <div
          className={cn('h-full rounded-full transition-[width] duration-500 ease-out', gagne ? 'bg-[#0167EA]' : 'bg-[#c4cad4]')}
          style={{ width: `${(montant / max) * 100}%` }}
        />
      </div>
    </div>
  )
}
