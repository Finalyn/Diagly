/**
 * Onglet Variantes.
 *
 * Le diagnostic de base répond à « qu'est-ce qu'il faut faire ». La variante
 * répond à « et si on s'y prenait autrement » : isoler par l'intérieur plutôt que
 * par l'extérieur, passer au pellet ou au chauffage à distance plutôt qu'à la
 * pompe à chaleur. On ne redécrit donc pas le bâtiment : on désigne l'ouvrage
 * concerné, on met en face la solution retenue et son montant, et tout le reste
 * du dossier vaut par défaut.
 *
 * C'est ce qui permet de corriger un ouvrage une seule fois, dans le diagnostic,
 * et de voir les trois variantes bouger ensemble — au lieu de trois copies du
 * dossier qui divergent dès la première correction.
 */
import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, AlertTriangle, Loader2, Plus, Trash2, X, ArrowRight } from 'lucide-react'
import { Button, Card, CardContent, Input } from '@/components/ui'
import { api } from '@/lib/api'
import { cn, formatCHF } from '@/lib/utils'
import { baseDuProjet, calculerVariantes, montantDepuisCatalogue, montantOuvrage, type LigneArbitrage, type Variante } from '@/lib/variantes'
import { buildDevis, uniteCourte } from '@/lib/devis'
import { useBaseCfc } from '@/lib/base-cfc/requete'
import { donneesDuBatiment } from '@/lib/base-cfc/batiment'
import { buildQuantityContext, resolveQuantity, type QuantityContext } from '@/lib/diagnostic-auto'
import { consequencesDe, type Consequence } from '@/lib/variantes-consequences'
import { cfcLabelIndex } from '@/lib/cfc'
import { suffixeLocalisation } from '@/lib/localisation'
import { stateColors, stateLabels } from '@/data/mock'
import { ETATS } from '@/components/report/constants'
import type { ApiCatalogItem, ApiCfcEntry, ApiDiagnosticItem, ApiVariant, ApiVariantLine, ElementState } from '@/lib/api-types'

/** Suggestions de départ : les arbitrages que le bureau pose le plus souvent. */
const MODELES = [
  { nom: "Isolation par l'intérieur", desc: "Doublage intérieur au lieu d'une isolation périphérique : moins cher, mais perte de surface habitable et ponts thermiques à traiter." },
  { nom: 'Chauffage à pellets', desc: 'Chaudière à pellets au lieu de la production de chaleur prévue : local de stockage et livraisons à prévoir.' },
  { nom: 'Chauffage à distance (CAD)', desc: 'Raccordement au réseau de chauffage à distance : taxe de raccordement et sous-station, plus de chaufferie à entretenir.' },
]

export function ProjectVariantes() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const [ouverte, setOuverte] = useState<string | null>(null)

  const projectQuery = useQuery({ queryKey: ['project', id], queryFn: () => api.projects.get(id!), enabled: !!id })
  const project = projectQuery.data?.project
  const diagnostic = projectQuery.data?.diagnostics[0]

  const itemsQuery = useQuery({
    queryKey: ['diagnostic-items', diagnostic?.id],
    queryFn: () => api.diagnostics.listItems(diagnostic!.id),
    enabled: !!diagnostic,
  })
  const items = useMemo(() => itemsQuery.data?.items ?? [], [itemsQuery.data])

  const cfcQuery = useQuery({ queryKey: ['cfc-catalog'], queryFn: () => api.cfc.catalog(), staleTime: 3.6e6 })
  const catalogQuery = useQuery({ queryKey: ['cfc-items'], queryFn: () => api.cfc.items(), staleTime: 3.6e6 })
  // La base v3 sert au devis de référence ; les lignes de variante, elles,
  // pointent encore l'ancien catalogue par identifiant.
  const baseQuery = useBaseCfc()

  const variantsKey = ['variants', id] as const
  const variantsQuery = useQuery({
    queryKey: variantsKey, queryFn: () => api.variants.list(id!), enabled: !!id,
  })
  const variants = useMemo(() => variantsQuery.data?.variants ?? [], [variantsQuery.data])

  const rafraichir = () => qc.invalidateQueries({ queryKey: variantsKey })
  const creer = useMutation({
    mutationFn: (v: { name: string; description?: string | null }) => api.variants.create(id!, v),
    onSuccess: (r) => { setOuverte(r.variant.id); rafraichir() },
  })
  const supprimer = useMutation({
    mutationFn: (variantId: string) => api.variants.remove(variantId),
    onSuccess: rafraichir,
  })

  // Référence stable : un objet recréé à chaque rendu relancerait tous les calculs.
  const options = useMemo(
    () => ({ honoraryPct: project?.honoraryPct ?? null, reservePct: project?.reservePct ?? null }),
    [project?.honoraryPct, project?.reservePct],
  )
  // Les variantes se comparent au devis complet du rapport — postes de chantier
  // compris — et non à la seule somme des ouvrages : sinon l'écart affiché ici ne
  // se recouperait pas avec celui du rapport.
  const devis = useMemo(
    () => buildDevis(items, cfcLabelIndex(cfcQuery.data?.entries ?? []), {
      articles: baseQuery.data?.articles ?? [],
      postes: baseQuery.data?.postes ?? [],
      etapes: baseQuery.data?.etapes ?? [],
    }, {
      honoraryPct: project?.honoraryPct ?? null,
      reservePct: project?.reservePct ?? null,
      batiment: donneesDuBatiment(project ?? {}),
    }),
    [items, cfcQuery.data, baseQuery.data, project],
  )
  const nomenclature = useMemo(() => cfcQuery.data?.entries ?? [], [cfcQuery.data])
  const catalogue = useMemo(() => catalogQuery.data?.items ?? [], [catalogQuery.data])
  // Mêmes dimensions de bâtiment que le diagnostic : une variante doit trouver les
  // mêmes 310 m² de fenêtres, sans qu'on les ressaisisse.
  const qtyCtx = useMemo(() => buildQuantityContext(project ?? {}), [project])
  const base = useMemo(() => baseDuProjet(devis.ht, options), [devis.ht, options])
  // Le contexte de chiffrage : sans lui, une variante garderait les quantités figées
  // au jour de sa saisie et ne suivrait plus les corrections du dossier.
  const contexte = useMemo(
    () => ({ catalogue: new Map(catalogue.map((c) => [c.id, c])), qtyCtx }),
    [catalogue, qtyCtx],
  )
  const calculees = useMemo(() => calculerVariantes(variants, items, options, devis.ht, contexte),
    [variants, items, options, devis.ht, contexte])

  if (projectQuery.isLoading || variantsQuery.isLoading) {
    return <div className="flex items-center justify-center py-32 text-muted-foreground"><Loader2 className="mr-2 h-6 w-6 animate-spin" />Chargement…</div>
  }
  if (projectQuery.isError || !project) {
    return <Card><CardContent className="py-16 text-center"><AlertCircle className="mx-auto mb-2 h-8 w-8 text-red-500" /><p className="text-sm text-red-700">Projet introuvable</p></CardContent></Card>
  }
  if (!diagnostic) {
    return (
      <Card><CardContent className="py-16 text-center">
        <h3 className="mb-1 text-lg font-semibold">Aucun diagnostic</h3>
        <p className="text-sm text-muted-foreground">Une variante s'appuie sur le diagnostic de base. Commencez par le faire.</p>
      </CardContent></Card>
    )
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Même en-tête que les autres pages du dossier : le titre, puis ce qu'on y voit. */}
      <div>
        <h1 className="text-xl font-bold md:text-2xl">Variantes</h1>
        <p className="text-sm text-muted-foreground">
          {variants.length === 0
            ? 'Aucune variante pour l’instant'
            : `${variants.length} variante${variants.length > 1 ? 's' : ''} comparée${variants.length > 1 ? 's' : ''} au diagnostic de base`}
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <p className="max-w-3xl text-sm text-muted-foreground">
            Une variante reprend tout le diagnostic et ne change que ce que vous désignez :
            l'ouvrage remplacé sort du total, la solution retenue prend sa place. Corriger le
            diagnostic met à jour toutes les variantes d'un coup.
          </p>

          {/* Comparaison : c'est la raison d'être de l'écran, elle vient donc en premier. */}
          <Comparaison base={base} variantes={calculees} />
        </CardContent>
      </Card>

      {calculees.map((v) => (
        <CarteVariante
          key={v.variant.id}
          calcul={v}
          items={items}
          nomenclature={nomenclature}
          catalogue={catalogue}
          qtyCtx={qtyCtx}
          ouverte={ouverte === v.variant.id}
          onBasculer={() => setOuverte(ouverte === v.variant.id ? null : v.variant.id)}
          onChange={rafraichir}
          onSupprimer={() => {
            if (v.variant.lines.length > 0 &&
              !window.confirm(`Supprimer « ${v.variant.name} » et ses ${v.variant.lines.length} arbitrage(s) ?`)) return
            supprimer.mutate(v.variant.id)
          }}
          suppressionEnCours={supprimer.isPending}
        />
      ))}

      {/* Création : les trois arbitrages les plus courants sont proposés d'un clic. */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-sm font-semibold">Ajouter une variante</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Une variante peut porter sur n'importe quel ouvrage du dossier, quel que soit son CFC.
            Nommez-la, puis désignez les arbitrages.
          </p>
          <NouvelleVariante onCreer={(nom) => creer.mutate({ name: nom })} enCours={creer.isPending} />
          {/* Raccourcis : les arbitrages les plus fréquents, à titre d'exemple. Ils ne
              limitent rien — n'importe quel intitulé fait une variante. */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Exemples :</span>
            {MODELES.filter((m) => !variants.some((v) => v.name === m.nom)).map((m) => (
              <button
                key={m.nom}
                onClick={() => creer.mutate({ name: m.nom, description: m.desc })}
                disabled={creer.isPending}
                className="rounded-lg border px-3 py-1 text-xs hover:border-primary/40 hover:bg-muted/50"
              >
                <Plus className="mr-1 inline h-3 w-3" />{m.nom}
              </button>
            ))}
          </div>
          {creer.isError && (
            <p className="mt-2 text-sm text-red-700">{(creer.error as Error).message}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/** Saisie libre d'un nom de variante, pour les arbitrages hors modèles. */
function NouvelleVariante({ onCreer, enCours }: { onCreer: (nom: string) => void; enCours: boolean }) {
  const [nom, setNom] = useState('')
  const valider = () => { const n = nom.trim(); if (n) { onCreer(n); setNom('') } }
  return (
    <div className="mt-3 flex gap-2">
      <Input
        value={nom} onChange={(e) => setNom(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') valider() }}
        placeholder="… ou nommez votre propre variante"
        className="max-w-sm"
      />
      <Button variant="outline" onClick={valider} disabled={!nom.trim() || enCours}>Créer</Button>
    </div>
  )
}

/** Tableau de comparaison : le diagnostic de base et chaque variante, côte à côte. */
function Comparaison({ base, variantes }: { base: { ht: number; cascade: { total: number } }; variantes: Variante[] }) {
  if (variantes.length === 0) {
    return (
      <p className="mt-4 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        Aucune variante pour l'instant. Le diagnostic de base chiffre {formatCHF(base.ht)} HT
        ({formatCHF(base.cascade.total)} TTC).
      </p>
    )
  }
  const moinsCher = variantes.reduce((a, b) => (b.ht < a.ht ? b : a))
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-1.5 font-medium">Scénario</th>
            <th className="w-24 py-1.5 text-right font-medium">Arbitrages</th>
            <th className="w-32 py-1.5 text-right font-medium">Travaux HT</th>
            <th className="w-32 py-1.5 text-right font-medium">Total TTC</th>
            <th className="w-32 py-1.5 text-right font-medium">Écart</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t">
            <td className="py-1.5 font-medium">Diagnostic de base</td>
            <td className="py-1.5 text-right text-muted-foreground">0</td>
            <td className="py-1.5 text-right tabular-nums">{formatCHF(base.ht)}</td>
            <td className="py-1.5 text-right font-medium tabular-nums">{formatCHF(base.cascade.total)}</td>
            <td className="py-1.5 text-right text-muted-foreground">référence</td>
          </tr>
          {variantes.map((v) => (
            <tr key={v.variant.id} className="border-t">
              <td className="py-1.5 font-medium">
                {v.variant.name}
                {v.ht === moinsCher.ht && variantes.length > 1 && (
                  <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">moins cher</span>
                )}
              </td>
              <td className="py-1.5 text-right tabular-nums">{v.arbitrages.length}</td>
              <td className="py-1.5 text-right tabular-nums">{formatCHF(v.ht)}</td>
              <td className="py-1.5 text-right font-medium tabular-nums">{formatCHF(v.cascade.total)}</td>
              <td className={cn('py-1.5 text-right font-medium tabular-nums',
                v.ecartHt < 0 ? 'text-emerald-700' : v.ecartHt > 0 ? 'text-red-700' : 'text-muted-foreground')}>
                {v.ecartHt === 0 ? '0' : `${v.ecartHt > 0 ? '+' : '−'}${formatCHF(Math.abs(v.ecartHt))}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Une variante et ses arbitrages, dépliable. */
function CarteVariante({ calcul, items, nomenclature, catalogue, qtyCtx, ouverte, onBasculer, onChange, onSupprimer, suppressionEnCours }: {
  calcul: Variante
  items: ApiDiagnosticItem[]
  /** Nomenclature CFC complète : n'importe quelle position peut être arbitrée. */
  nomenclature: ApiCfcEntry[]
  catalogue: ApiCatalogItem[]
  qtyCtx: QuantityContext
  ouverte: boolean
  onBasculer: () => void
  onChange: () => void
  onSupprimer: () => void
  suppressionEnCours: boolean
}) {
  const v = calcul.variant
  const supprimerLigne = useMutation({
    mutationFn: (lineId: string) => api.variants.removeLine(lineId),
    onSuccess: onChange,
  })

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <button onClick={onBasculer} className="min-w-0 flex-1 text-left">
            <h2 className="font-semibold">{v.name}</h2>
            {v.description && <p className="mt-0.5 text-sm text-muted-foreground">{v.description}</p>}
            <p className="mt-1 text-sm">
              <span className="font-semibold">{formatCHF(calcul.ht)} HT</span>
              <span className="text-muted-foreground"> · {formatCHF(calcul.cascade.total)} TTC · </span>
              <span className={cn('font-medium', calcul.ecartHt < 0 ? 'text-emerald-700' : calcul.ecartHt > 0 ? 'text-red-700' : 'text-muted-foreground')}>
                {calcul.ecartHt === 0 ? 'identique au diagnostic' : `${calcul.ecartHt > 0 ? '+' : '−'}${formatCHF(Math.abs(calcul.ecartHt))} vs diagnostic`}
              </span>
            </p>
          </button>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" onClick={onBasculer}>{ouverte ? 'Replier' : 'Modifier'}</Button>
            <button
              onClick={onSupprimer} disabled={suppressionEnCours}
              className="rounded-lg border p-2 text-muted-foreground hover:border-red-300 hover:text-red-600"
              title="Supprimer la variante"
            ><Trash2 className="h-4 w-4" /></button>
          </div>
        </div>

        {v.lines.length > 0 && (
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-1 font-medium">Au lieu de</th>
                <th className="py-1 font-medium">On retient</th>
                <th className="w-28 py-1 text-right font-medium">Montant HT</th>
                <th className="w-28 py-1 text-right font-medium">Écart</th>
                {ouverte && <th className="w-10" />}
              </tr>
            </thead>
            <tbody>
              {calcul.arbitrages.map((a) => (
                <LigneArbitrageLigne
                  key={a.ligne.id} a={a} catalogue={catalogue}
                  ouverte={ouverte} onChange={onChange}
                  onSupprimer={() => supprimerLigne.mutate(a.ligne.id)}
                />
              ))}
            </tbody>
          </table>
        )}

        <ConsequencesInduites calcul={calcul} items={items} catalogue={catalogue} onChange={onChange} />

        {ouverte && (
          <NouvelArbitrage
            variantId={v.id} items={items} dejaArbitres={v.lines}
            nomenclature={nomenclature} catalogue={catalogue} qtyCtx={qtyCtx} onAjout={onChange}
          />
        )}
      </CardContent>
    </Card>
  )
}

/** Formulaire d'ajout d'un arbitrage à une variante. */

/**
 * Ce qu'un arbitrage entraîne, et que la variante a oublié.
 *
 * C'est le garde-fou du calcul : une variante qui retire un ouvrage sans reprendre
 * ce qu'il portait paraît moins chère qu'elle ne l'est, et oriente la décision dans
 * le mauvais sens. On ne corrige rien d'office — c'est au diagnostiqueur d'arbitrer
 * — mais on refuse de laisser l'oubli silencieux.
 */
function ConsequencesInduites({ calcul, items, catalogue, onChange }: {
  calcul: Variante
  /** Tout le diagnostic : une règle peut constater qu'un travail y figure déjà. */
  items: ApiDiagnosticItem[]
  catalogue: ApiCatalogItem[]
  onChange: () => void
}) {
  const montantDeLaLigne = (l: ApiVariantLine) =>
    calcul.arbitrages.find((a) => a.ligne.id === l.id)?.montant ?? Number(l.amount)
  const manques = consequencesDe(calcul.variant, items, montantDeLaLigne)

  if (manques.length === 0) return null
  return (
    <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50/60 p-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-900">
        <AlertTriangle className="h-4 w-4" />
        À ne pas oublier dans cette variante
      </p>
      <ul className="mt-2 space-y-2">
        {manques.map((c, i) => (
          <ConsequenceLigne key={`${c.regle.id}-${i}`} c={c} calcul={calcul} catalogue={catalogue} onChange={onChange} />
        ))}
      </ul>
    </div>
  )
}

function ConsequenceLigne({ c, calcul, catalogue, onChange }: {
  c: Consequence
  calcul: Variante
  catalogue: ApiCatalogItem[]
  onChange: () => void
}) {
  // Article du catalogue le plus proche de la position attendue : il porte le prix,
  // donc le travail induit se chiffre comme les autres.
  const article = c.cfcAttendu
    ? catalogue.find((a) => (a.cfcCode ?? '').replace(/\D/g, '').startsWith(c.cfcAttendu!))
    : undefined

  const retirer = useMutation({
    mutationFn: (lineId: string) => api.variants.removeLine(lineId),
    onSuccess: onChange,
  })
  const ajouter = useMutation({
    mutationFn: () => api.variants.addLine(calcul.variant.id, {
      catalogItemId: article?.id ?? null,
      state: 'MAUVAIS',
      cfcCode: article?.cfcCode ?? c.cfcAttendu ?? 'N/A',
      label: article?.description
        ?? (c.regle.effet.type === 'ajouter' ? c.regle.effet.libelle : c.regle.titre),
      unit: article?.unit ?? null,
      area: null,
      amount: 0,
      costManual: !article,
      note: c.regle.titre,
    }),
    onSuccess: onChange,
  })

  const ligneReduite = c.ouvrageReduit
    ? calcul.arbitrages.find((a) => a.remplace?.id === c.ouvrageReduit!.item.id)?.ligne
    : undefined

  return (
    <li className="text-sm">
      <p className="font-medium text-amber-900">{c.regle.titre}</p>
      <p className="text-xs text-amber-800">{c.regle.raison}</p>
      {c.nature === 'conserver' && c.ouvrageReduit && (
        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-amber-900">
            « {c.ouvrageReduit.item.cfcLabel} » est ramené de {formatCHF(c.ouvrageReduit.montantBase)} à
            {' '}{formatCHF(c.ouvrageReduit.montantVariante)}.
          </span>
          {ligneReduite && (
            <button
              onClick={() => retirer.mutate(ligneReduite.id)} disabled={retirer.isPending}
              className="rounded border border-amber-400 bg-white px-2 py-0.5 font-medium text-amber-900 hover:bg-amber-100"
            >Rétablir l'ouvrage entier</button>
          )}
        </p>
      )}
      {c.nature === 'ajouter' && (
        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-amber-900">
            {article
              ? `Proposé : ${article.cfcCode} · ${article.description}.`
              : `Aucun article de catalogue en CFC ${c.cfcAttendu} : à ajouter à la main.`}
          </span>
          {article && (
            <button
              onClick={() => ajouter.mutate()} disabled={ajouter.isPending}
              className="rounded border border-amber-400 bg-white px-2 py-0.5 font-medium text-amber-900 hover:bg-amber-100"
            >Ajouter au devis de la variante</button>
          )}
        </p>
      )}
    </li>
  )
}

/**
 * Une ligne d'arbitrage, modifiable en place.
 *
 * Tant qu'une ligne n'est rattachée à aucun article du catalogue, son montant
 * reste un nombre saisi : il ne suit ni le catalogue, ni les dimensions du
 * bâtiment. Pouvoir choisir l'article et l'état après coup est donc ce qui permet
 * de faire basculer une ligne d'un montant figé à un montant calculé — sans la
 * supprimer et la ressaisir.
 */
function LigneArbitrageLigne({ a, catalogue, ouverte, onChange, onSupprimer }: {
  a: LigneArbitrage
  catalogue: ApiCatalogItem[]
  ouverte: boolean
  onChange: () => void
  onSupprimer: () => void
}) {
  const modifier = useMutation({
    mutationFn: (corps: Parameters<typeof api.variants.updateLine>[1]) =>
      api.variants.updateLine(a.ligne.id, corps),
    onSuccess: onChange,
  })
  const calcule = a.ligne.catalogItemId != null && a.ligne.state != null && !a.ligne.costManual

  return (
    <tr className="border-t align-top">
      <td className="py-1.5 pr-3">
        {a.remplace ? (
          <>
            <span className="font-mono text-xs text-muted-foreground">{a.remplace.cfcCode}</span>{' '}
            {a.remplace.cfcLabel}
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              {a.remplace.state && (
                <span className={cn('rounded px-1.5 text-[10px] text-white', stateColors[a.remplace.state])}>
                  {stateLabels[a.remplace.state]}
                </span>
              )}
              {formatCHF(a.montantRemplace)}
            </div>
          </>
        ) : (
          <span className="text-muted-foreground">Travail nouveau</span>
        )}
      </td>

      <td className="py-1.5 pr-3">
        <span className="font-mono text-xs text-muted-foreground">{a.ligne.cfcCode}</span>{' '}
        {a.ligne.label}
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {a.ligne.state && (
            <span className={cn('rounded px-1.5 text-[10px] text-white', stateColors[a.ligne.state])}>
              {stateLabels[a.ligne.state]}
            </span>
          )}
          {a.quantite != null && (
            <span>
              {a.quantite} {uniteCourte(a.ligne.unit) ?? ''}
              {a.baseMetre && <span className="italic"> ({a.baseMetre})</span>}
            </span>
          )}
          {a.ligne.costManual && <span className="italic">montant forcé</span>}
        </div>
        {a.ligne.note && <div className="text-xs italic text-muted-foreground">{a.ligne.note}</div>}

        {ouverte && (
          <div className="mt-2 space-y-1.5 rounded border border-dashed p-2">
            <select
              value={a.ligne.catalogItemId ?? ''}
              onChange={(e) => {
                const id = e.target.value ? Number(e.target.value) : null
                const art = catalogue.find((c) => c.id === id)
                // Rattacher un article rend la ligne calculable : on relâche donc le
                // montant forcé, sinon le chiffre resterait figé sans qu'on voie pourquoi.
                modifier.mutate({
                  catalogItemId: id, costManual: false,
                  unit: art?.unit ?? a.ligne.unit,
                  cfcCode: art?.cfcCode ?? a.ligne.cfcCode,
                })
              }}
              className="h-8 w-full rounded border bg-background px-1.5 text-xs"
            >
              <option value="">Aucun article, montant saisi</option>
              {catalogue.map((c) => (
                <option key={c.id} value={c.id}>{c.cfcCode ? `${c.cfcCode} · ` : ''}{c.description}</option>
              ))}
            </select>
            <div className="flex flex-wrap items-center gap-1">
              {ETATS.map((e) => (
                <button
                  key={e} type="button"
                  onClick={() => modifier.mutate({ state: e, costManual: false })}
                  className={cn('rounded border px-1.5 py-0.5 text-[11px]',
                    a.ligne.state === e ? `${stateColors[e]} border-transparent text-white` : 'hover:border-primary/40')}
                >{stateLabels[e]}</button>
              ))}
              {modifier.isPending && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </div>
            <p className={cn('text-[11px]', calcule ? 'text-muted-foreground' : 'text-amber-700')}>
              {calcule
                ? 'Montant calculé depuis le catalogue et les dimensions du bâtiment.'
                : "Montant saisi : choisissez un article et un état pour qu'il se calcule."}
            </p>
          </div>
        )}
      </td>

      <td className="py-1.5 text-right tabular-nums">{formatCHF(a.montant)}</td>
      <td className={cn('py-1.5 text-right font-medium tabular-nums',
        a.ecart < 0 ? 'text-emerald-700' : a.ecart > 0 ? 'text-red-700' : 'text-muted-foreground')}>
        {a.ecart === 0 ? '0' : `${a.ecart > 0 ? '+' : '−'}${formatCHF(Math.abs(a.ecart))}`}
      </td>
      {ouverte && (
        <td className="py-1.5 text-right">
          <button onClick={onSupprimer} className="text-muted-foreground hover:text-red-600" title="Retirer cet arbitrage">
            <X className="h-4 w-4" />
          </button>
        </td>
      )}
    </tr>
  )
}

/**
 * Ajout d'un arbitrage.
 *
 * Le montant n'est pas saisi : il est calculé. On désigne l'ouvrage concerné, on
 * choisit l'article retenu à sa place et l'état visé, et le prix sort du catalogue
 * — mêmes prix par état, même indexation que le diagnostic. La plus-value est donc
 * la différence entre les deux, et elle se recalcule dès qu'on change d'article ou
 * d'état. Le montant reste reprenable à la main quand le catalogue est muet.
 */
function NouvelArbitrage({ variantId, items, dejaArbitres, nomenclature, catalogue, qtyCtx, onAjout }: {
  variantId: string
  items: ApiDiagnosticItem[]
  dejaArbitres: ApiVariant['lines']
  nomenclature: ApiCfcEntry[]
  /** Catalogue du bureau : il porte les prix par état, donc le calcul. */
  catalogue: ApiCatalogItem[]
  /** Dimensions du bâtiment : elles donnent la quantité, on ne la saisit pas. */
  qtyCtx: QuantityContext
  onAjout: () => void
}) {
  const [remplace, setRemplace] = useState('')
  const [articleId, setArticleId] = useState('')
  const [etat, setEtat] = useState<ElementState | ''>('')
  const [quantite, setQuantite] = useState('')
  const [libelle, setLibelle] = useState('')
  const [cfc, setCfc] = useState('')
  const [forceMontant, setForceMontant] = useState(false)
  const [montantSaisi, setMontantSaisi] = useState('')
  const [note, setNote] = useState('')

  const parId = useMemo(() => new Map(catalogue.map((c) => [c.id, c])), [catalogue])
  const ouvrageChoisi = items.find((i) => i.id === remplace)
  const article = articleId ? parId.get(Number(articleId)) : undefined

  /**
   * Quantité de la variante, dans cet ordre :
   *  1. ce que l'utilisateur a repris à la main, s'il l'a fait ;
   *  2. la quantité relevée sur place sur l'ouvrage remplacé — une mesure vaut
   *     mieux qu'une formule, c'est déjà la règle du diagnostic ;
   *  3. la quantité déduite des dimensions du bâtiment pour l'article retenu.
   * Remplacer des fenêtres par d'autres fenêtres retrouve donc les mêmes mètres
   * carrés que le diagnostic, sans les ressaisir.
   */
  const resolution = article ? resolveQuantity(article, qtyCtx) : null
  const mesureSurPlace = ouvrageChoisi?.quantityManual && ouvrageChoisi.area != null
    ? ouvrageChoisi.area : undefined
  const quantiteAuto = mesureSurPlace ?? resolution?.quantity
  const origineQuantite = mesureSurPlace != null
    ? 'relevée sur place au diagnostic'
    : resolution?.origin === 'formule' ? resolution.basis : resolution?.reason

  const qte = quantite !== '' ? Number(quantite) : (quantiteAuto ?? null)
  const montantCalcule = montantDepuisCatalogue(article, etat || null, qte)
  const montant = forceMontant || montantCalcule == null
    ? (montantSaisi === '' ? null : Number(montantSaisi))
    : montantCalcule
  const montantBase = ouvrageChoisi ? montantOuvrage(ouvrageChoisi) : 0
  const plusValue = montant == null ? null : montant - montantBase

  /** Choisir l'ouvrage à remplacer préremplit tout ce qui peut l'être. */
  const choisirOuvrage = (id: string) => {
    setRemplace(id)
    const it = items.find((i) => i.id === id)
    if (!it) return
    // On part de l'existant : même article, même état. La quantité, elle, se déduit
    // du bâtiment — la saisir ici reviendrait à figer une valeur qui doit suivre le
    // dossier.
    if (it.catalogItemId != null) setArticleId(String(it.catalogItemId))
    if (it.state) setEtat(it.state)
    if (!cfc.trim()) setCfc(it.cfcCode)
  }

  const ajouter = useMutation({
    mutationFn: () => api.variants.addLine(variantId, {
      replacesItemId: remplace || null,
      catalogItemId: article?.id ?? null,
      state: etat || null,
      cfcCode: (cfc.trim() || article?.cfcCode || ouvrageChoisi?.cfcCode || 'N/A'),
      label: libelle.trim() || article?.description || '',
      unit: article?.unit ?? ouvrageChoisi?.unit ?? null,
      area: qte,
      amount: montant ?? 0,
      costManual: forceMontant || montantCalcule == null,
      note: note.trim() || null,
    }),
    onSuccess: () => {
      setRemplace(''); setArticleId(''); setEtat(''); setQuantite('')
      setLibelle(''); setCfc(''); setForceMontant(false); setMontantSaisi(''); setNote('')
      onAjout()
    },
  })

  // Un ouvrage déjà arbitré dans cette variante ne doit pas pouvoir l'être deux fois :
  // deux lignes le remplaçant donneraient deux totaux selon l'ordre de lecture.
  const disponibles = items.filter((it) => !dejaArbitres.some((l) => l.replacesItemId === it.id))
  const cfcTrouve = nomenclature.find((n) => n.code === cfc.trim())
  const uniteArticle = uniteCourte(article?.unit)
  const nomRetenu = libelle.trim() || article?.description || ''
  const valide = nomRetenu.length > 0 && montant != null && montant >= 0

  return (
    <div className="mt-4 rounded-lg border border-dashed p-4">
      <datalist id="cfc-nomenclature">
        {nomenclature.map((n) => <option key={n.code} value={n.code}>{n.label}</option>)}
      </datalist>

      <p className="text-sm font-medium">Ajouter un arbitrage</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        N'importe quel ouvrage du dossier peut être remplacé, par n'importe quel article du
        catalogue et dans l'état de votre choix. La plus-value se calcule toute seule.
      </p>

      <div className="mt-3 grid gap-4 md:grid-cols-2">
        {/* --- Ce qu'on remplace --- */}
        <div className="rounded-lg border p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">CFC concerné</p>
          <select
            value={remplace} onChange={(e) => choisirOuvrage(e.target.value)}
            className="h-9 w-full rounded-lg border bg-background px-2 text-sm"
          >
            <option value="">Rien, c'est un travail nouveau</option>
            {disponibles.map((it) => (
              <option key={it.id} value={it.id}>
                {it.cfcCode} · {it.cfcLabel}{suffixeLocalisation(it.localisation)}
              </option>
            ))}
          </select>
          {ouvrageChoisi ? (
            <div className="mt-2 space-y-1 text-sm">
              <p className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">État actuel</span>
                {ouvrageChoisi.state
                  ? <span className={cn('rounded px-1.5 text-[11px] text-white', stateColors[ouvrageChoisi.state])}>{stateLabels[ouvrageChoisi.state]}</span>
                  : <span className="text-xs">à évaluer</span>}
              </p>
              <p><span className="text-xs text-muted-foreground">Montant au diagnostic</span> <span className="font-semibold">{formatCHF(montantBase)}</span></p>
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">Rien ne sort du devis : la ligne s'ajoutera au total.</p>
          )}
        </div>

        {/* --- Ce qu'on retient --- */}
        <div className="rounded-lg border p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">CFC de remplacement</p>
          <select
            value={articleId}
            onChange={(e) => {
              setArticleId(e.target.value)
              const a = parId.get(Number(e.target.value))
              // Le libellé et le CFC suivent l'article choisi tant qu'on ne les a pas
              // repris à la main : c'est le cas le plus fréquent.
              if (a && !libelle.trim()) setLibelle(a.description)
              if (a?.cfcCode) setCfc(a.cfcCode)
            }}
            className="h-9 w-full rounded-lg border bg-background px-2 text-sm"
          >
            <option value="">Choisir un article du catalogue…</option>
            {catalogue.map((c) => (
              <option key={c.id} value={c.id}>{c.cfcCode ? `${c.cfcCode} · ` : ''}{c.description}</option>
            ))}
          </select>

          <p className="mb-1 mt-3 text-xs font-medium text-muted-foreground">État retenu</p>
          <div className="flex flex-wrap gap-1.5">
            {ETATS.map((e) => (
              <button
                key={e} type="button" onClick={() => setEtat(e)}
                className={cn('rounded-lg border px-2 py-1 text-xs',
                  etat === e ? `${stateColors[e]} border-transparent text-white` : 'hover:border-primary/40')}
              >{stateLabels[e]}</button>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="text-xs">
              <span className="mb-1 flex items-baseline justify-between gap-2 font-medium text-muted-foreground">
                <span>Quantité</span>
                {quantite !== '' && quantiteAuto != null && (
                  <button type="button" onClick={() => setQuantite('')} className="text-primary hover:underline">
                    reprendre le calcul
                  </button>
                )}
              </span>
              <Input
                type="number" min="0" value={quantite} onChange={(e) => setQuantite(e.target.value)}
                placeholder={quantiteAuto != null ? String(quantiteAuto) : 'à saisir'}
              />
            </label>
            <label className="text-xs">
              <span className="mb-1 block font-medium text-muted-foreground">Code CFC</span>
              <Input list="cfc-nomenclature" value={cfc} onChange={(e) => setCfc(e.target.value)} placeholder="ex. 221.1" />
            </label>
          </div>
          {/* D'où sort la quantité : sans cette ligne, un métré déduit passerait pour
              une valeur saisie, et personne ne saurait quoi corriger s'il est faux. */}
          {article && (
            <p className={cn('mt-1 text-xs', quantiteAuto == null ? 'text-amber-700' : 'text-muted-foreground')}>
              {quantite !== ''
                ? 'Quantité reprise à la main.'
                : quantiteAuto != null
                  ? `${quantiteAuto} ${uniteArticle ?? ''} déduits du bâtiment, ${origineQuantite}.`
                  : `Ne se déduit pas des dimensions du bâtiment${origineQuantite ? ` : ${origineQuantite}` : ''}. À saisir.`}
            </p>
          )}
          {cfcTrouve && <p className="mt-1 text-xs text-muted-foreground">{cfcTrouve.label}</p>}

          <label className="mt-2 block text-xs">
            <span className="mb-1 block font-medium text-muted-foreground">Intitulé</span>
            <Input value={libelle} onChange={(e) => setLibelle(e.target.value)}
              placeholder={article?.description ?? 'ex. Fenêtres en bois-métal'} />
          </label>
        </div>
      </div>

      {/* --- Plus-value, calculée --- */}
      <div className="mt-3 rounded-lg border bg-muted/20 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <span className="text-xs text-muted-foreground">Plus-value</span>
            {montant == null ? (
              <p className="text-muted-foreground">
                Choisissez l'article, l'état et la quantité, ou reprenez le montant à la main.
              </p>
            ) : (
              <p className="flex flex-wrap items-center gap-2">
                <span>{formatCHF(montantBase)}</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-semibold">{formatCHF(montant)}</span>
                <span className={cn('font-semibold', plusValue! < 0 ? 'text-emerald-700' : plusValue! > 0 ? 'text-red-700' : 'text-muted-foreground')}>
                  {plusValue === 0 ? 'identique' : `${plusValue! > 0 ? '+' : '−'}${formatCHF(Math.abs(plusValue!))}`}
                </span>
              </p>
            )}
            {montantCalcule != null && !forceMontant && article && etat && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {qte} × prix catalogue « {stateLabels[etat as ElementState].toLowerCase()} » de {article.description}
              </p>
            )}
            {montantCalcule == null && article && etat && qte != null && (
              <p className="mt-0.5 text-xs text-amber-700">
                Le catalogue ne donne pas de prix pour cet état : reprenez le montant à la main.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {(forceMontant || montantCalcule == null) && (
              <Input type="number" min="0" className="w-36" value={montantSaisi}
                onChange={(e) => setMontantSaisi(e.target.value)} placeholder="Montant HT" />
            )}
            {montantCalcule != null && (
              <button type="button" onClick={() => { setForceMontant((f) => !f); setMontantSaisi(String(montantCalcule)) }}
                className="text-xs text-primary hover:underline">
                {forceMontant ? 'Reprendre le catalogue' : 'Forcer le montant'}
              </button>
            )}
          </div>
        </div>
      </div>

      <label className="mt-3 block text-xs">
        <span className="mb-1 block font-medium text-muted-foreground">Note (facultative)</span>
        <Input value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="ex. perte de 4 cm de surface habitable par paroi" />
      </label>

      <div className="mt-3 flex items-center gap-3">
        <Button onClick={() => ajouter.mutate()} disabled={!valide || ajouter.isPending}>
          {ajouter.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
          Ajouter
        </Button>
        {ajouter.isError && <p className="text-sm text-red-700">{(ajouter.error as Error).message}</p>}
      </div>
    </div>
  )
}
