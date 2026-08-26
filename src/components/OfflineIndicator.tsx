import { useEffect, useState } from 'react'
import { useIsMutating, onlineManager } from '@tanstack/react-query'
import { WifiOff, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Bandeau d'état réseau / synchro pour le travail hors-ligne (chantier, sous-sol) :
 *  - Hors-ligne : prévient et indique le nombre de modifications en attente.
 *  - De retour en ligne avec des modifs en file : affiche « Synchronisation… ».
 *  - En ligne et rien en attente : masqué.
 */
export function OfflineIndicator() {
  const [online, setOnline] = useState(onlineManager.isOnline())
  const pending = useIsMutating()

  useEffect(() => onlineManager.subscribe((isOnline) => setOnline(isOnline)), [])

  if (online && pending === 0) return null

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
          Synchronisation{pending > 0 ? ` de ${pending} modification${pending > 1 ? 's' : ''}` : ''}…
        </>
      ) : (
        <>
          <WifiOff className="h-3.5 w-3.5" />
          Hors-ligne{pending > 0 ? ` : ${pending} modification${pending > 1 ? 's' : ''} en attente de synchro` : ''}
        </>
      )}
    </div>
  )
}
