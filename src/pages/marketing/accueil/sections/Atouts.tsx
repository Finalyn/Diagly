import { useEffect, useRef, useState, type ComponentType } from 'react'
import { ArrowRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Accent, Apparition, Bouton, Conteneur, EnTeteCentre, LienFleche } from '../ui'
import { useMouvementReduit } from '../mouvement'
import { typo } from '../typo'
import { IPad } from '../maquettes/IPad'
import { SceneMetres, SceneRapport } from '../maquettes/Scenes'

/**
 * Les principales fonctionnalités, comme sur un site classique : une rangée
 * par outil, le texte d'un côté et, de l'autre, une scène qui le raconte en
 * quelques secondes (maquettes/Scenes.tsx), en alternant les côtés : le
 * plan lu par l'IA, le rez monté et ses ouvrages par CFC, puis, sans
 * animation, le relevé guidé et la base de prix en vrais écrans sur iPad, et
 * les premières pages du rapport en éventail, à l'en-tête du bureau. Les
 * liens de la base et du rapport demandent une démonstration. Les métrés rappellent qu'on peut partir sans plan : les trois
 * autres façons d'ouvrir un dossier (/fonctionnalites#demarrer).
 *
 * Une scène se joue quand elle arrive à l'écran, puis se rejoue tant qu'on
 * la regarde, après une pause sur son image finale ; la photo du relevé et
 * le bâtiment des métrés, qu'on fait tourner, ne se jouent qu'une fois. En
 * mouvement réduit, elle reste sur son image finale.
 */

interface Outil {
  id: string
  titre: string
  texte: string
  points: string[]
  /** Une autre façon d'y arriver, sous les coches : pour les métrés, quand on n'a pas de plan. */
  sinon?: { question: string; texte: string }
  /** Où mène le lien, s'il ne va pas à la section de l'outil : une page, ou la démo plus bas. */
  lien?: { to?: string; href?: string; libelle: string }
  Scene: ComponentType<{ joue: boolean }>
  /** Le temps de la scène, en secondes. */
  duree: number
  /** Faux pour une scène qui se joue une fois, sans repartir (la photo qui se recadre, le bâtiment qu'on fait tourner), ou qui ne bouge pas. */
  boucle?: boolean
}

const OUTILS: Outil[] = [
  {
    id: 'metres',
    titre: 'Les métrés, tirés de vos plans',
    texte: 'L’IA lit vos plans, en PDF ou photographiés, dessine les pièces et compte portes et fenêtres. Vous validez.',
    points: ['Échelle vérifiée sur une cote', 'Pièces, façades, portes et fenêtres', 'Surfaces SIA 416 étage par étage'],
    sinon: {
      question: 'Pas de plan ?',
      texte: 'Partez d’une adresse, d’un document ou d’un certificat énergétique : Diagly pré-remplit le dossier, et vous vérifiez les dimensions.',
    },
    lien: { to: '/fonctionnalites#demarrer', libelle: 'Les quatre façons de démarrer' },
    Scene: SceneMetres,
    duree: 11,
    boucle: false,
  },
  {
    id: 'releve',
    titre: 'Le relevé, guidé sur place',
    texte: 'Le tour du bâtiment, ouvrage par ouvrage, photo par photo, sur iPad ou iPhone.',
    points: ['7 étapes, de la façade aux abords', 'Le Guide IA vérifie chaque photo', 'Même sans réseau, au sous-sol'],
    Scene: EcranReleve,
    duree: 0,
    boucle: false,
  },
  {
    id: 'chiffrage',
    titre: 'Une base de prix faite par le métier',
    texte: 'Chaque ouvrage, rangé par code CFC, avec ses travaux et son prix pour chaque état. Posés sur les quantités du bâtiment, ils font le devis tout seul.',
    points: ['Un prix et des travaux pour chaque état', 'Une correction profite à tous les devis', 'Honoraires, réserve et TVA compris'],
    lien: { href: '#demo', libelle: 'Demander une présentation de la base de données' },
    Scene: EcranBase,
    duree: 0,
    boucle: false,
  },
  {
    id: 'rapports',
    titre: 'Le rapport, avec votre logo',
    texte: 'Votre logo et vos coordonnées en tête de chaque page : le client reçoit le rapport de votre bureau. Tout vient du dossier, sans rien ressaisir.',
    points: ['Rapport, devis estimatif, présentation 16:9', 'Votre logo et votre couleur sur chaque page', 'En PDF ou par lien au client'],
    lien: { href: '#demo', libelle: 'Demander un rapport démo' },
    Scene: SceneRapport,
    duree: 0,
    boucle: false,
  },
]

/**
 * La base de prix, en vrai écran sur iPad : la liste du code CFC 221 et la
 * fiche des fenêtres en bois, avec son prix pour chaque état. Une image
 * fixe : ici, pas d'animation.
 */
function EcranBase() {
  return (
    <IPad
      nom="base-article"
      alt="La base de prix de Diagly sur iPad : les articles du code CFC 221 et la fiche Fenêtres en bois, avec son prix pour chaque état."
      sizes="(min-width: 1024px) 620px, 92vw"
    />
  )
}

/** Le relevé guidé en vrai écran sur iPad : la photo d'une porte palière, prise sur place, et le Guide IA. */
function EcranReleve() {
  return (
    <IPad
      nom="releve-guide-ia"
      alt="Le relevé guidé de Diagly sur iPad : la photo d’une porte palière en bois prise dans la cage d’escalier, et le Guide IA."
      sizes="(min-width: 1024px) 620px, 92vw"
    />
  )
}

/** La pause sur l'image finale avant que la scène ne se rejoue, en secondes. */
const PAUSE = 3

export function Atouts() {
  return (
    <section id="atouts" aria-labelledby="titre-atouts" className="scroll-mt-24 bg-white py-20 sm:py-28">
      <Conteneur>
        <EnTeteCentre
          id="titre-atouts"
          titre={<>Tout le diagnostic, <Accent>dans un seul outil</Accent></>}
          sousTitre="L’IA propose, vous décidez. Des plans au rapport, chaque étape du diagnostic vit dans le même dossier."
        />

        <div className="mt-16 space-y-20 sm:mt-20 sm:space-y-28 lg:space-y-32">
          {OUTILS.map((o, i) => <Rangee key={o.id} outil={o} inverse={i % 2 === 1} />)}
        </div>

        <Apparition className="mt-20 flex flex-col items-center justify-center gap-3 sm:mt-24 sm:flex-row">
          <Bouton to="/fonctionnalites" className="w-full px-6 sm:w-auto">
            Découvrir toutes les fonctionnalités<ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Bouton>
          <Bouton href="#demo" variante="contour" className="w-full px-6 sm:w-auto">Réserver une démo</Bouton>
        </Apparition>
      </Conteneur>
    </section>
  )
}

/**
 * Une rangée : le texte de l'outil et sa scène, à droite, ou à gauche quand
 * elle est `inverse`. Sur téléphone, le texte passe au-dessus. La scène
 * repart du début chaque fois que sa clé change : à son arrivée à l'écran,
 * puis à chaque tour.
 */
function Rangee({ outil: o, inverse }: { outil: Outil; inverse: boolean }) {
  const scene = useRef<HTMLDivElement>(null)
  const [enVue, setEnVue] = useState(false)
  const [tour, setTour] = useState(0)
  const reduit = useMouvementReduit()
  const joue = enVue && !reduit

  useEffect(() => {
    const el = scene.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const ob = new IntersectionObserver(([e]) => setEnVue(e.isIntersecting), { threshold: 0.35 })
    ob.observe(el)
    return () => ob.disconnect()
  }, [])

  useEffect(() => {
    if (!joue || o.boucle === false) return
    const t = window.setInterval(() => setTour((n) => n + 1), (o.duree + PAUSE) * 1000)
    return () => window.clearInterval(t)
  }, [joue, o.duree, o.boucle])

  return (
    <article
      id={`outil-${o.id}`}
      className={cn(
        'grid items-center gap-8 lg:gap-16',
        inverse ? 'lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]' : 'lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]',
      )}
    >
      <div className={cn(inverse && 'lg:order-2')}>
        <h3 className="text-balance text-[clamp(1.6rem,2.6vw,2.2rem)] font-semibold leading-[1.12] tracking-[-0.03em] text-[#0b1220]">{typo(o.titre)}</h3>
        <p className="mt-4 text-pretty text-[16px] leading-[1.6] text-[#6b7280] sm:text-[17px]">{typo(o.texte)}</p>
        <ul className="mt-6 space-y-2.5">
          {o.points.map((pt) => (
            <li key={pt} className="flex gap-3 text-[15px] leading-snug text-[#1f2937] sm:text-[16px]">
              <Check className="mt-[3px] h-4 w-4 shrink-0 text-[#0167EA]" aria-hidden="true" />{typo(pt)}
            </li>
          ))}
        </ul>
        {o.sinon && (
          <>
            <div aria-hidden="true" className="mt-6 h-px max-w-[26rem] bg-black/[0.07]" />
            <p className="mt-5 max-w-[30rem] text-pretty text-[15px] leading-[1.6] text-[#6b7280] sm:text-[16px]">
              <strong className="font-semibold text-[#0b1220]">{typo(o.sinon.question)}</strong> {typo(o.sinon.texte)}
            </p>
          </>
        )}
        <LienFleche
          to={o.lien?.href ? undefined : o.lien?.to ?? `/fonctionnalites#${o.id}`}
          href={o.lien?.href}
          className="mt-5"
        >
          {o.lien?.libelle ?? 'En savoir plus'}
        </LienFleche>
      </div>
      <div ref={scene} className={cn(inverse && 'lg:order-1')}>
        <o.Scene key={joue ? `joue-${tour}` : 'fixe'} joue={joue} />
      </div>
    </article>
  )
}
