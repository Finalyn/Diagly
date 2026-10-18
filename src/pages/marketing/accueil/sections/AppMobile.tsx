import { Bell, Fingerprint, PanelBottom, ScanLine, Tablet, WifiOff } from 'lucide-react'
import { Apparition, Conteneur, Maquette } from '../ui'
import { Telephone } from '../maquettes/Appareils'
import { EcranConnexion, EcranDossier } from '../maquettes/EcranApp'
import { EnTeteSection, Point } from './blocs'

/**
 * L'app iPhone et iPad. Elle est distribuée en test (TestFlight), pas encore
 * publiée : le badge de l'App Store le dit et ne mène nulle part, plutôt que
 * d'annoncer un téléchargement qui n'aboutirait pas.
 */
export function AppMobile() {
  return (
    <section id="app" aria-labelledby="titre-app" className="scroll-mt-16 overflow-hidden bg-[#0b1220] py-20 text-white sm:py-28">
      <Conteneur>
        <div className="grid items-center gap-14 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <EnTeteSection
              id="titre-app"
              sombre
              surtitre="L’app iPhone et iPad"
              titre="Faite pour le chantier, pas seulement pour le bureau."
              chapo="Le même Diagly, en application : la navigation d’iOS, son scanner de documents, les relevés gardés hors ligne et la connexion avec Apple ou Google."
            />
            <div className="mt-10 grid gap-7 sm:grid-cols-2">
              <Point sombre icone={PanelBottom} titre="La barre d’iOS">
                Sur iPhone, la barre du bas est dessinée par iOS, en Liquid Glass sur iOS 26.
              </Point>
              <Point sombre icone={WifiOff} titre="Hors ligne">
                Les relevés s’enregistrent sur l’appareil et partent dès que le réseau revient.
              </Point>
              <Point sombre icone={ScanLine} titre="Le scanner d’iOS">
                Un plan papier passe au scanner de documents et devient un plan à métrer.
              </Point>
              <Point sombre icone={Fingerprint} titre="Apple ou Google">
                Continuer avec Apple ou avec Google, ou avec votre adresse e-mail.
              </Point>
              <Point sombre icone={Bell} titre="Les rappels">
                Rappels de visite et priorités urgentes arrivent en notification.
              </Point>
              <Point sombre icone={Tablet} titre="Tout Diagly sur iPad">
                Métrés, coûts, rapports et présentation : sur iPad, l’application entière, au doigt.
              </Point>
            </div>
            <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-3">
              <BadgeAppStore />
              <p className="max-w-[22rem] text-[14px] leading-relaxed text-white/60">
                En test sur TestFlight, bientôt sur l’App Store. D’ici là, Diagly s’utilise dans Safari sur iPad et iPhone.
              </p>
            </div>
          </div>

          <Apparition className="lg:col-span-6" delai={80}>
            <Maquette description="L’app sur iPhone : le sommaire d’un dossier avec l’avancement du relevé et la barre du bas en verre, et l’écran de connexion avec Continuer avec Apple et Continuer avec Google.">
              <div className="relative mx-auto flex max-w-[520px] items-start justify-center gap-[6%]">
                <div className="w-[47%]"><Telephone className="ring-1 ring-white/15"><EcranDossier /></Telephone></div>
                <div className="mt-[14%] w-[47%]"><Telephone className="ring-1 ring-white/15"><EcranConnexion /></Telephone></div>
              </div>
            </Maquette>
          </Apparition>
        </div>
      </Conteneur>
    </section>
  )
}

/**
 * Le badge de l'App Store, redessiné pour rester net, avec sa mention. Il
 * n'est pas un lien : l'app n'est pas encore publiée.
 */
function BadgeAppStore() {
  return (
    <span role="img" aria-label="App Store : bientôt disponible" className="inline-flex items-center gap-2.5 rounded-[11px] border border-white/40 bg-black px-4 py-2 text-white">
      <svg viewBox="0 0 384 512" className="h-[28px] w-[28px] shrink-0 fill-current" aria-hidden="true">
        <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
      </svg>
      <span className="text-left leading-none" aria-hidden="true">
        <span className="block text-[10px] text-white/85">Bientôt sur</span>
        <span className="mt-[3px] block text-[19px] font-semibold tracking-[-0.02em]">l’App Store</span>
      </span>
    </span>
  )
}
