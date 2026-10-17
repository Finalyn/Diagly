/**
 * Le récapitulatif des quantités validées du jeu, dans le panneau de droite
 * de l'espace Métrés (et seul à l'écran sur un téléphone).
 *
 * Chaque groupe suit l'ordre d'un métré : façades, fenêtres, portes,
 * toiture, emprise et dalles par étage, murs, pièces, éléments comptés. Un
 * étage type y est déjà multiplié, et la ligne le dit. Ce qui attend encore
 * d'être validé n'y entre pas : le haut du panneau dit combien il en reste,
 * pour qu'on ne prenne pas un total partiel pour le total.
 *
 * Toucher une ligne mène à la feuille d'où vient sa première quantité.
 */
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LigneRecap, Recapitulatif, SourceRecap, UniteRecap } from '@/lib/plans/recapitulatif'

const NOMBRE = new Intl.NumberFormat('fr-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const ENTIER = new Intl.NumberFormat('fr-CH', { maximumFractionDigits: 0 })

/** « 1 234,56 m² », « 18 pce » : au centième pour ce qui se mesure, entier pour ce qui se compte. */
function quantiteLisible(v: number, unite: UniteRecap): string {
  return `${unite === 'pce' ? ENTIER.format(v) : NOMBRE.format(v)} ${unite}`
}

export function RecapitulatifMetres({ recap, onAllerA }: {
  recap: Recapitulatif
  /** Mène à la feuille d'une quantité. */
  onAllerA?: (source: SourceRecap) => void
}) {
  return (
    <div className="space-y-3">
      {(recap.aValider > 0 || recap.sansEchelle > 0) && (
        <div className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {recap.aValider > 0 && (
            <p className="flex items-start gap-1.5">
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
              {recap.aValider} proposition{recap.aValider > 1 ? 's' : ''} de l’IA à valider : elles ne comptent pas encore.
            </p>
          )}
          {recap.sansEchelle > 0 && (
            <p className="flex items-start gap-1.5">
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
              {recap.sansEchelle} zone{recap.sansEchelle > 1 ? 's' : ''} sur des feuilles sans échelle, comptée{recap.sansEchelle > 1 ? 's' : ''} sans mesure.
            </p>
          )}
        </div>
      )}

      {recap.groupes.length === 0 ? (
        <p className="rounded-xl border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
          Aucune quantité validée pour l’instant. Validez les zones proposées feuille par feuille :
          elles s’additionnent ici, étages types multipliés.
        </p>
      ) : (
        recap.groupes.map((g) => (
          <section key={g.cle} className="overflow-hidden rounded-xl border bg-background">
            <h3 className="border-b bg-muted/40 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g.titre}</h3>
            <ul>
              {g.lignes.map((l) => <Ligne key={l.cle} ligne={l} onAllerA={onAllerA} />)}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}

function Ligne({ ligne, onAllerA }: { ligne: LigneRecap; onAllerA?: (s: SourceRecap) => void }) {
  const source = ligne.sources[0]
  const cliquable = !!onAllerA && !!source
  const contenu = (
    <>
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-[13px]', ligne.total && 'font-semibold')}>{ligne.libelle}</span>
        {ligne.detail && <span className="block truncate text-[11px] text-muted-foreground">{ligne.detail}</span>}
      </span>
      <span className={cn('shrink-0 text-[13px] tabular-nums', ligne.total ? 'font-semibold' : 'font-medium')}>
        {quantiteLisible(ligne.quantite, ligne.unite)}
      </span>
    </>
  )
  return (
    <li className={cn('border-b last:border-b-0', ligne.total && 'bg-muted/30')}>
      {cliquable ? (
        <button onClick={() => onAllerA!(source)} className="flex w-full items-start gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/60" title="Afficher la feuille">
          {contenu}
        </button>
      ) : (
        <div className="flex items-start gap-3 px-3 py-2">{contenu}</div>
      )}
    </li>
  )
}
