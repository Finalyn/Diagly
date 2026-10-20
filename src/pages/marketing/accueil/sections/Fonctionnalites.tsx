import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MENTION_CECB } from '@/lib/marque-cecb'
import { Apparition, Conteneur, EnTeteCentre, LienFleche, MarqueIA } from '../ui'
import { typo } from '../typo'
import { IPad, type NomIPad } from '../maquettes/IPad'
import { AnalysePlan } from '../maquettes/AnalysePlan'
import { Departs } from '../maquettes/Departs'
import { HorsLigne } from '../maquettes/HorsLigne'
import { BadgeAppStore } from '../BadgeAppStore'
import { Demo } from './Demo'

/**
 * Les fonctionnalités, la page /fonctionnalites : une section simple par
 * outil, qu'on comprend d'un coup d'œil.
 *
 * Toutes suivent le même modèle : le titre, deux lignes de texte, trois
 * coches et le lien pour essayer d'un côté, le visuel de l'autre (de vrais
 * écrans sur iPad ou sur iPhone, ou le plan lu par l'IA). Les côtés et les
 * fonds alternent d'une section à l'autre. Pas de numéros, pas de menu : on
 * descend, simplement. La première, les quatre façons d'ouvrir un dossier,
 * pose ses quatre cartes sous un titre centré ; la réservation d'une démo
 * ferme la page.
 */

interface Ecran { nom: NomIPad; alt: string }

export function Fonctionnalites() {
  return (
    <div id="fonctionnalites">
      <section id="demarrer" aria-labelledby="titre-demarrer" className="scroll-mt-24 bg-white py-20 sm:py-28">
        <Conteneur>
          <EnTeteCentre
            id="titre-demarrer"
            titre="Partez de ce que vous avez."
            sousTitre="Des plans, une adresse, un document ou un certificat énergétique : Diagly pré-remplit le dossier, et vous relisez avant de créer."
          />
          <Departs />
          <p className="mt-6 text-center text-[12.5px] leading-relaxed text-[#8a8f98]">{MENTION_CECB}</p>
        </Conteneur>
      </section>

      <SectionSimple
        id="metres"
        produit="Métrés IA"
        fond="gris"
        titre="L’IA tire les métrés de vos plans."
        texte="Déposez les plans du bâtiment : l’IA lit chaque feuille comme un métreur, et vous ne validez que ce qui est juste."
        coches={['L’échelle vérifiée sur une cote', 'Les pièces, façades et fenêtres dessinées', 'Rien ne compte avant votre validation']}
        visuel={<Panneau><AnalysePlan /></Panneau>}
      />

      <SectionSimple
        id="quantites"
        produit="Plan et tableau"
        inverse
        titre="Les quantités, en plan ou en tableau."
        texte="Chaque forme validée s’additionne, étage par étage. Le plan et le tableau montrent les mêmes métrés."
        coches={['Les étages types multipliés', 'Les surfaces SIA 416', 'L’export Excel en un clic']}
        visuel={
          <PaireIPad
            principal={{ nom: 'metres-plan', alt: 'Les métrés sur iPad : l’étage type aux pièces colorées avec leurs surfaces, et le panneau des quantités.' }}
            second={{ nom: 'metres-tableau', alt: 'Les métrés en vue Tableau : les pièces de chaque feuille, avec leur étage et leur surface.' }}
          />
        }
      />

      <SectionSimple
        id="releve"
        produit="Relevé terrain"
        fond="gris"
        titre="Sur place, l’iPad vous guide."
        texte="Le tour du bâtiment, ouvrage par ouvrage : une photo, l’état constaté, puis « Suivant »."
        coches={['Le Guide IA vérifie chaque photo', 'Les travaux suivent l’état choisi', 'Même sans réseau, au sous-sol']}
        visuel={
          <PaireIPad
            principal={{ nom: 'releve-guide-ia', alt: 'Le relevé d’une fenêtre en bois sur iPad, avec le Guide IA qui confirme le CFC 221.0 et suggère l’état Mauvais.' }}
            second={{ nom: 'releve-etapes', alt: 'Le tour du bâtiment, de la façade aux aménagements extérieurs, avec les relevés de chaque partie.' }}
          />
        }
      />

      <SectionSimple
        id="hors-ligne"
        produit="Hors connexion"
        inverse
        titre="Pas de réseau ? Pas de problème."
        texte="Au sous-sol ou dans une cave, le relevé continue. Tout reste sur l’appareil et part dès que le réseau revient."
        coches={['« Préparer pour le terrain » met le dossier sur l’appareil', 'Les relevés et les photos gardés sur place', 'L’envoi se fait tout seul au retour du réseau']}
        visuel={<Panneau><HorsLigne /></Panneau>}
      />

      <SectionSimple
        id="base"
        produit="Base de données CFC"
        fond="gris"
        titre="Votre base de prix CFC."
        texte="Chaque ouvrage avec ses travaux et son prix pour chaque état. Commune au bureau : une correction profite à tous les devis."
        coches={['Rangée selon la nomenclature CFC', 'Un prix et des travaux par état', 'Chaque modification garde son auteur']}
        visuel={
          <PaireIPad
            principal={{ nom: 'base-article', alt: 'La base de données sur iPad : les fenêtres du code CFC 221 et la fiche Fenêtres en bois, avec son prix par état.' }}
            second={{ nom: 'base-liste', alt: 'La liste des articles du code CFC 221, avec leur prix pour chaque état.' }}
          />
        }
      />

      <SectionSimple
        id="chiffrage"
        produit="Chiffrage"
        inverse
        titre="Le chiffrage se fait tout seul."
        texte="Les quantités du bâtiment, multipliées par les prix de votre base. Chaque montant dit d’où il vient."
        coches={['Honoraires, réserve et TVA 8,1 % inclus', 'Des variantes comparées, avec leur écart', 'Une estimation à plus ou moins 15 %']}
        visuel={
          <PaireIPad
            principal={{ nom: 'couts', alt: 'Les coûts sur iPad : les éléments comptés, dont les portes palières réparties en bois et en métal.' }}
            second={{ nom: 'variantes', alt: 'Les variantes comparées au diagnostic de base, avec leur total et leur écart.' }}
          />
        }
      />

      <SectionSimple
        id="presentation"
        produit="Présentation 16:9"
        fond="gris"
        titre="Vos métrés, prêts à projeter."
        texte="Un bouton fait de vos métrés une présentation 16:9, à montrer en réunion ou à envoyer en PDF."
        coches={['Chaque élément repéré sur son plan', 'Le total par niveau', 'À l’écran ou en PDF']}
        visuel={
          <PaireIPad
            principal={{ nom: 'presentation-reperage', alt: 'La présentation des métrés : les portes palières repérées sur le plan de l’étage type, puis leur total.' }}
            second={{ nom: 'presentation-titre', alt: 'La page de titre de la présentation « Plans de repérage et métrés ».' }}
          />
        }
      />

      <SectionSimple
        id="rapports"
        produit="Rapports"
        inverse
        titre="Le rapport, à votre en-tête."
        texte="Le rapport se construit pendant la visite. Il sort à votre logo, prêt à remettre au client."
        coches={['À votre logo et votre couleur', 'En PDF, ou par lien au client', 'Les données en Excel, CSV ou JSON']}
        visuel={
          <PaireIPad
            principal={{ nom: 'rapport-couverture', alt: 'La couverture du rapport de diagnostic de la Résidence Les Tilleuls, sur iPad.' }}
            second={{ nom: 'rapport-devis', alt: 'Le devis estimatif du rapport, poste par poste.' }}
          />
        }
      />

      <SectionSimple
        id="assistant"
        produit="Assistant Diagly"
        fond="gris"
        titre="Une question ? Demandez à l’assistant."
        texte="Il lit les relevés et les coûts de vos dossiers, et répond avec vos chiffres."
        coches={['Plusieurs dossiers à la fois', 'Des réponses à toucher', 'Une API pour vos propres outils']}
        visuel={<PaireIPad principal={{ nom: 'assistant', alt: 'L’assistant Diagly sur iPad : une demande de budget pour la gérance et sa réponse chiffrée.' }} />}
      />

      <SectionSimple
        id="app"
        produit="Apps"
        inverse
        titre="Sur iPhone, iPad, Mac et PC."
        texte="L’app iPhone et iPad pour le terrain, Diagly installable sur Mac et PC pour le bureau, et tout le reste dans le navigateur, sans rien installer."
        coches={['L’app iPhone et iPad, avec la navigation d’iOS', 'Installable sur Mac et PC', 'Ou directement dans le navigateur']}
        visuel={<IPhones />}
        action={<BadgeAppStore />}
      />

      <Demo />
    </div>
  )
}

/**
 * Une section simple : le titre, la phrase, trois coches et le lien pour
 * essayer d'un côté ; le visuel de l'autre. `inverse` met le visuel à gauche
 * sur grand écran ; sur téléphone, le texte vient toujours en premier.
 */
function SectionSimple({ id, produit, titre, texte, coches, visuel, inverse, fond = 'blanc', action }: {
  id: string
  /** Le nom du produit, au-dessus du titre. */
  produit: string
  titre: string
  texte: string
  coches: string[]
  visuel: ReactNode
  inverse?: boolean
  fond?: 'blanc' | 'gris'
  action?: ReactNode
}) {
  const titreId = `titre-${id}`
  return (
    <section id={id} aria-labelledby={titreId} className={cn('scroll-mt-24 overflow-x-clip py-20 sm:py-28', fond === 'gris' ? 'bg-[#f7f8fa]' : 'bg-white')}>
      <Conteneur>
        {/* Le visuel garde la colonne large, qu'il soit à droite ou à gauche. */}
        <div className={cn('grid gap-12 lg:items-center lg:gap-16', inverse ? 'lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]' : 'lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]')}>
          <Apparition className={cn(inverse && 'lg:order-2')}>
            <p className="mb-4 flex items-center gap-2 text-[14px] font-semibold text-[#0167EA]">
              <MarqueIA className="h-4 w-4" />{produit}
            </p>
            <h2 id={titreId} className="max-w-[15ch] text-balance text-[clamp(2.1rem,4.4vw,3.3rem)] font-medium leading-[1.04] tracking-[-0.045em] text-[#0b1220]">
              {typo(titre)}
            </h2>
            <p className="mt-5 max-w-[28rem] text-pretty text-[17px] leading-[1.6] text-[#6b7280]">{typo(texte)}</p>
            <ul className="mt-7 space-y-3">
              {coches.map((c) => (
                <li key={c} className="flex items-center gap-3 text-[15.5px] font-medium text-[#0b1220]">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0167EA] text-white">
                    <Check className="h-3.5 w-3.5" strokeWidth={2.8} aria-hidden="true" />
                  </span>
                  {typo(c)}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              {action}
              <LienFleche href="#demo">Réserver une démo</LienFleche>
            </div>
          </Apparition>
          <Apparition className={cn('min-w-0', inverse && 'lg:order-1')} delai={80}>{visuel}</Apparition>
        </div>
      </Conteneur>
    </section>
  )
}

/** La carte grise qui porte une interface dessinée. */
function Panneau({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[28px] border border-black/[0.06] bg-[#eef0f3] p-2 sm:p-2.5">
      <div className="relative rounded-[22px] bg-gradient-to-b from-white via-[#f7f9fc] to-[#e9f1fd] p-3 sm:p-6">{children}</div>
    </div>
  )
}

/**
 * Un ou deux iPad. Le principal prend presque toute la place ; le second,
 * plus petit, est posé en avant sur son coin bas, pour que les deux pages se
 * lisent. Chacun arrive couché et se redresse au défilement
 * (accueil-redresse, index.css).
 */
function PaireIPad({ principal, second }: { principal: Ecran; second?: Ecran }) {
  return (
    <div>
      <div className={cn(second ? 'w-[92%]' : 'w-full')}>
        <div className="accueil-redresse">
          <IPad nom={principal.nom} alt={principal.alt} sizes="(min-width: 1024px) 640px, 92vw" />
        </div>
      </div>
      {second && (
        <div className="relative z-10 -mt-[22%] ml-auto w-[52%]">
          <div className="accueil-redresse">
            <IPad nom={second.nom} alt={second.alt} sizes="(min-width: 1024px) 360px, 50vw" />
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * L'app sur iPhone, en vraies captures prises sur l'appareil : le sommaire
 * d'un dossier et le relevé d'une porte palière, avec la barre native d'iOS.
 */
function IPhones() {
  const ecrans = [
    { nom: 'iphone-dossier', alt: 'Le sommaire d’un dossier sur iPhone : appeler, itinéraire, visite, préparer pour le terrain, puis le bâtiment, l’analyse et les documents.' },
    { nom: 'iphone-releve-photo', alt: 'Le relevé d’une porte palière en bois sur iPhone : la photo prise sur place, les vignettes et le bouton Suivant.' },
  ]
  return (
    <div className="mx-auto flex max-w-[560px] items-start justify-center gap-[6%]">
      {ecrans.map((e, i) => (
        <img
          key={e.nom}
          src={`/accueil/iphone/${e.nom}-900.webp`}
          srcSet={`/accueil/iphone/${e.nom}-480.webp 480w, /accueil/iphone/${e.nom}-900.webp 900w`}
          sizes="(min-width: 640px) 260px, 42vw"
          alt={e.alt}
          width={1000}
          height={2071}
          loading="lazy"
          decoding="async"
          className={cn('block h-auto w-[47%] [filter:drop-shadow(0_24px_30px_rgba(11,31,68,0.25))]', i === 1 && 'mt-[12%]')}
        />
      ))}
    </div>
  )
}
