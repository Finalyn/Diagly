import { Construction } from 'lucide-react'
import { Card, CardContent } from '@/components/ui'

/**
 * Parc immobilier : module en cours de refonte. On n'affiche volontairement
 * qu'un écran "en travaux" (pas de stats/filtres/liste) tant qu'il n'est pas prêt.
 */
export function BuildingsList() {
  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2 flex-wrap">
          Parc immobilier
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 px-2.5 py-0.5 text-xs font-semibold">
            <Construction className="h-3.5 w-3.5" />En travaux
          </span>
        </h1>
      </div>

      <Card>
        <CardContent className="py-20 text-center">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mb-4">
            <Construction className="h-8 w-8" />
          </div>
          <h2 className="text-lg font-semibold mb-1">Bientôt disponible</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Le module Parc immobilier est en cours de construction : gestion des bâtiments,
            appartements, locataires et suivi détaillé. Il arrive prochainement.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
