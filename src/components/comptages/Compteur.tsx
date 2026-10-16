/**
 * Le compteur d'unités d'un type, et le bloc de répartition de l'éditeur.
 *
 * « Portes palières en bois  [−] 2 [+]  / 6 » : sur la tablette, au palier,
 * on ne tape pas un nombre dans un champ, on touche plus ou moins en
 * comptant les portes qu'on a devant soi. Les boutons font donc au moins
 * 44 px, la taille qu'un doigt touche sans viser, et le total compté sur les
 * plans reste à côté, pour qu'on voie ce qui reste à attribuer.
 *
 * Zéro n'est pas proposé : un type dont on ne garde aucune unité n'a rien à
 * faire au relevé, il se retire (bouton « Retirer » de l'éditeur). Le
 * proposer ici laisserait des types vides dans le rapport.
 */
import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CATEGORIE, NOMBRE_MAX, comptees, enNombre, type EtatRepartition } from '@/lib/base-cfc/comptages'

export function CompteurUnites({ libelle, valeur, total, onChange, disabled }: {
  libelle: string
  /** Les unités du type ; null tant qu'elles ne sont pas précisées. */
  valeur: number | null
  total: number
  onChange: (v: number) => void
  disabled?: boolean
}) {
  const bouton = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border bg-background text-foreground transition-colors active:scale-95 hover:bg-muted disabled:opacity-30 disabled:active:scale-100'
  return (
    <div className="flex items-center gap-2">
      <p className="min-w-0 flex-1 text-sm font-medium leading-snug">{libelle}</p>
      <button
        type="button"
        className={bouton}
        disabled={disabled || valeur == null || valeur <= 1}
        onClick={() => valeur != null && onChange(valeur - 1)}
        aria-label={`Une de moins : ${libelle}`}
        title={valeur === 1 ? 'Pour n’en garder aucun, retirez ce type' : undefined}
      >
        <Minus className="h-5 w-5" />
      </button>
      <span
        className={cn('w-10 text-center text-xl font-semibold tabular-nums', valeur == null && 'text-amber-600')}
        aria-live="polite"
      >
        {valeur ?? '?'}
      </span>
      <button
        type="button"
        className={bouton}
        disabled={disabled || (valeur ?? 0) >= NOMBRE_MAX}
        onClick={() => onChange((valeur ?? 0) + 1)}
        aria-label={`Une de plus : ${libelle}`}
      >
        <Plus className="h-5 w-5" />
      </button>
      <span className="w-10 shrink-0 text-sm tabular-nums text-muted-foreground">/ {total}</span>
    </div>
  )
}

/**
 * La répartition d'une catégorie comptée, vue depuis un de ses types.
 *
 * Elle prend la place de la part de surface : les unités remplacent le
 * pourcentage pour une catégorie que le dossier a comptée. Comme la part de
 * surface, elle montre tout le groupe et non le seul type ouvert : on ne
 * répartit pas six portes en ne regardant qu'une ligne, et ce qui manque
 * doit se voir au moment où on le saisit.
 */
export function RepartitionDuType({ repartition, releveId, libelle, onUnites, disabled }: {
  repartition: EtatRepartition
  releveId: string
  libelle: string
  onUnites: (v: number) => void
  disabled?: boolean
}) {
  const c = repartition.comptage
  const type = repartition.types.find((t) => t.id === releveId)
  const autres = repartition.types.filter((t) => t.id !== releveId)
  const def = CATEGORIE[c.categorie]
  return (
    <div className={cn('space-y-2.5 rounded-xl border p-3', repartition.complet ? 'bg-muted/40' : 'border-amber-300 bg-amber-50')}>
      <div>
        <p className="text-xs font-medium">
          {def.libelle}
          <span className="font-normal text-muted-foreground">
            {' '}· {enNombre(c.nombre, c.categorie)} {comptees(c.nombre, c.categorie)}
            {c.source === 'plans' ? ' sur les plans' : c.source === 'analyse' ? ' sur un plan analysé' : ' au dossier'}
          </span>
          {!c.valide && <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">à vérifier</span>}
        </p>
        {c.detail && <p className="mt-0.5 text-[11px] text-muted-foreground">{c.detail}</p>}
      </div>
      <CompteurUnites libelle={libelle} valeur={type?.effectives ?? null} total={c.nombre} onChange={onUnites} disabled={disabled} />
      <p className={cn('text-xs', repartition.complet ? 'text-muted-foreground' : 'font-medium text-amber-800')}>
        {repartition.detail}
      </p>
      {autres.length > 0 && (
        <ul className="space-y-0.5 border-t border-black/[0.06] pt-2 text-[11px] text-muted-foreground">
          {autres.map((t) => (
            <li key={t.id} className="flex justify-between gap-3">
              <span className="truncate">{t.nom}</span>
              <span className={cn('shrink-0 tabular-nums', t.effectives == null && 'text-amber-700')}>
                {t.effectives == null ? 'à préciser' : `${t.effectives}/${c.nombre}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
