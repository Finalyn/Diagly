/**
 * Rapport de diagnostic « standard », paginé en A4.
 *
 * C'est le document que servent les variantes Sommaire, Détaillé et Documenté,
 * ainsi que l'onglet Rapports : même corps, un chapitre en plus ou en moins.
 *
 * Il était rendu dans une carte qui défilait, et le navigateur découpait les
 * pages tout seul au moment d'imprimer : le tableau des observations perdait ses
 * intitulés de colonnes en changeant de feuille, et on ne voyait jamais à l'écran
 * ce qui sortirait de l'imprimante. Le contenu part désormais en blocs, répartis
 * sur de vraies feuilles A4 avec logo et numéro de page.
 */
import { useMemo, type ReactNode } from 'react'
import { DocumentA4, type BlocDocument } from './PagesA4'
import { Info, LogoEntete, Row, SectionTitre, TitreRapport } from './shared'
import { TVA, toNum } from './constants'
import { VariantsCompare, type RVariant } from './scenarios'
import { blocsPhotos } from './photos'
import { buildingTypeLabels, stateColors, stateLabels } from '@/data/mock'
import { computeProjectMetrics } from '@/lib/formulas'
import { getMarketCoeff, phraseIndexation, priceBasisNote } from '@/lib/diagnostic-auto'
import { cn, formatCHF, formatDate } from '@/lib/utils'
import type { ApiDiagnosticItem, ApiProject, ElementState } from '@/lib/api-types'

/**
 * Prix unitaire réellement appliqué : le coût rapporté à la quantité. C'est la valeur
 * qui permet à un destinataire de contester un montant, contrairement au prix catalogue
 * qui n'inclut pas l'indice de construction.
 */
function prixUnitaire(it: { area: number | null; estimatedCost: string | null }): string {
  const cost = toNum(it.estimatedCost)
  if (!it.area || it.area <= 0 || cost <= 0) return '—'
  return formatCHF(Math.round(cost / it.area))
}

/** Largeurs imposées : sans elles, les morceaux d'un même tableau ne s'alignent plus d'une page à l'autre. */
const COLONNES = (
  <>
    <col style={{ width: '15mm' }} />
    <col />
    <col style={{ width: '21mm' }} />
    <col style={{ width: '11mm' }} />
    <col style={{ width: '21mm' }} />
    <col style={{ width: '23mm' }} />
    <col style={{ width: '25mm' }} />
  </>
)

const ENTETE = (
  <thead>
    <tr className="text-left text-muted-foreground">
      <th className="py-1 font-medium">CFC</th>
      <th className="py-1 font-medium">Élément</th>
      <th className="py-1 font-medium">État</th>
      <th className="py-1 font-medium">Prio.</th>
      <th className="py-1 text-right font-medium">Quantité</th>
      <th className="py-1 text-right font-medium">Prix unit.</th>
      <th className="py-1 text-right font-medium">Coût</th>
    </tr>
  </thead>
)

export interface RapportStandardProps {
  project: ApiProject
  items: ApiDiagnosticItem[]
  groups: { code: string; label: string; items: ApiDiagnosticItem[] }[]
  etatExistant: (it: { catalogItemId: number | null; state: ElementState | null }) => string | null
  auteur: string
  titre: string
  /** Le rapport sommaire remplace le détail des observations par la comparaison des scénarios. */
  sommaire?: boolean
  /** Le rapport documenté annexe le reportage photo au même document. */
  avecPhotos?: boolean
  variants: RVariant[]
}

export function RapportStandard({
  project, items, groups, etatExistant, auteur, titre, sommaire, avecPhotos, variants,
}: RapportStandardProps) {
  const aujourdhui = formatDate(new Date())
  const metrics = computeProjectMetrics(project)
  const roof = metrics.roof

  const couts = useMemo(() => {
    const htRepair = items.reduce((s, i) => s + toNum(i.estimatedCost), 0)
    const htImprovement = items.reduce((s, i) => s + toNum(i.improvementCost), 0)
    const htNorms = items.reduce((s, i) => s + toNum(i.normsCost), 0)
    const ht = htRepair + htImprovement + htNorms
    const honoraires = ht * (project.honoraryPct ?? 0) / 100
    const apresHonoraires = ht + honoraires
    const reserve = apresHonoraires * (project.reservePct ?? 0) / 100
    const sousTotal = apresHonoraires + reserve
    const tva = sousTotal * TVA
    const parPriorite = (['I', 'II', 'III'] as const).map((p) => ({
      p,
      total: items.filter((i) => i.priority === p).reduce((s, i) => s + toNum(i.estimatedCost), 0),
      count: items.filter((i) => i.priority === p).length,
    }))
    return { htRepair, htImprovement, htNorms, ht, honoraires, reserve, sousTotal, tva, total: sousTotal + tva, parPriorite }
  }, [items, project.honoraryPct, project.reservePct])

  const blocs = useMemo(() => {
    const out: BlocDocument[] = []
    const bloc = (cle: string, noeud: ReactNode, o: { nouvellePage?: boolean; avecSuivant?: boolean } = {}) =>
      out.push({ type: 'bloc', cle, noeud, ...o })

    bloc('titre', (
      <TitreRapport
        titre={titre}
        projet={project.name}
        mention={`Édité le ${aujourdhui}${auteur ? ` par ${auteur}` : ''}`}
      />
    ), { avecSuivant: true })

    // ------------------------------------------------------------ bâtiment
    bloc('batiment', (
      <section>
        <SectionTitre>Bâtiment</SectionTitre>
        <div className="grid grid-cols-2 gap-x-8 gap-y-1">
          <Info l="Adresse" v={`${project.address}, ${project.postalCode ?? ''} ${project.city} (${project.canton})`} />
          <Info l="Type" v={buildingTypeLabels[project.buildingType]} />
          <Info l="Année de construction" v={project.yearBuilt ? String(project.yearBuilt) : '—'} />
          <Info l="Année de rénovation" v={project.renovationYear ? String(project.renovationYear) : '—'} />
          <Info l="Parcelle" v={project.parcelNumber ?? '—'} />
          <Info l="Logements / étages" v={`${project.nbApartments ?? '—'} / ${project.nbFloors ?? '—'}`} />
          <Info l="Surface plancher / bâtie" v={`${project.floorArea ?? '—'} / ${project.builtArea ?? '—'} m²`} />
          <Info l="Façade / Toiture" v={`${metrics.facade.toFixed(0)} m² / ${roof != null ? roof + ' m²' : 'à préciser'}`} />
        </div>
      </section>
    ))

    // ------------------------------------------- contraintes géo/énergétiques
    if (project.geoData || project.energyClassGlobal || project.sre != null) {
      const g = project.geoData
      const patrimoine = [
        g?.heritage?.isos && `ISOS (${g.heritage.isos})`,
        g?.heritage?.unesco && `UNESCO (${g.heritage.unesco})`,
        g?.heritage?.bln && `BLN (${g.heritage.bln})`,
      ].filter(Boolean).join(' · ')
      const radonEleve = g?.radonPct != null && g.radonPct >= 20
      const notes = [
        patrimoine && 'Bâtiment en secteur protégé : surcoûts patrimoniaux possibles.',
        radonEleve && 'Zone radon élevée : mesures de mitigation possibles.',
      ].filter(Boolean).join(' ')

      bloc('contraintes', (
        <section>
          <SectionTitre>Contraintes &amp; données géo/énergétiques</SectionTitre>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1">
            {(g?.affectationDetail || g?.affectation) && <Info l="Affectation" v={(g?.affectationDetail ?? g?.affectation) as string} />}
            {g?.noise && <Info l="Sensibilité au bruit" v={g.noise} />}
            {project.egid && <Info l="EGID" v={project.egid} />}
            {g?.radonPct != null && <Info l="Radon (dépassement)" v={`${g.radonPct} %`} />}
            {g?.seismic && <Info l="Classe de sol sismique" v={g.seismic} />}
            {patrimoine && <Info l="Patrimoine protégé" v={patrimoine} />}
            {project.energyClassGlobal && <Info l="Classe énergétique" v={project.energyClassGlobal} />}
            {project.sre != null && <Info l="SRE (certificat)" v={`${project.sre} m²`} />}
            {project.energyAgent && <Info l="Agent énergétique" v={project.energyAgent} />}
          </div>
          {notes && <p className="mt-2 text-amber-700">{notes}</p>}
        </section>
      ))
    }

    // -------------------------------------------------------- synthèse coûts
    bloc('couts', (
      <section>
        <SectionTitre>Synthèse des coûts</SectionTitre>
        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-1">
            {/* Le détail par enveloppe n'a de sens que s'il y en a plusieurs :
                sinon « Réparation » et « Travaux » affichaient deux fois le même montant. */}
            {(couts.htImprovement > 0 || couts.htNorms > 0) && <Row l="Réparation (HT)" v={formatCHF(couts.htRepair)} />}
            {couts.htImprovement > 0 && <Row l="Amélioration (HT)" v={formatCHF(couts.htImprovement)} />}
            {couts.htNorms > 0 && <Row l="Mise aux normes (HT)" v={formatCHF(couts.htNorms)} />}
            <Row l="Travaux (HT)" v={formatCHF(couts.ht)} strong />
            <Row l={`Honoraires (${project.honoraryPct ?? 0}%)`} v={formatCHF(couts.honoraires)} />
            <Row l={`Réserve (${project.reservePct ?? 0}%)`} v={formatCHF(couts.reserve)} />
            <Row l="Sous-total" v={formatCHF(couts.sousTotal)} />
            <Row l="TVA 8.1%" v={formatCHF(couts.tva)} />
            <div className="flex justify-between border-t pt-2 font-bold">
              <span>Total TTC</span><span>{formatCHF(couts.total)}</span>
            </div>
          </div>
          <div className="space-y-1">
            {couts.parPriorite.map((b) => (
              <Row key={b.p} l={`Priorité ${b.p} (${b.count})`} v={formatCHF(b.total)} />
            ))}
            <p className="pt-2 text-muted-foreground">
              Estimation ±15%. {items.length} élément{items.length !== 1 ? 's' : ''} diagnostiqué{items.length !== 1 ? 's' : ''}.
            </p>
          </div>
        </div>
      </section>
    ))

    // ------------------------------------------------- scénarios (sommaire)
    if (sommaire) {
      bloc('scenarios-titre', <SectionTitre>Scénarios de rénovation</SectionTitre>, { avecSuivant: true })
      bloc('scenarios', (
        <VariantsCompare
          variants={variants}
          energyClass={project.energyClassGlobal ?? project.energyClassEnvelope ?? null}
        />
      ))
    }

    // ------------------------------------------------------ détail par CFC
    if (!sommaire) {
      bloc('detail-titre', <SectionTitre>Détail des observations (par CFC)</SectionTitre>, { avecSuivant: true })

      if (items.length === 0) {
        bloc('detail-vide', <p className="text-muted-foreground">Aucun élément observé.</p>)
      }

      for (const g of groups) {
        const tableauId = `detail-${g.code || 'nc'}`
        bloc(`${tableauId}-titre`, (
          <h3 className="mb-1 mt-3 border-b pb-1 font-bold uppercase tracking-wide">
            {g.code ? `${g.code} · ${g.label}` : g.label}
          </h3>
        ), { avecSuivant: true })

        for (const it of g.items) {
          out.push({
            type: 'lignes', cle: `${tableauId}-${it.id}`, tableauId, colonnes: COLONNES, entete: ENTETE,
            lignes: (
              <tr className="border-t align-top">
                <td className="py-1 font-mono">{it.cfcCode}</td>
                <td className="py-1">
                  {it.cfcLabel}
                  {/* État existant constaté : c'est le cœur du livrable, pas seulement une aide à la saisie. */}
                  {etatExistant(it) && <div className="text-muted-foreground">{etatExistant(it)}</div>}
                  {it.works.length > 0 && <div className="italic text-muted-foreground">Travaux : {it.works.join(' · ')}</div>}
                </td>
                <td className="py-1">
                  {it.state ? (
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                      <span className={cn('inline-block h-2.5 w-2.5 rounded-full border border-black/20', stateColors[it.state])} />
                      {stateLabels[it.state]}
                    </span>
                  ) : 'À évaluer'}
                </td>
                <td className="py-1">{it.priority ?? '—'}</td>
                <td className="py-1 text-right tabular-nums">
                  {it.area != null ? `${it.area}${it.unit ? ` ${it.unit.replace(/^CHF\s*\/?\s*/i, '')}` : ''}` : '—'}
                  {it.quantityManual && <span className="ml-1 text-muted-foreground" title="Quantité relevée sur place">·</span>}
                </td>
                <td className="py-1 text-right tabular-nums">{prixUnitaire(it)}</td>
                <td className="py-1 text-right font-medium tabular-nums">{it.estimatedCost ? formatCHF(toNum(it.estimatedCost)) : '—'}</td>
              </tr>
            ),
          })
        }
      }
    }

    // ------------------------------------------------------------ hypothèses
    bloc('hypotheses-titre', <SectionTitre>Hypothèses retenues</SectionTitre>, { avecSuivant: true })
    bloc('hypotheses', (
      <>
        <table className="doc-tableau w-full">
          <colgroup>
            <col style={{ width: '46mm' }} />
            <col style={{ width: '30mm' }} />
            <col />
          </colgroup>
          <tbody>
            {([
              ['Surface de façade', `${Math.round(metrics.facade)} m²`,
                project.perimeter ? `périmètre ${project.perimeter} ml × ${project.nbFloors ?? '?'} étages × ${project.floorHeight ?? 2.7} m` : 'surface relevée'],
              ["Hauteur d'étage", `${project.floorHeight ?? 2.7} m`, project.floorHeight ? 'renseignée' : 'valeur par défaut, non relevée'],
              ['Part vitrée', `${project.windowPct} %`, 'appliquée à la surface de façade'],
              ['Surface de toiture', roof != null ? `${roof} m²` : `${Math.round(metrics.flatRoof)}–${Math.round(metrics.slopedRoof)} m²`,
                roof != null ? `type ${project.roofType === 'PENTE' ? 'en pente' : project.roofType === 'MIXTE' ? 'mixte' : 'plate'}` : 'type de toiture non précisé, aucune présomption'],
              ['Indice de construction', `× ${getMarketCoeff()}`, phraseIndexation()],
              ['Honoraires / Réserve', `${project.honoraryPct ?? 0} % / ${project.reservePct ?? 0} %`, 'réserve calculée sur le montant déjà majoré'],
              ['TVA', '8.1 %', 'appliquée au sous-total'],
            ] as [string, string, string][]).map(([l, v, note]) => (
              <tr key={l} className="border-t align-top">
                <td className="py-1">{l}</td>
                <td className="py-1 font-medium tabular-nums">{v}</td>
                <td className="py-1 text-muted-foreground">{note}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-muted-foreground">
          Les quantités suivies d'un point ont été relevées sur place et ne sont plus recalculées. Les
          autres sont déduites des dimensions du bâtiment ci-dessus, à la date d'édition : corriger une
          dimension du dossier met à jour les montants correspondants.
        </p>
      </>
    ))

    // ------------------------------------------- annexe photo (documenté)
    if (avecPhotos) {
      bloc('annexe-titre', <SectionTitre>Annexe : reportage photo</SectionTitre>,
        { nouvellePage: true, avecSuivant: true })
      out.push(...blocsPhotos(groups, 'annexe'))
    }

    bloc('mentions', (
      <p className="mt-6 border-t pt-3 text-muted-foreground">
        {priceBasisNote()} Surfaces et coûts estimés par formules, à vérifier sur place.
        Rapport généré par Diagly.
      </p>
    ))

    return out
  }, [project, items, groups, couts, metrics, roof, etatExistant, titre, sommaire, avecPhotos, variants, aujourdhui, auteur])

  return (
    <DocumentA4
      blocs={blocs}
      entete={<LogoEntete />}
      mentionPied={`${project.name} · ${aujourdhui}`}
    />
  )
}
