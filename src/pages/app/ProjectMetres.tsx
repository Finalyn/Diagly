import { Fragment, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, AlertCircle, AlertTriangle, ClipboardCheck, FileText, Plus, RotateCcw, X } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardContent, Input } from '@/components/ui'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { priorityTextColors } from '@/data/mock'
import { formatCHF, formatPrixUnitaire, cn } from '@/lib/utils'
import { priceBasisNote, buildQuantityContext } from '@/lib/diagnostic-auto'
import { api } from '@/lib/api'
import { ENVELOPPES, type DevisLigne } from '@/lib/devis'
import { etatDeLaLigne, etatPourLaBase, patchDuPrix, patchDuRetour, prixDePostePourLaBase } from '@/lib/prix-du-dossier'
import { calculerVariantes } from '@/lib/variantes'
import { saisir } from '@/lib/hors-ligne/file-envoi'
import { useAuth } from '@/stores/auth'
import type { ApiDiagnostic, ApiProject, MajorationsDuDossier } from '@/lib/api-types'
import { ElementsComptes } from '@/components/comptages/ElementsComptes'
import { useDevisDuDossier } from '@/components/report/use-devis-du-dossier'
import { ENVELOPPE_COURTE, TITRE_ENVELOPPE } from '@/components/report/constants'

type ProjetEnCache = { project: ApiProject; diagnostics: ApiDiagnostic[] }

/** Les frais secondaires qu'on ajoute le plus souvent, proposés d'un clic. */
const FRAIS_COURANTS = ['Autorisations et taxes', 'Assurances', 'Prorata', 'Reproduction de documents']

const nombre = (v: number) => new Intl.NumberFormat('fr-CH', { maximumFractionDigits: 2 }).format(v)

/**
 * L'onglet Coûts : le devis du dossier, comme il sortira au rapport, et
 * l'endroit où l'on ajuste ses prix.
 *
 * Les lignes sont celles du devis (lib/devis.ts) : postes de chantier,
 * réparations, mises aux normes, améliorations, chacune avec son enveloppe,
 * triées par code CFC. Un prix saisi sur une ligne recalcule la ligne et les
 * totaux. La base de prix ne change que si on le demande. On ne télécharge
 * rien ici : les documents sortent de la page Rapports.
 */
export function ProjectMetres() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const user = useAuth((s) => s.user)
  const dossier = useDevisDuDossier(id)
  const { project, diagnostic, devis, base } = dossier
  const items = useMemo(() => dossier.items ?? [], [dossier.items])
  const orgQuery = useQuery({ queryKey: ['org'], queryFn: () => api.org.get(), staleTime: 5 * 60 * 1000 })
  // La base est commune au bureau : seul un responsable l'écrit (le serveur le vérifie aussi).
  const responsable = user?.role === 'ADMIN' || orgQuery.data?.role === 'OWNER' || orgQuery.data?.role === 'ADMIN'
  const variantsQuery = useQuery({ queryKey: ['variants', id], queryFn: () => api.variants.list(id!), enabled: !!id })
  const catalogQuery = useQuery({ queryKey: ['cfc-items'], queryFn: () => api.cfc.items(), staleTime: 3.6e6 })

  const [question, setQuestion] = useState<{ ligne: DevisLigne; pu: number } | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enregistrement, setEnregistrement] = useState(false)

  const variantes = useMemo(() => {
    if (!project || !devis) return []
    const catalogue = new Map((catalogQuery.data?.items ?? []).map((c) => [c.id, c]))
    return calculerVariantes(variantsQuery.data?.variants ?? [], items,
      { honoraryPct: project.honoraryPct, reservePct: project.reservePct }, devis.ht,
      { catalogue, qtyCtx: buildQuantityContext(project) })
  }, [project, devis, items, variantsQuery.data, catalogQuery.data])

  if (dossier.chargement && !project) {
    return <div className="flex items-center justify-center py-32 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mr-2" />Chargement…</div>
  }
  if (dossier.erreur || !project) {
    return (
      <Card><CardContent className="py-16 text-center">
        <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
        <p className="text-sm text-red-700">Projet introuvable</p>
      </CardContent></Card>
    )
  }

  // Les éléments comptés se règlent au bureau aussi bien que pendant la
  // visite : ils ouvrent la page, avant les montants qui en découlent.
  const elementsComptes = <ElementsComptes project={project} diagnosticId={diagnostic?.id ?? null} items={items} />

  if (!diagnostic) {
    return (
      <div className="space-y-4 md:space-y-6">
        {elementsComptes}
        <Card><CardContent className="py-16 text-center">
          <h3 className="text-lg font-semibold mb-1">Aucun diagnostic</h3>
          <p className="text-sm text-muted-foreground mb-4">Les coûts proviennent du diagnostic. Démarrez-le d'abord.</p>
          <Link to={`/app/projects/${id}/diagnostic`}><Button>Aller au diagnostic</Button></Link>
        </CardContent></Card>
      </div>
    )
  }

  const majorations: MajorationsDuDossier = project.majorations ?? {}
  const enregistrerProjet = async (corps: Partial<ApiProject>) => {
    setErreur(null)
    try {
      const { project: p } = await api.projects.update(id!, corps)
      qc.setQueryData<ProjetEnCache>(['project', id], (v) => (v ? { ...v, project: p } : v))
    } catch {
      setErreur("L'enregistrement n'a pas abouti : réessayez.")
    }
  }
  const majorer = (m: MajorationsDuDossier) => enregistrerProjet({ majorations: m })

  /** Le prix appliqué au dossier seulement. */
  const auDossier = async (ligne: DevisLigne, pu: number) => {
    if (ligne.automatique) {
      await majorer({ ...majorations, prixPostes: { ...(majorations.prixPostes ?? {}), [ligne.cfcCode]: pu } })
    } else if (ligne.releveId) {
      await saisir({ type: 'modifier', diagnosticId: diagnostic.id, releveId: ligne.releveId, corps: patchDuPrix(ligne, pu) })
    }
  }

  /** Le prix écrit aussi dans la base du bureau : le dossier le suit alors comme les autres. */
  const aLaBase = async (ligne: DevisLigne, pu: number) => {
    if (ligne.automatique) {
      await api.cfc.updatePoste(ligne.cfcCode, { prix: prixDePostePourLaBase(pu) })
      const reste = { ...(majorations.prixPostes ?? {}) }
      delete reste[ligne.cfcCode]
      await majorer({ ...majorations, prixPostes: reste })
    } else {
      const it = items.find((i) => i.id === ligne.releveId)
      const article = it?.articleId ? base.articles.find((a) => a.id === it.articleId) : undefined
      const etat = etatDeLaLigne(ligne, it)
      if (!it || !article || !etat) return auDossier(ligne, pu)
      await api.cfc.updateArticle(article.id, { etats: [etatPourLaBase(article, etat, pu)] })
      const patch = patchDuRetour({ ...ligne, prixBase: pu }) ?? patchDuPrix(ligne, pu)
      await saisir({ type: 'modifier', diagnosticId: diagnostic.id, releveId: it.id, corps: patch })
    }
    await qc.invalidateQueries({ queryKey: ['base-cfc'] })
  }

  const appliquer = async (versLaBase: boolean) => {
    if (!question) return
    setEnregistrement(true)
    setErreur(null)
    try {
      await (versLaBase ? aLaBase(question.ligne, question.pu) : auDossier(question.ligne, question.pu))
      setQuestion(null)
    } catch {
      setErreur(versLaBase
        ? "La base de prix n'a pas pu être modifiée (réservé aux responsables du bureau). Le prix n'a été appliqué nulle part."
        : "Le prix n'a pas pu être enregistré : réessayez.")
    } finally {
      setEnregistrement(false)
    }
  }

  const revenir = async (ligne: DevisLigne) => {
    if (ligne.automatique) {
      const reste = { ...(majorations.prixPostes ?? {}) }
      delete reste[ligne.cfcCode]
      await majorer({ ...majorations, prixPostes: reste })
      return
    }
    const patch = patchDuRetour(ligne)
    if (patch && ligne.releveId) await saisir({ type: 'modifier', diagnosticId: diagnostic.id, releveId: ligne.releveId, corps: patch })
  }

  const ligneModifiable = (l: DevisLigne) => !l.rattacheA && (l.automatique ? l.cfcCode !== '211.0' && l.quantite != null : l.releveId != null)
  const peutAllerALaBase = (l: DevisLigne) => {
    if (!responsable) return false
    if (l.automatique) return l.cle.startsWith('auto:') && l.cfcCode !== '211.0' && !l.cle.endsWith(':amelioration')
    const it = items.find((i) => i.id === l.releveId)
    return !!it?.articleId && !!etatDeLaLigne(l, it)
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div className="min-w-0">
          <h1 className="text-xl font-bold md:text-2xl">Coûts</h1>
          <p className="text-sm text-muted-foreground">
            Le devis du dossier, ligne par ligne, comme il sort au rapport. Saisissez votre prix sur une
            ligne : elle et les totaux se recalculent. Les documents se téléchargent depuis Rapports.
          </p>
          {!responsable && (
            <p className="mt-1 text-xs text-muted-foreground">
              Vos prix s'appliquent à ce dossier. La base de prix du bureau se modifie depuis un compte responsable.
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link to={`/app/projects/${id}/diagnostic`}><Button variant="outline"><ClipboardCheck className="mr-2 h-4 w-4" />Ouvrir le relevé</Button></Link>
          <Link to={`/app/projects/${id}/rapports`}><Button variant="outline"><FileText className="mr-2 h-4 w-4" />Rapports</Button></Link>
        </div>
      </div>

      {elementsComptes}

      {erreur && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</p>}

      {!devis || devis.lignes.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <h3 className="text-lg font-semibold mb-1">Aucun coût</h3>
          <p className="text-sm text-muted-foreground mb-4">Évaluez des ouvrages dans le relevé pour voir le devis ici.</p>
          <Link to={`/app/projects/${id}/diagnostic`}><Button><ClipboardCheck className="mr-2 h-4 w-4" />Ouvrir le relevé</Button></Link>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <Card className="min-w-0">
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="text-base">Devis</CardTitle>
              <span className="font-bold tabular-nums">{formatCHF(devis.ht)} HT</span>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full min-w-[52rem] table-fixed text-sm">
                <colgroup>
                  <col className="w-[4.5rem]" />
                  <col />
                  <col className="w-[6.5rem]" />
                  <col className="w-12" />
                  <col className="w-20" />
                  <col className="w-16" />
                  <col className="w-[7.5rem]" />
                  <col className="w-32" />
                </colgroup>
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">CFC</th>
                    <th className="py-2 font-medium">Désignation</th>
                    <th className="px-2 py-2 font-medium">Enveloppe</th>
                    <th className="px-2 py-2 font-medium">Prio.</th>
                    <th className="px-2 py-2 text-right font-medium">Quantité</th>
                    <th className="px-2 py-2 font-medium">Unité</th>
                    <th className="px-2 py-2 text-right font-medium">Prix unitaire</th>
                    <th className="px-3 py-2 text-right font-medium">Coût</th>
                  </tr>
                </thead>
                <tbody>
                  {devis.positions.map((pos) => (
                    <Fragment key={pos.code || 'nc'}>
                      <tr className="border-t bg-muted/40 font-semibold">
                        <td className="px-3 py-1.5 font-mono text-xs">{pos.code || '·'}</td>
                        <td className="py-1.5" colSpan={6}>{pos.label}</td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">{formatCHF(pos.montant)}</td>
                      </tr>
                      {pos.lignes.map((l) => (
                        <tr key={l.cle} className={cn('border-t align-top', l.aChiffrer && 'bg-amber-50/60')}>
                          <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{l.rattacheA ? '' : l.cfcCode}</td>
                          <td className={cn('py-2 pr-3', l.rattacheA && 'pl-3 text-muted-foreground')}>
                            <span className="font-medium">{l.libelle}</span>
                            {l.remarque && <span className="block text-xs text-muted-foreground">{l.remarque}</span>}
                            {l.aChiffrer && <span className="block text-xs font-medium text-amber-700">À chiffrer : {l.raisonAChiffrer}</span>}
                            {l.prixModifie && l.prixBase != null && (
                              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-blue-700">
                                Prix modifié · base {formatPrixUnitaire(l.prixBase)}
                                <button type="button" onClick={() => void revenir(l)} className="inline-flex items-center gap-1 font-medium hover:underline">
                                  <RotateCcw className="h-3 w-3" />Revenir au prix de la base
                                </button>
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-2 text-xs">{ENVELOPPE_COURTE[l.enveloppe]}</td>
                          <td className={cn('px-2 py-2 text-xs font-semibold', l.priorite && priorityTextColors[l.priorite])}>{l.priorite ?? '·'}</td>
                          <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">{l.quantite != null ? nombre(l.quantite) : ''}</td>
                          <td className="px-2 py-2 text-muted-foreground">{l.unite ?? ''}</td>
                          <td className="px-2 py-1.5 text-right">
                            {ligneModifiable(l) ? (
                              <PrixSaisi
                                ligne={l}
                                onSaisi={(pu) => (peutAllerALaBase(l) ? setQuestion({ ligne: l, pu }) : void auDossier(l, pu))}
                              />
                            ) : (
                              <span className="tabular-nums">{l.prixUnitaire != null ? formatPrixUnitaire(Math.abs(l.prixUnitaire)) : ''}</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-right font-medium tabular-nums">
                            {l.aChiffrer ? <span className="text-amber-700">à chiffrer</span> : l.montant < 0 ? `−${formatCHF(-l.montant)}` : formatCHF(l.montant)}
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                  <tr className="border-t-2 font-bold">
                    <td className="px-3 py-2" colSpan={7}>Total général des travaux (HT)</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{formatCHF(devis.ht)}</td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>

          <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
            <Card>
              <CardHeader><CardTitle>Synthèse</CardTitle></CardHeader>
              <CardContent className="space-y-2.5 text-sm">
                {ENVELOPPES.map((cle) => {
                  const e = devis.enveloppes.find((x) => x.cle === cle)!
                  if (e.lignes.length === 0) return null
                  return <Row key={cle} label={`${TITRE_ENVELOPPE[cle]}${e.aChiffrer ? ` (${e.aChiffrer} à chiffrer)` : ''}`} value={formatCHF(e.ht)} />
                })}
                <Row label="Travaux (HT)" value={formatCHF(devis.ht)} strong />
                <Pourcentage libelle="Honoraires" valeur={project.honoraryPct ?? 0} montant={devis.cascade.honoraires}
                  onChange={(v) => void enregistrerProjet({ honoraryPct: v })} />
                <Pourcentage libelle="Réserve" valeur={project.reservePct ?? 0} montant={devis.cascade.reserve}
                  onChange={(v) => void enregistrerProjet({ reservePct: v })} />
                {devis.cascade.detailFrais.map((f) => <Row key={f.libelle} label={f.libelle} value={formatCHF(f.montant)} />)}
                <Row label="Sous-total" value={formatCHF(devis.cascade.sousTotal)} />
                <Row label="TVA 8,1 %" value={formatCHF(devis.cascade.tva)} />
                <div className="flex items-center justify-between border-t pt-3">
                  <span className="font-semibold">Total TTC</span>
                  <span className="text-xl font-bold text-primary">{formatCHF(devis.cascade.total)}</span>
                </div>
                {devis.aChiffrer.length > 0 && (
                  <p className="flex gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-xs text-amber-900">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {devis.aChiffrer.length} ligne{devis.aChiffrer.length > 1 ? 's' : ''} à chiffrer, non comprise{devis.aChiffrer.length > 1 ? 's' : ''} dans ce total.
                  </p>
                )}
                <p className="pt-1 text-[11px] text-muted-foreground">
                  Honoraires sur les travaux, réserve sur les travaux et les honoraires, puis frais secondaires et TVA. Estimation ±15 %.
                </p>
                <p className="border-t pt-2 text-[11px] text-muted-foreground">{priceBasisNote()}</p>
              </CardContent>
            </Card>

            <Majorations majorations={majorations} onChange={(m) => void majorer(m)} />

            {variantes.length > 0 && (
              <Card>
                <CardHeader className="py-3"><CardTitle className="text-base">Variantes du projet</CardTitle></CardHeader>
                <CardContent className="space-y-1.5 text-sm">
                  {variantes.map((v) => (
                    <div key={v.variant.id} className="flex items-baseline justify-between gap-2">
                      <span className="truncate">{v.variant.name}</span>
                      <span className={cn('shrink-0 tabular-nums', v.ecartHt < 0 ? 'text-emerald-700' : v.ecartHt > 0 ? 'text-red-700' : 'text-muted-foreground')}>
                        {formatCHF(v.ht)} ({v.ecartHt > 0 ? '+' : v.ecartHt < 0 ? '−' : ''}{formatCHF(Math.abs(v.ecartHt))})
                      </span>
                    </div>
                  ))}
                  <Link to={`/app/projects/${id}/variantes`} className="block pt-1 text-xs font-medium text-primary hover:underline">Ouvrir les variantes</Link>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {question && (
        <Dialog open onOpenChange={(o) => { if (!o && !enregistrement) void appliquer(false) }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Où appliquer ce prix ?</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">
              {formatPrixUnitaire(question.pu)} pour « {question.ligne.libelle} ». Appliquer ce prix uniquement à ce
              dossier, ou mettre aussi à jour votre base de prix ? La base sert à tous les dossiers du bureau.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => void appliquer(true)} disabled={enregistrement}>Aussi ma base de prix</Button>
              <Button onClick={() => void appliquer(false)} disabled={enregistrement}>
                {enregistrement && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Ce dossier uniquement
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

/** Le prix unitaire d'une ligne, saisi à la main ; vide pour une ligne à chiffrer. */
function PrixSaisi({ ligne, onSaisi }: { ligne: DevisLigne; onSaisi: (pu: number) => void }) {
  const valeur = ligne.prixUnitaire != null ? String(ligne.prixUnitaire) : ''
  const valider = (brut: string, champ: HTMLInputElement) => {
    const texte = brut.trim().replace(',', '.')
    if (texte === valeur) return
    const pu = Number(texte)
    if (!texte || !Number.isFinite(pu) || pu < 0) { champ.value = valeur; return }
    onSaisi(Math.round(pu * 100) / 100)
  }
  return (
    <Input
      key={`${ligne.cle}-${valeur}`}
      type="text"
      inputMode="decimal"
      defaultValue={valeur}
      placeholder="prix"
      aria-label={`Prix unitaire, ${ligne.libelle}`}
      className={cn('ml-auto h-8 w-24 text-right tabular-nums', ligne.prixModifie && 'border-blue-300 bg-blue-50/60', ligne.aChiffrer && 'border-amber-300')}
      onBlur={(e) => valider(e.target.value, e.target)}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
    />
  )
}

function Pourcentage({ libelle, valeur, montant, onChange }: { libelle: string; valeur: number; montant: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1 text-muted-foreground">
        {libelle}
        <Input
          type="number" min="0" max="100" step="0.5" defaultValue={valeur} className="h-7 w-16 text-xs" key={valeur}
          onBlur={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v >= 0 && v <= 100 && v !== valeur) onChange(v) }}
        />%
      </span>
      <span className="font-medium tabular-nums">{formatCHF(montant)}</span>
    </div>
  )
}

/**
 * Les majorations propres au dossier : l'installation de chantier, comptée
 * d'office, et les frais secondaires. Tout peut se mettre à zéro, pour
 * comparer avec un devis d'entreprise qui ne porte que le coût des travaux.
 */
function Majorations({ majorations, onChange }: { majorations: MajorationsDuDossier; onChange: (m: MajorationsDuDossier) => void }) {
  const inst = majorations.installation ?? null
  const frais = majorations.frais ?? []
  const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')))
  const changerFrais = (i: number, f: Partial<(typeof frais)[number]>) => onChange({ ...majorations, frais: frais.map((x, j) => (j === i ? { ...x, ...f } : x)) })
  return (
    <Card>
      <CardHeader className="py-3"><CardTitle className="text-base">Majorations du dossier</CardTitle></CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div>
          <p className="font-medium">Installation de chantier</p>
          <p className="mb-2 text-xs text-muted-foreground">Comptée d'office : un pourcentage des travaux, avec un minimum. À zéro, il n'y en a pas.</p>
          <div className="flex flex-wrap items-center gap-2">
            <Input type="number" min="0" step="0.5" className="h-8 w-20" placeholder="%" defaultValue={inst?.pct ?? ''} key={`p-${inst?.pct}`}
              onBlur={(e) => { const v = num(e.target.value); if (v !== (inst?.pct ?? null)) onChange({ ...majorations, installation: { pct: v, minimum: inst?.minimum ?? null } }) }} />
            <span className="text-muted-foreground">% des travaux, minimum</span>
            <Input type="number" min="0" step="100" className="h-8 w-24" placeholder="CHF" defaultValue={inst?.minimum ?? ''} key={`m-${inst?.minimum}`}
              onBlur={(e) => { const v = num(e.target.value); if (v !== (inst?.minimum ?? null)) onChange({ ...majorations, installation: { pct: inst?.pct ?? null, minimum: v } }) }} />
            <span className="text-muted-foreground">CHF</span>
          </div>
          {inst == null && <p className="mt-1 text-xs font-medium text-amber-700">Pas encore réglée : elle paraît à chiffrer au devis.</p>}
        </div>
        <div>
          <p className="font-medium">Frais secondaires</p>
          <p className="mb-2 text-xs text-muted-foreground">À côté des honoraires et de la réserve : un pourcentage des travaux, ou un montant.</p>
          <div className="space-y-2">
            {frais.map((f, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <Input className="h-8 min-w-0 flex-1" defaultValue={f.libelle} key={`l-${i}-${f.libelle}`}
                  onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== f.libelle) changerFrais(i, { libelle: v }) }} />
                <Input type="number" min="0" step="0.1" className="h-8 w-20" defaultValue={f.pct ?? f.montant ?? ''} key={`v-${i}-${f.pct}-${f.montant}`}
                  onBlur={(e) => { const v = num(e.target.value) ?? 0; changerFrais(i, f.pct != null ? { pct: v } : { montant: v }) }} />
                <button type="button" className="h-8 rounded-md border px-1.5 text-xs" title="Pourcentage ou montant"
                  onClick={() => changerFrais(i, f.pct != null ? { pct: null, montant: f.pct } : { montant: null, pct: f.montant ?? 0 })}>
                  {f.pct != null ? '%' : 'CHF'}
                </button>
                <button type="button" aria-label={`Retirer ${f.libelle}`} className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                  onClick={() => onChange({ ...majorations, frais: frais.filter((_, j) => j !== i) })}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {FRAIS_COURANTS.filter((l) => !frais.some((f) => f.libelle === l)).map((l) => (
              <button key={l} type="button" className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs hover:bg-muted"
                onClick={() => onChange({ ...majorations, frais: [...frais, { libelle: l, pct: null, montant: 0 }] })}>
                <Plus className="h-3 w-3" />{l}
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('tabular-nums', strong ? 'font-semibold' : 'font-medium')}>{value}</span>
    </div>
  )
}
