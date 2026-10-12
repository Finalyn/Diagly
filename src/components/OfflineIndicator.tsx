import { useEffect, useState } from 'react'
import { useIsMutating, onlineManager } from '@tanstack/react-query'
import { WifiOff, RefreshCw, AlertTriangle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFileEnvoi, ignorerRefus } from '@/lib/hors-ligne/file-envoi'

const saisies = (n: number) => `${n} saisie${n > 1 ? 's' : ''}`

/**
 * Bandeau d'état réseau / envoi pour le travail hors-ligne (chantier, sous-sol) :
 *  - Hors-ligne : prévient, et dit combien de saisies sont gardées sur l'appareil.
 *  - De retour en ligne avec des saisies en attente : « Envoi de… ».
 *  - Connecté mais serveur injoignable (sous-sol avec une barre de réseau) :
 *    le dit, plutôt qu'un « Envoi… » qui tournerait sans fin.
 *  - Une saisie refusée par le serveur : le dit, avec la raison, jusqu'à ce
 *    qu'on ferme le bandeau. Elle a quitté l'écran ; sans ce message, on
 *    croirait l'avoir perdue sans raison.
 *  - En ligne et rien en attente : masqué.
 */
export function OfflineIndicator() {
  const [online, setOnline] = useState(onlineManager.isOnline())
  const mutations = useIsMutating()
  const { enAttente, injoignable, refus } = useFileEnvoi()
  const pending = enAttente + mutations

  useEffect(() => onlineManager.subscribe((isOnline) => setOnline(isOnline)), [])

  if (refus.length > 0) {
    return (
      <div className="flex shrink-0 items-start gap-2 bg-red-50 px-3 py-2 text-xs font-medium text-red-800">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p className="min-w-0 flex-1">
          {refus.length === 1
            ? `Une saisie n'a pas été acceptée par le serveur : ${refus[0].raison}`
            : `${refus.length} saisies n'ont pas été acceptées par le serveur. ${refus[refus.length - 1].raison}`}
        </p>
        <button type="button" onClick={ignorerRefus} aria-label="Fermer" className="shrink-0 rounded p-0.5 hover:bg-red-100">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  if (online && pending === 0) return null

  if (online && injoignable && enAttente > 0) {
    return (
      <div className="flex shrink-0 items-center justify-center gap-2 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
        <WifiOff className="h-3.5 w-3.5" />
        Serveur injoignable : {saisies(enAttente)} gardée{enAttente > 1 ? 's' : ''} sur l'appareil, nouvel essai automatique
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium shrink-0',
        online ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-800',
      )}
    >
      {online ? (
        <>
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          Envoi{pending > 0 ? ` de ${saisies(pending)}` : ''}…
        </>
      ) : (
        <>
          <WifiOff className="h-3.5 w-3.5" />
          Hors-ligne{pending > 0 ? ` : ${saisies(pending)} gardée${pending > 1 ? 's' : ''} sur l'appareil, envoi au retour du réseau` : ''}
        </>
      )}
    </div>
  )
}
