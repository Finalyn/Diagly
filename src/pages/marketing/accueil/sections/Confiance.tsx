import { BadgeCheck, Cpu, Landmark, LockKeyhole, Server, Users } from 'lucide-react'
import { Apparition, Conteneur } from '../ui'
import { typo } from '../typo'
import { EnTeteSection } from './blocs'

/**
 * Sécurité et Suisse. Chaque carte décrit un fait vérifiable dans le code ou
 * l'hébergement ; celle de l'IA dit où partent les données qu'on lui confie,
 * plutôt que de laisser croire que tout reste en Suisse.
 */
const CARTES = [
  {
    icone: Server,
    titre: 'Hébergé en Suisse',
    texte: 'Les dossiers, les photos et les plans sont hébergés chez Infomaniak, en Suisse, et circulent en connexion chiffrée.',
  },
  {
    icone: LockKeyhole,
    titre: 'Double authentification',
    texte: 'Par application d’authentification ou par code reçu par e-mail. Les mots de passe ne sont jamais stockés en clair.',
  },
  {
    icone: Users,
    titre: 'Des rôles par membre',
    texte: 'Propriétaire, administrateur, membre ou lecture seule : chacun dans l’équipe a les droits de son rôle.',
  },
  {
    icone: Landmark,
    titre: 'Les références suisses',
    texte: 'Codes CFC, surfaces selon SIA 416, TVA à 8,1 %, montants en francs et textes en français de Suisse romande.',
  },
  {
    icone: BadgeCheck,
    titre: 'L’IA propose, vous décidez',
    texte: 'Une forme dessinée, un état suggéré, un document lu : rien n’entre dans un métré, un relevé ou un dossier sans votre validation.',
  },
  {
    icone: Cpu,
    titre: 'Une IA dite par son nom',
    texte: 'Les analyses par l’IA (photos, plans, documents, assistant) sont confiées à un fournisseur externe, Anthropic, hors de Suisse.',
  },
]

export function Confiance() {
  return (
    <section id="confiance" aria-labelledby="titre-confiance" className="scroll-mt-16 bg-white py-20 sm:py-28">
      <Conteneur>
        <EnTeteSection
          id="titre-confiance"
          centre
          surtitre="Sécurité et Suisse"
          titre="Vos données sont hébergées en Suisse."
          chapo="Diagly est conçu en Suisse romande, pour les normes et les usages des bureaux suisses."
        />
        <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CARTES.map((c, i) => (
            <Apparition as="li" key={c.titre} delai={(i % 3) * 70} className="rounded-2xl bg-[#f5f7fa] p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#0167EA] ring-1 ring-black/[0.05]"><c.icone className="h-5 w-5" aria-hidden="true" /></span>
              <h3 className="mt-4 text-[17px] font-semibold">{c.titre}</h3>
              <p className="mt-1 text-[15px] leading-relaxed text-[#545458]">{typo(c.texte)}</p>
            </Apparition>
          ))}
        </ul>
      </Conteneur>
    </section>
  )
}
