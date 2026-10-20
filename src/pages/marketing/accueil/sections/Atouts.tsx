import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Apparition, Bouton, Conteneur, EnTeteCentre, FOCUS } from '../ui'
import { typo } from '../typo'
import { IPad, type NomIPad } from '../maquettes/IPad'

/**
 * Ce que Diagly fait pour vous, en quatre grandes cartes : chacune dit un
 * bénéfice en une ligne, montre l'écran qui le tient (un iPad qui dépasse
 * par le bas de la carte, comme une porte entrouverte) et mène au détail sur
 * la page Fonctionnalités. Toute la carte est cliquable.
 *
 * Les cartes alternent large et étroite d'un rang à l'autre ; la base de
 * données prend toute la largeur, son iPad à droite. Dessous, les deux
 * portes : tout voir, ou essayer.
 */

const CARTES: { id: string; surtitre: string; titre: string; texte: string; ecran: NomIPad; alt: string; large: boolean; pleine?: boolean }[] = [
  {
    id: 'metres',
    surtitre: 'Métrés par l’IA',
    titre: 'Vos plans, mesurés pour vous.',
    texte: 'L’IA lit chaque feuille, dessine les pièces et compte les portes. Vous validez, les quantités sont prêtes.',
    ecran: 'metres-plan',
    alt: 'Les métrés sur iPad : l’étage type aux pièces colorées avec leurs surfaces, et le panneau des quantités.',
    large: true,
  },
  {
    id: 'releve',
    surtitre: 'Relevé guidé',
    titre: 'Sur place, rien n’est oublié.',
    texte: 'Le tour du bâtiment en 7 étapes, photo par photo, et le Guide IA qui vérifie chaque ouvrage.',
    ecran: 'releve-guide-ia',
    alt: 'Le relevé d’une fenêtre en bois sur iPad, avec le Guide IA qui suggère l’état Mauvais.',
    large: false,
  },
  {
    id: 'base',
    surtitre: 'Base de données',
    titre: 'Votre base de prix CFC, au cœur du chiffrage.',
    texte: 'Chaque ouvrage avec ses travaux et son prix pour chaque état, rangé selon la nomenclature CFC. Commune au bureau, chaque modification garde son auteur.',
    ecran: 'base-article',
    alt: 'La base de données sur iPad : les fenêtres de la nomenclature CFC 221 et la fiche Fenêtres en bois, avec ses travaux et son prix par état.',
    large: true,
    pleine: true,
  },
  {
    id: 'chiffrage',
    surtitre: 'Chiffrage CFC',
    titre: 'Le coût, ouvrage par ouvrage.',
    texte: 'Les prix de votre base CFC posés sur les quantités du bâtiment, et les variantes comparées.',
    ecran: 'couts',
    alt: 'Les coûts sur iPad : les éléments comptés, dont les portes palières en bois et en métal.',
    large: false,
  },
  {
    id: 'rapports',
    surtitre: 'Rapports',
    titre: 'Le rapport sort à votre en-tête.',
    texte: 'Rapport complet, devis estimatif et présentation 16:9, prêts à remettre ou à partager par lien.',
    ecran: 'rapport-couverture',
    alt: 'La couverture du rapport de diagnostic de la Résidence Les Tilleuls, sur iPad.',
    large: true,
  },
]

export function Atouts() {
  return (
    <section id="atouts" aria-labelledby="titre-atouts" className="scroll-mt-24 bg-white py-20 sm:py-28">
      <Conteneur>
        <EnTeteCentre
          id="titre-atouts"
          titre="Tout le diagnostic, dans un seul outil"
          sousTitre="Diagly fait le travail répétitif, des plans au rapport. Vous gardez l’œil de l’expert, et le temps de l’exercer."
        />

        <ul className="mt-12 grid gap-4 sm:mt-16 lg:grid-cols-12">
          {CARTES.map((c, i) => (
            <Apparition as="li" key={c.id} delai={(i % 2) * 90} className={cn(c.pleine ? 'lg:col-span-12' : c.large ? 'lg:col-span-7' : 'lg:col-span-5')}>
              <Link
                to={`/fonctionnalites#${c.id}`}
                className={cn('group flex h-full flex-col overflow-hidden rounded-[28px] border border-black/[0.06] bg-[#f4f5f7] transition-colors hover:border-[#0167EA]/25', c.pleine && 'lg:flex-row lg:items-center', FOCUS)}
              >
                <div className={cn('p-6 sm:p-8', c.pleine && 'lg:w-[40%] lg:shrink-0 lg:p-12')}>
                  <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#0167EA]">{c.surtitre}</p>
                  <h3 className="mt-2 text-balance text-[clamp(1.4rem,2.3vw,1.85rem)] font-medium leading-[1.15] tracking-[-0.03em] text-[#0b1220]">{typo(c.titre)}</h3>
                  <p className="mt-2.5 max-w-[30rem] text-pretty text-[15px] leading-[1.6] text-[#6b7280]">{typo(c.texte)}</p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-[14.5px] font-medium text-[#0167EA]">
                    En savoir plus<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                </div>
                {/* L'iPad dépasse par le bas : la carte le coupe. */}
                <div className={cn('relative mt-auto aspect-[16/9] overflow-hidden', c.pleine && 'lg:mt-0 lg:flex-1 lg:self-stretch lg:aspect-auto lg:min-h-[400px]')}>
                  <div className={cn('absolute inset-x-[7%] top-[4%] transition-transform duration-500 ease-out group-hover:-translate-y-2', c.pleine && 'lg:inset-x-auto lg:left-0 lg:right-[-8%] lg:top-[10%]')}>
                    <IPad nom={c.ecran} alt={c.alt} sizes={c.large ? '(min-width: 1024px) 620px, 90vw' : '(min-width: 1024px) 440px, 90vw'} />
                  </div>
                </div>
              </Link>
            </Apparition>
          ))}
        </ul>

        <Apparition className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Bouton href="#demo" className="w-full px-6 sm:w-auto">
            Réserver une démo<ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Bouton>
          <Bouton to="/fonctionnalites" variante="contour" className="w-full px-6 sm:w-auto">Voir toutes les fonctionnalités</Bouton>
        </Apparition>
      </Conteneur>
    </section>
  )
}
