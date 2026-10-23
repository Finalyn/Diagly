import { ArrowRight, ClipboardList, DoorOpen, Handshake, type LucideIcon } from 'lucide-react'
import { METIERS } from '@/lib/partenaires'
import { Apparition, Bouton, Conteneur, EnTeteCentre } from '../ui'
import { typo } from '../typo'
import { DEVENIR_PARTENAIRE } from '../contenu'

/**
 * Le diagnostic comme outil de prospection, et les partenaires qui prennent
 * la suite : trois étapes, du diagnostic proposé au propriétaire jusqu'à la
 * mise en relation, puis la carte bleue qui invite les professionnels à
 * rejoindre l'annuaire.
 *
 * La mise en relation décrite est celle de l'application (pages/app/
 * Partenaires.tsx) : un annuaire tenu par l'équipe Diagly, qu'on contacte
 * depuis le dossier, son résumé joint si on le souhaite, la réponse arrivant
 * dans la messagerie de l'utilisateur. Devenir partenaire passe par un
 * e-mail : l'équipe ajoute chaque partenaire elle-même, après vérification.
 */

const ETAPES: { icone: LucideIcon; titre: string; texte: string }[] = [
  {
    icone: DoorOpen,
    titre: 'Proposez le diagnostic',
    texte: 'À un propriétaire, une régie ou une PPE. Avec Diagly, il s’établit vite : les plans sont mesurés pour vous, la visite est guidée. C’est votre porte d’entrée chez le client.',
  },
  {
    icone: ClipboardList,
    titre: 'Le rapport montre les travaux',
    texte: 'L’état de chaque ouvrage, les priorités et les coûts par code CFC : le propriétaire voit ce qu’il faut faire. C’est le point de départ du mandat de rénovation.',
  },
  {
    icone: Handshake,
    titre: 'La suite, avec des partenaires',
    texte: 'Un certificat énergétique (CECB®), un ingénieur, un diagnostic amiante ou des offres de travaux : vous contactez depuis le dossier un professionnel de l’annuaire Diagly. Sa réponse arrive dans votre messagerie.',
  },
]

const METIERS_AFFICHES = METIERS.filter((m) => m.id !== 'AUTRE').map((m) => m.label)

export function Partenaires() {
  return (
    <section id="partenaires" aria-labelledby="titre-partenaires" className="scroll-mt-24 bg-[#f3f7fe] py-20 sm:py-28">
      <Conteneur>
        <EnTeteCentre
          id="titre-partenaires"
          titre="Chaque diagnostic ouvre un projet."
          sousTitre="Le diagnostic n’est pas qu’un rapport : c’est votre meilleure façon d’entrer chez un propriétaire. Et pour ce que vous ne faites pas vous-même, Diagly vous met en relation avec ses partenaires."
        />

        <ol className="mt-12 grid gap-4 sm:mt-16 lg:grid-cols-3">
          {ETAPES.map((e, i) => (
            <Apparition as="li" key={e.titre} delai={i * 90} className="relative flex flex-col rounded-[28px] bg-white p-7 ring-1 ring-black/[0.05]">
              <div className="flex items-center justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef5ff] text-[#0167EA]">
                  <e.icone className="h-5 w-5" aria-hidden="true" />
                </span>
                <span aria-hidden="true" className="text-[44px] font-medium leading-none tracking-[-0.05em] text-[#0167EA]/15">{i + 1}</span>
              </div>
              <h3 className="mt-6 text-[19px] font-semibold tracking-[-0.02em] text-[#0b1220]">{typo(e.titre)}</h3>
              <p className="mt-2 text-pretty text-[15px] leading-[1.6] text-[#6b7280]">{typo(e.texte)}</p>
            </Apparition>
          ))}
        </ol>

        {/* Devenir partenaire : la carte bleue, comme la tuile CFC de « Aux normes suisses ». */}
        <Apparition className="relative mt-4 overflow-hidden rounded-[28px] bg-gradient-to-br from-[#0167EA] via-[#0b5bd3] to-[#0b3d8f] p-7 text-white sm:p-10">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:linear-gradient(to_left,#000,transparent_85%)]"
          />
          <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-12">
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-white/70">Devenir partenaire</p>
              <h3 className="mt-3 max-w-[22ch] text-balance text-[clamp(1.6rem,3vw,2.3rem)] font-medium leading-[1.1] tracking-[-0.035em]">
                {typo('Recevez des demandes qui arrivent avec leur dossier.')}
              </h3>
              <p className="mt-4 max-w-[40rem] text-pretty text-[15.5px] leading-[1.6] text-white/75">
                {typo('Architecte, ingénieur, expert ou entreprise : rejoignez l’annuaire des partenaires Diagly. Les bureaux qui établissent un diagnostic vous contactent depuis leur dossier, avec son résumé s’ils le souhaitent : des demandes concrètes, sur des bâtiments déjà relevés.')}
              </p>
              <ul className="mt-6 flex flex-wrap gap-2">
                {METIERS_AFFICHES.map((m) => (
                  <li key={m} className="rounded-full bg-white/10 px-3 py-1.5 text-[13px] font-medium text-white ring-1 ring-inset ring-white/15">{m}</li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col items-start gap-3 lg:items-end">
              <Bouton href={DEVENIR_PARTENAIRE} variante="clair" className="px-6">
                Devenir partenaire<ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Bouton>
              <p className="max-w-[17rem] text-[13px] leading-[1.5] text-white/60 lg:text-right">
                {typo('L’annuaire est tenu par l’équipe Diagly : chaque partenaire y est ajouté après vérification.')}
              </p>
            </div>
          </div>
        </Apparition>
      </Conteneur>
    </section>
  )
}
