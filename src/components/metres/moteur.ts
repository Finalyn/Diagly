/**
 * La file d'analyse de l'outil Métrés : tout un jeu de plans analysé par
 * lots, en tâche de fond.
 *
 * « Analyser tout » met chaque feuille non analysée dans une file ; la file
 * prend un lot à la fois (huit pages au plus, d'un même document), rend les
 * pages dans le navigateur comme l'éditeur le fait (pdf.js, et la géométrie
 * vectorielle pour l'aimantation), lance l'analyse sur le serveur, attend le
 * résultat et le range aussitôt : les propositions dans les annotations du
 * plan, « à valider », le cartouche et l'échelle proposée dans ses feuilles.
 * Un onglet fermé ne perd donc que le lot en cours, et pas même lui : le
 * numéro de sa tâche est gardé avec les feuilles, et la file en reprend le
 * résultat à la réouverture.
 *
 * Le moteur vit hors de React, un par dossier, le temps de la page : on peut
 * quitter l'espace de travail et y revenir sans relancer ni perdre le lot en
 * cours, et le double montage du mode strict ne lance rien deux fois. Les
 * écrans s'y abonnent (useMoteurMetres).
 *
 * Une seule écriture à la fois par plan (`ecrire`) : la file range un lot
 * pendant que l'éditeur enregistre peut-être un tracé sur le même document,
 * et deux écritures croisées perdraient l'une des deux. Quand l'éditeur a ce
 * plan ouvert, les propositions lui sont remises directement (la poignée) :
 * c'est lui qui tient les annotations à jour, et c'est lui qui les enregistre.
 *
 * Coût : chaque lot est un appel au modèle des plans. Rien ne repart sans
 * qu'on l'ait demandé : une feuille déjà analysée ne se relance que par
 * « Relancer », une feuille en erreur attend qu'on la relance, et une
 * analyse perdue en route n'est reprise qu'une fois (feuilles.ts).
 */
import { useEffect, useSyncExternalStore } from 'react'
import type { QueryClient } from '@tanstack/react-query'
import { api, ApiError, type CorpsMajPlan, type ResultatAnalyseServeur } from '@/lib/api'
import type { ApiPlan, ApiProject, ApiDiagnostic, FeuillePlan, FeuillesPlan, PlanAnnotation } from '@/lib/api-types'
import { propositionsDeLAnalyse } from '@/lib/plans/analyse-ia'
import {
  PAGES_PAR_LOT, VIDE, apresUnePerte, appliquerAnalyse, ordonnerPlans, completerBatiment, corrigerFeuille, enCoursParTache, estPdf,
  etatAnalyse, mettreEnCours, mettreEnErreur, mettreEnFile, nomProvisoire, nombreDePages, prochainLot, retirerDeLaFile,
  type FeuilleEnFile, type RefFeuille,
} from '@/lib/plans/feuilles'
import { preparerPages, type PageAEnvoyer } from '@/components/plans/analyse'

/** Ce que l'éditeur ouvert expose à la file : son plan, et de quoi lui remettre des propositions. */
export interface PoigneeEditeur {
  planId: string
  recevoir: (pages: number[], annotations: PlanAnnotation[]) => void
}

export interface OuvrageEnvoye { id: string; cfcCode: string | null; libelle: string; unite: string | null }

export interface EtatFile {
  /** Le lot qui tourne : son plan, ses pages, et l'étape. */
  lot: { planId: string; pages: number[]; etape: 'preparation' | 'analyse'; depuis: number } | null
  /** La file s'est arrêtée d'elle-même, et pourquoi. */
  pause: string | null
  /** Change à chaque écriture : de quoi redessiner les écrans abonnés. */
  version: number
}

/** Le message du serveur quand le compte a déjà une analyse en cours (taches-de-fond.ts). */
const DEJA_EN_COURS = /déjà en cours/i
/** Échecs de suite avant que la file ne se mette en pause : un réseau coupé ne doit pas tout passer en erreur. */
const ECHECS_AVANT_PAUSE = 2

const attendre = (ms: number, signal?: AbortSignal) => new Promise<void>((ok) => {
  const t = setTimeout(ok, ms)
  signal?.addEventListener('abort', () => { clearTimeout(t); ok() }, { once: true })
})

let compteur = 0
/** Identifiant d'une annotation posée par la file, du même genre que ceux de l'éditeur. */
const identifiant = () => `m${Date.now().toString(36)}_${compteur++}`

const maintenant = () => new Date().toISOString()

export class MoteurMetres {
  readonly projectId: string
  private queryClient: QueryClient | null = null
  private ouvrages: OuvrageEnvoye[] = []
  private poignee: PoigneeEditeur | null = null
  /** Les feuilles telles que cet onglet les a écrites : elles font foi sur ce que relit le serveur entre-temps. */
  private feuilles = new Map<string, FeuillesPlan>()
  private chaines = new Map<string, Promise<unknown>>()
  private ecouteurs = new Set<() => void>()
  private etat: EtatFile = { lot: null, pause: null, version: 0 }
  private tourne = false
  private repris = false
  private arret: AbortController | null = null
  /** La tâche du lot en cours, pour l'arrêter aussi sur le serveur. */
  private enVol: { planId: string; tache: string } | null = null
  private echecsDeSuite = 0

  constructor(projectId: string) {
    this.projectId = projectId
  }

  // ---------------------------------------------------------------- abonnement

  abonner = (ecouteur: () => void) => {
    this.ecouteurs.add(ecouteur)
    return () => { this.ecouteurs.delete(ecouteur) }
  }

  instantane = () => this.etat

  private maj(patch: Partial<EtatFile>) {
    this.etat = { ...this.etat, ...patch, version: this.etat.version + 1 }
    for (const e of this.ecouteurs) e()
  }

  configurer(options: { queryClient: QueryClient; ouvrages: OuvrageEnvoye[] }) {
    this.queryClient = options.queryClient
    this.ouvrages = options.ouvrages
  }

  /** L'éditeur ouvert sur un plan se déclare ; null quand il se ferme. */
  definirPoignee(p: PoigneeEditeur | null) {
    this.poignee = p
  }

  // ---------------------------------------------------------------- lecture

  /** Les plans du dossier, du plus ancien au plus récent : l'ordre du dépôt, celui du navigateur. */
  plans(): ApiPlan[] {
    const donnees = this.queryClient?.getQueryData<{ plans: ApiPlan[] }>(['plans', this.projectId])
    return ordonnerPlans(donnees?.plans ?? [])
  }

  feuillesDe(plan: ApiPlan): FeuillesPlan {
    return this.feuilles.get(plan.id) ?? plan.feuilles ?? VIDE
  }

  /** Toutes les feuilles du jeu, dans l'ordre, avec l'état de leur analyse. */
  feuillesDuJeu(): (FeuilleEnFile & { plan: ApiPlan; feuille: FeuillePlan })[] {
    const sortie: (FeuilleEnFile & { plan: ApiPlan; feuille: FeuillePlan })[] = []
    for (const plan of this.plans()) {
      const f = this.feuillesDe(plan)
      const n = nombreDePages(plan, f)
      if (!n) continue
      for (let page = 1; page <= n; page++) {
        sortie.push({ planId: plan.id, page, plan, feuille: f.pages[String(page)] ?? {}, etat: etatAnalyse(plan, f, page) })
      }
    }
    return sortie
  }

  // ---------------------------------------------------------------- écritures

  /**
   * Une écriture sur un plan, après celles qui l'attendent déjà. Le cache de
   * la liste des plans prend aussitôt la réponse du serveur.
   */
  ecrire(planId: string, corps: CorpsMajPlan): Promise<ApiPlan> {
    const precedente = this.chaines.get(planId) ?? Promise.resolve()
    const suivante = precedente.catch(() => undefined).then(async () => {
      const { plan } = await api.plans.update(planId, corps)
      this.queryClient?.setQueryData<{ plans: ApiPlan[]; count: number }>(['plans', this.projectId], (avant) =>
        avant ? { ...avant, plans: avant.plans.map((p) => (p.id === plan.id ? plan : p)) } : avant)
      return plan
    })
    this.chaines.set(planId, suivante)
    return suivante
  }

  /** Les feuilles d'un plan changent ici tout de suite, et partent au serveur dans l'ordre. */
  private async ecrireFeuilles(planId: string, maj: (f: FeuillesPlan) => FeuillesPlan): Promise<void> {
    const plan = this.plans().find((p) => p.id === planId)
    const avant = this.feuilles.get(planId) ?? plan?.feuilles ?? VIDE
    const apres = maj(avant)
    this.feuilles.set(planId, apres)
    this.maj({})
    try {
      await this.ecrire(planId, { feuilles: apres })
    } catch {
      // L'état reste juste à l'écran ; la prochaine écriture de ce plan le renverra en entier.
    }
  }

  // ---------------------------------------------------------------- actions

  /** Le nombre de pages d'un PDF, une fois lu par le navigateur des feuilles. */
  definirNombre(planId: string, nombre: number) {
    const plan = this.plans().find((p) => p.id === planId)
    if (!plan || this.feuillesDe(plan).nombre === nombre) return
    void this.ecrireFeuilles(planId, (f) => ({ ...f, nombre }))
  }

  /** Corriger ce que dit une feuille : titre, type de vue, niveau, étages identiques. */
  corriger(planId: string, page: number, patch: Parameters<typeof corrigerFeuille>[2]) {
    void this.ecrireFeuilles(planId, (f) => corrigerFeuille(f, page, patch))
  }

  /** Combien de feuilles « Analyser tout » mettrait en file : jamais analysées, ou en erreur. */
  aAnalyser(): number {
    return this.feuillesDuJeu().filter((x) => x.etat === 'aucune' || x.etat === 'erreur').length
  }

  /** Toutes les feuilles jamais analysées (ou en erreur) passent dans la file. */
  async analyserTout(): Promise<number> {
    const visees = this.feuillesDuJeu().filter((x) => x.etat === 'aucune' || x.etat === 'erreur')
    await this.mettreEnFile(visees)
    this.etat = { ...this.etat, pause: null }
    this.echecsDeSuite = 0
    void this.demarrer()
    return visees.length
  }

  /** Analyser ou relancer des feuilles choisies, même déjà analysées : c'est une demande explicite. */
  async analyser(refs: RefFeuille[]) {
    const jeu = this.feuillesDuJeu()
    const visees = refs
      .map((r) => jeu.find((x) => x.planId === r.planId && x.page === r.page))
      .filter((x): x is NonNullable<typeof x> => !!x && x.etat !== 'en_cours' && x.etat !== 'en_file')
    await this.mettreEnFile(visees)
    this.etat = { ...this.etat, pause: null }
    this.echecsDeSuite = 0
    void this.demarrer()
  }

  private async mettreEnFile(visees: RefFeuille[]) {
    const parPlan = new Map<string, number[]>()
    for (const v of visees) parPlan.set(v.planId, [...(parPlan.get(v.planId) ?? []), v.page])
    const depuis = maintenant()
    await Promise.all([...parPlan].map(([planId, pages]) => this.ecrireFeuilles(planId, (f) => mettreEnFile(f, pages, depuis))))
  }

  /**
   * Arrêter : le lot en cours s'arrête aussi sur le serveur, et les feuilles
   * qui attendaient redeviennent non analysées. Ce qui est déjà rangé reste.
   */
  async arreter() {
    this.arret?.abort()
    if (this.enVol) api.plans.arreterAnalyse(this.enVol.planId, this.enVol.tache)
    const lot = this.etat.lot
    for (const plan of this.plans()) {
      const f = this.feuillesDe(plan)
      const pages = Object.entries(f.pages)
        .filter(([cle, x]) => x.analyse?.statut === 'en_file' || (x.analyse?.statut === 'en_cours' && lot?.planId === plan.id && lot.pages.includes(Number(cle))))
        .map(([cle]) => Number(cle))
      if (pages.length) await this.ecrireFeuilles(plan.id, (x) => retirerDeLaFile(x, pages))
    }
    this.maj({ lot: null, pause: null })
  }

  // ---------------------------------------------------------------- la file

  /** Fait tourner la file jusqu'à ce qu'elle soit vide ; ne fait rien si elle tourne déjà. */
  async demarrer() {
    if (this.tourne || !this.queryClient) return
    this.tourne = true
    try {
      if (!this.repris) {
        this.repris = true
        await this.reprendre()
      }
      while (!this.etat.pause) {
        const lot = prochainLot(this.feuillesDuJeu(), PAGES_PAR_LOT)
        if (!lot) break
        await this.traiterLot(lot.planId, lot.pages, null)
      }
    } finally {
      this.tourne = false
      this.maj({ lot: null })
    }
  }

  /**
   * À la réouverture : un lot resté « en cours » a peut-être fini pendant
   * qu'on était parti. Avec le numéro de sa tâche, on va chercher son
   * résultat ; sans lui, on demande au serveur s'il en tient une pour ce plan.
   * Une tâche introuvable (expirée, serveur redémarré) remet ses pages en
   * file, une fois.
   */
  private async reprendre() {
    for (const plan of this.plans()) {
      for (const [tache, pages] of enCoursParTache(this.feuillesDe(plan))) {
        let numero = tache
        if (!numero) {
          try { numero = (await api.plans.tacheEnCours(plan.id)).enCours } catch { numero = null }
        }
        if (numero) await this.traiterLot(plan.id, pages, numero)
        else await this.ecrireFeuilles(plan.id, (f) => apresUnePerte(f, pages, maintenant()))
      }
    }
  }

  private async traiterLot(planId: string, pages: number[], tacheConnue: string | null) {
    const plan = this.plans().find((p) => p.id === planId)
    if (!plan) return
    const controle = new AbortController()
    this.arret = controle
    const depuis = maintenant()
    this.maj({ lot: { planId, pages, etape: 'preparation', depuis: Date.now() } })
    let tache = tacheConnue
    try {
      if (!tache) await this.ecrireFeuilles(planId, (f) => mettreEnCours(f, pages, depuis, null))
      // Les pages se rendent aussi pour une reprise : c'est leur géométrie qui
      // aimante les zones, et leur taille qui ramène les points au canevas.
      const preparees = await preparerPages(plan, pages)
      if (controle.signal.aborted) return
      if (!tache) {
        const depart = await api.plans.lancerAnalyse(planId, {
          pages: preparees.map((p) => ({ image: p.image, numero: p.rendue.numero, largeurPt: p.rendue.largeurPagePt, hauteurPt: p.rendue.hauteurPagePt })),
          ouvrages: this.ouvrages,
        })
        if (!depart.configured || !depart.enCours) {
          await this.ecrireFeuilles(planId, (f) => mettreEnFile(f, pages, depuis))
          this.maj({ pause: 'L’analyse par l’IA n’est pas disponible sur ce serveur.' })
          return
        }
        tache = depart.enCours
        if (controle.signal.aborted) { api.plans.arreterAnalyse(planId, tache); return }
        const numero = tache
        await this.ecrireFeuilles(planId, (f) => mettreEnCours(f, pages, depuis, numero))
      }
      this.enVol = { planId, tache }
      this.maj({ lot: { planId, pages, etape: 'analyse', depuis: Date.now() } })
      const r = await api.plans.suivreAnalyse(planId, tache, { signal: controle.signal })
      await this.ranger(plan, pages, preparees, r)
    } catch (e) {
      if (controle.signal.aborted || (e as Error)?.name === 'AbortError') return
      if (e instanceof ApiError && e.status === 404) {
        await this.ecrireFeuilles(planId, (f) => apresUnePerte(f, pages, maintenant()))
        return
      }
      if (e instanceof ApiError && DEJA_EN_COURS.test(e.message)) {
        // Une autre analyse du compte tourne (dans l'éditeur, ou un autre
        // onglet) : on attend son tour, sans rien compter comme un échec.
        await this.ecrireFeuilles(planId, (f) => mettreEnFile(f, pages, maintenant()))
        await attendre(20_000, controle.signal)
        return
      }
      if (e instanceof ApiError && e.status === 429) {
        await this.ecrireFeuilles(planId, (f) => mettreEnFile(f, pages, maintenant()))
        this.maj({ pause: 'Limite d’utilisation de l’IA atteinte : reprenez dans quelques minutes.' })
        return
      }
      await this.ecrireFeuilles(planId, (f) => mettreEnErreur(f, pages, maintenant(), (e as Error)?.message || 'L’analyse a échoué.'))
      this.echecsDeSuite++
      if (this.echecsDeSuite >= ECHECS_AVANT_PAUSE) this.maj({ pause: 'La file s’est arrêtée après deux échecs de suite. Relancez quand le réseau est revenu.' })
    } finally {
      if (this.arret === controle) { this.arret = null; this.enVol = null }
    }
  }

  /** Le résultat d'un lot, rangé : propositions au plan, cartouche et échelles aux feuilles, nom au dossier. */
  private async ranger(plan: ApiPlan, pages: number[], preparees: PageAEnvoyer[], r: ResultatAnalyseServeur) {
    const le = maintenant()
    if (!r.configured) {
      await this.ecrireFeuilles(plan.id, (f) => mettreEnFile(f, pages, le))
      this.maj({ pause: 'L’analyse par l’IA n’est pas disponible sur ce serveur.' })
      return
    }
    if (r.refus || !r.analyse) {
      const message = r.refus ? 'L’IA a décliné l’analyse de ces pages.' : 'La réponse de l’IA était illisible. Relancez la feuille.'
      await this.ecrireFeuilles(plan.id, (f) => mettreEnErreur(f, pages, le, message))
      this.echecsDeSuite++
      return
    }
    const pdf = estPdf(plan)
    const propositions = propositionsDeLAnalyse(r.analyse, preparees.map((p) => p.rendue), { estPdf: pdf, identifiant })
    await this.remettre(plan.id, pages, propositions.annotations)
    await this.ecrireFeuilles(plan.id, (f) => appliquerAnalyse(f, {
      numeros: pages,
      pages: r.analyse!.pages,
      echelles: propositions.echelles,
      ecartees: r.analyse!.ecartees,
      sansGeometrie: pdf ? preparees.filter((p) => !p.rendue.index).map((p) => p.rendue.numero) : [],
      tronque: !!r.tronque,
      comptages: r.analyse!.comptages ?? [],
      remarques: r.analyse!.remarques,
      le,
    }))
    this.echecsDeSuite = 0
    await this.completerLeBatiment(r.analyse.projet ?? null).catch(() => undefined)
  }

  /**
   * Les propositions d'un lot, remises à qui tient les annotations du plan :
   * l'éditeur s'il l'a ouvert, sinon le serveur. Un éditeur ouvert sur ce plan
   * pendant l'écriture les reçoit aussi : il s'était chargé sans elles, et son
   * prochain enregistrement les aurait effacées. Le remplacement est le même
   * des deux côtés, et une double livraison ne double rien.
   */
  private async remettre(planId: string, pages: number[], annotations: PlanAnnotation[]) {
    const ouvert = this.poignee
    if (ouvert?.planId === planId) { ouvert.recevoir(pages, annotations); return }
    await this.ecrire(planId, { propositions: { pages, annotations } })
    const apres = this.poignee
    if (apres?.planId === planId) apres.recevoir(pages, annotations)
  }

  /** Le nom et l'adresse lus au cartouche complètent un dossier ouvert depuis un dépôt (feuilles.ts). */
  private async completerLeBatiment(lu: Parameters<typeof completerBatiment>[1]) {
    if (!lu || !this.queryClient) return
    const donnees = await this.queryClient.fetchQuery<{ project: ApiProject; diagnostics: ApiDiagnostic[] }>({
      queryKey: ['project', this.projectId],
      queryFn: () => api.projects.get(this.projectId),
    })
    const patch = completerBatiment(donnees.project, lu, this.plans().map((p) => nomProvisoire(p.name)))
    if (!patch) return
    await api.projects.update(this.projectId, patch)
    void this.queryClient.invalidateQueries({ queryKey: ['project', this.projectId] })
    void this.queryClient.invalidateQueries({ queryKey: ['projects'] })
    void this.queryClient.invalidateQueries({ queryKey: ['metres'] })
  }
}

const moteurs = new Map<string, MoteurMetres>()

/** Le moteur d'un dossier, créé au premier besoin et gardé le temps de la page. */
export function moteurDe(projectId: string): MoteurMetres {
  let m = moteurs.get(projectId)
  if (!m) { m = new MoteurMetres(projectId); moteurs.set(projectId, m) }
  return m
}

/** S'abonner au moteur d'un dossier : l'écran se redessine à chaque écriture de la file. */
export function useMoteurMetres(projectId: string, options: { queryClient: QueryClient; ouvrages: OuvrageEnvoye[]; plansCharges: boolean }) {
  const { queryClient, ouvrages, plansCharges } = options
  const moteur = moteurDe(projectId)
  useEffect(() => { moteur.configurer({ queryClient, ouvrages }) }, [moteur, queryClient, ouvrages])
  const etat = useSyncExternalStore(moteur.abonner, moteur.instantane, moteur.instantane)
  // Le moteur lit les plans dans le cache : il ne démarre (et ne reprend un
  // lot laissé en cours) qu'une fois la liste chargée.
  useEffect(() => { if (plansCharges) void moteur.demarrer() }, [moteur, plansCharges])
  return { moteur, etat }
}
