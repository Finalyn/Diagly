import { Braces, KeyRound, Webhook } from 'lucide-react'
import { Apparition, Conteneur, Echelle, Maquette } from '../ui'
import { typo } from '../typo'
import { EcranAssistant } from '../maquettes/EcranAssistant'
import { EnTeteSection } from './blocs'

/**
 * L'assistant et les intégrations : ce qui relie Diagly au reste du travail.
 * Le parc immobilier, annoncé dans le menu mais pas encore construit, n'est
 * pas présenté ici.
 */
const INTEGRATIONS = [
  {
    icone: KeyRound,
    titre: 'API en lecture',
    texte: 'Une clé d’API par outil : diagnostics, éléments, coûts et plan de travaux, documentés au format OpenAPI.',
  },
  {
    icone: Webhook,
    titre: 'Webhooks',
    texte: 'Diagnostic finalisé, rapport généré, élément modifié, plan de travaux mis à jour : chaque événement part signé.',
  },
  {
    icone: Braces,
    titre: 'Serveur MCP',
    texte: 'Vos outils d’IA interrogent vos diagnostics : synthèse du parc, recherche, éléments, coûts, plan de travaux.',
  },
]

export function Assistant() {
  return (
    <section id="assistant" aria-labelledby="titre-assistant" className="scroll-mt-16 bg-[#f5f7fa] py-20 sm:py-28">
      <Conteneur>
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-6">
            <EnTeteSection
              id="titre-assistant"
              surtitre="Assistant et intégrations"
              titre="Une question sur un dossier ? Posez-la."
              chapo="Rattachez un ou plusieurs dossiers à la conversation : l’assistant Diagly en lit les relevés et les coûts. Quand une précision lui manque, il vous la demande, avec des réponses à toucher plutôt qu’à taper."
            />
          </div>
          <Apparition className="mx-auto w-full max-w-[520px] lg:col-span-6" delai={80}>
            <Maquette description="L’assistant Diagly : à la demande « Prépare un budget de travaux pour la gérance », il répond sur le dossier rattaché et pose une question à choix sur l’horizon, cinq ans, dix ans ou tout le relevé.">
              <div className="overflow-hidden rounded-[20px] shadow-[0_30px_70px_-30px_rgba(16,36,80,0.45)] ring-1 ring-black/[0.06]">
                <Echelle largeur={520} hauteur={640}><EcranAssistant /></Echelle>
              </div>
            </Maquette>
          </Apparition>
        </div>

        <ul className="mt-16 grid gap-4 md:grid-cols-3">
          {INTEGRATIONS.map((x, i) => (
            <Apparition as="li" key={x.titre} delai={i * 70} className="rounded-2xl bg-white p-6 ring-1 ring-black/[0.06]">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef5ff] text-[#0167EA]"><x.icone className="h-5 w-5" aria-hidden="true" /></span>
              <h3 className="mt-4 text-[17px] font-semibold">{x.titre}</h3>
              <p className="mt-1 text-[15px] leading-relaxed text-[#545458]">{typo(x.texte)}</p>
            </Apparition>
          ))}
        </ul>
      </Conteneur>
    </section>
  )
}
