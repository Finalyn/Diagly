import { cn } from '@/lib/utils'
import type { Classe } from '@/lib/energie/calcul'

/**
 * L'échelle A à G, en flèches, comme sur une étiquette-énergie.
 *
 * Les flèches s'allongent de A vers G et passent du vert au rouge. La classe
 * atteinte est désignée par une pastille à droite, à sa hauteur : c'est la lecture
 * que tout le monde connaît, et la seule qui se comprenne sans légende.
 *
 * La couleur ne parle jamais seule : chaque barreau porte sa lettre, et la classe
 * atteinte est répétée en toutes lettres à côté de l'échelle.
 */

const LETTRES: Classe[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G']

const COULEURS: Record<Classe, string> = {
  A: 'bg-[#0b8a3e]',
  B: 'bg-[#3aa23a]',
  C: 'bg-[#8bbf1e]',
  D: 'bg-[#e8c000]',
  E: 'bg-[#f08a1d]',
  F: 'bg-[#e35b11]',
  G: 'bg-[#d32020]',
}

export function EtiquetteAG({ classe, titre, valeur, unite, compacte }: {
  classe: Classe
  titre: string
  valeur?: number | null
  unite?: string
  compacte?: boolean
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{titre}</p>
      <div className="mt-2 space-y-1">
        {LETTRES.map((l, i) => {
          const atteinte = l === classe
          return (
            <div key={l} className="flex items-center gap-2">
              <div
                className={cn(
                  'flex items-center rounded-r-sm pl-2 pr-1 text-white',
                  COULEURS[l],
                  compacte ? 'h-4 text-[10px]' : 'h-6 text-xs',
                  atteinte ? 'font-bold' : 'font-medium opacity-45',
                )}
                style={{ width: `${(compacte ? 34 : 42) + i * (compacte ? 7 : 9)}%` }}
              >
                {l}
              </div>
              {atteinte && (
                <span className={cn(
                  'rounded px-2 font-bold text-white',
                  COULEURS[l],
                  compacte ? 'py-0 text-[11px]' : 'py-0.5 text-sm',
                )}>
                  {l}
                </span>
              )}
            </div>
          )
        })}
      </div>
      {valeur != null && (
        <p className={cn('mt-2 font-semibold tabular-nums', compacte ? 'text-sm' : 'text-base')}>
          {Math.round(valeur)}
          {unite && <span className="ml-1 text-xs font-normal text-muted-foreground">{unite}</span>}
        </p>
      )}
    </div>
  )
}

/** Deux étiquettes côte à côte : l'état actuel, et ce que les mesures donneraient. */
export function AvantApres({ titre, avant, apres, valeurAvant, valeurApres }: {
  titre: string
  avant: Classe
  apres: Classe
  valeurAvant: number
  valeurApres: number
}) {
  const gagne = apres !== avant
  return (
    <div className="rounded-xl border p-4">
      <p className="mb-3 text-sm font-semibold">{titre}</p>
      <div className="flex items-start gap-6">
        <div className="flex-1">
          <EtiquetteAG classe={avant} titre="Aujourd'hui" valeur={valeurAvant} unite="kWh/m²·an" compacte />
        </div>
        <div className="flex-1">
          <EtiquetteAG classe={apres} titre="Après travaux" valeur={valeurApres} unite="kWh/m²·an" compacte />
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {gagne
          ? `L'estimation passe de ${avant} à ${apres}.`
          : `L'estimation reste en classe ${avant} : les mesures cochées ne suffisent pas à changer de palier.`}
      </p>
    </div>
  )
}
