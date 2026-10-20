/**
 * Rapport complet : le livrable « clé en main », et ses extraits.
 *
 * Le document entier, dans l'ordre où un propriétaire le lit :
 *
 *   garde · sommaire · 1. méthode · 2. synthèse · 3. données du projet ·
 *   4. estimation énergétique · 5. rapport photo · 6. devis · 7. variantes
 *
 * La synthèse est une page du rapport, plus un document à part : elle lit le
 * même devis que le chapitre 6, ses totaux et ses compteurs ne peuvent plus
 * diverger. Le devis original, le rapport photo et l'étiquette énergétique
 * sont des extraits de ce même document (`partie`) : mêmes données, mêmes
 * lignes, même mise en page.
 *
 * Le chiffrage vient de `@/lib/devis-du-dossier` : le composant reçoit le
 * devis, il ne le calcule pas.
 *
 * Ce fichier ne produit pas une page web : il produit la suite de blocs d'un
 * document, que `DocumentA4` répartit ensuite sur des feuilles A4 réelles.
 */
import { useMemo, type ReactNode } from 'react'
import { buildingTypeLabels, priorityTextColors, stateLabels } from '@/data/mock'
import { cfcGroupCode } from '@/lib/cfc'
import { LIBELLE_LOCALISATION } from '@/lib/localisation'
import { getMarketInfo, priceBasisNote } from '@/lib/diagnostic-auto'
import { HORIZON, uniteCourte, type BaseDuDevis, type Devis } from '@/lib/devis'
import { ouvrageDeLArticle } from '@/lib/base-cfc/pont'
import { donneesDuBatiment } from '@/lib/base-cfc/batiment'
import { calculateurDesQuantites, vraimentRelevee } from '@/lib/base-cfc/quantite-comptee'
import { dureeVieResiduelle, phraseDureeVie } from '@/lib/duree-vie'
import { calculerVariantes } from '@/lib/variantes'
import { buildQuantityContext } from '@/lib/diagnostic-auto'
import { computeProjectMetrics, facadeMesuree, ROOF_COEFF } from '@/lib/formulas'
import { LIBELLE_SOURCE, sourceDe } from '@/lib/sources-dimensions'
import { corrigerTexte, nomDuReleve } from '@/lib/textes'
import { assembler } from '@/lib/energie/entree'
import { comparer } from '@/lib/energie/calcul'
import type { SaisieEnergie } from '@/lib/energie/entree'
import { cn, formatCHF, formatDate } from '@/lib/utils'

/** Un nombre à la suisse romande : « 2,8 », « 26,88 ». */
const nb = (v: number) => new Intl.NumberFormat('fr-CH', { maximumFractionDigits: 2 }).format(v)
import type { ApiCatalogItem, ApiDiagnosticItem, ApiProject, ApiVariant, DimensionSuivie, ElementState } from '@/lib/api-types'
import { useAuth } from '@/stores/auth'
import { useMarque } from './use-marque'
import { AvertissementEnergie, CorpsEnergie } from './ChapitreEnergie'
import { CHAPITRES, ETATS, PAGE } from './constants'
import { CaseEtat, Info, Ligne, LogoEntete, TitreRapport } from './shared'
import { DocumentA4, type BlocDocument } from './PagesA4'
import { usePageDuBloc } from './page-contexte'
import { blocsDuDevis } from './devis-blocs'
import { BudgetParEnveloppe, SousTitre, TableauPriorites } from './devis-tableaux'
import { blocsMethode } from './methode'
import { ComparaisonVariantes, DetailVariante, TitreVariante } from './variantes-rapport'
import { photoDeGarde } from '@/lib/photo-de-garde'

/** Le document entier, ou l'un de ses extraits. */
export type PartieDuRapport = 'complet' | 'devis' | 'photos' | 'energie'

const TITRE_ENERGIE = 'Estimation énergétique indicative'

type Chapitre = { cle: string; n: number; titre: string; bloc: string }

/** Identité d'entreprise reprise des réglages ; le logo par défaut est celui de Diagly. */
export type Entreprise = {
  name?: string | null; address?: string | null; postalCode?: string | null; city?: string | null
  vatNumber?: string | null; logo?: string | null
} | undefined

export interface RapportCompletProps {
  project: ApiProject
  /** Les relevés, quantités recalées sur la fiche (chiffrerLeDossier). */
  items: ApiDiagnosticItem[]
  /** Le devis du dossier, le même pour tous les documents. */
  devis: Devis
  /** Description de l'état constaté, tirée de l'ancien catalogue selon l'état coché. */
  etatExistant: (it: { catalogItemId: number | null; state: ElementState | null }) => string | null
  /** La base du bureau : articles, postes automatiques, étapes de visite. */
  base: BaseDuDevis
  /** L'ancien catalogue, encore nécessaire aux variantes, dont les lignes le référencent. */
  catalogItems: ApiCatalogItem[]
  /** Variantes du projet. Absentes, leur chapitre ne paraît pas. */
  variants: ApiVariant[]
  auteur: string
  partie?: PartieDuRapport
  /** L'identité du bureau quand le rapport se lit sans session (lien de partage). */
  entreprise?: Entreprise
}

export function RapportComplet({
  project, items, devis, etatExistant, base, catalogItems, variants, auteur, partie = 'complet', entreprise,
}: RapportCompletProps) {
  const marque = useMarque()
  const reglages = useAuth((s) => s.user?.preferences?.company) as Entreprise
  const company = useMemo(
    () => entreprise ?? ({ ...(reglages ?? {}), name: marque.name ?? undefined, logo: marque.logo ?? undefined } as Entreprise),
    [entreprise, reglages, marque],
  )
  const signataire = marque.auteur || auteur
  const metrics = computeProjectMetrics(project)
  const catalogue = useMemo(() => new Map(catalogItems.map((c) => [c.id, c])), [catalogItems])
  const articlesBruts = useMemo(() => new Map(base.articles.map((a) => [a.id, a])), [base.articles])
  /** Les articles de la base, prêts à être lus par la fiche d'ouvrage. */
  const articles = useMemo(() => new Map(base.articles.map((a) => [a.id, ouvrageDeLArticle(a)])), [base.articles])
  const nomDEtape = useMemo(() => new Map(base.etapes.map((e) => [e.numero, e.nom])), [base.etapes])
  /** La quantité que le calcul donne à chaque relevé : « relevée sur place » seulement si elle en diffère. */
  const calcul = useMemo(
    () => calculateurDesQuantites(items, base.articles, donneesDuBatiment(project)),
    [items, base.articles, project],
  )

  const evalues = useMemo(() => items.filter((i) => i.state), [items])
  const nonEvalues = useMemo(() => items.filter((i) => !i.state), [items])

  /**
   * Le rapport photo, dans l'ordre de la visite.
   *
   * Il raconte le tour du bâtiment : on commence dehors par la façade, on
   * entre, on monte, on ressort. Le devis, lui, suit le code CFC. Les relevés
   * d'avant la bascule n'ont pas d'étape : ils se rangent par les anciens
   * chapitres CFC, à la suite.
   */
  const chapitresPhoto = useMemo(() => {
    const reste = new Set(evalues.map((i) => i.id))
    const tri = (a: ApiDiagnosticItem, b: ApiDiagnosticItem) => (a.cfcCode ?? '').localeCompare(b.cfcCode ?? '', undefined, { numeric: true })
    const parEtape = [...base.etapes]
      .sort((a, b) => a.numero - b.numero)
      .map((etape) => {
        const dedans = evalues.filter((i) => i.etapeNumero === etape.numero).sort(tri)
        for (const i of dedans) reste.delete(i.id)
        return { titre: etape.nom, items: dedans }
      })
    const anciens = CHAPITRES.map((ch) => {
      const dedans = evalues.filter((i) => reste.has(i.id) && ch.groupes.includes(cfcGroupCode(i.cfcCode) ?? '')).sort(tri)
      for (const i of dedans) reste.delete(i.id)
      return { titre: ch.titre, items: dedans }
    })
    const orphelins = evalues.filter((i) => reste.has(i.id))
    const tous = [...parEtape, ...anciens]
    if (orphelins.length) tous.push({ titre: 'Divers', items: orphelins })
    return tous.filter((c) => c.items.length > 0)
  }, [evalues, base.etapes])

  const variantes = useMemo(
    () => calculerVariantes(variants, items,
      { honoraryPct: project.honoraryPct, reservePct: project.reservePct }, devis.ht,
      { catalogue, qtyCtx: buildQuantityContext(project) }),
    [variants, items, project, devis.ht, catalogue],
  )

  // Sans surface de référence énergétique, tout le calcul au mètre carré tombe :
  // mieux vaut pas de chapitre qu'un chapitre qui divise par zéro.
  const avecEnergie = Boolean(project.sre ?? project.floorArea)

  const chapitres = useMemo<Chapitre[]>(() => {
    const l: Omit<Chapitre, 'n'>[] = [
      { cle: 'methode', titre: 'Comment ce rapport est réalisé', bloc: 'ch-methode' },
      { cle: 'synthese', titre: 'Synthèse du diagnostic', bloc: 'ch-synthese' },
      { cle: 'donnees', titre: 'Données du projet', bloc: 'ch-donnees' },
      ...(avecEnergie ? [{ cle: 'energie', titre: TITRE_ENERGIE, bloc: 'ch-energie' }] : []),
      { cle: 'photo', titre: 'Rapport photo', bloc: 'ch-photo' },
      { cle: 'devis', titre: 'Devis estimatif ±15 %', bloc: 'ch-devis' },
      ...(variantes.length > 0 ? [{ cle: 'variantes', titre: 'Variantes de projet', bloc: 'ch-variantes' }] : []),
    ]
    return l.map((c, i) => ({ ...c, n: i + 1 }))
  }, [avecEnergie, variantes.length])
  const numero = (cle: string) => chapitres.find((c) => c.cle === cle)?.n ?? 0

  const aujourdhui = formatDate(new Date())
  const adresse = [project.address, [project.postalCode, project.city].filter(Boolean).join(' ')]
    .filter(Boolean).join(', ')

  const blocs = useMemo<BlocDocument[]>(() => {
    const out: BlocDocument[] = []
    const bloc = (cle: string, noeud: ReactNode, o: { nouvellePage?: boolean; avecSuivant?: boolean } = {}) =>
      out.push({ type: 'bloc', cle, noeud, ...o })
    const titreChapitre = (cle: string) => {
      const c = chapitres.find((x) => x.cle === cle)!
      return <ChapitreTitre n={partie === 'complet' ? c.n : null} titre={c.titre} />
    }

    // --------------------------------------------------- les chapitres
    const methode = () => {
      bloc('ch-methode', titreChapitre('methode'), { nouvellePage: true, avecSuivant: true })
      for (const [cle, noeud] of blocsMethode(project, devis)) bloc(cle, noeud)
    }

    const synthese = () => {
      bloc('ch-synthese', titreChapitre('synthese'), { nouvellePage: true, avecSuivant: true })
      bloc('s-etat', <SyntheseEtat project={project} items={items} devis={devis} nom={(it) => nomDuReleve(it, articlesBruts)} />)
      bloc('s-energie', <SyntheseEnergie project={project} items={items} avecEnergie={avecEnergie} />)
      bloc('s-budget', <SyntheseBudget devis={devis} chapitreDevis={numero('devis')} />)
      if (project.yearBuilt != null && project.yearBuilt < 1991) bloc('s-polluants', <RecommandationPolluants annee={project.yearBuilt} />)
    }

    const donnees = () => {
      bloc('ch-donnees', titreChapitre('donnees'), { nouvellePage: true, avecSuivant: true })
      bloc('d-identite', (
        <div className="grid grid-cols-2 gap-x-8 gap-y-1">
          <Info l="Adresse" v={`${adresse || 'n.c.'} (${project.canton})`} />
          <Info l="Type" v={buildingTypeLabels[project.buildingType] ?? project.buildingType} />
          <Info l="Année de construction" v={project.yearBuilt ? String(project.yearBuilt) : 'n.c.'} />
          <Info l="Année de rénovation" v={project.renovationYear ? String(project.renovationYear) : 'n.c.'} />
          <Info l="Parcelle" v={project.parcelNumber ?? 'n.c.'} />
          {project.egid && <Info l="EGID" v={project.egid} />}
          {project.energyClassGlobal && <Info l="Classe énergétique (CECB)" v={project.energyClassGlobal} />}
          {project.sre != null && <Info l="SRE (certificat)" v={`${project.sre} m²`} />}
        </div>
      ))
      bloc('d-metres-titre', <SousTitre className="mt-6">Métrés retenus et leur source</SousTitre>, { avecSuivant: true })
      bloc('d-metres', <MetresDuProjet project={project} metrics={metrics} devis={devis} />)
    }

    const energie = () => {
      // Le titre et l'avertissement en un bloc : le corps est long, et un titre
      // qui attend le bloc suivant restait seul en bas de page.
      bloc('ch-energie', <>{titreChapitre('energie')}<AvertissementEnergie /></>, { nouvellePage: true })
      bloc('e-donnees', <CorpsEnergie project={project} ouvrages={items} devis={devis} client partie="donnees" />)
      bloc('e-resultat', <CorpsEnergie project={project} ouvrages={items} devis={devis} client partie="resultat" />)
    }

    const photo = () => {
      bloc('ch-photo', titreChapitre('photo'), { nouvellePage: true, avecSuivant: true })
      bloc('p-intro', (
        <p className="mb-2 text-muted-foreground">
          Les ouvrages diagnostiqués, dans l'ordre de la visite : leur état, ce qui a été constaté, les
          travaux à prévoir et les photos prises sur place.
        </p>
      ))
      if (chapitresPhoto.length === 0) bloc('p-vide', <p className="text-muted-foreground">Aucun ouvrage évalué pour l'instant.</p>)
      for (const ch of chapitresPhoto) {
        bloc(`p-${ch.titre}`, (
          <h3 className="mb-1 mt-4 border-b-2 border-foreground pb-1 font-bold uppercase">{ch.titre}</h3>
        ), { avecSuivant: true })
        for (const it of ch.items) {
          bloc(`ouvrage-${it.id}`, (
            <FicheOuvrage
              it={it}
              nom={nomDuReleve(it, articlesBruts)}
              constat={etatExistant(it)}
              article={it.articleId ? articles.get(it.articleId) : it.catalogItemId != null ? catalogue.get(it.catalogItemId) : undefined}
              etape={it.etapeNumero != null ? nomDEtape.get(it.etapeNumero) ?? null : null}
              relevee={vraimentRelevee(it, calcul)}
            />
          ))
        }
      }
      // Un ouvrage repéré mais pas encore évalué ne s'imprime pas comme une
      // fiche vide : il va dans cet encadré, et il n'est pas chiffré.
      if (nonEvalues.length > 0) {
        bloc('p-a-completer', (
          <PointsACompleter items={nonEvalues} nom={(it) => nomDuReleve(it, articlesBruts)} nomDEtape={nomDEtape} />
        ))
      }
    }

    const leDevis = () => {
      bloc('ch-devis', titreChapitre('devis'), { nouvellePage: true, avecSuivant: true })
      out.push(...blocsDuDevis(devis, project))
    }

    const lesVariantes = () => {
      if (variantes.length === 0) return
      bloc('ch-variantes', titreChapitre('variantes'), { nouvellePage: true, avecSuivant: true })
      bloc('v-intro', (
        <p className="mb-4 text-muted-foreground">
          Le diagnostic décrit ce qu'il faut faire. Les variantes répondent à une autre question : et
          si on s'y prenait autrement ? Chacune reprend tout le diagnostic et ne remplace que les
          ouvrages désignés ; les écarts se lisent par rapport au devis du chapitre {numero('devis')}.
        </p>
      ))
      bloc('v-comparaison-titre', <SousTitre>Comparaison</SousTitre>, { avecSuivant: true })
      bloc('v-comparaison', <ComparaisonVariantes base={devis} variantes={variantes} />)
      for (const v of variantes) {
        bloc(`v-${v.variant.id}-titre`, <TitreVariante calcul={v} />, { nouvellePage: true, avecSuivant: true })
        bloc(`v-${v.variant.id}-detail`, <DetailVariante calcul={v} />)
      }
    }

    const mentions = () => bloc('mentions', (
      <p className="mt-6 border-t pt-3 text-muted-foreground">
        {priceBasisNote()} Diagnostic établi à vue, sans sondage destructif, le {aujourdhui}
        {signataire ? ` par ${signataire}` : ''}. Rapport généré par Diagly.
      </p>
    ))

    // ------------------------------------------------------ les extraits
    if (partie !== 'complet') {
      const titres = { devis: 'Devis estimatif ±15 %', photos: 'Rapport photo', energie: 'Étiquette énergétique' } as const
      bloc('extrait-titre', (
        <TitreRapport
          titre={titres[partie]}
          projet={[project.name, adresse].filter(Boolean).join(' · ')}
          mention={`Extrait du rapport de diagnostic, édité le ${aujourdhui}${signataire ? ` par ${signataire}` : ''}`}
        />
      ), { avecSuivant: true })
      if (partie === 'devis') out.push(...blocsDuDevis(devis, project))
      if (partie === 'photos') {
        const avant = out.length
        photo()
        // Le titre de chapitre fait doublon avec celui de l'extrait.
        out.splice(avant, 1)
      }
      if (partie === 'energie') {
        if (avecEnergie) {
          bloc('e-avertissement', <AvertissementEnergie />)
          bloc('e-donnees', <CorpsEnergie project={project} ouvrages={items} devis={devis} client partie="donnees" />)
          bloc('e-resultat', <CorpsEnergie project={project} ouvrages={items} devis={devis} client partie="resultat" />)
        } else {
          bloc('e-vide', <p className="text-muted-foreground">Renseignez la surface de plancher ou la SRE du dossier pour estimer la classe énergétique.</p>)
        }
      }
      mentions()
      return out
    }

    // -------------------------------------------------------- le complet
    bloc('garde', (
      <PageDeGarde
        project={project} items={items} adresse={adresse}
        aujourdhui={aujourdhui} auteur={signataire} company={company} accent={marque.accentColor}
      />
    ))
    bloc('sommaire-titre', <h2 className="mb-6 text-2xl font-bold">Sommaire</h2>, { nouvellePage: true, avecSuivant: true })
    bloc('sommaire', <Sommaire chapitres={chapitres} />)
    methode()
    synthese()
    donnees()
    if (avecEnergie) energie()
    photo()
    leDevis()
    lesVariantes()
    mentions()
    return out
    // `numero` se déduit de `chapitres`, déjà dans la liste.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partie, project, items, devis, chapitres, chapitresPhoto, nonEvalues, avecEnergie, variantes, catalogue, articles, articlesBruts, nomDEtape, calcul, etatExistant, metrics, adresse, aujourdhui, signataire, marque, company])

  return (
    <DocumentA4
      blocs={blocs}
      entete={<LogoEntete />}
      mentionPied={`${project.name} · ${aujourdhui}`}
      sansPiedPremierePage={partie === 'complet'}
    />
  )
}

// ---------------------------------------------------------------------------
// Garde et sommaire
// ---------------------------------------------------------------------------

/** Page de garde : elle occupe la hauteur utile d'une feuille, à elle seule, sans numéro. */
function PageDeGarde({ project, items, adresse, aujourdhui, auteur, company, accent }: {
  project: ApiProject
  items: ApiDiagnosticItem[]
  adresse: string
  aujourdhui: string
  auteur: string
  company: Entreprise
  /** La couleur du dossier : le seul endroit de la garde où elle se voit. */
  accent: string | null
}) {
  // Celle choisie dans la page Photos, sinon la première venue.
  const photo = photoDeGarde(items, project.photoDeGarde)
  const ligne2 = [company?.postalCode, company?.city].filter(Boolean).join(' ')
  // La hauteur utile moins l'en-tête et le pied : la garde remplit sa page.
  const hauteur = `${PAGE.hauteur - PAGE.entete - PAGE.pied}mm`
  const rue = project.address?.trim()
  const localite = [project.postalCode, project.city].filter(Boolean).join(' ')
  const nomDistinct = project.name && project.name.trim() !== rue && project.name.trim() !== adresse

  return (
    <div className="flex flex-col" style={{ height: hauteur }}>
      <div className="flex-1">
        <p className="uppercase tracking-[0.2em] text-muted-foreground">Diagnostic de bâtiment</p>
        <h1 className="mt-2 text-4xl font-bold leading-tight">Rapport de diagnostic</h1>
        <div className="mt-3 h-1 w-24" style={{ backgroundColor: accent ?? undefined }} />
        <p className="mt-6 text-2xl font-semibold">{rue || project.name}</p>
        {localite && <p className="text-xl">{localite}</p>}
        {nomDistinct && <p className="mt-1 text-muted-foreground">{project.name}</p>}
        {photo && <img src={photo} alt="" className="mt-8 max-h-[100mm] w-full rounded border object-cover" />}
      </div>
      <div className="mt-8 flex items-end justify-between gap-6 border-t pt-4 text-muted-foreground">
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
 * Sommaire : les chapitres et leur page, alignés.
 *
 * Le numéro n'est connu qu'une fois le document découpé ; il apparaît au
 * second rendu. Un seul filet pointillé mène du titre au numéro : la page
 * précédente en portait deux par ligne.
 */
function Sommaire({ chapitres }: { chapitres: Chapitre[] }) {
  return (
    <ol className="space-y-2.5">
      {chapitres.map((c) => <LigneSommaire key={c.bloc} chapitre={c} />)}
    </ol>
  )
}

function LigneSommaire({ chapitre }: { chapitre: Chapitre }) {
  const page = usePageDuBloc(chapitre.bloc)
  return (
    <li className="flex items-baseline gap-3 text-[11pt]">
      <span className="w-6 shrink-0 font-bold tabular-nums">{chapitre.n}.</span>
      <span className="font-medium">{chapitre.titre}</span>
      <span className="min-w-6 flex-1 translate-y-[-0.25em] border-b border-dotted border-muted-foreground/40" aria-hidden />
      <span className="w-8 shrink-0 text-right tabular-nums">{page ?? ''}</span>
    </li>
  )
}

/** Titre de chapitre numéroté, repris du sommaire ; sans numéro dans un extrait. */
function ChapitreTitre({ n, titre }: { n: number | null; titre: string }) {
  return (
    <h2 className="mb-4 border-b-2 border-foreground pb-2 text-2xl font-bold">
      {n != null && <span className="text-muted-foreground">{n}.</span>} {titre}
    </h2>
  )
}

// ---------------------------------------------------------------------------
// Synthèse
// ---------------------------------------------------------------------------

/** L'état du bâtiment, en une demi-page : ce qui va, ce qui ne va pas, et le plus urgent. */
function SyntheseEtat({ project, items, devis, nom }: {
  project: ApiProject
  items: ApiDiagnosticItem[]
  devis: Devis
  nom: (it: ApiDiagnosticItem) => string
}) {
  const parEtat = ETATS.map((e) => ({ e, n: items.filter((i) => i.state === e).length }))
  const evalues = parEtat.reduce((s, x) => s + x.n, 0)
  const identite = [
    buildingTypeLabels[project.buildingType],
    project.yearBuilt ? `construit en ${project.yearBuilt}` : null,
    project.nbApartments ? `${project.nbApartments} logement${project.nbApartments > 1 ? 's' : ''}` : null,
    project.nbFloors ? `${project.nbFloors} niveau${project.nbFloors > 1 ? 'x' : ''}` : null,
  ].filter(Boolean).join(', ')
  const parId = new Map(items.map((i) => [i.id, i]))
  const urgents = devis.lignes
    .filter((l) => l.priorite === 'I' && l.releveId && !l.rattacheA)
    .sort((a, b) => b.montant - a.montant)
    .slice(0, 6)

  return (
    <div>
      <SousTitre>État du bâtiment</SousTitre>
      <p className="mb-2">
        {identite ? `${identite.charAt(0).toUpperCase()}${identite.slice(1)}. ` : ''}
        {evalues} ouvrage{evalues > 1 ? 's' : ''} évalué{evalues > 1 ? 's' : ''} lors de la visite.
      </p>
      <div className="flex flex-wrap gap-x-6 gap-y-1">
        {parEtat.map(({ e, n }) => (
          <span key={e} className="inline-flex items-center gap-2">
            <CaseEtat etat={e} actif={n > 0} /><b className="tabular-nums">{n}</b>
          </span>
        ))}
      </div>
      {urgents.length > 0 && (
        <>
          <p className="mb-1 mt-4 font-semibold">À engager en priorité I ({HORIZON.I})</p>
          <table className="w-full">
            <tbody>
              {urgents.map((l) => {
                const it = l.releveId ? parId.get(l.releveId) : undefined
                return (
                  <tr key={l.cle} className="border-t align-top">
                    <td className="py-1">
                      {it ? nom(it) : l.libelle}
                      <span className="text-muted-foreground"> · {l.enveloppe.toLowerCase()}{it?.state ? `, état ${stateLabels[it.state].toLowerCase()}` : ''}</span>
                    </td>
                    <td className="w-32 py-1 text-right tabular-nums">
                      {l.aChiffrer ? <span className="font-medium text-amber-700">à chiffrer</span> : formatCHF(l.montant)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}

/** La classe énergétique : celle du certificat s'il existe, sinon l'estimation du chapitre 4. */
function SyntheseEnergie({ project, items, avecEnergie }: { project: ApiProject; items: ApiDiagnosticItem[]; avecEnergie: boolean }) {
  const estimation = useMemo(() => {
    if (!avecEnergie) return null
    const saisie = (project.energyData?.estimation as SaisieEnergie | undefined) ?? {}
    const a = assembler(project, items, saisie)
    return { a, gain: comparer(a.avant, a.apres, a.entree.sre) }
  }, [project, items, avecEnergie])
  if (!project.energyClassGlobal && !estimation) return null
  return (
    <div className="mt-5">
      <SousTitre>Classe énergétique</SousTitre>
      {project.energyClassGlobal ? (
        <p>
          Certificat CECB : classe <b>{project.energyClassEnvelope ?? 'n.c.'}</b> pour l'enveloppe, <b>{project.energyClassGlobal}</b> en
          efficacité globale.
        </p>
      ) : estimation && (
        <p>
          Estimation indicative : classe <b>{estimation.a.avant.global.classe}</b> aujourd'hui
          {estimation.a.cochees.length > 0 && <>, <b>{estimation.a.apres.global.classe}</b> après les mesures retenues (gain estimé {String(estimation.gain.gainPourcent).replace('.', ',')} %)</>}.
          Ce n'est pas un certificat ; le détail est au chapitre de l'estimation énergétique.
        </p>
      )}
    </div>
  )
}

/** Le budget global : le total, ses enveloppes et ses priorités, lus sur le devis. */
function SyntheseBudget({ devis, chapitreDevis }: { devis: Devis; chapitreDevis: number }) {
  const n = devis.aChiffrer.length
  return (
    <div className="mt-5">
      <SousTitre>Budget global</SousTitre>
      <p className="mb-2">
        <span className="text-[13pt] font-bold tabular-nums">{formatCHF(devis.cascade.total)} TTC</span>
        <span className="text-muted-foreground"> · {formatCHF(devis.ht)} HT · fourchette de {formatCHF(devis.cascade.total * 0.85)} à {formatCHF(devis.cascade.total * 1.15)}</span>
      </p>
      <BudgetParEnveloppe devis={devis} />
      <p className="mb-1 mt-4 font-semibold">Par priorité</p>
      <TableauPriorites devis={devis} />
      <p className="mt-2 text-muted-foreground">
        Le détail ligne par ligne est au chapitre {chapitreDevis}. Les améliorations y sont chiffrées à part : elles se décident séparément.
        {n > 0 && ` ${n} ligne${n > 1 ? 's restent' : ' reste'} à chiffrer et ne ${n > 1 ? 'sont' : 'est'} pas comprise${n > 1 ? 's' : ''} dans ce total.`}
      </p>
    </div>
  )
}

/** Avant 1991, l'amiante et les autres polluants sont possibles : le rapport le dit, même hors mandat. */
function RecommandationPolluants({ annee }: { annee: number }) {
  return (
    <div className="mt-5 border-l-[3px] border-orange-500 bg-orange-50 px-3 py-2">
      <p className="font-semibold">Recommandation : repérage des polluants avant travaux</p>
      <p className="text-muted-foreground">
        Le bâtiment date de {annee}, avant l'interdiction de l'amiante en 1990. Des matériaux contenant
        de l'amiante, des PCB, du plomb ou des HAP peuvent être présents. Un repérage des polluants par
        un diagnostiqueur spécialisé est recommandé avant tous travaux. Il ne fait pas partie du
        présent mandat et n'est pas chiffré.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Données du projet
// ---------------------------------------------------------------------------

/**
 * Les dimensions retenues pour les métrés, avec la source de chacune : les
 * plans du bâtiment, le registre, le calcul, ou une valeur par défaut. La
 * surface à échafauder est celle que le devis chiffre, et pas une autre.
 */
function MetresDuProjet({ project, metrics, devis }: {
  project: ApiProject
  metrics: ReturnType<typeof computeProjectMetrics>
  devis: Devis
}) {
  const source = (champ: DimensionSuivie, valeur: unknown, sinon = 'fiche du dossier') => {
    const s = sourceDe(project, champ)
    if (s) return LIBELLE_SOURCE[s]
    return valeur == null ? 'non renseignée' : sinon
  }
  const m2 = (v: number | null | undefined) => (v != null && v > 0 ? `${Math.round(v).toLocaleString('fr-CH').replace(/\s/g, "'")} m²` : 'n.c.')
  const hauteur = project.floorHeight ?? 2.7
  const coefToit = project.roofType ? ROOF_COEFF[project.roofType] : null
  const lignes: [string, string, string][] = [
    ['Surface de plancher', m2(project.floorArea), source('floorArea', project.floorArea)],
    ['Surface bâtie (emprise)', m2(project.builtArea), source('builtArea', project.builtArea)],
    ['Périmètre', project.perimeter ? `${nb(project.perimeter)} ml` : 'n.c.', source('perimeter', project.perimeter)],
    ["Nombre d'étages", project.nbFloors != null ? String(project.nbFloors) : 'n.c.', source('nbFloors', project.nbFloors)],
    ["Hauteur d'étage", `${nb(hauteur)} m`, project.floorHeight ? source('floorHeight', project.floorHeight) : 'valeur par défaut, non relevée'],
    ['Surface de façade', m2(metrics.facade),
      facadeMesuree(project) != null
        ? source('facadeArea', project.facadeArea)
        : project.perimeter && project.nbFloors
          ? `calcul : ${nb(project.perimeter)} ml × ${project.nbFloors} étages × ${nb(hauteur)} m`
          : source('facadeArea', project.facadeArea)],
    ['Part vitrée', `${nb(project.windowPct)} %`, sourceDe(project, 'windowPct') ? source('windowPct', project.windowPct) : 'fiche du dossier, appliquée à la façade'],
    ['Surface de toiture', metrics.roof != null ? m2(metrics.roof) : 'à préciser',
      project.roofArea
        ? source('roofArea', project.roofArea)
        : coefToit
          ? `calcul : surface bâtie × ${String(coefToit).replace('.', ',')} (toiture ${project.roofType === 'PENTE' ? 'en pente' : project.roofType === 'MIXTE' ? 'mixte' : 'plate'})`
          : 'type de toiture non précisé, aucune présomption'],
    // Au dixième près, comme au devis : la même surface, écrite de la même façon.
    ['Surface à échafauder', devis.surfaceEchafaudee != null ? `${nb(devis.surfaceEchafaudee)} m²` : 'aucune',
      devis.surfaceEchafaudee != null ? 'chiffrée au devis (CFC 211.1)' : "aucun ouvrage chiffré ne demande d'échafaudage"],
    ['Logements', project.nbApartments != null ? String(project.nbApartments) : 'n.c.', source('nbApartments', project.nbApartments)],
    ["Cages d'escalier", project.nbStaircases != null ? String(project.nbStaircases) : 'n.c.', source('nbStaircases', project.nbStaircases)],
    ['Indice de la construction', `× ${nb(getMarketInfo().coeff)}`, 'indice suisse des prix de la construction (OFS)'],
  ]
  return (
    <>
      <table className="w-full">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-1 font-medium">Dimension</th>
            <th className="w-28 py-1 font-medium">Valeur</th>
            <th className="py-1 font-medium">Source</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map(([l, v, s]) => (
            <tr key={l} className="border-t align-top">
              <td className="w-48 py-1">{l}</td>
              <td className="py-1 font-medium tabular-nums">{v}</td>
              <td className={cn('py-1', s === LIBELLE_SOURCE.plans ? 'font-medium text-emerald-700' : 'text-muted-foreground')}>{s}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-muted-foreground">
        Les quantités du devis se déduisent de ces dimensions : quand les plans du bâtiment sont
        analysés, les métrés qu'ils donnent remplacent les valeurs de la fiche, et les quantités qui en
        dépendent se recalculent. Une quantité mesurée sur place, elle, ne suit plus le calcul.
      </p>
    </>
  )
}

// ---------------------------------------------------------------------------
// Rapport photo
// ---------------------------------------------------------------------------

/**
 * Une observation : l'état coché, ce qui a été constaté, ce qu'il faut prévoir,
 * et les photos de la visite, en vignettes à droite. Plusieurs fiches tiennent
 * sur une page : un seul ouvrage occupait souvent une page entière.
 */
function FicheOuvrage({ it, nom, constat, article, etape, relevee }: {
  it: ApiDiagnosticItem
  nom: string
  constat: string | null
  /** L'article de la base, ou de l'ancien catalogue pour un relevé d'avant. */
  article: { unit: string | null; scaffoldingNote: string | null } | undefined
  /** Étape de visite du relevé, qui dit de quel côté du bâtiment il parle. */
  etape: string | null
  /** La quantité a été mesurée sur place, et diffère du calcul. */
  relevee: boolean
}) {
  const vie = dureeVieResiduelle(it, {})
  const phraseVie = phraseDureeVie(vie, it.cfcCode)
  const travaux = it.works.filter((w) => w && w !== 'Néant').map((w) => corrigerTexte(w))
  const unite = uniteCourte(it.unit) ?? uniteCourte(article?.unit)
  const photos = it.photos.slice(0, 2)

  return (
    <article className={cn('grid gap-x-4 border-t py-2', photos.length > 0 && 'grid-cols-[minmax(0,1fr)_64mm]')}>
      <div className="min-w-0">
        <p className="font-semibold">
          {nom}
          {/* Quand le chapitre porte déjà le nom de l'étape, le redire alourdit ;
              pour un relevé d'avant la bascule, rangé par code CFC, la mention reste. */}
          {!etape && it.localisation && (
            <span className="ml-1.5 font-normal text-muted-foreground">({LIBELLE_LOCALISATION[it.localisation].toLowerCase()})</span>
          )}
          <span className="ml-2 font-mono font-normal text-muted-foreground">{it.cfcCode}</span>
        </p>
        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[8.5pt]">
          {ETATS.map((e) => <CaseEtat key={e} etat={e} actif={it.state === e} />)}
        </div>
        {constat && <Ligne titre="État constaté" texte={corrigerTexte(constat)} />}
        {it.notes?.trim() && <Ligne titre="Observations" texte={corrigerTexte(it.notes)} />}
        {travaux.length > 0 && <Ligne titre="Travaux à prévoir" texte={travaux.join(' ')} />}
        {it.norms && <Ligne titre="Mise aux normes" texte={corrigerTexte(it.norms)} />}
        {it.improvement && <Ligne titre="Amélioration possible" texte={corrigerTexte(it.improvement)} />}
        {article?.scaffoldingNote && (
          <p className="mt-1 text-amber-700">{article.scaffoldingNote} : l'accès conditionne le coût et la date d'intervention.</p>
        )}
        <p className="mt-1 text-muted-foreground">
          {it.priority && (
            <span className={cn('font-semibold', priorityTextColors[it.priority])}>Priorité {it.priority} ({HORIZON[it.priority]})</span>
          )}
          {it.priority && it.area != null && ' · '}
          {it.area != null && <>Quantité {nb(it.area)}{unite ? ` ${unite}` : ''}{relevee ? ' (relevée sur place)' : ''}</>}
        </p>
        {/* L'état dit ce que vaut l'ouvrage aujourd'hui, la durée restante combien
            de temps il lui reste : les deux décident s'il faut remplacer maintenant. */}
        {phraseVie && (
          <p className={cn('mt-0.5', vie && vie.depassement > 0 ? 'text-red-700' : 'text-muted-foreground')}>{phraseVie}</p>
        )}
        {it.photos.length > 2 && (
          <p className="mt-0.5 text-muted-foreground">
            {it.photos.length - 2} autre{it.photos.length - 2 > 1 ? 's' : ''} photo{it.photos.length - 2 > 1 ? 's' : ''} de cet ouvrage au dossier.
          </p>
        )}
      </div>
      {photos.length > 0 && (
        <div className="grid grid-cols-2 content-start gap-1.5">
          {photos.map((src, i) => (
            <img key={i} src={src} alt="" className="aspect-[4/3] w-full rounded border object-cover" />
          ))}
        </div>
      )}
    </article>
  )
}

/** Les ouvrages repérés mais pas encore évalués : ni fiche vide, ni chiffrage. */
function PointsACompleter({ items, nom, nomDEtape }: {
  items: ApiDiagnosticItem[]
  nom: (it: ApiDiagnosticItem) => string
  nomDEtape: Map<number, string>
}) {
  return (
    <div className="mt-5 border border-dashed border-muted-foreground/50 px-3 py-2">
      <p className="font-semibold">Points à compléter</p>
      <p className="mb-1 text-muted-foreground">
        Ces ouvrages ont été repérés mais pas encore évalués. Ils ne sont pas chiffrés au devis.
      </p>
      <ul className="columns-2 gap-6">
        {items.map((it) => (
          <li key={it.id} className="break-inside-avoid">
            · {nom(it)}
            {it.etapeNumero != null && nomDEtape.get(it.etapeNumero) && (
              <span className="text-muted-foreground"> ({nomDEtape.get(it.etapeNumero)})</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
