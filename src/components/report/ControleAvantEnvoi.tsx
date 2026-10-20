/**
 * Le contrôle avant envoi, dans la page Rapports.
 *
 * Il liste ce qui rend le rapport faux (bloquant) ou fragile (à vérifier), et
 * mène à la correction : le relevé en cause, l'onglet Coûts, ou la fusion des
 * doublons, faite ici même. Tant qu'un point bloquant reste, télécharger ou
 * partager demande une confirmation : le rapport peut sortir en brouillon,
 * pas chez un client sans qu'on l'ait voulu.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, ChevronDown, CircleAlert, GitMerge, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { stateLabels } from '@/data/mock'
import { doublons, fusionner, type ControleRapport } from '@/lib/controles-rapport'
import { saisir } from '@/lib/hors-ligne/file-envoi'
import { cn } from '@/lib/utils'
import type { ApiDiagnosticItem } from '@/lib/api-types'

export function ControleAvantEnvoi({ controles, items, projectId, diagnosticId }: {
  controles: ControleRapport[]
  items: ApiDiagnosticItem[]
  projectId: string
  diagnosticId: string
}) {
  const [ouvert, setOuvert] = useState(true)
  const [aFusionner, setAFusionner] = useState<ApiDiagnosticItem[] | null>(null)
  const nBloquants = controles.filter((c) => c.gravite === 'bloquant').length

  if (controles.length === 0) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
        <span>Contrôle avant envoi : rien à signaler.</span>
      </div>
    )
  }

  const groupes = doublons(items)
  const relever = (ids: string[]) => `/app/projects/${projectId}/diagnostic${ids[0] ? `?item=${ids[0]}` : ''}`

  return (
    <div className={cn('rounded-lg border', nBloquants > 0 ? 'border-amber-300 bg-amber-50/60' : 'bg-muted/30')}>
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold"
      >
        {nBloquants > 0 ? <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" /> : <CircleAlert className="h-4 w-4 shrink-0 text-muted-foreground" />}
        <span className="flex-1">
          Contrôle avant envoi
          <span className="block text-xs font-normal text-muted-foreground">
            {nBloquants > 0 ? `${nBloquants} point${nBloquants > 1 ? 's' : ''} bloquant${nBloquants > 1 ? 's' : ''}` : 'Aucun point bloquant'}
            {controles.length > nBloquants ? ` · ${controles.length - nBloquants} à vérifier` : ''}
          </span>
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', ouvert && 'rotate-180')} />
      </button>
      {ouvert && (
        <ul className="max-h-[50vh] space-y-2 overflow-y-auto px-3 pb-3">
          {controles.map((c) => {
            const groupe = c.genre === 'doublon' ? groupes.find((g) => g.some((i) => i.id === c.releveIds[0])) : undefined
            return (
              <li key={c.cle} className="rounded-md border bg-background p-2.5 text-xs">
                <p className="flex items-start gap-1.5 font-medium">
                  <span className={cn('mt-1 h-1.5 w-1.5 shrink-0 rounded-full', c.gravite === 'bloquant' ? 'bg-amber-500' : 'bg-muted-foreground/50')} />
                  {c.titre}
                </p>
                <p className="mt-0.5 pl-3 text-muted-foreground">{c.detail}</p>
                <div className="mt-1.5 flex flex-wrap gap-x-3 pl-3">
                  {groupe && (
                    <button type="button" onClick={() => setAFusionner(groupe)} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                      <GitMerge className="h-3.5 w-3.5" />Fusionner
                    </button>
                  )}
                  {(c.genre === 'installation' || c.genre === 'poste-sans-quantite') && (
                    <Link to={`/app/projects/${projectId}/${c.genre === 'installation' ? 'couts' : 'fiche'}`} className="font-medium text-primary hover:underline">
                      {c.genre === 'installation' ? 'Régler dans Coûts' : 'Ouvrir la fiche'}
                    </Link>
                  )}
                  {c.releveIds.length > 0 && c.genre !== 'doublon' && (
                    <Link to={relever(c.releveIds)} className="font-medium text-primary hover:underline">
                      Ouvrir le relevé{c.releveIds.length > 1 ? ` (${c.releveIds.length})` : ''}
                    </Link>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {aFusionner && (
        <FusionDesDoublons groupe={aFusionner} diagnosticId={diagnosticId} onFini={() => setAFusionner(null)} />
      )}
    </div>
  )
}

/** Choisir le relevé à garder : il reçoit les photos et les observations des autres. */
function FusionDesDoublons({ groupe, diagnosticId, onFini }: {
  groupe: ApiDiagnosticItem[]
  diagnosticId: string
  onFini: () => void
}) {
  // Par défaut, le relevé le plus renseigné : un état, puis le plus de photos.
  const [garde, setGarde] = useState(() =>
    [...groupe].sort((a, b) => Number(!!b.state) - Number(!!a.state) || b.photos.length - a.photos.length)[0].id)
  const [enCours, setEnCours] = useState(false)

  const confirmer = async () => {
    setEnCours(true)
    try {
      const f = fusionner(groupe, garde)
      if (Object.keys(f.patch).length > 0) {
        await saisir({ type: 'modifier', diagnosticId, releveId: f.garde, corps: f.patch })
      }
      for (const id of f.retires) await saisir({ type: 'supprimer', diagnosticId, releveId: id })
      onFini()
    } finally {
      setEnCours(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onFini() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fusionner les relevés en double</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Choisissez le relevé à garder, avec son état et son prix. Les photos et les observations des
          autres le rejoignent, puis ils sont retirés.
        </p>
        <div className="space-y-2">
          {groupe.map((it) => (
            <label key={it.id} className={cn('flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm', garde === it.id && 'border-primary bg-primary/5')}>
              <input type="radio" name="garde" checked={garde === it.id} onChange={() => setGarde(it.id)} className="mt-1" />
              <span className="min-w-0">
                <span className="font-medium">{it.state ? stateLabels[it.state] : 'À évaluer'}</span>
                <span className="text-muted-foreground">
                  {' · '}{it.photos.length} photo{it.photos.length > 1 ? 's' : ''}
                  {it.estimatedCost ? ` · ${Math.round(Number(it.estimatedCost)).toLocaleString('fr-CH')} CHF` : ''}
                </span>
                {it.notes && <span className="mt-0.5 block truncate text-muted-foreground">{it.notes}</span>}
              </span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onFini} disabled={enCours}>Annuler</Button>
          <Button onClick={() => void confirmer()} disabled={enCours}>
            {enCours && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Fusionner
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** La confirmation avant de télécharger ou de partager un rapport qui a des points bloquants. */
export function ConfirmerEnvoi({ bloquants, action, onConfirmer, onAnnuler }: {
  bloquants: ControleRapport[]
  action: string
  onConfirmer: () => void
  onAnnuler: () => void
}) {
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onAnnuler() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Le rapport n'est pas prêt pour un client</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {bloquants.length} point{bloquants.length > 1 ? 's' : ''} rend{bloquants.length > 1 ? 'ent' : ''} le total faux ou incomplet :
        </p>
        <ul className="max-h-60 space-y-1 overflow-y-auto text-sm">
          {bloquants.slice(0, 8).map((b) => <li key={b.cle} className="flex gap-2"><span aria-hidden>·</span>{b.titre}</li>)}
          {bloquants.length > 8 && <li className="text-muted-foreground">et {bloquants.length - 8} autre{bloquants.length - 8 > 1 ? 's' : ''}.</li>}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={onAnnuler}>Corriger d'abord</Button>
          <Button variant="outline" onClick={onConfirmer}>{action} quand même</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
