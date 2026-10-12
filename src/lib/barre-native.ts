import { registerPlugin, type PluginListenerHandle } from '@capacitor/core'

// La barre du bas de l'app iPhone, dessinée par iOS (Liquid Glass sur iOS 26) :
// ios/App/App/BarreOngletsPlugin.swift. Décrite et pilotée par MobileNav.

export interface BoutonNatif {
  id: string
  /** Nom d'un SF Symbol (icônes d'Apple), par exemple « gearshape ». */
  symbole: string
  /** Lu par VoiceOver. */
  libelle: string
}

interface PluginBarreOnglets {
  afficher(options: { gauche?: BoutonNatif; centre: BoutonNatif[]; droite?: BoutonNatif; actif?: string }): Promise<void>
  masquer(): Promise<void>
  addListener(evenement: 'toucher', rappel: (d: { id: string }) => void): Promise<PluginListenerHandle>
}

export const BarreOnglets = registerPlugin<PluginBarreOnglets>('BarreOnglets')
