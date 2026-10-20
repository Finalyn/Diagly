import { cn } from '@/lib/utils'
import { AnalysePlan } from '@/pages/marketing/accueil/maquettes/AnalysePlan'

/**
 * L'exemple animé des Métrés, montré tant qu'il n'y a rien à montrer : sur
 * la page Métrés sans aucun métré, et dans l'espace d'un dossier qui n'a pas
 * encore de plan.
 *
 * C'est l'interface de la page d'accueil (AnalysePlan) : l'étage type des
 * plans d'essai, que l'IA lit sous les yeux (échelle vérifiée, pièces
 * dessinées avec leur surface, fenêtres et portes repérées, quantités qui se
 * remplissent). La pastille « Exemple » dit bien que ce n'est pas un dossier
 * de l'utilisateur.
 */
export function ExempleMetres({ dossier, className }: {
  /** Dans un dossier : les plans s'ajoutent à gauche ; sinon, dans la zone de dépôt au-dessus. */
  dossier?: boolean
  className?: string
}) {
  return (
    // La disposition suit la place disponible, pas l'écran : l'espace d'un dossier est étroit.
    <div className={cn('@container rounded-2xl border bg-card p-4 sm:p-6', className)}>
      <div className="grid gap-6 @3xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] @3xl:items-center @3xl:gap-10">
        <div>
          <span className="inline-flex rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-700">Exemple</span>
          <h3 className="mt-3 text-[20px] font-semibold leading-snug tracking-tight text-foreground">Voici ce que l’IA fera de vos plans</h3>
          <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
            Sur cet étage d’exemple, elle vérifie l’échelle sur une cote, dessine chaque pièce avec sa surface, repère les fenêtres et compte les portes. Rien n’entre dans vos totaux sans votre validation.
          </p>
          <p className="mt-3 text-[14px] font-medium text-foreground">
            {dossier
              ? 'Ajoutez les plans de ce dossier à gauche : l’analyse démarre d’elle-même.'
              : 'Déposez les plans d’un bâtiment ci-dessus : vos métrés apparaîtront ici.'}
          </p>
        </div>
        <AnalysePlan />
      </div>
    </div>
  )
}
