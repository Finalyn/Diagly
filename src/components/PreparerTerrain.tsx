import { useState } from 'react'
import { CloudDownload, CheckCircle2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { datePreparation, preparerPourLeTerrain, DUREE_PREPARATION_MS } from '@/lib/hors-ligne/preparer'

function quand(d: Date): string {
  const aujourdhui = new Date().toDateString() === d.toDateString()
  const h = d.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })
  return aujourdhui ? `aujourd'hui à ${h}` : `le ${d.toLocaleDateString('fr-CH', { day: 'numeric', month: 'long' })} à ${h}`
}

/**
 * « Préparer pour le terrain » : met le dossier sur l'appareil avant la visite,
 * pour relever au sous-sol comme au bureau. Toucher à nouveau rafraîchit.
 */
export function PreparerTerrain({ projetId }: { projetId: string }) {
  const [date, setDate] = useState(() => datePreparation(projetId))
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState(false)
  const pret = !!date && Date.now() - date.getTime() < DUREE_PREPARATION_MS

  const preparer = async () => {
    setEnCours(true); setErreur(false)
    try {
      await preparerPourLeTerrain(projetId)
      setDate(datePreparation(projetId))
    } catch {
      setErreur(true)
    } finally {
      setEnCours(false)
    }
  }

  const Icone = enCours ? Loader2 : pret && !erreur ? CheckCircle2 : CloudDownload
  return (
    <button
      type="button"
      onClick={preparer}
      disabled={enCours}
      className="flex w-full items-center gap-3 rounded-2xl border border-black/[0.08] bg-white px-4 py-3.5 text-left active:bg-neutral-50"
    >
      <Icone className={cn('h-5 w-5 shrink-0', enCours && 'animate-spin', pret && !erreur ? 'text-emerald-600' : 'text-blue-600')} strokeWidth={1.7} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">
          {enCours ? 'Préparation…' : pret && !erreur ? 'Prêt pour le terrain' : 'Préparer pour le terrain'}
        </span>
        <span className={cn('block text-xs', erreur ? 'text-red-600' : 'text-muted-foreground')}>
          {erreur
            ? 'Impossible sans réseau. Réessayez avant de partir.'
            : pret
              ? `Dossier sur l'appareil depuis ${quand(date!)}. Toucher pour le mettre à jour.`
              : "Met le dossier sur l'appareil, pour relever même sans réseau."}
        </span>
      </span>
    </button>
  )
}
