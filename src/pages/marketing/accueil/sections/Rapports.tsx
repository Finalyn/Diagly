import { Download, Link2, Palette, Printer } from 'lucide-react'
import { Echelle, Maquette } from '../ui'
import { PageDeGarde, PageDevis } from '../maquettes/Rapport'
import { EnTeteSection, Fonctionnalite, Point } from './blocs'

/**
 * Les rapports : les documents que l'onglet Rapports propose réellement
 * (pages/app/ProjectRapports.tsx), leur apparence, et ce qui en sort.
 */
const DOCUMENTS = ['Rapport complet', 'Rapport de diagnostic', 'Rapport de l’existant', 'Rapport photo', 'Plans de repérage et métrés']

export function Rapports() {
  return (
    <Fonctionnalite
      id="rapports"
      labelledBy="titre-rapports"
      inverse
      texte={
        <>
          <EnTeteSection
            id="titre-rapports"
            surtitre="Les rapports"
            titre="Un rapport prêt à remettre, à votre en-tête."
            chapo="Le rapport se construit pendant la visite. Choisissez le document, sa photo de garde, votre logo et votre couleur, puis imprimez-le en PDF ou envoyez un lien."
          />
          <ul className="mt-8 flex flex-wrap gap-2" aria-label="Les documents disponibles">
            {DOCUMENTS.map((d) => (
              <li key={d} className="rounded-full bg-[#f5f7fa] px-3.5 py-1.5 text-[14px] font-medium text-[#1d1d1f] ring-1 ring-black/[0.05]">{d}</li>
            ))}
          </ul>
          <div className="mt-10 grid gap-7">
            <Point icone={Palette} titre="À votre image">
              Logo, couleur, raison sociale et auteur, réglés pour tout le bureau ou pour un seul dossier. La photo de garde se choisit parmi celles du relevé.
            </Point>
            <Point icone={Printer} titre="En PDF, page par page">
              Le document s’affiche en pages A4, telles qu’elles sortiront de l’imprimante : chapitres, devis estimatif, annexes.
            </Point>
            <Point icone={Link2} titre="Un lien pour le client">
              Il lit le rapport sans compte et sans rien installer, sans vos notes internes. Le lien se révoque d’un geste.
            </Point>
            <Point icone={Download} titre="Vos données, exportées">
              Excel, CSV ou JSON, pour votre tableur ou votre outil de gestion.
            </Point>
          </div>
        </>
      }
      maquette={
        <Maquette description="Deux pages A4 du rapport complet : la page de garde « Rapport de diagnostic » avec la photo de l’immeuble, le bandeau de couleur et l’identité du bureau, et une page du devis estimatif à plus ou moins 15 %, rangé par priorité.">
          <div className="relative mx-auto max-w-[620px] pb-[8%]">
            <div className="w-[64%] overflow-hidden rounded-[4px] shadow-[0_30px_60px_-30px_rgba(16,36,80,0.5)] ring-1 ring-black/[0.06]">
              <Echelle largeur={595} hauteur={842}><PageDeGarde /></Echelle>
            </div>
            <div className="absolute bottom-0 right-0 w-[56%] overflow-hidden rounded-[4px] shadow-[0_30px_60px_-24px_rgba(16,36,80,0.55)] ring-1 ring-black/[0.06]">
              <Echelle largeur={595} hauteur={842}><PageDevis /></Echelle>
            </div>
            <div className="absolute bottom-[1%] left-[5%] flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-[13px] font-medium shadow-[0_12px_30px_-12px_rgba(16,36,80,0.45)] ring-1 ring-black/[0.06]">
              <Link2 className="h-4 w-4 text-[#0167EA]" />Partager au client
            </div>
          </div>
        </Maquette>
      }
    />
  )
}
