/**
 * Rapport complet — le livrable « clé en main ».
 *
 * Les rapports existants sont des pièces : l'un décrit l'existant, l'autre chiffre,
 * un troisième montre les photos. Le bureau devait les imprimer séparément puis
 * reconstruire le document dans Word, en ajoutant à la main la page de garde, le
 * sommaire et l'explication de la méthode. Ce rapport-ci est le document entier,
 * dans l'ordre où il se lit, prêt à partir chez le client :
 *
 *   garde · sommaire · méthode · bâtiment · état et travaux (avec photos) · devis
 *
 * Le devis est à la maille CFC 3 chiffres et groupé par priorité, parce que c'est
 * ainsi que la décision se prend : « ce qu'il faut engager dans les cinq ans » est
 * une enveloppe, pas une ligne perdue au milieu des autres. Son calcul est dans
 * `@/lib/devis`, avec ses tests.
 *
 * Ce fichier ne produit pas une page web : il produit la suite de blocs d'un
 * document, que `DocumentA4` répartit ensuite sur des feuilles A4 réelles. Chaque
 * chapitre ouvre une page, chaque feuille porte le logo et son numéro.
 */
import { useMemo, type ReactNode } from 'react'
import { buildingTypeLabels, priorityDescriptions, priorityTextColors, stateLabels } from '@/data/mock'
import { cfcGroupCode, cfcLabelIndex } from '@/lib/cfc'
import { LIBELLE_LOCALISATION } from '@/lib/localisation'
import { getMarketInfo, phraseIndexation, priceBasisNote } from '@/lib/diagnostic-auto'
import { buildDevis, HORIZON, PRIORITES, uniteCourte, type Devis, type DevisBloc } from '@/lib/devis'
import { dureeVieResiduelle, phraseDureeVie } from '@/lib/duree-vie'
import { calculerVariantes, type Variante } from '@/lib/variantes'
import { buildQuantityContext } from '@/lib/diagnostic-auto'
import { computeProjectMetrics } from '@/lib/formulas'
import { cn, formatCHF, formatDate } from '@/lib/utils'
import type { ApiCatalogItem, ApiCfcEntry, ApiDiagnosticItem, ApiProject, ApiVariant, ElementState } from '@/lib/api-types'
import { useAuth } from '@/stores/auth'
import { AvertissementEnergie, CorpsEnergie } from './ChapitreEnergie'
import { CHAPITRES, ETATS, PAGE, TVA } from './constants'
import { CaseEtat, Info, Ligne, LogoEntete, Row } from './shared'
import { DocumentA4, type BlocDocument } from './PagesA4'
import { usePageDuBloc } from './page-contexte'

/** Titre du chapitre énergétique : il vit avec le sommaire, qui l'annonce. */
const TITRE_ENERGIE = 'Estimation énergétique indicative'

/**
 * Chapitres du document, dans l'ordre. Sert au sommaire et aux titres.
 * `bloc` est la clé du titre de chapitre : c'est par elle que le sommaire
 * retrouve la page où le chapitre est tombé.
 */
const SOMMAIRE = [
  { n: 1, titre: 'Comment ce rapport est établi', bloc: 'c1-titre' },
  { n: 2, titre: 'Le bâtiment', bloc: 'c2-titre' },
  { n: 3, titre: "État de l'existant et travaux proposés", bloc: 'c3-titre' },
  { n: 4, titre: 'Devis estimatif ±15 %', bloc: 'c4-titre' },
]

/**
 * Annexes, numérotées en lettres et listées après les chapitres.
 *
 * La méthode occupait huit sous-chapitres en tête de rapport : le lecteur devait
 * traverser le mode d'emploi avant d'arriver à son bâtiment. Elle est conservée
 * entière, mais déplacée derrière le devis, et une page la résume à l'entrée.
 */
const ANNEXES = [
  { lettre: 'A', titre: 'Méthode détaillée', bloc: 'cA-titre' },
  { lettre: 'B', titre: 'Cadre normatif', bloc: 'cB-titre' },
] as const

type Chapitre = { n: number; titre: string; bloc: string; lettre?: string }

/**
 * Les chapitres du document, numérotés à la volée.
 *
 * Deux d'entre eux ne paraissent pas toujours : l'estimation énergétique suit la
 * présence d'une surface de référence, les variantes celle d'au moins une
 * variante. Numéroter en dur obligeait à renuméroter la main à chaque ajout, et
 * laissait le sommaire annoncer un chapitre quatre devant un chapitre cinq absent.
 */
function chapitresDuDocument(avecEnergie: boolean, avecVariantes: boolean): Chapitre[] {
  const l: Chapitre[] = SOMMAIRE.map((c) => ({ ...c }))
  if (avecEnergie) l.push({ n: l.length + 1, titre: TITRE_ENERGIE, bloc: 'c-energie-titre' })
  if (avecVariantes) l.push({ n: l.length + 1, titre: 'Variantes de projet', bloc: 'c5-titre' })
  // Les annexes closent le sommaire : elles portent une lettre, pas un numéro,
  // pour qu'on voie d'un coup d'œil où s'arrête le rapport proprement dit.
  for (const a of ANNEXES) l.push({ n: 0, lettre: a.lettre, titre: a.titre, bloc: a.bloc })
  return l
}

const numeroDe = (chapitres: Chapitre[], bloc: string) =>
  chapitres.find((c) => c.bloc === bloc)?.n ?? 0

/** Identité d'entreprise reprise des réglages ; le logo par défaut est celui de Diagly. */
type Entreprise = {
  name?: string; address?: string; postalCode?: string; city?: string
  vatNumber?: string; logo?: string | null
} | undefined

export interface RapportCompletProps {
  project: ApiProject
  items: ApiDiagnosticItem[]
  /** Description de l'état constaté, tirée du catalogue selon l'état coché. */
  etatExistant: (it: { catalogItemId: number | null; state: ElementState | null }) => string | null
  cfcEntries: ApiCfcEntry[]
  /** Catalogue du bureau : unités, formules de métré, prix par état. */
  catalogItems: ApiCatalogItem[]
  /** Variantes du projet, au plus trois. Absentes, le chapitre 5 ne paraît pas. */
  variants: ApiVariant[]
  auteur: string
}

export function RapportComplet({ project, items, etatExistant, cfcEntries, catalogItems, variants, auteur }: RapportCompletProps) {
  const company = useAuth((s) => s.user?.preferences?.company) as Entreprise
  const metrics = computeProjectMetrics(project)
  const labels = useMemo(() => cfcLabelIndex(cfcEntries), [cfcEntries])
  const catalogue = useMemo(() => new Map(catalogItems.map((c) => [c.id, c])), [catalogItems])

  // Chapitres de l'état : mêmes regroupements que le rapport de l'existant, pour que
  // les deux documents se lisent dans le même ordre.
  const chapitres = useMemo(() => {
    const reste = new Set(items.map((i) => i.id))
    const sortis = CHAPITRES.map((ch) => {
      const dedans = items
        .filter((i) => ch.groupes.includes(cfcGroupCode(i.cfcCode) ?? ''))
        .sort((a, b) => (a.cfcCode ?? '').localeCompare(b.cfcCode ?? '', undefined, { numeric: true }))
      for (const i of dedans) reste.delete(i.id)
      return { titre: ch.titre, items: dedans }
    })
    const orphelins = items.filter((i) => reste.has(i.id))
    if (orphelins.length) sortis.push({ titre: 'Divers', items: orphelins })
    return sortis.filter((c) => c.items.length > 0)
  }, [items])

  const devis = useMemo(
    () => buildDevis(items, labels, catalogItems, {
      honoraryPct: project.honoraryPct,
      reservePct: project.reservePct,
      floorArea: project.floorArea,
    }),
    [items, labels, catalogItems, project.honoraryPct, project.reservePct, project.floorArea],
  )

  const variantes = useMemo(
    () => calculerVariantes(variants, items,
      { honoraryPct: project.honoraryPct, reservePct: project.reservePct }, devis.ht,
      { catalogue, qtyCtx: buildQuantityContext(project) }),
    [variants, items, project, devis.ht, catalogue],
  )

  // Sans surface de référence énergétique, tout le calcul au mètre carré tombe :
  // mieux vaut pas de chapitre qu'un chapitre qui divise par zéro.
  const avecEnergie = Boolean(project.sre ?? project.floorArea)
  const chapitresDoc = useMemo(
    () => chapitresDuDocument(avecEnergie, variantes.length > 0),
    [avecEnergie, variantes.length],
  )

  const aujourdhui = formatDate(new Date())
  const adresse = [project.address, [project.postalCode, project.city].filter(Boolean).join(' ')]
    .filter(Boolean).join(', ')

  const blocs = useMemo<BlocDocument[]>(() => {
    const out: BlocDocument[] = []
    const bloc = (cle: string, noeud: ReactNode, o: { nouvellePage?: boolean; avecSuivant?: boolean } = {}) =>
      out.push({ type: 'bloc', cle, noeud, ...o })

    // ---------------------------------------------------------------- garde
    bloc('garde', (
      <PageDeGarde
        project={project} items={items} adresse={adresse}
        aujourdhui={aujourdhui} auteur={auteur} company={company}
      />
    ))

    // ------------------------------------------------------------- sommaire
    bloc('sommaire-titre', <h2 className="mb-4 text-2xl font-bold">Sommaire</h2>,
      { nouvellePage: true, avecSuivant: true })
    bloc('sommaire', <Sommaire chapitres={chapitresDoc} />)

    // ------------------------------------------------------- 1. la méthode
    bloc('c1-titre', <ChapitreTitre n={1} titre="Comment ce rapport est établi" />,
      { nouvellePage: true, avecSuivant: true })
    for (const [cle, noeud] of blocsPreambule(project)) bloc(cle, noeud)

    // ------------------------------------------------------- 2. le bâtiment
    bloc('c2-titre', <ChapitreTitre n={2} titre="Le bâtiment" />,
      { nouvellePage: true, avecSuivant: true })
    bloc('c2-identite', (
      <div className="grid grid-cols-2 gap-x-8 gap-y-1">
        <Info l="Adresse" v={`${adresse || '—'} (${project.canton})`} />
        <Info l="Type" v={buildingTypeLabels[project.buildingType] ?? project.buildingType} />
        <Info l="Année de construction" v={project.yearBuilt ? String(project.yearBuilt) : '—'} />
        <Info l="Année de rénovation" v={project.renovationYear ? String(project.renovationYear) : '—'} />
        <Info l="Parcelle" v={project.parcelNumber ?? '—'} />
        <Info l="Logements / étages" v={`${project.nbApartments ?? '—'} / ${project.nbFloors ?? '—'}`} />
        <Info l="Surface plancher / bâtie" v={`${project.floorArea ?? '—'} / ${project.builtArea ?? '—'} m²`} />
        <Info l="Façade / toiture" v={`${metrics.facade.toFixed(0)} m² / ${metrics.roof != null ? `${metrics.roof} m²` : 'à préciser'}`} />
        {project.energyClassGlobal && <Info l="Classe énergétique" v={project.energyClassGlobal} />}
        {project.sre != null && <Info l="SRE (certificat)" v={`${project.sre} m²`} />}
        {project.egid && <Info l="EGID" v={project.egid} />}
        {project.energyAgent && <Info l="Agent énergétique" v={project.energyAgent} />}
      </div>
    ))
    bloc('c2-dims-titre', <SousTitre className="mt-6">Dimensions retenues pour les métrés</SousTitre>,
      { avecSuivant: true })
    bloc('c2-dims', (
      <>
        <table className="w-full">
          <tbody>
            {[
              ['Surface de façade', `${Math.round(metrics.facade)} m²`,
                project.perimeter
                  ? `périmètre ${project.perimeter} ml × ${project.nbFloors ?? '?'} étages × ${project.floorHeight ?? 2.7} m`
                  : 'surface relevée'],
              ["Hauteur d'étage", `${project.floorHeight ?? 2.7} m`,
                project.floorHeight ? 'renseignée' : 'valeur par défaut, non relevée'],
              ['Part vitrée', `${project.windowPct} %`, 'appliquée à la surface de façade'],
              ['Surface de toiture',
                metrics.roof != null ? `${metrics.roof} m²` : `${Math.round(metrics.flatRoof)}–${Math.round(metrics.slopedRoof)} m²`,
                metrics.roof != null
                  ? `type ${project.roofType === 'PENTE' ? 'en pente' : project.roofType === 'MIXTE' ? 'mixte' : 'plate'}`
                  : 'type de toiture non précisé, aucune présomption'],
              ['Surface à échafauder', `${Math.round(metrics.scaffolding)} m²`,
                'façade + débord et retours ; le vitrage n’est pas déduit'],
              ['Indice de construction', `× ${getMarketInfo().coeff}`, phraseIndexation()],
            ].map(([l, v, note]) => (
              <tr key={l} className="border-t align-top">
                <td className="w-44 py-1">{l}</td>
                <td className="w-28 py-1 font-medium tabular-nums">{v}</td>
                <td className="py-1 text-muted-foreground">{note}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-muted-foreground">
          Les quantités déduites de ces dimensions suivent le dossier : corriger une dimension
          ci-dessus met à jour les montants du chapitre 4. Les quantités relevées sur place, elles,
          ne sont plus recalculées.
        </p>
      </>
    ))

    // --------------------------------------- 3. état de l'existant + travaux
    bloc('c3-titre', <ChapitreTitre n={3} titre="État de l'existant et travaux proposés" />,
      { nouvellePage: true, avecSuivant: true })
    if (chapitres.length === 0) {
      bloc('c3-vide', <p className="text-muted-foreground">Aucun ouvrage relevé pour l'instant.</p>)
    }
    for (const ch of chapitres) {
      bloc(`c3-${ch.titre}`, (
        <h3 className="mb-3 mt-4 border-b-2 border-foreground pb-1 font-bold uppercase">{ch.titre}</h3>
      ), { avecSuivant: true })
      for (const it of ch.items) {
        bloc(`ouvrage-${it.id}`, (
          <FicheOuvrage
            it={it}
            constat={etatExistant(it)}
            article={it.catalogItemId != null ? catalogue.get(it.catalogItemId) : undefined}
            yearBuilt={project.yearBuilt ?? null}
          />
        ))
      }
    }

    // ------------------------------------------------------------ 4. devis
    bloc('c4-titre', <ChapitreTitre n={4} titre="Devis estimatif ±15 %" />,
      { nouvellePage: true, avecSuivant: true })
    bloc('c4-intro', (
      <p className="mb-4 text-muted-foreground">
        Les travaux sont regroupés par priorité, puis par position CFC à 3 chiffres. Chaque ligne
        porte sa quantité, son prix unitaire et son montant : quantité × prix unitaire = montant,
        à l'arrondi près. Un ouvrage qui appelle à la fois une réparation, une amélioration et une
        remise aux normes apparaît en autant de lignes, chacune chiffrée séparément.
      </p>
    ))

    if (devis.blocs.length === 0) {
      bloc('c4-vide', (
        <p className="text-muted-foreground">
          Aucun coût chiffré pour l'instant. Les montants apparaissent dès qu'un état est saisi
          sur les ouvrages du chapitre 3.
        </p>
      ))
    }

    devis.blocs.forEach((b, i) => {
      // Chaque enveloppe de décision ouvre sa page : « ce qu'il faut engager dans
      // les cinq ans » se lit d'un seul tenant.
      bloc(`devis-${b.cle}-titre`, <TitreBlocDevis bloc={b} />,
        { nouvellePage: i > 0, avecSuivant: true })

      for (const pos of b.positions) {
        out.push({
          type: 'lignes',
          cle: `devis-${b.cle}-${pos.code || 'nc'}`,
          tableauId: `devis-${b.cle}`,
          colonnes: COLONNES_DEVIS,
          entete: ENTETE_DEVIS,
          lignes: <LignesPosition position={pos} />,
        })
      }
      out.push({
        type: 'lignes',
        cle: `devis-${b.cle}-total`,
        tableauId: `devis-${b.cle}`,
        colonnes: COLONNES_DEVIS,
        entete: ENTETE_DEVIS,
        lignes: (
          <>
            <tr className="border-t-2 font-semibold">
              <td className="py-1" colSpan={4}>Sous-total {b.titre} (HT)</td>
              <td className="py-1 text-right tabular-nums">{formatCHF(b.ht)}</td>
            </tr>
            <tr className="text-muted-foreground">
              <td className="py-0.5" colSpan={4}>Total TTC (honoraires, réserve et TVA compris)</td>
              <td className="py-0.5 text-right tabular-nums">{formatCHF(b.cascade.total)}</td>
            </tr>
          </>
        ),
      })
    })

    if (devis.blocs.length > 0) {
      bloc('c4-recap-titre', <SousTitre>Récapitulatif par priorité</SousTitre>,
        { nouvellePage: true, avecSuivant: true })
      bloc('c4-recap', <Recapitulatif devis={devis} />)
      bloc('c4-total', <TotalOperation devis={devis} project={project} />)
    }

    // -------------------------------------------- estimation énergétique
    // Elle ne demande aucune saisie supplémentaire : les états viennent des
    // ouvrages relevés, le reste du dossier. Sans surface de référence, en
    // revanche, le calcul au mètre carré n'a pas de sens et le chapitre saute.
    if (avecEnergie) {
      bloc('c-energie-titre',
        <ChapitreTitre n={numeroDe(chapitresDoc, 'c-energie-titre')} titre={TITRE_ENERGIE} />,
        { nouvellePage: true, avecSuivant: true })
      bloc('c-energie-avertissement', <AvertissementEnergie />, { avecSuivant: true })
      bloc('c-energie-corps', <CorpsEnergie project={project} ouvrages={items} />)
    }

    // ------------------------------------------------------- variantes
    if (variantes.length > 0) {
      bloc('c5-titre',
        <ChapitreTitre n={numeroDe(chapitresDoc, 'c5-titre')} titre="Variantes de projet" />,
        { nouvellePage: true, avecSuivant: true })
      bloc('c5-intro', (
        <p className="mb-4 text-muted-foreground">
          Le diagnostic des chapitres 3 et 4 décrit ce qu'il faut faire. Les variantes ci-dessous
          répondent à une autre question : et si on s'y prenait autrement ? Chacune reprend
          l'intégralité du diagnostic et ne remplace que les ouvrages désignés ; tout le reste est
          inchangé. Les écarts se lisent donc par rapport au devis du chapitre 4.
        </p>
      ))
      bloc('c5-comparaison-titre', <SousTitre>Comparaison</SousTitre>, { avecSuivant: true })
      bloc('c5-comparaison', <ComparaisonVariantes base={devis} variantes={variantes} />)

      for (const v of variantes) {
        bloc(`c5-${v.variant.id}-titre`, <TitreVariante calcul={v} />,
          { nouvellePage: true, avecSuivant: true })
        bloc(`c5-${v.variant.id}-detail`, <DetailVariante calcul={v} />)
      }
    }

    // ------------------------------------------------------------- annexes
    bloc('cA-titre', <AnnexeTitre lettre="A" titre="Méthode détaillée" />,
      { nouvellePage: true, avecSuivant: true })
    for (const [cle, noeud] of blocsMethode(project, devis)) bloc(cle, noeud)

    bloc('cB-titre', <AnnexeTitre lettre="B" titre="Cadre normatif" />,
      { nouvellePage: true, avecSuivant: true })
    bloc('cB-corps', blocCadreNormatif())

    bloc('mentions', (
      <p className="mt-6 border-t pt-3 text-muted-foreground">
        {priceBasisNote()} Diagnostic établi à vue, sans sondage destructif, le {aujourdhui}
        {auteur ? ` par ${auteur}` : ''}. Rapport généré par Diagly.
      </p>
    ))

    return out
  }, [project, items, chapitres, chapitresDoc, avecEnergie, devis, variantes, catalogue, etatExistant, metrics, adresse, aujourdhui, auteur, company])

  return (
    <DocumentA4
      blocs={blocs}
      entete={<LogoEntete />}
      mentionPied={`${project.name} · ${aujourdhui}`}
    />
  )
}

/** Page de garde : elle occupe la hauteur utile d'une feuille, à elle seule. */
function PageDeGarde({ project, items, adresse, aujourdhui, auteur, company }: {
  project: ApiProject
  items: ApiDiagnosticItem[]
  adresse: string
  aujourdhui: string
  auteur: string
  company: Entreprise
}) {
  const photo = items.find((i) => i.photos.length > 0)?.photos[0]
  const ligne2 = [company?.postalCode, company?.city].filter(Boolean).join(' ')
  // La hauteur utile moins l'en-tête et le pied : la garde remplit sa page.
  const hauteur = `${PAGE.hauteur - PAGE.entete - PAGE.pied}mm`

  return (
    <div className="flex flex-col" style={{ height: hauteur }}>
      <div className="flex-1">
        <p className="uppercase tracking-[0.2em] text-muted-foreground">Diagnostic de bâtiment</p>
        <h1 className="mt-2 text-4xl font-bold leading-tight">Rapport de diagnostic</h1>
        <p className="mt-6 text-xl">{project.name}</p>
        {adresse && <p className="text-lg text-muted-foreground">{adresse}</p>}
        {photo && <img src={photo} alt="" className="mt-8 max-h-[95mm] w-full rounded border object-cover" />}
      </div>
      <div className="mt-8 flex items-end justify-between gap-6 border-t pt-4 text-muted-foreground">
        {/* La page de garde porte l'identité du document, pas ses réserves : la
            tolérance de ±15 % et la portée de l'estimation sont dites au chapitre 1
            et rappelées en pied du devis. */}
        <p>Édité le {aujourdhui}{auteur ? ` par ${auteur}` : ''}</p>
        {company?.name && (
          <div className="shrink-0 text-right">
            <p className="font-semibold text-foreground">{company.name}</p>
            {company.address && <p>{company.address}</p>}
            {ligne2 && <p>{ligne2}</p>}
            {company.vatNumber && <p>{company.vatNumber}</p>}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Sommaire : les têtes de chapitre et leur page.
 *
 * Le numéro n'est connu qu'une fois le document découpé ; il apparaît donc au
 * second rendu. Un tiret tient la place en attendant, plutôt qu'un vide qui
 * ferait sauter la ligne quand le chiffre arrive.
 */
function Sommaire({ chapitres }: { chapitres: Chapitre[] }) {
  return (
    <ol>
      {chapitres.map((c) => <LigneSommaire key={c.bloc} chapitre={c} />)}
    </ol>
  )
}

function LigneSommaire({ chapitre }: { chapitre: Chapitre }) {
  const page = usePageDuBloc(chapitre.bloc)
  return (
    <li className="flex items-baseline gap-3 border-b py-2">
      <span className="w-10 shrink-0 font-bold tabular-nums">
        {chapitre.lettre ? `Ann. ${chapitre.lettre}` : `${chapitre.n}.`}
      </span>
      <span className="font-medium">{chapitre.titre}</span>
      {/* Ligne de points : l'œil suit le titre jusqu'à son numéro. */}
      <span className="min-w-6 flex-1 self-end border-b border-dotted border-muted-foreground/50" aria-hidden />
      <span className="shrink-0 tabular-nums">{page ?? '—'}</span>
    </li>
  )
}

/** Titre de chapitre numéroté, repris du sommaire. */
function ChapitreTitre({ n, titre }: { n: number; titre: string }) {
  return (
    <h2 className="mb-4 border-b-2 border-foreground pb-2 text-2xl font-bold">
      <span className="text-muted-foreground">{n}.</span> {titre}
    </h2>
  )
}

/** Intertitre de section à l'intérieur d'un chapitre. */
/** Titre d'annexe : une lettre là où les chapitres portent un numéro. */
function AnnexeTitre({ lettre, titre }: { lettre: string; titre: string }) {
  return (
    <h2 className="mb-4 border-b-2 border-foreground pb-2 text-2xl font-bold">
      <span className="text-muted-foreground">Annexe {lettre}</span> — {titre}
    </h2>
  )
}

function SousTitre({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cn('mb-2 font-bold uppercase tracking-wide', className)}>{children}</h3>
}

/** Couleur de la priorité d'un bloc ; neutre pour les postes de chantier. */
function couleurDeBloc(cle: DevisBloc['cle']): string {
  return cle === 'I' || cle === 'II' || cle === 'III' ? priorityTextColors[cle] : 'text-foreground'
}

/**
 * Chapitre 1 — la méthode, découpé en blocs.
 *
 * C'est le chapitre que le client lit avant de regarder les montants : il doit
 * pouvoir y répondre seul à « d'où sort ce chiffre ? ». On y décrit donc le
 * référentiel du bureau tel qu'il est réellement appliqué — les quatre états et
 * leurs travaux, les trois enveloppes, l'origine des quantités et des prix, les
 * postes comptés d'office — et non une présentation générale de la démarche.
 */
/**
 * Préambule : une page, en tête de rapport.
 *
 * Le rapport s'ouvrait sur huit sous-chapitres de méthode. Le destinataire —
 * une gérance, un propriétaire — n'ouvre pas un diagnostic pour lire un mode
 * d'emploi : il l'ouvre pour savoir ce qu'il doit faire de son bâtiment. La
 * méthode complète est conservée, en annexe A ; ici tient ce qu'il faut avoir
 * lu pour comprendre les chapitres suivants.
 *
 * Les taux sont lus sur le dossier et sur la configuration, jamais écrits dans
 * le texte : un rapport qui annonce 12 % d'honoraires alors que le dossier en
 * applique 15 se contredit tout seul, et c'est le texte qu'on croit.
 */
function blocsPreambule(project: ApiProject): [string, ReactNode][] {
  const sections: [string, ReactNode][] = []
  const pct = (v: number | null | undefined) => `${nombreFr(v ?? 0)} %`

  sections.push(['c1-intro', (
    <p>
      Nous avons parcouru le bâtiment élément par élément : structure, façades, fenêtres,
      toiture, installations techniques et aménagements intérieurs. Pour chacun, nous avons noté
      son état. Les travaux, leur priorité et leur coût en découlent, selon une grille identique
      pour tous les bâtiments, puis sont ajustés si la visite l'exige. Chaque montant peut ainsi
      être retracé jusqu'à la photo prise sur place.
    </p>
  )])

  sections.push(['c1-etats', (
    <div className="mt-5">
      <SousTitre>Quatre états</SousTitre>
      <table className="w-full">
        <tbody>
          {([
            ['TRES_BON', 'Aucune dégradation, rien à prévoir.'],
            ['BON', 'Usure normale, un entretien courant suffit.'],
            ['MOYEN', 'Dégradation visible. Une réparation maintenant évite un remplacement plus tard.'],
            ['MAUVAIS', 'Fin de vie ou sécurité en jeu. Remplacement à prévoir.'],
          ] as [ElementState, string][]).map(([e, texte]) => (
            <tr key={e} className="border-t align-top">
              <td className="w-32 py-1.5"><CaseEtat etat={e} actif /></td>
              <td className="py-1.5 text-muted-foreground">{texte}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )])

  sections.push(['c1-travaux', (
    <div className="mt-5">
      <SousTitre>Trois types de travaux</SousTitre>
      <table className="w-full">
        <tbody>
          {[
            ['Réparation', "Remettre l'élément en état. C'est ce que la dégradation impose."],
            ['Amélioration', "Faire mieux qu'à l'origine (énergie, confort, valeur). C'est un choix du propriétaire."],
            ['Mise aux normes', "Corriger un écart avec une norme actuelle, même si l'élément est en bon état."],
          ].map(([l, note]) => (
            <tr key={l} className="border-t align-top">
              <td className="w-40 py-1.5 font-medium">{l}</td>
              <td className="py-1.5 text-muted-foreground">{note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )])

  sections.push(['c1-priorites', (
    <div className="mt-5">
      <SousTitre>Trois priorités</SousTitre>
      <table className="w-full">
        <tbody>
          {PRIORITES.map((p) => (
            <tr key={p} className="border-t align-top">
              <td className={cn('w-40 py-1.5 font-semibold', priorityTextColors[p])}>Priorité {p}</td>
              <td className="py-1.5 text-muted-foreground">{HORIZON[p]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )])

  sections.push(['c1-dureevie', (
    <div className="mt-5">
      <SousTitre>Durée de vie restante</SousTitre>
      <p>
        Elle se calcule ainsi : année de pose + durée de vie de référence − année actuelle.
        Lorsque l'année de pose n'a pas pu être relevée, nous utilisons l'année de construction,
        avec la mention « à confirmer ». Lorsqu'elle est inconnue, la durée restante n'est pas
        calculée.
      </p>
    </div>
  )])

  sections.push(['c1-cout', (
    <div className="mt-5">
      <SousTitre>Le coût</SousTitre>
      <p>
        Il repose sur les prix du catalogue Diagly. {phraseIndexation()} Ces prix sont majorés
        des honoraires ({pct(project.honoraryPct)}), d'une réserve pour imprévus
        ({pct(project.reservePct)}) et de la TVA ({nombreFr(TVA * 100)} %). La précision est de
        ±15 % : c'est une enveloppe pour décider, pas un prix d'entreprise.
      </p>
    </div>
  )])

  sections.push(['c1-perimetre', (
    <div className="mt-5">
      <SousTitre>Ce que le rapport ne couvre pas</SousTitre>
      <p>
        Sondages destructifs, calcul de structure, amiante et polluants, protection incendie,
        transformations, planification et direction des travaux. Ces points relèvent de mandats
        spécialisés.
      </p>
    </div>
  )])

  return sections
}

/** Nombre à la française : la virgule décimale, et pas de décimale inutile. */
function nombreFr(v: number): string {
  return String(Math.round(v * 100) / 100).replace('.', ',')
}

/**
 * Méthode détaillée, en annexe A.
 *
 * C'était le chapitre 1 du rapport. Le texte n'a pas changé : seule sa place
 * l'a fait, derrière le devis, pour que le lecteur arrive à son bâtiment sans
 * traverser d'abord le mode d'emploi.
 */
/**
 * Cadre normatif, en annexe B.
 *
 * Le diagnostic ne certifie aucune conformité. Les normes citées fixent le
 * vocabulaire, la structure des coûts et les seuils auxquels un ouvrage est
 * comparé : elles éclairent le rapport sans l'engager.
 */
function blocCadreNormatif(): ReactNode {
  return (
    <div className="mt-5">
      <SousTitre>Le cadre normatif</SousTitre>
      <p className="mb-2">
        Le diagnostic ne certifie aucune conformité : il constate, et il chiffre. Il s'appuie
        toutefois sur un corpus de normes suisses, qui fixent le vocabulaire, la structure des
        coûts et les seuils auxquels un ouvrage est comparé.
      </p>
      <table className="w-full">
        <tbody>
          {[
            ['SN 506 500 — CFC',
              "Code des frais de construction. Il donne l'arborescence qui structure le devis du chapitre 4 : chapitre, groupe, puis position à 3 chiffres."],
            ['SIA 469 — Conservation des ouvrages',
              "Cadre de la maintenance et de la remise en état du bâti existant. C'est d'elle que relève la notion de durée d'utilisation, sur laquelle repose la durée de vie résiduelle."],
            ['SIA 269 — Maintenance des structures porteuses',
              "Référence pour l'appréciation des ouvrages porteurs existants. Le diagnostic en reste au constat visuel : toute vérification de capacité portante relève d'un ingénieur."],
            ['SIA 380/1 — Énergie thermique dans le bâtiment',
              "Valeurs limites de déperdition qui servent de repère pour juger l'isolation d'une paroi, d'une toiture ou d'une fenêtre."],
            ['SIA 358 — Garde-corps et allèges',
              "Hauteurs et écartements exigés. C'est la référence des remises aux normes de garde-corps relevées au chapitre 3."],
            ['CECB / CECB+',
              "Certificat énergétique cantonal des bâtiments. Lorsqu'il existe, ses étiquettes et ses variantes sont reprises et non recalculées."],
          ].map(([norme, role]) => (
            <tr key={norme} className="border-t align-top">
              <td className="w-52 py-1.5 font-medium">{norme}</td>
              <td className="py-1.5 text-muted-foreground">{role}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-muted-foreground">
        La protection incendie (prescriptions AEAI) et le repérage des polluants relèvent de
        mandats distincts : le rapport peut les signaler, il ne les instruit pas.
      </p>
    </div>
  )
}

function blocsMethode(project: ApiProject, devis: Devis): [string, ReactNode][] {
  const sections: [string, ReactNode][] = []

  sections.push(['cA-intro', (
    <>
      <p className="mb-3">
        Le bâtiment est parcouru ouvrage par ouvrage, sur place et à vue, en suivant le
        référentiel du bureau : une liste fermée d'ouvrages types, rangés par domaine —
        structure, façade, fenêtres, portes extérieures, stores et volets, toiture, électricité,
        chauffage, ventilation, sanitaires, revêtements de murs, de plafonds et de sols,
        serrurerie, menuiserie, aménagements extérieurs. Pour chacun, le diagnostiqueur ne
        saisit qu'une chose : l'état constaté. Tout le reste — les travaux qui en découlent, la
        priorité, la quantité, le prix — est déduit de ce référentiel, puis corrigé à la main si
        la visite l'impose.
      </p>
      <p>
        Ce rapport n'est donc pas une appréciation d'ensemble du bâtiment : c'est la somme
        d'observations individuelles, chacune traçable de la photo prise sur place jusqu'au prix
        unitaire appliqué au chapitre 4. Deux bâtiments diagnostiqués par deux personnes
        différentes sont comparables, parce qu'ils sont lus avec la même grille.
      </p>
    </>
  )])

  sections.push(['cA-etats', (
    <div className="mt-5">
      <SousTitre>Les quatre états</SousTitre>
      <p className="mb-2">
        Quatre états, et quatre seulement. L'état décrit ce qui a été vu, jamais ce qu'il faut
        faire : c'est ce qui permet de séparer le constat, qui engage le diagnostiqueur, de la
        décision de travaux, qui appartient au propriétaire. À chaque état, le référentiel
        associe d'avance une description type et les travaux correspondants — de « néant » pour
        un ouvrage sain jusqu'au remplacement complet en fin de vie.
      </p>
      <table className="w-full">
        <tbody>
          {([
            ['TRES_BON', "Aucune dégradation. L'ouvrage remplit sa fonction et n'appelle aucune dépense : le référentiel prévoit « néant »."],
            ['BON', "Usure normale, sans conséquence sur la fonction. L'entretien courant suffit ; aucun travail n'est chiffré, ou seulement un entretien léger."],
            ['MOYEN', "Dégradation visible et qui progresse. Une intervention partielle maintenant — réparation, reprise, traitement de surface — évite un remplacement complet ensuite."],
            ['MAUVAIS', "Fin de vie, fonction compromise ou sécurité en jeu. Le référentiel bascule sur la dépose et le remplacement complet de l'ouvrage."],
          ] as [ElementState, string][]).map(([e, texte]) => (
            <tr key={e} className="border-t align-top">
              <td className="w-32 py-1.5"><CaseEtat etat={e} actif /></td>
              <td className="py-1.5 text-muted-foreground">{texte}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )])

  sections.push(['cA-enveloppes', (
    <div className="mt-5">
      <SousTitre>Les trois enveloppes de travaux</SousTitre>
      <p className="mb-2">
        Un même ouvrage peut appeler trois dépenses de nature différente, que le rapport ne
        mélange jamais : les additionner masquerait ce qui est subi et ce qui est choisi.
      </p>
      <table className="w-full">
        <tbody>
          {[
            ['Réparation', "Remettre l'ouvrage dans l'état où il devrait être. C'est la seule enveloppe imposée par la dégradation constatée."],
            ['Amélioration', "Aller au-delà de l'état d'origine : meilleure performance, meilleur confort, valeur d'usage supérieure. Facultative, elle relève d'un choix."],
            ['Mise aux normes', "Rattraper un écart avec une norme en vigueur — hauteur de garde-corps, résistance au feu d'une porte palière, sécurité électrique. Elle ne dépend pas de l'état : un ouvrage en bon état peut être non conforme."],
          ].map(([l, note]) => (
            <tr key={l} className="border-t align-top">
              <td className="w-40 py-1.5 font-medium">{l}</td>
              <td className="py-1.5 text-muted-foreground">{note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )])

  sections.push(['cA-priorites', (
    <div className="mt-5">
      <SousTitre>La priorité d'intervention</SousTitre>
      <p className="mb-2">
        La priorité est proposée d'après l'état — un ouvrage en fin de vie est urgent, un ouvrage
        dégradé est à planifier — puis arbitrée par le diagnostiqueur, qui seul voit le contexte :
        un ouvrage en état moyen devient urgent s'il en met un autre en péril, et une réfection
        sans enjeu peut attendre le prochain chantier pour mutualiser l'échafaudage. C'est la
        priorité, et non l'état, qui structure le devis du chapitre 4.
      </p>
      <table className="w-full">
        <tbody>
          {PRIORITES.map((p) => (
            <tr key={p} className="border-t align-top">
              <td className={cn('w-40 py-1.5 font-semibold', priorityTextColors[p])}>
                Priorité {p} <span className="font-normal text-muted-foreground">({HORIZON[p]})</span>
              </td>
              <td className="py-1.5 text-muted-foreground">{priorityDescriptions[p]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )])

  sections.push(['cA-dureevie', (
    <div className="mt-5">
      <SousTitre>La durée de vie résiduelle</SousTitre>
      <p className="mb-2">
        L'état constaté dit ce que vaut un ouvrage aujourd'hui ; il ne dit pas combien de temps
        il lui reste. Deux façades en état moyen n'appellent pas la même décision selon qu'elles
        ont douze ou trente-cinq ans : la première se répare, la seconde se remplace. Chaque
        ouvrage porte donc, au chapitre 3, son année de pose et sa durée de vie résiduelle :
      </p>
      <p className="mb-2 font-medium">
        durée résiduelle = (année de pose + durée de vie de référence) − année courante
      </p>
      <p>
        La durée de vie de référence dépend du type d'ouvrage — une peinture intérieure ne dure
        pas ce que dure une charpente — et suit les durées d'utilisation retenues par le bureau
        dans le cadre de la SIA 469. Lorsque l'année de pose n'a pas pu être relevée, l'année de
        construction du bâtiment est utilisée et la mention « à confirmer » l'indique. Un ouvrage
        dont la durée de vie est dépassée est signalé comme tel : il peut encore fonctionner,
        mais sa défaillance n'est plus un imprévu.
      </p>
    </div>
  )])

  sections.push(['cA-quantites', (
    <div className="mt-5">
      <SousTitre>Les quantités</SousTitre>
      <p className="mb-2">
        Chaque ouvrage du référentiel porte son unité de métré — m² de façade, m² de toiture,
        mètre linéaire, pièce, forfait — et la règle qui donne la quantité à partir des
        dimensions du bâtiment : surface bâtie, périmètre, nombre d'étages, nombre de logements,
        nombre de cages d'escalier. Les dimensions retenues sont listées au chapitre 2, et les
        quantités en découlent automatiquement.
      </p>
      <p>
        Une quantité peut être reprise à la main lorsque le relevé sur place contredit le calcul.
        Elle est alors figée : elle ne suit plus les corrections du dossier, et c'est voulu — une
        mesure prise au mètre vaut mieux qu'une déduction. Le chapitre 4 affiche la quantité
        retenue et le prix unitaire appliqué, de sorte que chaque montant se recalcule de tête.
      </p>
    </div>
  )])

  sections.push(['cA-prix', (
    <div className="mt-5">
      <SousTitre>Les prix et leur indexation</SousTitre>
      <p className="mb-2">
        Les prix ne sont pas négociés au cas par cas : ils viennent du catalogue du bureau, qui
        fixe pour chaque ouvrage un prix unitaire par état — le prix d'une réparation en état
        moyen n'est pas celui d'un remplacement en fin de vie — ainsi qu'un prix propre à
        l'amélioration et à la remise aux normes. Ces prix sont ensuite indexés, puis majorés
        dans cet ordre :
      </p>
      <table className="w-full">
        <tbody>
          {[
            ['Travaux (HT)', 'somme des lignes du devis : réparation, amélioration, remise aux normes et postes de chantier'],
            [`Honoraires (${project.honoraryPct ?? 0} %)`, 'calculés sur le montant des travaux'],
            [`Réserve pour imprévus (${project.reservePct ?? 0} %)`, "calculée sur le montant déjà majoré des honoraires, et non sur les travaux seuls"],
            ['TVA (8.1 %)', 'appliquée au sous-total'],
          ].map(([l, note]) => (
            <tr key={l} className="border-t align-top">
              <td className="w-52 py-1.5 font-medium">{l}</td>
              <td className="py-1.5 text-muted-foreground">{note}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-muted-foreground">{priceBasisNote()}</p>
    </div>
  )])

  if (devis.reglesAppliquees.length > 0) {
    sections.push(['cA-postes', (
      <div className="mt-5">
        <SousTitre>Les postes comptés d'office</SousTitre>
        <p className="mb-2">
          Certains postes n'apparaissent dans aucune observation mais accompagnent tout chantier.
          Le référentiel impose de les porter au devis dès qu'il y a des travaux ; ils figurent
          en tête du chapitre 4, sous « Postes de chantier », avec leur règle :
        </p>
        <ul className="space-y-1 text-muted-foreground">
          {devis.reglesAppliquees.map((r) => (
            <li key={r} className="flex gap-2"><span aria-hidden>·</span><span>{r}</span></li>
          ))}
        </ul>
      </div>
    )])
  }

  sections.push(['cA-precision', (
    <div className="mt-5">
      <SousTitre>La précision de l'estimation</SousTitre>
      <p>
        L'estimation est donnée à <b>±15 %</b>. Cette fourchette n'est pas une précaution de
        style : elle recouvre l'écart normal entre un métré déduit et un métré d'exécution, la
        dispersion des offres d'entreprises, et ce qu'une visite sans sondage ne peut pas voir.
        Le total du chapitre 4 est donc à lire comme une enveloppe de décision — savoir s'il
        faut prévoir trois cent mille ou huit cent mille francs — et non comme un prix
        d'adjudication. Un devis d'entreprise reste nécessaire avant d'engager les travaux.
      </p>
    </div>
  )])

  sections.push(['cA-perimetre', (
    <div className="mt-5">
      <SousTitre>Ce que le rapport couvre, et ce qu'il ne couvre pas</SousTitre>
      <table className="w-full">
        <tbody>
          {([
            ['État physique et fonctionnel des ouvrages visibles', true],
            ['Travaux de remise en état et leur estimation', true],
            ['Installations techniques accessibles à la visite', true],
            ['Améliorations de performance et remises aux normes identifiées', true],
            ['Sondages destructifs et ouvertures de parois', false],
            ['Calcul de structure et vérification portante', false],
            ["Repérage de l'amiante et des polluants du bâtiment", false],
            ['Mise en conformité incendie et sécurité', false],
            ["Transformation, changement d'affectation, besoins nouveaux", false],
            ['Planification, appels d’offres et direction des travaux', false],
          ] as [string, boolean][]).map(([l, inclus]) => (
            <tr key={l} className="border-t align-top">
              <td className="py-1.5">{l}</td>
              <td className={cn('w-20 py-1.5 text-right font-medium', inclus ? 'text-emerald-700' : 'text-muted-foreground')}>
                {inclus ? 'Oui' : 'Non'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-muted-foreground">
        Le diagnostic est établi à vue, sans sondage. Une dégradation masquée qui ne pouvait pas
        être détectée lors de la visite n'est pas couverte par l'estimation. Les points marqués
        « non » ne sont pas des oublis : ils relèvent de spécialistes et de mandats distincts.
      </p>
    </div>
  )])

  return sections
}

/**
 * Une observation : l'état coché, ce qui a été constaté, ce qu'il faut prévoir,
 * et les photos de la visite.
 */
function FicheOuvrage({ it, constat, article, yearBuilt }: {
  it: ApiDiagnosticItem
  constat: string | null
  article: ApiCatalogItem | undefined
  /** Année de construction, seule base possible quand la pose n'a pas été relevée. */
  yearBuilt: number | null
}) {
  const vie = dureeVieResiduelle(it, { yearBuilt })
  const phraseVie = phraseDureeVie(vie)
  const travaux = it.works.filter((w) => w && w !== 'Néant')
  const vide = !constat && !it.notes && travaux.length === 0 && !it.improvement && !it.norms
  const unite = uniteCourte(it.unit) ?? uniteCourte(article?.unit)

  return (
    <article className="border-t py-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-semibold">
          {it.cfcLabel}
          {/* Le même revêtement se relève dans la cage et dans les logements :
              le rapport doit dire lequel des deux il décrit. */}
          {it.localisation && (
            <span className="ml-1.5 font-normal text-muted-foreground">
              ({LIBELLE_LOCALISATION[it.localisation].toLowerCase()})
            </span>
          )}
          <span className="ml-2 font-mono font-normal text-muted-foreground">{it.cfcCode}</span>
        </p>
        <div className="flex flex-wrap gap-3 text-[8.5pt]">
          {ETATS.map((e) => <CaseEtat key={e} etat={e} actif={it.state === e} />)}
        </div>
      </div>

      {constat && <Ligne titre="État constaté" texte={constat} />}
      {it.notes && <Ligne titre="Observations" texte={it.notes} />}
      {travaux.length > 0 && <Ligne titre="Travaux à prévoir" texte={travaux.join(' ')} />}
      {it.improvement && <Ligne titre="Amélioration possible" texte={it.improvement} />}
      {it.norms && <Ligne titre="Mise aux normes" texte={it.norms} />}
      {article?.scaffoldingNote && (
        <p className="mt-1 text-amber-700">
          {article.scaffoldingNote} — l'accès conditionne le coût et la date d'intervention.
        </p>
      )}
      {vide && (
        <p className="mt-1 italic text-muted-foreground">
          {it.state ? 'Aucune observation saisie.' : 'Élément non encore évalué.'}
        </p>
      )}

      <p className="mt-1 text-muted-foreground">
        {it.priority && (
          <span className={cn('font-semibold', priorityTextColors[it.priority])}>
            Priorité {it.priority} ({HORIZON[it.priority]})
          </span>
        )}
        {it.priority && it.area != null && ' · '}
        {it.area != null && <>Quantité {it.area}{unite ? ` ${unite}` : ''}{it.quantityManual ? ' (relevée sur place)' : ''}</>}
      </p>

      {/* Durée de vie : l'état dit ce que vaut l'ouvrage aujourd'hui, la durée
          résiduelle dit combien de temps il lui reste. Les deux sont nécessaires
          pour décider s'il faut remplacer maintenant ou attendre. */}
      {phraseVie && (
        <p className={cn('mt-0.5', vie && vie.depassement > 0 ? 'text-red-700' : 'text-muted-foreground')}>
          {phraseVie}
        </p>
      )}

      {it.photos.length > 0 && (
        <>
          {/* Deux photos par ouvrage : la vue d'ensemble et le détail. Au-delà, le
              document devient un album et l'observation se perd ; les autres restent
              consultables dans le dossier. */}
          <div className="mt-2 grid grid-cols-2 gap-2">
            {it.photos.slice(0, 2).map((src, i) => (
              <img key={i} src={src} alt="" className="aspect-[4/3] w-full rounded border object-cover" />
            ))}
          </div>
          {it.photos.length > 2 && (
            <p className="mt-1 text-muted-foreground">
              {it.photos.length - 2} autre{it.photos.length - 2 > 1 ? 's' : ''} photo
              {it.photos.length - 2 > 1 ? 's' : ''} de cet ouvrage au dossier.
            </p>
          )}
        </>
      )}
    </article>
  )
}

// ---------------------------------------------------------------------------
// Devis : le tableau est découpé en groupes de lignes, un par position CFC, pour
// qu'il puisse se poursuivre d'une page à l'autre sans perdre ses en-têtes.
// ---------------------------------------------------------------------------

const COLONNES_DEVIS = (
  <>
    <col style={{ width: '14mm' }} />
    <col />
    <col style={{ width: '24mm' }} />
    <col style={{ width: '24mm' }} />
    <col style={{ width: '28mm' }} />
  </>
)

const ENTETE_DEVIS = (
  <thead>
    <tr className="text-left text-muted-foreground">
      <th className="py-1 font-medium">CFC</th>
      <th className="py-1 font-medium">Désignation</th>
      <th className="py-1 text-right font-medium">Quantité</th>
      <th className="py-1 text-right font-medium">Prix unit.</th>
      <th className="py-1 text-right font-medium">Montant HT</th>
    </tr>
  </thead>
)

function TitreBlocDevis({ bloc }: { bloc: DevisBloc }) {
  return (
    <h3 className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 border-b-2 border-foreground pb-1">
      <span className={cn('font-bold uppercase tracking-wide', couleurDeBloc(bloc.cle))}>
        {bloc.titre} <span className="font-normal normal-case text-muted-foreground">— {bloc.horizon}</span>
      </span>
      <span className="font-bold tabular-nums">{formatCHF(bloc.ht)} HT</span>
    </h3>
  )
}

function LignesPosition({ position }: { position: DevisBloc['positions'][number] }) {
  return (
    <>
      <tr className="border-t bg-muted/40 font-semibold">
        <td className="py-1 font-mono">{position.code || '—'}</td>
        <td className="py-1">{position.label}</td>
        <td className="py-1" />
        <td className="py-1" />
        <td className="py-1 text-right tabular-nums">{formatCHF(position.montant)}</td>
      </tr>
      {position.lignes.map((l) => (
        <tr key={l.cle} className="border-t align-top text-muted-foreground">
          <td className="py-1 pl-3 font-mono">{l.cfcCode}</td>
          <td className="py-1">
            {l.libelle}
            {l.enveloppe !== 'Réparation' && (
              <span className="ml-1.5 whitespace-nowrap rounded border px-1 text-[8pt] uppercase tracking-wide">{l.enveloppe}</span>
            )}
            {l.remarque && <div className="italic">{l.remarque}</div>}
          </td>
          <td className="py-1 text-right tabular-nums">
            {l.quantite != null ? `${l.quantite}${l.unite ? ` ${l.unite}` : ''}` : '—'}
          </td>
          <td className="py-1 text-right tabular-nums">
            {l.prixUnitaire != null ? formatCHF(l.prixUnitaire) : '—'}
          </td>
          <td className="py-1 text-right tabular-nums">{formatCHF(l.montant)}</td>
        </tr>
      ))}
    </>
  )
}

function Recapitulatif({ devis }: { devis: Devis }) {
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b text-left text-muted-foreground">
          <th className="py-1 font-medium">Priorité</th>
          <th className="py-1 font-medium">Horizon</th>
          <th className="w-16 py-1 text-right font-medium">Postes</th>
          <th className="w-28 py-1 text-right font-medium">Travaux HT</th>
          <th className="w-28 py-1 text-right font-medium">Total TTC</th>
        </tr>
      </thead>
      <tbody>
        {devis.blocs.map((b) => (
          <tr key={b.cle} className="border-t">
            <td className={cn('py-1 font-medium', couleurDeBloc(b.cle))}>{b.titre}</td>
            <td className="py-1 text-muted-foreground">{b.horizon}</td>
            <td className="py-1 text-right tabular-nums">{b.positions.length}</td>
            <td className="py-1 text-right tabular-nums">{formatCHF(b.ht)}</td>
            <td className="py-1 text-right font-medium tabular-nums">{formatCHF(b.cascade.total)}</td>
          </tr>
        ))}
        <tr className="border-t-2 font-bold">
          <td className="py-1.5" colSpan={3}>Ensemble des travaux</td>
          <td className="py-1.5 text-right tabular-nums">{formatCHF(devis.ht)}</td>
          <td className="py-1.5 text-right tabular-nums">{formatCHF(devis.cascade.total)}</td>
        </tr>
      </tbody>
    </table>
  )
}

function TotalOperation({ devis, project }: { devis: Devis; project: ApiProject }) {
  return (
    <div className="mt-6 max-w-[95mm] space-y-1">
      <SousTitre>Coût total de l'opération</SousTitre>
      <Row l="Travaux (HT)" v={formatCHF(devis.ht)} strong />
      <Row l={`Honoraires (${project.honoraryPct ?? 0} %)`} v={formatCHF(devis.cascade.honoraires)} />
      <Row l={`Réserve pour imprévus (${project.reservePct ?? 0} %)`} v={formatCHF(devis.cascade.reserve)} />
      <Row l="Sous-total" v={formatCHF(devis.cascade.sousTotal)} />
      <Row l="TVA 8.1 %" v={formatCHF(devis.cascade.tva)} />
      <div className="flex justify-between border-t pt-2 font-bold">
        <span>Total TTC</span><span>{formatCHF(devis.cascade.total)}</span>
      </div>
      <p className="pt-2 text-muted-foreground">
        Fourchette à ±15 % : de {formatCHF(devis.cascade.total * 0.85)} à {formatCHF(devis.cascade.total * 1.15)} TTC.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chapitre 5 — variantes
// ---------------------------------------------------------------------------

/** Le devis de base et chaque variante, côte à côte : c'est la lecture utile. */
function ComparaisonVariantes({ base, variantes }: { base: Devis; variantes: Variante[] }) {
  const moinsCher = variantes.reduce((a, b) => (b.ht < a.ht ? b : a))
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b text-left text-muted-foreground">
          <th className="py-1 font-medium">Scénario</th>
          <th className="w-20 py-1 text-right font-medium">Arbitrages</th>
          <th className="w-28 py-1 text-right font-medium">Travaux HT</th>
          <th className="w-28 py-1 text-right font-medium">Total TTC</th>
          <th className="w-28 py-1 text-right font-medium">Écart</th>
        </tr>
      </thead>
      <tbody>
        <tr className="border-t">
          <td className="py-1 font-medium">Diagnostic de base (chapitre 4)</td>
          <td className="py-1 text-right text-muted-foreground">—</td>
          <td className="py-1 text-right tabular-nums">{formatCHF(base.ht)}</td>
          <td className="py-1 text-right font-medium tabular-nums">{formatCHF(base.cascade.total)}</td>
          <td className="py-1 text-right text-muted-foreground">référence</td>
        </tr>
        {variantes.map((v) => (
          <tr key={v.variant.id} className="border-t">
            <td className="py-1 font-medium">
              {v.variant.name}
              {variantes.length > 1 && v.ht === moinsCher.ht && (
                <span className="ml-1.5 text-[8pt] font-normal text-emerald-700">(le moins cher)</span>
              )}
            </td>
            <td className="py-1 text-right tabular-nums">{v.arbitrages.length}</td>
            <td className="py-1 text-right tabular-nums">{formatCHF(v.ht)}</td>
            <td className="py-1 text-right font-medium tabular-nums">{formatCHF(v.cascade.total)}</td>
            <td className={cn('py-1 text-right font-medium tabular-nums', couleurEcart(v.ecartHt))}>
              {ecartLisible(v.ecartHt)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Un écart se lit à son signe : moins cher en vert, plus cher en rouge. */
function couleurEcart(ecart: number): string {
  return ecart < 0 ? 'text-emerald-700' : ecart > 0 ? 'text-red-700' : 'text-muted-foreground'
}
function ecartLisible(ecart: number): string {
  if (ecart === 0) return '—'
  return `${ecart > 0 ? '+' : '−'}${formatCHF(Math.abs(ecart))}`
}

function TitreVariante({ calcul }: { calcul: Variante }) {
  return (
    <>
      <h3 className="mb-1 flex flex-wrap items-baseline justify-between gap-x-4 border-b-2 border-foreground pb-1">
        <span className="font-bold uppercase tracking-wide">{calcul.variant.name}</span>
        <span className="font-bold tabular-nums">{formatCHF(calcul.ht)} HT</span>
      </h3>
      {calcul.variant.description && (
        <p className="mt-2 text-muted-foreground">{calcul.variant.description}</p>
      )}
    </>
  )
}

/** Le détail d'une variante : ce qu'elle remplace, par quoi, et ce que ça change. */
function DetailVariante({ calcul }: { calcul: Variante }) {
  return (
    <div className="mt-3">
      <table className="w-full">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-1 font-medium">Au lieu de</th>
            <th className="py-1 font-medium">On retient</th>
            <th className="w-24 py-1 text-right font-medium">Montant HT</th>
            <th className="w-24 py-1 text-right font-medium">Écart</th>
          </tr>
        </thead>
        <tbody>
          {calcul.arbitrages.map((a) => (
            <tr key={a.ligne.id} className="border-t align-top">
              <td className="py-1 pr-3">
                {a.remplace ? (
                  <>
                    <span className="font-mono text-muted-foreground">{a.remplace.cfcCode}</span> {a.remplace.cfcLabel}
                    <div className="text-muted-foreground">
                      {a.remplace.state && <>{stateLabels[a.remplace.state]} · </>}
                      {formatCHF(a.montantRemplace)}
                    </div>
                  </>
                ) : (
                  <span className="text-muted-foreground">Travail nouveau, absent du diagnostic</span>
                )}
              </td>
              <td className="py-1 pr-3">
                <span className="font-mono text-muted-foreground">{a.ligne.cfcCode}</span> {a.ligne.label}
                {/* L'état retenu fait partie de l'arbitrage : passer un ouvrage de moyen à
                    mauvais change le prix autant que changer d'article. */}
                {(a.ligne.state || a.quantite != null) && (
                  <div className="text-muted-foreground">
                    {a.ligne.state && <>{stateLabels[a.ligne.state]}</>}
                    {a.ligne.state && a.quantite != null && ' · '}
                    {a.quantite != null && (
                      <>{a.quantite} {uniteCourte(a.ligne.unit) ?? ''}{a.baseMetre ? ` (${a.baseMetre})` : ''}</>
                    )}
                  </div>
                )}
                {a.ligne.note && <div className="italic text-muted-foreground">{a.ligne.note}</div>}
              </td>
              <td className="py-1 text-right tabular-nums">{formatCHF(a.montant)}</td>
              <td className={cn('py-1 text-right font-medium tabular-nums', couleurEcart(a.ecart))}>
                {ecartLisible(a.ecart)}
              </td>
            </tr>
          ))}
          <tr className="border-t-2 font-semibold">
            <td className="py-1" colSpan={2}>Travaux conservés du diagnostic</td>
            <td className="py-1 text-right tabular-nums">{formatCHF(calcul.htConserve)}</td>
            <td className="py-1" />
          </tr>
          <tr className="font-semibold">
            <td className="py-1" colSpan={2}>Total des travaux de la variante (HT)</td>
            <td className="py-1 text-right tabular-nums">{formatCHF(calcul.ht)}</td>
            <td className={cn('py-1 text-right tabular-nums', couleurEcart(calcul.ecartHt))}>
              {ecartLisible(calcul.ecartHt)}
            </td>
          </tr>
          <tr className="text-muted-foreground">
            <td className="py-0.5" colSpan={2}>Total TTC (honoraires, réserve et TVA compris)</td>
            <td className="py-0.5 text-right tabular-nums">{formatCHF(calcul.cascade.total)}</td>
            <td className="py-0.5" />
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-muted-foreground">
        Les ouvrages non cités ci-dessus sont repris tels quels du diagnostic : seuls les
        arbitrages listés distinguent cette variante du devis du chapitre 4.
      </p>
    </div>
  )
}
