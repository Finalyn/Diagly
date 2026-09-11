import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Surtitre } from './elements'
import visite from '@/assets/vitrine/app-visite.png'

/**
 * Le parcours, en quatre plans qui se succèdent au défilement.
 *
 * Une liste de quatre colonnes se lit en diagonale et ne retient rien. Ici la
 * page se cale sur une étape à la fois : on ne peut pas passer à la suivante
 * sans avoir eu la précédente sous les yeux, ce qui est exactement l'ordre du
 * travail réel.
 *
 * Le défilement ne fait que choisir l'index. Aucun calcul de position par image,
 * aucune animation pilotée à la main : la bascule est une transition CSS, donc
 * elle reste fluide même quand le doigt va vite, et « animation réduite » la
 * désactive sans rien casser.
 */

interface Slide {
  cle: string
  numero: string
  titre: string
  texte: string
  visuel: React.ReactNode
}

/* ------------------------------------------------------------ les visuels */

/** Une ligne de relevé, libellé à gauche et valeur à droite. */
function Ligne({ libelle, valeur, note, secondaire }: {
  libelle: string; valeur: string; note?: string; secondaire?: boolean
}) {
  return (
    <div className={cn('items-baseline justify-between gap-4 border-b border-black/[0.06] py-2 last:border-0',
      secondaire ? 'hidden sm:flex' : 'flex')}>
      <span className="text-[14px] text-[#1d1d1f]/70">
        {libelle}
        {note && <span className="ml-2 text-[11px] text-[#86868b]">{note}</span>}
      </span>
      <span className="shrink-0 text-[14px] font-semibold tabular-nums">{valeur}</span>
    </div>
  )
}

function Cadre({ titre, enTete, children }: { titre: string; enTete?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="w-full max-h-full overflow-hidden rounded-[20px] border border-black/[0.07] bg-white p-5 shadow-[0_24px_70px_-40px_rgba(20,45,90,0.5)] sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#86868b]">{titre}</p>
        {enTete}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  )
}

/** Étape 1 : ce que l'adresse rend, et ce qui reste à la main. */
function VisuelAdresse() {
  return (
    <Cadre
      titre="Depuis l'adresse"
      enTete={
        <span className="inline-flex rounded-full bg-[#f5f7fa] p-0.5 text-[11px]">
          <span className="rounded-full bg-white px-2.5 py-1 font-medium shadow-sm">Automatique</span>
          <span className="px-2.5 py-1 text-[#86868b]">Manuel</span>
        </span>
      }
    >
      <Ligne libelle="Année de construction" valeur="1972" />
      <Ligne libelle="Nombre d'étages" valeur="6" />
      <Ligne libelle="Nombre de logements" valeur="18" />
      <Ligne libelle="Emprise au sol" valeur="420 m²" />
      <Ligne libelle="Périmètre" valeur="88 ml" note="déduit" />
      <Ligne secondaire libelle="Surface de plancher" valeur="2'520 m²" note="déduite" />
      <Ligne secondaire libelle="Parcelle" valeur="508" />
      <p className="mt-4 text-[12px] leading-relaxed text-[#86868b]">
        Les valeurs marquées « déduit » ne viennent pas du registre : Diagly les a calculées.
        Chaque champ reste modifiable à la main.
      </p>
    </Cadre>
  )
}

/** Étape 2 : les coefficients qui transforment la géométrie en métrés. */
function VisuelRatios() {
  return (
    <Cadre titre="Les ratios du dossier">
      <Ligne libelle="Part vitrée de la façade" valeur="30 %" />
      <Ligne libelle="Hauteur d'étage" valeur="2.70 m" />
      <Ligne libelle="Toiture en pente" valeur="× 1.35" />
      <Ligne secondaire libelle="Toiture mixte" valeur="× 1.175" />
      <Ligne libelle="Échafaudage sur façade" valeur="× 1.10" />
      <Ligne libelle="Communs sur plancher" valeur="10 %" />
      <Ligne secondaire libelle="Pièces d'eau par logement" valeur="2" />
      <p className="mt-4 rounded-xl bg-[#f5f7fa] px-3.5 py-3 font-mono text-[12px] leading-relaxed text-[#0167EA]">
        façade = périmètre × étages × hauteur
      </p>
    </Cadre>
  )
}

/** Étape 3 : l'éditeur, tel qu'il est sur le téléphone pendant la visite. */
function VisuelEditeur() {
  return (
    <div className="mx-auto flex h-full w-full max-w-[260px] items-center justify-center">
      <img
        src={visite}
        alt="Sur téléphone, les quatre états proposés pour un ouvrage, chacun avec son constat et les travaux qu'il engage."
        loading="lazy"
        className="max-h-full w-auto rounded-[20px] border border-black/[0.07] object-contain shadow-[0_30px_80px_-40px_rgba(20,45,90,0.7)]"
      />
    </div>
  )
}

/** Étape 4 : les sorties, avec ce que chacune contient. */
const SORTIES = [
  { nom: 'Excel', detail: 'plusieurs onglets, colonnes renommables' },
  { nom: 'CSV', detail: 'postes, plan de travaux ou bâtiment' },
  { nom: 'JSON', detail: 'la structure entière, pour vos outils' },
  { nom: 'PDF', detail: 'le rapport mis en page' },
  { nom: 'Lien de partage', detail: 'lecture seule, pour la gérance' },
]

function VisuelExport() {
  return (
    <Cadre titre="Sortir le dossier">
      <ul className="space-y-2.5">
        {SORTIES.map((s) => (
          <li key={s.nom} className="flex items-baseline gap-3">
            <span className="w-[118px] shrink-0 rounded-lg bg-[#0167EA]/[0.07] px-2.5 py-1 text-center text-[13px] font-semibold text-[#0167EA]">
              {s.nom}
            </span>
            <span className="text-[13px] leading-snug text-[#1d1d1f]/70">{s.detail}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[12px] leading-relaxed text-[#86868b]">
        Le modèle de colonnes se définit une fois et se retrouve au prochain export.
      </p>
    </Cadre>
  )
}

/* ------------------------------------------------------------- les étapes */

const SLIDES: Slide[] = [
  {
    cle: 'adresse',
    numero: '01',
    titre: 'Tout commence par une adresse',
    texte: "Diagly interroge le registre fédéral des bâtiments et en tire l'année de construction, les étages, les logements, l'emprise au sol et la parcelle. Ce qu'il ne trouve pas, il le dit ; ce qu'il déduit, il le signale. Rien n'est verrouillé : chaque valeur se corrige à la main.",
    visuel: <VisuelAdresse />,
  },
  {
    cle: 'ratios',
    numero: '02',
    titre: 'Vous posez vos ratios',
    texte: "La géométrie devient des métrés par des coefficients que vous voyez et que vous changez : part vitrée, hauteur d'étage, pente de toiture, débord d'échafaudage, part des communs. Ce sont eux qui font la surface de façade et la surface à isoler.",
    visuel: <VisuelRatios />,
  },
  {
    cle: 'editeur',
    numero: '03',
    titre: 'Vous relevez sur place',
    texte: "Vous photographiez l'ouvrage depuis l'application, puis vous retenez un état parmi quatre, chacun affichant son constat et les travaux qu'il engage. L'IA vous en propose un si vous le demandez. La priorité et le montant suivent aussitôt.",
    visuel: <VisuelEditeur />,
  },
  {
    cle: 'export',
    numero: '04',
    titre: 'Vous ressortez avec tout',
    texte: "Excel, CSV, JSON, PDF, et un lien de partage en lecture seule pour la gérance. Les colonnes portent vos intitulés. Ce que vous avez saisi ne reste pas enfermé ici.",
    visuel: <VisuelExport />,
  },
]

/* ------------------------------------------------------------ la mécanique */

export function ParcoursSlides() {
  const zone = useRef<HTMLDivElement>(null)
  const [actif, setActif] = useState(0)

  useEffect(() => {
    let demande = 0
    const relire = () => {
      demande = 0
      const el = zone.current
      if (!el) return
      const { top, height } = el.getBoundingClientRect()
      // La scène est haute d'un écran : la course utile est le reste.
      const course = height - window.innerHeight
      if (course <= 0) return
      const part = Math.min(Math.max(-top / course, 0), 0.999)
      setActif(Math.floor(part * SLIDES.length))
    }
    const auDefilement = () => {
      if (demande) return
      demande = requestAnimationFrame(relire)
    }
    relire()
    window.addEventListener('scroll', auDefilement, { passive: true })
    window.addEventListener('resize', auDefilement)
    return () => {
      if (demande) cancelAnimationFrame(demande)
      window.removeEventListener('scroll', auDefilement)
      window.removeEventListener('resize', auDefilement)
    }
  }, [])

  return (
    <section
      id="methode"
      ref={zone}
      className="relative scroll-mt-0"
      style={{ height: `${SLIDES.length * 100}vh` }}
    >
      <div className="sticky top-0 flex h-screen flex-col overflow-hidden px-5 pb-10 pt-[110px] sm:pb-14 sm:pt-[124px]">
        <Surtitre>Comment ça marche</Surtitre>

        {/* La barre d'avancement : quatre segments, celui en cours se remplit. */}
        <div className="mx-auto mb-10 flex w-full max-w-[1000px] gap-2" aria-hidden="true">
          {SLIDES.map((s, i) => (
            <span key={s.cle} className="h-[3px] flex-1 overflow-hidden rounded-full bg-black/[0.08]">
              <span
                className={cn('block h-full rounded-full bg-[#0167EA] transition-transform duration-500 ease-out',
                  i <= actif ? 'scale-x-100' : 'scale-x-0')}
                style={{ transformOrigin: 'left' }}
              />
            </span>
          ))}
        </div>

        {/* Les quatre plans occupent le même espace ; seul celui en cours se voit. */}
        <div className="relative mx-auto w-full max-w-[1000px] flex-1">
          {SLIDES.map((s, i) => {
            const courant = i === actif
            return (
              <article
                key={s.cle}
                aria-hidden={!courant}
                className={cn(
                  'absolute inset-0 grid grid-rows-[auto_minmax(0,1fr)] items-stretch gap-6 transition-all duration-500 ease-out',
                  'md:grid-cols-2 md:grid-rows-1 md:items-center md:gap-14',
                  courant
                    ? 'pointer-events-auto opacity-100 motion-safe:translate-y-0'
                    : 'pointer-events-none opacity-0 motion-safe:translate-y-5',
                )}
              >
                <div className="md:order-1">
                  <p className="font-mono text-[13px] tracking-[0.1em] text-[#0167EA]">{s.numero}</p>
                  <h3 className="mt-3 text-balance text-[clamp(1.7rem,3.6vw,2.6rem)] font-semibold leading-[1.08] tracking-[-0.028em]">
                    {s.titre}
                  </h3>
                  <p className="mt-4 max-w-[46ch] text-[clamp(0.98rem,1.6vw,1.15rem)] leading-relaxed text-[#6e6e73]">
                    {s.texte}
                  </p>
                </div>
                <div className="flex min-h-0 items-center justify-center md:order-2">{s.visuel}</div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
