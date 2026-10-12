/**
 * La base CFC du bureau : l'arborescence, le tableau, la fiche.
 *
 * C'est la page où le catalogue se tient, et elle est faite pour deux gestes
 * très différents. Chercher un article, d'abord : on tape trois lettres et on
 * le trouve, ou on descend l'arborescence CFC si on cherche par position.
 * Corriger un prix, ensuite : on ouvre la fiche, on modifie, on enregistre
 * explicitement, et la modification laisse une trace nominative.
 *
 * La base est commune. Un prix corrigé ici change le devis de tous les
 * diagnostiqueurs, y compris sur les dossiers en cours, et c'est pourquoi
 * l'écriture est réservée aux responsables et l'enregistrement jamais
 * automatique.
 */
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle, ChevronRight, Download, HardHat, Loader2, Pencil, Percent, Plus, Search,
  Wrench, X, type LucideIcon,
} from 'lucide-react'
import {
  Button, Card, CardContent, CardHeader, CardTitle, Input, Select, Textarea,
} from '@/components/ui'
import { api, ApiError } from '@/lib/api'
import { useBaseCfc, useNomenclatureCfc } from '@/lib/base-cfc/requete'
import { arborescenceCfc, cheminDuCode, type NoeudArbre } from '@/lib/base-cfc/arborescence'
import {
  articleSemblable, controlerLaBase, controlesDeLArticle, type Controle, type RaisonControle,
} from '@/lib/base-cfc/controles'
import { chercherDansLaBase, filtresPosés, valeursDeFiltre, type FiltresDeLaBase } from '@/lib/base-cfc/recherche'
import { BASES_EN_CLAIR, uniteEnClair } from '@/lib/base-cfc/pont'
import {
  ENTETES_ARTICLES, ENTETES_NOMENCLATURE, ENTETES_POSTES, ENTETES_VISITE,
  ligneArticle, ligneNomenclature, lignePoste, lignesDeVisite,
} from '@/lib/base-cfc/exporter'
import { classeurXlsx, telechargerClasseur } from '@/lib/xlsx'
import { ValeursParDefaut } from '@/components/cfc/ValeursParDefaut'
import { cn } from '@/lib/utils'
import type { ApiArticle, ApiEtapeVisite, ApiPosteAutomatique } from '@/lib/api-types'
import type { EtatArticle, Unite } from '@/lib/base-cfc/normaliser'

/** Un prix, au format suisse et sans monnaie : la colonne la porte déjà. */
const prixSuisse = (v: number | null): string =>
  v === null ? '' : new Intl.NumberFormat('fr-CH', { maximumFractionDigits: 2 }).format(v)

/** Les six états, dans l'ordre où la fiche les montre. */
const ETATS: { etat: EtatArticle; nom: string; pastille: string }[] = [
  { etat: 'tres_bon', nom: 'Très bon', pastille: 'bg-green-500' },
  { etat: 'bon', nom: 'Bon', pastille: 'bg-lime-500' },
  { etat: 'moyen', nom: 'Moyen', pastille: 'bg-orange-400' },
  { etat: 'mauvais', nom: 'Mauvais', pastille: 'bg-red-500' },
  { etat: 'amelioration', nom: 'Amélioration', pastille: 'bg-blue-500' },
  { etat: 'normes', nom: 'Mise aux normes', pastille: 'bg-violet-500' },
]

const UNITES: Unite[] = ['m2', 'ml', 'pce', 'forfait']

const LIBELLES_CONTROLES: Record<RaisonControle, string> = {
  neant_avec_prix: 'Néant avec un prix',
  travaux_sans_prix: 'Travaux sans prix',
  code_inconnu: 'Code hors nomenclature',
  sans_etape: 'Sans étape de visite',
  doublon_probable: 'Doublon probable',
}

export function CFCManager() {
  const base = useBaseCfc()
  const nomenclature = useNomenclatureCfc()
  const [onglet, setOnglet] = useState<'articles' | 'postes' | 'valeurs'>('articles')

  if (base.isLoading) {
    return (
      <div className="flex items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />Chargement de la base…
      </div>
    )
  }
  if (base.isError || !base.data) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-sm text-red-700">
          {(base.error as ApiError | null)?.message ?? 'Base indisponible'}
        </CardContent>
      </Card>
    )
  }

  /**
   * Ce que contient chaque onglet, dit sous le titre.
   *
   * « Articles », « Postes automatiques », « Valeurs par défaut » ne disent
   * rien à qui ouvre la page pour la première fois : ce sont trois objets
   * différents, et l'on ne devine pas lequel règle quoi. La phrase change avec
   * l'onglet, et nomme ce que la correction va changer.
   */
  const ONGLETS = [
    {
      id: 'articles' as const,
      label: 'Articles et prix',
      icone: Wrench,
      phrase: `Les ${base.data.articles.filter((a) => a.actif).length} ouvrages que le diagnostiqueur peut relever, avec leur prix par état et les étapes de visite où ils se présentent.`,
      court: `${base.data.articles.filter((a) => a.actif).length} ouvrages, leurs prix et leurs étapes.`,
    },
    {
      id: 'postes' as const,
      label: 'Postes de chantier',
      icone: HardHat,
      phrase: "Ce qui s'ajoute d'office au devis sans avoir été relevé : échafaudage, nettoyage, protection des ouvrages.",
      court: "Ce qui s'ajoute d'office au devis.",
    },
    {
      id: 'valeurs' as const,
      label: 'Honoraires et TVA',
      icone: Percent,
      phrase: 'Les pourcentages appliqués au chiffrage des nouveaux diagnostics, et leur effet sur un montant.',
      court: 'Les pourcentages des nouveaux diagnostics.',
    },
  ]
  const courant = ONGLETS.find((o) => o.id === onglet) ?? ONGLETS[0]

  return (
    // Sur téléphone, la page défile d'un bloc : une hauteur fixe coinçait la
    // liste sous la barre du bas, avec ses filtres à moitié cachés.
    <div className="flex flex-col gap-4 md:h-[calc(100dvh-7rem)]">
      <div className="shrink-0 space-y-3">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold">Base de données</h1>
            <p className="hidden text-sm text-muted-foreground md:block">
              {courant.phrase} Elle est commune au bureau : une correction change le devis de tout le monde.
            </p>
            {/* Sur téléphone, la phrase longue occupait la moitié de l'écran. */}
            <p className="text-sm text-muted-foreground md:hidden">{courant.court}</p>
          </div>
          <Button
            variant="outline" size="sm"
            onClick={() => exporterLaBase(base.data!, nomenclature.data?.noeuds ?? [])}
            title="Sortir la base au format du classeur, pour la corriger dans Excel"
          >
            <Download className="h-3.5 w-3.5" />Exporter en Excel
          </Button>
        </div>
        {/* Les trois parties de la base changent de vue ; « Exporter » agit sur
            elle. Les quatre étaient alignés, de même forme et de même taille :
            rien ne disait lequel ouvrait quoi. */}
        <Commutateur options={ONGLETS} valeur={onglet} onChoisir={setOnglet} />
      </div>

      {onglet === 'articles' && (
        <Articles
          articles={base.data.articles}
          etapes={base.data.etapes}
          noeuds={nomenclature.data?.noeuds ?? []}
        />
      )}
      {onglet === 'postes' && <PostesAutomatiques postes={base.data.postes} />}
      {/* Les honoraires, la réserve et la TVA sont des règles de chiffrage :
          leur place est avec les prix, pas dans les réglages du compte. */}
      {onglet === 'valeurs' && <ValeursParDefaut />}
    </div>
  )
}

/**
 * Changer de vue, et le voir.
 *
 * Trois pastilles bordées, de la même forme que les boutons d'action, ne
 * disaient pas qu'elles ouvraient trois contenus différents : on les prenait
 * pour des filtres, ou pour trois actions à déclencher. Le cadre gris tient
 * les choix ensemble, le fond blanc dit lequel est ouvert, et ce qui agit sur
 * la base reste en dehors du cadre.
 */
function Commutateur<T extends string>({ options, valeur, onChoisir }: {
  options: readonly { id: T; label: string; icone: LucideIcon }[]
  valeur: T
  onChoisir: (id: T) => void
}) {
  return (
    // Sur téléphone, trois colonnes égales sans icône : en ligne, les trois
    // libellés dépassaient de l'écran et faisaient glisser toute la page.
    <nav className="grid w-full grid-cols-3 gap-1 rounded-[20px] border border-black/[0.05] bg-neutral-100/70 p-1.5 md:inline-flex md:w-auto">
      {options.map((o) => {
        const actif = o.id === valeur
        return (
          <button
            key={o.id}
            onClick={() => onChoisir(o.id)}
            aria-current={actif ? 'page' : undefined}
            className={cn(
              'flex min-w-0 items-center justify-center gap-2 rounded-2xl px-2 py-2 text-center text-xs font-semibold leading-tight transition-all md:shrink-0 md:px-4 md:text-[13.5px]',
              actif
                ? 'bg-white text-neutral-900 shadow-[0_1px_3px_rgba(0,0,0,0.12),0_1px_1px_rgba(0,0,0,0.04)]'
                : 'text-neutral-500 hover:text-neutral-900',
            )}
          >
            <o.icone
              className={cn('hidden h-[17px] w-[17px] shrink-0 transition-colors md:block', actif ? 'text-blue-600' : 'text-neutral-400')}
              strokeWidth={1.9}
            />
            {o.label}
          </button>
        )
      })}
    </nav>
  )
}

/**
 * La base rendue au classeur, dans le format du fichier importé.
 *
 * Le bureau doit pouvoir sortir la base, la corriger à vingt lignes d'un coup
 * dans Excel, et la réimporter. L'aller-retour est vérifié par les tests du
 * module d'export, qui redonnent à l'assembleur ce qu'il vient d'écrire.
 */
function exporterLaBase(
  base: { articles: ApiArticle[]; etapes: ApiEtapeVisite[]; postes: ApiPosteAutomatique[] },
  noeuds: { code: string; libelle: string; niveau: number; parentCode: string | null }[],
) {
  const libelles = new Map(noeuds.map((n) => [n.code, n.libelle]))
  const nomDeLEtape = (numero: number) => base.etapes.find((e) => e.numero === numero)?.nom ?? String(numero)
  const compte = new Map<string, number>()
  for (const a of base.articles) compte.set(a.cfcCode, (compte.get(a.cfcCode) ?? 0) + 1)

  const classeur = classeurXlsx([
    {
      nom: 'Articles',
      entetes: ENTETES_ARTICLES,
      lignes: base.articles.map((a) => ligneArticle(a, {
        libelleCfc: libelles.get(a.cfcCode) ?? null,
        groupeCfc: libelles.get(a.cfcCode.slice(0, 2)) ?? null,
        nomDeLEtape,
      })),
    },
    { nom: 'Ordre de visite', entetes: ENTETES_VISITE, lignes: lignesDeVisite(base.articles, base.etapes) },
    { nom: 'Postes automatiques', entetes: ENTETES_POSTES, lignes: base.postes.map(lignePoste) },
    {
      nom: 'Nomenclature CFC',
      entetes: ENTETES_NOMENCLATURE,
      lignes: noeuds.map((n) => ligneNomenclature(n, compte.get(n.code) ?? 0)),
    },
  ])
  telechargerClasseur(classeur, `DIAGLY_base_CFC_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

function Articles({ articles, etapes, noeuds }: {
  articles: ApiArticle[]
  etapes: ApiEtapeVisite[]
  noeuds: { code: string; libelle: string; niveau: number; parentCode: string | null }[]
}) {
  const [filtres, setFiltres] = useState<FiltresDeLaBase>({})
  const [choisi, setChoisi] = useState<string | null>(null)
  const [creation, setCreation] = useState(false)
  const [toutMontrer, setToutMontrer] = useState(false)
  /**
   * L'entrée par étape de visite ouvre la page.
   *
   * C'est dans cet ordre que le diagnostiqueur travaille : il fait le tour du
   * bâtiment étape par étape, et cherche un article en se demandant où il le
   * rencontre. Le code CFC, lui, sert à vérifier une position dans la
   * nomenclature, ce qui vient après.
   */
  const [parEtape, setParEtape] = useState(true)

  const codesConnus = useMemo(() => new Set(noeuds.map((n) => n.code)), [noeuds])
  const controles = useMemo(
    () => controlerLaBase(articles, codesConnus.size > 0 ? codesConnus : undefined),
    [articles, codesConnus],
  )
  const arbre = useMemo(() => arborescenceCfc(noeuds, articles, toutMontrer), [noeuds, articles, toutMontrer])
  const valeurs = useMemo(() => valeursDeFiltre(articles), [articles])
  const listes = useMemo(() => chercherDansLaBase(articles, filtres, controles), [articles, filtres, controles])
  const article = articles.find((a) => a.id === choisi) ?? null

  const poser = (p: Partial<FiltresDeLaBase>) => setFiltres((f) => ({ ...f, ...p }))

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
      {/* ----- Arborescence ----- */}
      <Card className="flex w-full shrink-0 flex-col overflow-hidden lg:w-72">
        <CardHeader className="shrink-0 border-b px-4 py-3">
          <CardTitle className="text-sm">Parcourir la base</CardTitle>
          {/* Les deux entrées sont montrées ensemble. Un bouton unique qui
              affichait « Voir par étape » laissait entière la question de
              savoir ce qu'on avait sous les yeux. */}
          <div className="mt-2 flex w-fit gap-1 rounded-full border bg-muted/50 p-1">
            {([
              { parEtape: true, label: 'Par étape de visite' },
              { parEtape: false, label: 'Par code CFC' },
            ] as const).map((v) => (
              <button
                key={v.label}
                onClick={() => setParEtape(v.parEtape)}
                aria-pressed={parEtape === v.parEtape}
                className={cn('rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                  parEtape === v.parEtape
                    ? 'bg-white text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.08)]'
                    : 'text-muted-foreground hover:text-foreground')}
              >{v.label}</button>
            ))}
          </div>
          {!parEtape && (
            <label className="mt-2 flex w-fit cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground">
              <input
                type="checkbox" checked={toutMontrer}
                onChange={(e) => setToutMontrer(e.target.checked)}
                className="h-3 w-3 cursor-pointer"
              />
              Montrer les branches sans article
            </label>
          )}
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto px-2 py-2 max-md:max-h-80">
          {parEtape ? (
            <ListeDesEtapes
              etapes={etapes}
              articles={articles}
              choisie={filtres.etapeNumero ?? null}
              onChoisir={(n) => poser({ etapeNumero: n, groupeCfc: null })}
            />
          ) : noeuds.length === 0 ? (
            <p className="px-2 py-4 text-xs text-muted-foreground">Nomenclature en cours de chargement…</p>
          ) : (
            <Branche
              noeuds={arbre}
              choisi={filtres.groupeCfc ?? null}
              onChoisir={(code) => poser({ groupeCfc: code, etapeNumero: null })}
            />
          )}
        </CardContent>
      </Card>

      {/* ----- Tableau ----- */}
      <Card className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <CardHeader className="shrink-0 space-y-2 border-b px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-48 flex-1">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-8 pl-7 text-sm"
                placeholder="Code, nom, travaux…"
                value={filtres.recherche ?? ''}
                onChange={(e) => poser({ recherche: e.target.value })}
              />
            </div>
            <span className="text-xs text-muted-foreground">{listes.length} articles</span>
            {/* Ajouter un article agit sur la base : c'est un bouton, et non
                une pastille de filtre comme celles de la ligne du dessous. */}
            <Button size="sm" onClick={() => setCreation(true)}>
              <Plus className="h-3.5 w-3.5" />Nouvel article
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Filtrer</span>
            <Select
              className="h-8 w-auto max-w-44 py-0 text-xs"
              value={filtres.domaineRapport ?? ''}
              onChange={(e) => poser({ domaineRapport: e.target.value || null })}
            >
              <option value="">Tous les domaines</option>
              {valeurs.domaines.map((d) => <option key={d} value={d}>{d}</option>)}
            </Select>
            <Select
              className="h-8 w-auto max-w-44 py-0 text-xs"
              value={filtres.groupeAlternatives ?? ''}
              onChange={(e) => poser({ groupeAlternatives: e.target.value || null })}
            >
              <option value="">Tous les groupes</option>
              {valeurs.groupes.map((g) => <option key={g} value={g}>{g}</option>)}
            </Select>
            <Select
              className="h-8 w-auto max-w-44 py-0 text-xs"
              value={filtres.controle ?? ''}
              onChange={(e) => poser({ controle: (e.target.value || null) as RaisonControle | null })}
            >
              <option value="">Tous les contrôles</option>
              {(Object.keys(LIBELLES_CONTROLES) as RaisonControle[]).map((r) => (
                <option key={r} value={r}>
                  {LIBELLES_CONTROLES[r]} ({controles.filter((c) => c.raison === r).length})
                </option>
              ))}
            </Select>
            <button
              onClick={() => poser({ echafaudage: filtres.echafaudage ? null : true })}
              className={cn('rounded-full border px-2 py-0.5 text-[11px]',
                filtres.echafaudage ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground')}
            >Échafaudage</button>
            <button
              onClick={() => poser({ inactifs: !filtres.inactifs })}
              className={cn('rounded-full border px-2 py-0.5 text-[11px]',
                filtres.inactifs ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground')}
            >Articles retirés</button>
            {filtresPosés(filtres) && (
              <button onClick={() => setFiltres({})} className="text-xs text-primary hover:underline">
                Retirer les filtres
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto p-0">
          <TableauArticles
            articles={listes}
            etapes={etapes}
            controles={controles}
            choisi={choisi}
            onChoisir={setChoisi}
          />
        </CardContent>
      </Card>

      {/* ----- Création ----- */}
      {creation && (
        <Card className="flex w-full shrink-0 flex-col overflow-hidden lg:w-[26rem]">
          <NouvelArticle
            articles={articles}
            etapes={etapes}
            onFini={(id) => { setCreation(false); if (id) setChoisi(id) }}
          />
        </Card>
      )}

      {/* ----- Fiche ----- */}
      {!creation && article && (
        <Card className="flex w-full shrink-0 flex-col overflow-hidden lg:w-[26rem]">
          <FicheArticle
            article={article}
            articles={articles}
            etapes={etapes}
            noeuds={noeuds}
            controles={controlesDeLArticle(controles, article.id)}
            onFermer={() => setChoisi(null)}
          />
        </Card>
      )}
    </div>
  )
}

/** Une branche de l'arborescence, et ses enfants. */
function Branche({ noeuds, choisi, onChoisir, profondeur = 0 }: {
  noeuds: NoeudArbre[]
  choisi: string | null
  onChoisir: (code: string | null) => void
  profondeur?: number
}) {
  return (
    <ul className={cn(profondeur > 0 && 'ml-3 border-l pl-2')}>
      {noeuds.map((n) => (
        <NoeudDeLArbre key={n.code} noeud={n} choisi={choisi} onChoisir={onChoisir} profondeur={profondeur} />
      ))}
    </ul>
  )
}

function NoeudDeLArbre({ noeud, choisi, onChoisir, profondeur }: {
  noeud: NoeudArbre
  choisi: string | null
  onChoisir: (code: string | null) => void
  profondeur: number
}) {
  // Les deux premiers niveaux s'ouvrent d'eux-mêmes : c'est le troisième qu'on
  // vient chercher, et le replier derrière deux clics n'aide personne.
  const [ouvert, setOuvert] = useState(profondeur < 1)
  const actif = choisi === noeud.code
  return (
    <li>
      <div className="flex items-center gap-1">
        {noeud.enfants.length > 0 ? (
          <button onClick={() => setOuvert((v) => !v)} className="shrink-0 p-0.5 text-muted-foreground">
            <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', ouvert && 'rotate-90')} />
          </button>
        ) : <span className="w-4 shrink-0" />}
        <button
          onClick={() => onChoisir(actif ? null : noeud.code)}
          className={cn('flex min-w-0 flex-1 items-baseline gap-1.5 rounded px-1.5 py-1 text-left text-xs hover:bg-muted/60',
            actif && 'bg-primary/10 text-primary')}
        >
          <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{noeud.code}</span>
          <span className="min-w-0 flex-1 truncate">{noeud.libelle}</span>
          {noeud.total > 0 && <span className="shrink-0 tabular-nums text-[11px] text-muted-foreground">{noeud.total}</span>}
        </button>
      </div>
      {ouvert && noeud.enfants.length > 0 && (
        <Branche noeuds={noeud.enfants} choisi={choisi} onChoisir={onChoisir} profondeur={profondeur + 1} />
      )}
    </li>
  )
}

function ListeDesEtapes({ etapes, articles, choisie, onChoisir }: {
  etapes: ApiEtapeVisite[]
  articles: ApiArticle[]
  choisie: number | null
  onChoisir: (n: number | null) => void
}) {
  return (
    <ul className="space-y-0.5">
      {etapes.map((e) => {
        const combien = articles.filter((a) => a.actif && a.etapes.some((x) => x.etapeNumero === e.numero)).length
        const actif = choisie === e.numero
        return (
          <li key={e.numero}>
            <button
              onClick={() => onChoisir(actif ? null : e.numero)}
              className={cn('flex w-full items-baseline gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted/60',
                actif && 'bg-primary/10 text-primary')}
            >
              <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{e.numero}</span>
              <span className="min-w-0 flex-1 truncate">{e.nom}</span>
              <span className="shrink-0 tabular-nums text-[11px] text-muted-foreground">{combien}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function TableauArticles({ articles, etapes, controles, choisi, onChoisir }: {
  articles: ApiArticle[]
  etapes: ApiEtapeVisite[]
  controles: Controle[]
  choisi: string | null
  onChoisir: (id: string) => void
}) {
  const nomEtape = new Map(etapes.map((e) => [e.numero, e.nom]))
  const prix = (a: ApiArticle, etat: EtatArticle) => prixSuisse(a.etats.find((e) => e.etat === etat)?.prix ?? null)

  if (articles.length === 0) {
    return <p className="px-4 py-10 text-center text-sm text-muted-foreground">Aucun article ne répond à ces filtres.</p>
  }

  return (
    <table className="w-full border-collapse text-xs">
      <thead className="sticky top-0 z-10 bg-card">
        <tr className="border-b text-left text-muted-foreground">
          <th className="px-3 py-2 font-medium">Code</th>
          <th className="px-2 py-2 font-medium">Article</th>
          <th className="px-2 py-2 font-medium">Unité</th>
          <th className="px-2 py-2 text-right font-medium">Très bon</th>
          <th className="px-2 py-2 text-right font-medium">Bon</th>
          <th className="px-2 py-2 text-right font-medium">Moyen</th>
          <th className="px-2 py-2 text-right font-medium">Mauvais</th>
          <th className="px-2 py-2 text-right font-medium">Amélior.</th>
          <th className="px-2 py-2 text-right font-medium">Normes</th>
          <th className="px-2 py-2 font-medium">Étapes</th>
        </tr>
      </thead>
      <tbody>
        {articles.map((a) => {
          const siens = controles.filter((c) => c.articleId === a.id)
          const grave = siens.some((c) => c.gravite === 'erreur')
          return (
            <tr
              key={a.id}
              onClick={() => onChoisir(a.id)}
              className={cn('cursor-pointer border-b hover:bg-muted/50',
                choisi === a.id && 'bg-primary/10', !a.actif && 'text-muted-foreground')}
            >
              <td className="px-3 py-1.5 font-mono text-[11px]">{a.cfcCode}</td>
              <td className="px-2 py-1.5">
                <span className="flex items-center gap-1.5">
                  {a.echafaudage && <span title="Échafaudage nécessaire" className="text-amber-600">▲</span>}
                  <span className={cn(!a.actif && 'line-through')}>{a.nom}</span>
                  {siens.length > 0 && (
                    <AlertTriangle className={cn('h-3 w-3 shrink-0', grave ? 'text-red-500' : 'text-amber-500')} />
                  )}
                </span>
              </td>
              <td className="px-2 py-1.5 text-muted-foreground">{uniteEnClair(a.uniteRemplacement)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{prix(a, 'tres_bon')}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{prix(a, 'bon')}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{prix(a, 'moyen')}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{prix(a, 'mauvais')}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{prix(a, 'amelioration')}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{prix(a, 'normes')}</td>
              <td className="px-2 py-1.5 text-[11px] text-muted-foreground">
                {a.etapes.map((e) => nomEtape.get(e.etapeNumero) ?? e.etapeNumero).join(', ')}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/** La fiche d'un article : ce qu'il dit, ce qu'il coûte, et ce qu'on y a changé. */
function FicheArticle({ article, articles, etapes, noeuds, controles, onFermer }: {
  article: ApiArticle
  articles: ApiArticle[]
  etapes: ApiEtapeVisite[]
  noeuds: { code: string; libelle: string }[]
  controles: Controle[]
  onFermer: () => void
}) {
  const [edition, setEdition] = useState(false)
  const lie = article.articleLieId ? articles.find((a) => a.id === article.articleLieId) : null
  const libelleCfc = noeuds.find((n) => n.code === article.cfcCode)?.libelle
  const chemin = noeuds.length > 0 ? cheminDuCode(article.cfcCode, noeuds as never) : []

  return (
    <>
      <CardHeader className="shrink-0 border-b px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-sm leading-tight">{article.nom}</CardTitle>
            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
              {article.id} · {article.cfcCode}{libelleCfc ? ` ${libelleCfc}` : ''}
            </p>
            {chemin.length > 0 && (
              <p className="text-[11px] text-muted-foreground">{chemin.join(' › ')}</p>
            )}
          </div>
          <div className="flex shrink-0 gap-1">
            {!edition && (
              <button onClick={() => setEdition(true)} title="Modifier" className="rounded p-1.5 hover:bg-muted">
                <Pencil className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
            <button onClick={onFermer} title="Fermer" className="rounded p-1.5 hover:bg-muted">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto px-4 py-3">
        {controles.length > 0 && (
          <div className="mb-3 space-y-1">
            {controles.map((c, i) => (
              <p
                key={i}
                className={cn('rounded-lg px-2.5 py-1.5 text-[11px]',
                  c.gravite === 'erreur' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800')}
              >{c.message}</p>
            ))}
          </div>
        )}

        {edition ? (
          <FormulaireArticle article={article} etapes={etapes} onFini={() => setEdition(false)} />
        ) : (
          <LectureArticle article={article} etapes={etapes} lie={lie ?? null} />
        )}
      </CardContent>
    </>
  )
}

function LectureArticle({ article, etapes, lie }: {
  article: ApiArticle
  etapes: ApiEtapeVisite[]
  lie: ApiArticle | null
}) {
  const nomEtape = new Map(etapes.map((e) => [e.numero, e.nom]))
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {ETATS.map(({ etat, nom, pastille }) => {
          const ligne = article.etats.find((e) => e.etat === etat)
          if (!ligne || (!ligne.travaux && ligne.prix === null)) return null
          return (
            <div key={etat} className="rounded-xl border p-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs font-medium">
                  <span className={cn('h-2 w-2 rounded-full', pastille)} />{nom}
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {ligne.prix !== null ? `${prixSuisse(ligne.prix)} CHF/${uniteEnClair(ligne.unite)}` : 'sans prix'}
                </span>
              </div>
              {ligne.travaux && <p className="mt-1 text-xs leading-snug">{ligne.travaux}</p>}
              {etat === 'moyen' && ligne.partPrixMauvais !== null && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Prix fixe plus {Math.round(ligne.partPrixMauvais * 100)} % du prix de remplacement.
                </p>
              )}
            </div>
          )
        })}
      </div>

      <dl className="space-y-1.5 text-xs">
        <Ligne terme="Quantité">
          {BASES_EN_CLAIR[article.baseQuantite]}
          {article.coefficient !== 1 && ` × ${article.coefficient}`}
          {article.indicationQuantite && ` (${article.indicationQuantite})`}
        </Ligne>
        <Ligne terme="Unités">
          entretien {uniteEnClair(article.uniteEntretien)}, remplacement {uniteEnClair(article.uniteRemplacement)}
        </Ligne>
        <Ligne terme="Domaine">{article.domaineRapport}</Ligne>
        {article.groupeAlternatives && <Ligne terme="Groupe">{article.groupeAlternatives}</Ligne>}
        <Ligne terme="Étapes">
          {article.etapes.length === 0
            ? 'aucune'
            : article.etapes.map((e) => nomEtape.get(e.etapeNumero) ?? e.etapeNumero).join(', ')}
        </Ligne>
        <Ligne terme="Échafaudage">{article.echafaudage ? 'nécessaire' : 'non'}</Ligne>
        {lie && <Ligne terme="Article lié">{lie.id} {lie.nom}</Ligne>}
        {!article.actif && <Ligne terme="État">retiré du catalogue</Ligne>}
      </dl>

      {article.noteDiagnostiqueur && (
        <div className="rounded-xl bg-muted/60 p-2.5">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Note interne, jamais imprimée
          </p>
          <p className="whitespace-pre-wrap text-xs leading-snug">{article.noteDiagnostiqueur}</p>
        </div>
      )}

      <Historique articleId={article.id} />
    </div>
  )
}

function Ligne({ terme, children }: { terme: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-28 shrink-0 text-muted-foreground">{terme}</dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  )
}

function Historique({ articleId }: { articleId: string }) {
  const q = useQuery({
    queryKey: ['base-cfc-historique', articleId],
    queryFn: () => api.cfc.historique(articleId),
  })
  const lignes = q.data?.lignes ?? []
  if (lignes.length === 0) return null
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Historique</p>
      <ul className="space-y-1 text-[11px] text-muted-foreground">
        {lignes.slice(0, 12).map((l) => (
          <li key={l.id}>
            <span className="font-medium text-foreground">{l.champ}</span>
            {' : '}{l.ancienneValeur ?? 'vide'} → {l.nouvelleValeur ?? 'vide'}
            {' · '}{new Date(l.date).toLocaleDateString('fr-CH')}
            {l.auteur ? ` · ${l.auteur}` : ''}
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * L'édition d'un article.
 *
 * Enregistrement explicite, et annulation qui rend la fiche intacte : on
 * modifie une base commune, et une correction partie par mégarde se retrouve
 * dans le devis de quelqu'un d'autre. Le correcteur du navigateur est activé en
 * français, parce que ces textes partent tels quels dans un rapport client.
 */
function FormulaireArticle({ article, etapes, onFini }: {
  article: ApiArticle
  etapes: ApiEtapeVisite[]
  onFini: () => void
}) {
  const qc = useQueryClient()
  const [brouillon, setBrouillon] = useState(() => ({
    nom: article.nom,
    cfcCode: article.cfcCode,
    domaineRapport: article.domaineRapport,
    groupeAlternatives: article.groupeAlternatives ?? '',
    echafaudage: article.echafaudage,
    uniteEntretien: article.uniteEntretien,
    uniteRemplacement: article.uniteRemplacement,
    coefficient: String(article.coefficient),
    indicationQuantite: article.indicationQuantite ?? '',
    noteDiagnostiqueur: article.noteDiagnostiqueur ?? '',
    actif: article.actif,
    etats: ETATS.map(({ etat }) => {
      const l = article.etats.find((e) => e.etat === etat)
      return {
        etat,
        travaux: l?.travaux ?? '',
        prix: l?.prix === null || l?.prix === undefined ? '' : String(l.prix),
        partPrixMauvais: l?.partPrixMauvais === null || l?.partPrixMauvais === undefined ? '' : String(l.partPrixMauvais),
        unite: (l?.unite ?? article.uniteRemplacement) as Unite,
      }
    }),
    etapes: article.etapes.map((e) => e.etapeNumero),
  }))
  const [erreur, setErreur] = useState<string | null>(null)

  const enregistrer = useMutation({
    mutationFn: () => api.cfc.updateArticle(article.id, {
      nom: brouillon.nom,
      cfcCode: brouillon.cfcCode,
      domaineRapport: brouillon.domaineRapport,
      groupeAlternatives: brouillon.groupeAlternatives || null,
      echafaudage: brouillon.echafaudage,
      uniteEntretien: brouillon.uniteEntretien,
      uniteRemplacement: brouillon.uniteRemplacement,
      coefficient: Number(brouillon.coefficient) || 1,
      indicationQuantite: brouillon.indicationQuantite || null,
      noteDiagnostiqueur: brouillon.noteDiagnostiqueur || null,
      actif: brouillon.actif,
      etats: brouillon.etats.map((e) => ({
        etat: e.etat,
        travaux: e.travaux.trim() || null,
        prix: e.prix.trim() === '' ? null : Number(e.prix),
        partPrixMauvais: e.partPrixMauvais.trim() === '' ? null : Number(e.partPrixMauvais),
        unite: e.unite,
      })),
      etapes: brouillon.etapes,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['base-cfc'] })
      qc.invalidateQueries({ queryKey: ['base-cfc-historique', article.id] })
      onFini()
    },
    onError: (e) => setErreur((e as ApiError).message),
  })

  const champ = (p: Partial<typeof brouillon>) => setBrouillon((b) => ({ ...b, ...p }))
  const etat = (i: number, p: Partial<typeof brouillon.etats[number]>) =>
    setBrouillon((b) => ({ ...b, etats: b.etats.map((e, j) => (j === i ? { ...e, ...p } : e)) }))

  return (
    <form
      lang="fr-CH"
      spellCheck
      className="space-y-3 text-xs"
      onSubmit={(e) => { e.preventDefault(); enregistrer.mutate() }}
    >
      <Champ titre="Nom">
        <Input className="h-8 text-xs" value={brouillon.nom} onChange={(e) => champ({ nom: e.target.value })} />
      </Champ>
      <div className="flex gap-2">
        <Champ titre="Code CFC">
          <Input className="h-8 font-mono text-xs" value={brouillon.cfcCode} onChange={(e) => champ({ cfcCode: e.target.value })} />
        </Champ>
        <Champ titre="Coefficient">
          <Input
            className="h-8 text-xs" type="number" step="0.01" min="0"
            value={brouillon.coefficient} onChange={(e) => champ({ coefficient: e.target.value })}
          />
        </Champ>
      </div>
      <Champ titre="Domaine du rapport">
        <Input className="h-8 text-xs" value={brouillon.domaineRapport} onChange={(e) => champ({ domaineRapport: e.target.value })} />
      </Champ>
      <Champ titre="Groupe d'alternatives">
        <Input
          className="h-8 text-xs" placeholder="aucun"
          value={brouillon.groupeAlternatives} onChange={(e) => champ({ groupeAlternatives: e.target.value })}
        />
      </Champ>
      <div className="flex gap-2">
        <Champ titre="Unité d'entretien">
          <Select className="h-8 text-xs" value={brouillon.uniteEntretien} onChange={(e) => champ({ uniteEntretien: e.target.value as Unite })}>
            {UNITES.map((u) => <option key={u} value={u}>{uniteEnClair(u)}</option>)}
          </Select>
        </Champ>
        <Champ titre="Unité de remplacement">
          <Select className="h-8 text-xs" value={brouillon.uniteRemplacement} onChange={(e) => champ({ uniteRemplacement: e.target.value as Unite })}>
            {UNITES.map((u) => <option key={u} value={u}>{uniteEnClair(u)}</option>)}
          </Select>
        </Champ>
      </div>
      <Champ titre="Indication de quantité">
        <Input
          className="h-8 text-xs" placeholder="par ascenseur, périmètre…"
          value={brouillon.indicationQuantite} onChange={(e) => champ({ indicationQuantite: e.target.value })}
        />
      </Champ>

      <Champ titre="Étapes de visite">
        <div className="space-y-1">
          {etapes.map((e) => (
            <label key={e.numero} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={brouillon.etapes.includes(e.numero)}
                onChange={(ev) => champ({
                  etapes: ev.target.checked
                    ? [...brouillon.etapes, e.numero]
                    : brouillon.etapes.filter((n) => n !== e.numero),
                })}
              />
              <span>{e.numero}. {e.nom}</span>
            </label>
          ))}
        </div>
      </Champ>

      <div className="flex flex-wrap gap-3">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={brouillon.echafaudage} onChange={(e) => champ({ echafaudage: e.target.checked })} />
          <span>Échafaudage nécessaire</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={brouillon.actif} onChange={(e) => champ({ actif: e.target.checked })} />
          <span>Actif au catalogue</span>
        </label>
      </div>

      <div className="space-y-2">
        {brouillon.etats.map((e, i) => {
          const def = ETATS[i]
          return (
            <div key={e.etat} className="rounded-xl border p-2">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-medium">
                <span className={cn('h-2 w-2 rounded-full', def.pastille)} />{def.nom}
              </p>
              <Textarea
                className="text-xs" rows={2} placeholder="Travaux, ou « Néant »"
                value={e.travaux} onChange={(ev) => etat(i, { travaux: ev.target.value })}
              />
              <div className="mt-1 flex gap-2">
                <Input
                  className="h-8 text-xs" type="number" step="0.01" min="0" placeholder="prix"
                  value={e.prix} onChange={(ev) => etat(i, { prix: ev.target.value })}
                />
                <Select className="h-8 w-24 text-xs" value={e.unite} onChange={(ev) => etat(i, { unite: ev.target.value as Unite })}>
                  {UNITES.map((u) => <option key={u} value={u}>{uniteEnClair(u)}</option>)}
                </Select>
                {e.etat === 'moyen' && (
                  <Input
                    className="h-8 w-28 text-xs" type="number" step="0.05" min="0" max="1" placeholder="part"
                    title="Part du prix Mauvais qui s'ajoute au prix fixe"
                    value={e.partPrixMauvais} onChange={(ev) => etat(i, { partPrixMauvais: ev.target.value })}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>

      <Champ titre="Note interne">
        <Textarea
          className="text-xs" rows={3} placeholder="Consigne de saisie, jamais imprimée dans le rapport"
          value={brouillon.noteDiagnostiqueur} onChange={(e) => champ({ noteDiagnostiqueur: e.target.value })}
        />
      </Champ>

      {erreur && <p className="rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] text-red-800">{erreur}</p>}

      <div className="flex gap-2 pb-2">
        <Button type="submit" size="sm" disabled={enregistrer.isPending}>
          {enregistrer.isPending ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onFini}>Annuler</Button>
      </div>
    </form>
  )
}

/**
 * La création d'un article.
 *
 * Le minimum pour qu'il tienne debout : un identifiant, un code, un nom, une
 * unité, une base de quantité et au moins une étape. Les prix et les travaux se
 * remplissent ensuite dans la fiche, où l'on voit les six états.
 *
 * Le doublon se signale avant l'enregistrement, pas après : deux articles de
 * même code et de nom proche se retrouvent tous les deux proposés à la visite,
 * et le diagnostiqueur en relève un au hasard.
 */
function NouvelArticle({ articles, etapes, onFini }: {
  articles: ApiArticle[]
  etapes: ApiEtapeVisite[]
  onFini: (id: string | null) => void
}) {
  const qc = useQueryClient()
  const [brouillon, setBrouillon] = useState({
    id: '',
    cfcCode: '',
    nom: '',
    domaineRapport: '',
    uniteEntretien: 'm2' as Unite,
    uniteRemplacement: 'm2' as Unite,
    baseQuantite: 'saisie_manuelle' as keyof typeof BASES_EN_CLAIR,
    etapes: [] as number[],
  })
  const [erreur, setErreur] = useState<string | null>(null)
  const semblable = brouillon.cfcCode && brouillon.nom
    ? articleSemblable(articles, { cfcCode: brouillon.cfcCode, nom: brouillon.nom })
    : null
  const dejaPris = articles.some((a) => a.id === brouillon.id.trim().toUpperCase())

  const creer = useMutation({
    mutationFn: () => api.cfc.createArticle({
      id: brouillon.id.trim().toUpperCase(),
      cfcCode: brouillon.cfcCode.trim(),
      nom: brouillon.nom.trim(),
      domaineRapport: brouillon.domaineRapport.trim(),
      groupeAlternatives: null,
      echafaudage: false,
      uniteEntretien: brouillon.uniteEntretien,
      uniteRemplacement: brouillon.uniteRemplacement,
      baseQuantite: brouillon.baseQuantite,
      indicationQuantite: null,
      coefficient: 1,
      noteDiagnostiqueur: null,
      actif: true,
      etats: [],
      etapes: brouillon.etapes,
    }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['base-cfc'] })
      onFini(r.article.id)
    },
    onError: (e) => setErreur((e as ApiError).message),
  })

  const champ = (p: Partial<typeof brouillon>) => setBrouillon((b) => ({ ...b, ...p }))
  const complet = brouillon.id.trim() && brouillon.cfcCode.trim() && brouillon.nom.trim()
    && brouillon.domaineRapport.trim() && brouillon.etapes.length > 0 && !dejaPris

  return (
    <>
      <CardHeader className="shrink-0 border-b px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm">Nouvel article</CardTitle>
          <button onClick={() => onFini(null)} title="Fermer" className="rounded p-1.5 hover:bg-muted">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto px-4 py-3">
        <form
          lang="fr-CH"
          spellCheck
          className="space-y-3 text-xs"
          onSubmit={(e) => { e.preventDefault(); creer.mutate() }}
        >
          <div className="flex gap-2">
            <Champ titre="Identifiant">
              <Input
                className="h-8 font-mono text-xs" placeholder="N003"
                value={brouillon.id} onChange={(e) => champ({ id: e.target.value })}
              />
            </Champ>
            <Champ titre="Code CFC">
              <Input
                className="h-8 font-mono text-xs" placeholder="226.1"
                value={brouillon.cfcCode} onChange={(e) => champ({ cfcCode: e.target.value })}
              />
            </Champ>
          </div>
          {dejaPris && <p className="text-[11px] text-red-700">Cet identifiant est déjà utilisé.</p>}

          <Champ titre="Nom de l'article">
            <Input className="h-8 text-xs" value={brouillon.nom} onChange={(e) => champ({ nom: e.target.value })} />
          </Champ>
          {semblable && (
            <p className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
              Article semblable existant : {semblable.id} « {semblable.nom} », même code CFC.
            </p>
          )}

          <Champ titre="Domaine du rapport">
            <Input
              className="h-8 text-xs" placeholder="Façades, Intérieur – murs…"
              value={brouillon.domaineRapport} onChange={(e) => champ({ domaineRapport: e.target.value })}
            />
          </Champ>

          <div className="flex gap-2">
            <Champ titre="Unité d'entretien">
              <Select className="h-8 text-xs" value={brouillon.uniteEntretien} onChange={(e) => champ({ uniteEntretien: e.target.value as Unite })}>
                {UNITES.map((u) => <option key={u} value={u}>{uniteEnClair(u)}</option>)}
              </Select>
            </Champ>
            <Champ titre="Unité de remplacement">
              <Select className="h-8 text-xs" value={brouillon.uniteRemplacement} onChange={(e) => champ({ uniteRemplacement: e.target.value as Unite })}>
                {UNITES.map((u) => <option key={u} value={u}>{uniteEnClair(u)}</option>)}
              </Select>
            </Champ>
          </div>

          <Champ titre="Base de quantité">
            <Select
              className="h-8 text-xs" value={brouillon.baseQuantite}
              onChange={(e) => champ({ baseQuantite: e.target.value as keyof typeof BASES_EN_CLAIR })}
            >
              {(Object.keys(BASES_EN_CLAIR) as (keyof typeof BASES_EN_CLAIR)[]).map((b) => (
                <option key={b} value={b}>{BASES_EN_CLAIR[b]}</option>
              ))}
            </Select>
          </Champ>

          <Champ titre="Étapes de visite">
            <div className="space-y-1">
              {etapes.map((e) => (
                <label key={e.numero} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={brouillon.etapes.includes(e.numero)}
                    onChange={(ev) => champ({
                      etapes: ev.target.checked
                        ? [...brouillon.etapes, e.numero]
                        : brouillon.etapes.filter((n) => n !== e.numero),
                    })}
                  />
                  <span>{e.numero}. {e.nom}</span>
                </label>
              ))}
            </div>
          </Champ>
          <p className="text-[11px] text-muted-foreground">
            Les travaux et les prix de chaque état se remplissent ensuite dans la fiche.
          </p>

          {erreur && <p className="rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] text-red-800">{erreur}</p>}

          <div className="flex gap-2 pb-2">
            <Button type="submit" size="sm" disabled={!complet || creer.isPending}>
              {creer.isPending ? 'Création…' : 'Créer l’article'}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => onFini(null)}>Annuler</Button>
          </div>
        </form>
      </CardContent>
    </>
  )
}

function Champ({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <label className="block flex-1">
      <span className="mb-0.5 block text-[11px] font-medium text-muted-foreground">{titre}</span>
      {children}
    </label>
  )
}

/**
 * Les postes automatiques : quatre lignes, et chacune pèse des milliers de
 * francs sur tous les devis. Leur prix se modifie ici, pas dans le code.
 */
function PostesAutomatiques({ postes }: { postes: ApiPosteAutomatique[] }) {
  const qc = useQueryClient()
  const [edite, setEdite] = useState<string | null>(null)
  const [prix, setPrix] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)

  const enregistrer = useMutation({
    mutationFn: (code: string) => api.cfc.updatePoste(code, { prix: Number(prix) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['base-cfc'] })
      setEdite(null)
      setErreur(null)
    },
    onError: (e) => setErreur((e as ApiError).message),
  })

  const DECLENCHEURS: Record<string, string> = {
    toujours: 'Compté sur tout devis',
    echafaudage_facade: "Dès qu'un ouvrage qui demande un échafaudage est chiffré",
    communs_mauvais: "Quand un mur ou un plafond de la cage d'escalier est en fin de vie",
  }
  const QUANTITES: Record<string, string> = {
    surface_echafaudee: 'surface des façades concernées, comptée une fois',
    par_cage_escalier: "par cage d'escalier",
    surface_plancher: 'au m² de surface de plancher',
    forfait: 'forfait',
  }

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <CardHeader className="shrink-0 border-b px-4 py-3">
        <CardTitle className="text-sm">Postes ajoutés d'office aux devis</CardTitle>
        <p className="text-xs text-muted-foreground">
          Ils ne viennent d'aucune observation : ils accompagnent le chantier. Leur prix est lu ici
          à chaque devis, et une correction vaut pour tous les dossiers édités ensuite.
        </p>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto p-0">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 bg-card">
            <tr className="border-b text-left text-muted-foreground">
              <th className="px-3 py-2 font-medium">CFC</th>
              <th className="px-2 py-2 font-medium">Poste</th>
              <th className="px-2 py-2 font-medium">Déclenchement</th>
              <th className="px-2 py-2 font-medium">Quantité</th>
              <th className="px-2 py-2 text-right font-medium">Prix</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {postes.map((p) => (
              <tr key={p.cfcCode} className="border-b align-top">
                <td className="px-3 py-2 font-mono text-[11px]">{p.cfcCode}</td>
                <td className="px-2 py-2">
                  {p.libelle}
                  {p.remarque && <div className="text-[11px] text-muted-foreground">{p.remarque}</div>}
                </td>
                <td className="px-2 py-2 text-muted-foreground">{DECLENCHEURS[p.declencheur] ?? p.declencheur}</td>
                <td className="px-2 py-2 text-muted-foreground">{QUANTITES[p.regleQuantite] ?? p.regleQuantite}</td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {edite === p.cfcCode ? (
                    <Input
                      className="h-7 w-24 text-right text-xs" type="number" step="0.01" min="0"
                      value={prix} onChange={(e) => setPrix(e.target.value)} autoFocus
                    />
                  ) : (
                    `${prixSuisse(p.prix)} CHF/${uniteEnClair(p.unite)}`
                  )}
                </td>
                <td className="px-2 py-2 text-right">
                  {edite === p.cfcCode ? (
                    <span className="flex justify-end gap-1">
                      <Button size="sm" disabled={enregistrer.isPending} onClick={() => enregistrer.mutate(p.cfcCode)}>
                        Enregistrer
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setEdite(null); setErreur(null) }}>
                        Annuler
                      </Button>
                    </span>
                  ) : (
                    <button
                      onClick={() => { setEdite(p.cfcCode); setPrix(String(p.prix)); setErreur(null) }}
                      className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Pencil className="h-3 w-3" />Modifier le prix
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {erreur && <p className="px-4 py-2 text-[11px] text-red-700">{erreur}</p>}
      </CardContent>
    </Card>
  )
}
