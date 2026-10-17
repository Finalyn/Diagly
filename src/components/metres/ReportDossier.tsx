/**
 * « Reporter au dossier » : ce que le métré écrira, à lire avant d'écrire.
 *
 * Deux choses partent : les éléments comptés vers les comptages du dossier,
 * et les quantités des zones rattachées à un ouvrage vers leurs relevés. Une
 * quantité relevée sur place ou un compte saisi à la main ne disparaissent
 * pas sans qu'on ait vu ce qui les remplace : la fenêtre le dit, ouvrage par
 * ouvrage, et rien ne s'écrit avant la confirmation.
 */
import { AlertTriangle, Check, Loader2, SendHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { quantiteDeLApport, type ResumeReport } from '@/lib/plans/report-metres'

const RAISONS: Record<string, string> = {
  'non-etalonne': 'feuille sans échelle',
  'unite-incompatible': 'unité incompatible',
  'rien-a-reporter': 'rien à reporter',
  'deja-a-jour': 'déjà à jour',
}

export function ReportDossier({ resume, etat, erreur, onConfirmer, onFermer }: {
  resume: ResumeReport
  etat: 'pret' | 'en-cours' | 'fait'
  erreur: string | null
  onConfirmer: () => void
  onFermer: () => void
}) {
  const comptages = resume.lignesComptages
  const possibles = resume.ouvrages.filter((o) => o.verdict.ok)
  const rien = resume.aEcrire === 0
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 pb-[calc(var(--safe-bottom)+1rem)] pl-[calc(var(--safe-left)+1rem)] pr-[calc(var(--safe-right)+1rem)] pt-[calc(var(--safe-top)+1rem)]" onClick={etat === 'en-cours' ? undefined : onFermer}>
      <div role="dialog" aria-label="Reporter au dossier" className="flex max-h-full w-full max-w-lg flex-col rounded-2xl border bg-background p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="flex items-center gap-2 text-lg font-semibold"><SendHorizontal className="h-5 w-5" />Reporter au dossier</h3>
        <p className="mt-1 text-sm text-muted-foreground">Voici ce qui sera écrit au dossier. Rien ne part avant votre confirmation.</p>

        <div className="-mx-1 mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto px-1 text-sm">
          <section>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Éléments comptés</p>
            {comptages.length ? (
              <ul className="space-y-0.5">{comptages.map((l) => <li key={l} className="flex gap-1.5"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />{l}</li>)}</ul>
            ) : <p className="text-xs text-muted-foreground">Aucun repère validé : les comptages du dossier ne changent pas.</p>}
            {resume.remplacements.length > 0 && (
              <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
                <p className="flex items-center gap-1 font-medium"><AlertTriangle className="h-3.5 w-3.5" />Ce report remplace :</p>
                <ul className="mt-0.5 list-disc pl-5">{resume.remplacements.map((r) => <li key={r}>{r}</li>)}</ul>
              </div>
            )}
          </section>

          <section>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Quantités des ouvrages</p>
            {resume.ouvrages.length ? (
              <ul className="divide-y rounded-lg border">
                {resume.ouvrages.map(({ ouvrage, apport, verdict }) => (
                  <li key={ouvrage.id} className="flex items-start gap-2 px-2.5 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {ouvrage.cfcCode && <span className="mr-1.5 font-mono text-xs text-muted-foreground">{ouvrage.cfcCode}</span>}{ouvrage.cfcLabel}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        Au dossier : {ouvrage.area != null ? ouvrage.area : 'aucune'} · {apport.zones.length} zone{apport.zones.length > 1 ? 's' : ''}
                        {apport.zones.some((z) => z.multiplicateur > 1) ? ', étages types compris' : ''}
                      </span>
                    </span>
                    <span className={cn('shrink-0 text-right text-xs', verdict.ok ? 'font-semibold' : 'text-muted-foreground')}>
                      {verdict.ok ? quantiteDeLApport(apport) : RAISONS[verdict.raison]}
                    </span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-xs text-muted-foreground">Aucune zone n’est rattachée à un ouvrage du relevé. Sélectionnez une zone, puis « Rattacher à un ouvrage ».</p>}
          </section>
        </div>

        {erreur && <p className="mt-3 text-sm text-red-700">{erreur}</p>}
        {etat === 'fait' && <p className="mt-3 text-sm text-emerald-700">Reporté au dossier : comptages et quantités des ouvrages sont à jour.</p>}

        <div className="mt-4 flex gap-2">
          <button onClick={onFermer} disabled={etat === 'en-cours'} className="h-11 flex-1 rounded-lg border text-sm font-medium hover:bg-muted disabled:opacity-50">
            {etat === 'fait' ? 'Fermer' : 'Annuler'}
          </button>
          {etat !== 'fait' && (
            <button
              onClick={onConfirmer}
              disabled={rien || etat === 'en-cours'}
              className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-foreground text-sm font-semibold text-background hover:opacity-90 disabled:opacity-40"
            >
              {etat === 'en-cours' && <Loader2 className="h-4 w-4 animate-spin" />}
              {rien ? 'Rien à reporter' : `Reporter (${comptages.length + possibles.length})`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
