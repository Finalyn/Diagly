import { useSyncExternalStore } from 'react'
import { onlineManager } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api'
import type { ApiDiagnostic, ApiDiagnosticItem } from '@/lib/api-types'
import { queryClient } from '@/lib/query-client'
import { useAuth } from '@/stores/auth'
import { entrer, fusionnerRelecture, superposer, type CorpsReleve, type Operation } from './operations'
import { stockage } from './stockage'
import { abonner, lireEtat, poserEtat, type Refus } from './etat'

/**
 * Le moteur de la file d'envoi : il écrit chaque saisie sur l'appareil avant
 * toute chose, puis l'envoie dès que le réseau le permet, une à la fois, dans
 * l'ordre de saisie.
 *
 * Il remplace, pour les relevés, les mutations mises en pause de react-query :
 * celles-ci ne survivaient pas à la fermeture de l'app (aucune n'avait de
 * fonction par défaut pour repartir après un redémarrage), et une modification
 * d'un relevé créé hors-ligne partait vers son identifiant provisoire.
 */

export type Saisie =
  | { type: 'creer'; diagnosticId: string; releveId: string; corps: CorpsReleve }
  | { type: 'modifier'; diagnosticId: string; releveId: string; corps: CorpsReleve }
  | { type: 'supprimer'; diagnosticId: string; releveId: string }

/** Identifiant d'un relevé, choisi par l'appareil (UUID v4). */
export function nouvelIdentifiant(): string {
  // randomUUID n'existe que dans un contexte sécurisé ; getRandomValues partout.
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const o = crypto.getRandomValues(new Uint8Array(16))
  o[6] = (o[6] & 0x0f) | 0x40
  o[8] = (o[8] & 0x3f) | 0x80
  const h = Array.from(o, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

let rang = 0
let chargement: Promise<void> | null = null
let envoiEnCours = false
let relance: ReturnType<typeof setTimeout> | null = null
let tentative = 0
// Une minute au plus : quand l'appareil se croit connecté sans atteindre le
// serveur, aucun événement réseau ne signale le retour, seul ce minuteur relance.
const DELAIS = [5_000, 10_000, 20_000, 30_000, 60_000]

// Les écritures sur le disque passent l'une après l'autre : deux saisies
// rapprochées du même relevé réécrivent la même opération, et la plus ancienne
// ne doit pas finir par écraser la plus récente.
let disque: Promise<void> = Promise.resolve()
function surLeDisque(travail: () => Promise<void>): Promise<void> {
  disque = disque.then(travail, travail)
  return disque
}

/**
 * Relit la file et les refus laissés sur l'appareil, et branche les
 * déclencheurs d'envoi. Une seule fois : la promesse est gardée, et tout ce
 * qui touche à la file l'attend (saisir).
 */
export function chargerFile(): Promise<void> {
  chargement ??= (async () => {
    try {
      const [lues, refusLus] = await Promise.all([
        stockage.lister(),
        // Des refus illisibles n'empêchent pas la file de repartir.
        stockage.lireRefus().catch((): Refus[] => []),
      ])
      // On fusionne avec ce qui serait déjà en mémoire au lieu de l'écraser
      // (voir fusionnerRelecture).
      const { file, renumerotees } = fusionnerRelecture(lues, lireEtat().file)
      rang = file.reduce((m, o) => Math.max(m, o.rang), 0)
      const connus = new Set(refusLus.map((r) => r.operation.id))
      const refus = [...refusLus, ...lireEtat().refus.filter((r) => !connus.has(r.operation.id))]
      poserEtat({ file, refus, chargee: true })
      if (renumerotees.length) await surLeDisque(() => stockage.ecrire(renumerotees))
      // Ce qui s'est affiché avant la fin de la lecture ne montrait pas ces
      // saisies : on relit les diagnostics concernés.
      for (const d of new Set(file.map((o) => o.diagnosticId))) rafraichir(d)
    } catch {
      poserEtat({ chargee: true })
    }
    onlineManager.subscribe((enLigne) => { if (enLigne) void envoyer() })
    // Une connexion (ou une reconnexion après expiration) libère les saisies du compte.
    useAuth.subscribe((s, avant) => {
      if (s.accessToken && s.accessToken !== avant.accessToken) void envoyer()
    })
    void envoyer()
  })()
  return chargement
}

function appliquerAuCache(op: Operation): void {
  const d = op.diagnosticId
  queryClient.setQueryData<{ items: ApiDiagnosticItem[]; count: number }>(['diagnostic-items', d], (v) => {
    if (!v) return v
    const items = superposer(v.items, [op], d, op.utilisateurId)
    return { ...v, items, count: items.length }
  })
  queryClient.setQueryData<{ diagnostic: ApiDiagnostic; items: ApiDiagnosticItem[] }>(['diagnostic', d], (v) =>
    v && Array.isArray(v.items) ? { ...v, items: superposer(v.items, [op], d, op.utilisateurId) } : v)
}

function rafraichir(diagnosticId: string): void {
  void queryClient.invalidateQueries({ queryKey: ['diagnostic', diagnosticId] })
  void queryClient.invalidateQueries({ queryKey: ['diagnostic-items', diagnosticId] })
  // Les compteurs et totaux du dossier.
  void queryClient.invalidateQueries({ queryKey: ['project'] })
  void queryClient.invalidateQueries({ queryKey: ['projects'] })
}

/**
 * Enregistre une saisie : à l'écran tout de suite, sur l'appareil ensuite,
 * puis envoyée dès que possible. La promesse se résout une fois la saisie à
 * l'abri sur l'appareil, pas à l'arrivée au serveur.
 */
export async function saisir(s: Saisie): Promise<void> {
  const utilisateurId = useAuth.getState().user?.id
  if (!utilisateurId) throw new Error('Aucune session ouverte.')
  // La file laissée sur l'appareil d'abord : lue en quelques millisecondes,
  // elle est presque toujours prête. Entrée avant, la saisie recevait le
  // rang 1, puis la liste relue l'écrasait : elle quittait l'écran, et
  // repartait dans le désordre au lancement suivant.
  await chargerFile()
  rang += 1
  const op = { ...s, id: nouvelIdentifiant(), rang, utilisateurId, saisieLe: Date.now() } as Operation
  const { file, enVol } = lireEtat()
  const changement = entrer(file, op, enVol)
  poserEtat({ file: changement.file })
  appliquerAuCache(op)
  await surLeDisque(async () => {
    if (changement.ecrites.length) await stockage.ecrire(changement.ecrites)
    if (changement.effacees.length) await stockage.effacer(changement.effacees)
  })
  void envoyer()
}

type Issue = { type: 'ok' } | { type: 'reessayer' } | { type: 'refus'; raison: string }

function raisonDuRefus(op: Operation, e: ApiError): string {
  if (e.status === 404) return op.type === 'creer'
    ? 'Le diagnostic de ce relevé a été supprimé.'
    : 'Ce relevé a été supprimé entre-temps, depuis un autre appareil.'
  if (e.status === 403) return 'Votre rôle dans l\'organisation ne permet pas de modifier ce dossier.'
  if (e.status === 413) return 'Les photos de ce relevé sont trop lourdes pour être envoyées.'
  return e.message || `Refusé par le serveur (${e.status}).`
}

async function transmettre(op: Operation): Promise<Issue> {
  try {
    if (op.type === 'creer') await api.diagnostics.createItem(op.diagnosticId, { ...op.corps, id: op.releveId })
    else if (op.type === 'modifier') await api.diagnostics.updateItem(op.releveId, op.corps)
    else await api.diagnostics.deleteItem(op.releveId)
    return { type: 'ok' }
  } catch (e) {
    // Pas de réponse lisible (réseau coupé, page d'erreur du proxy) : on réessaiera.
    if (!(e instanceof ApiError)) return { type: 'reessayer' }
    // Déjà supprimé : c'était le but.
    if (op.type === 'supprimer' && e.status === 404) return { type: 'ok' }
    // Session à renouveler, serveur surchargé ou en panne : rien de définitif.
    if (e.status === 401 || e.status === 408 || e.status === 429 || e.status >= 500) return { type: 'reessayer' }
    return { type: 'refus', raison: raisonDuRefus(op, e) }
  }
}

/**
 * Marque une opération comme tentée, sur le disque puis en mémoire, juste
 * avant sa première requête. Sans cette trace, une création reçue par le
 * serveur dont la réponse s'était perdue passait pour jamais envoyée : on y
 * fondait la suite, que le renvoi ne transmettait pas, ou on l'effaçait à la
 * suppression du relevé, qui revenait alors du serveur.
 *
 * Null si le disque refuse l'écriture : l'opération ne part pas sans sa trace.
 */
async function marquerTentee(op: Operation): Promise<Operation | null> {
  const marquee: Operation = { ...op, tentee: true }
  try {
    await surLeDisque(() => stockage.ecrire([marquee]))
  } catch {
    return null
  }
  // Pendant l'écriture, l'opération était déjà `enVol` : aucune saisie ne l'a
  // modifiée, la remplacer ne perd rien.
  poserEtat({ file: lireEtat().file.map((o) => (o.id === op.id ? marquee : o)) })
  return marquee
}

function programmerRelance(): void {
  if (relance) clearTimeout(relance)
  const delai = DELAIS[Math.min(tentative, DELAIS.length - 1)]
  tentative += 1
  relance = setTimeout(() => { relance = null; void envoyer() }, delai)
}

/** Envoie la file, une opération après l'autre. Sans effet si un envoi tourne déjà. */
export async function envoyer(): Promise<void> {
  if (envoiEnCours || !lireEtat().chargee) return
  envoiEnCours = true
  try {
    for (;;) {
      if (!onlineManager.isOnline()) return
      const { user, accessToken } = useAuth.getState()
      if (!user || !accessToken) return
      // Les saisies d'un autre compte (session expirée, appareil partagé)
      // attendent son retour : elles ne partent jamais sous ce compte-ci.
      const suivante = lireEtat().file.find((o) => o.utilisateurId === user.id)
      if (!suivante) {
        tentative = 0
        if (lireEtat().injoignable) poserEtat({ injoignable: false })
        return
      }

      poserEtat({ enVol: suivante.id })
      const op = suivante.tentee ? suivante : await marquerTentee(suivante)
      if (!op) { programmerRelance(); return }
      // Effacée pendant l'écriture de la marque (déconnexion) : plus rien à envoyer.
      if (!lireEtat().file.some((o) => o.id === op.id)) continue
      const issue = await transmettre(op)
      if (issue.type === 'reessayer') { poserEtat({ injoignable: true }); programmerRelance(); return }

      const avant = lireEtat()
      // Une création refusée emporte la suite du même relevé, saisie par le
      // même compte : ses modifications viseraient un relevé qui n'existe pas.
      const parties = avant.file.filter((o) => o.id === op.id
        || (issue.type === 'refus' && op.type === 'creer' && o.releveId === op.releveId && o.utilisateurId === op.utilisateurId))
      const file = avant.file.filter((o) => !parties.includes(o))
      const refus = issue.type === 'refus' ? [...avant.refus, { operation: op, raison: issue.raison, le: Date.now() }] : avant.refus
      poserEtat({ file, refus, enVol: null, injoignable: false })
      await surLeDisque(async () => {
        // Le refus d'abord : une coupure entre les deux laisse la saisie dans
        // la file (elle repartira, et sera refusée de nouveau), jamais
        // effacée sans que le refus soit gardé.
        if (issue.type === 'refus') await stockage.ecrireRefus(lireEtat().refus)
        await stockage.effacer(parties.map((o) => o.id))
      })
      tentative = 0
      // Le dossier est à jour sur le serveur : on reprend sa version (coûts
      // recalculés, ordre, compteurs). Un refus aussi : la saisie refusée doit
      // quitter l'écran.
      if (issue.type === 'refus' || !file.some((o) => o.diagnosticId === op.diagnosticId)) rafraichir(op.diagnosticId)
    }
  } finally {
    envoiEnCours = false
    if (lireEtat().enVol) poserEtat({ enVol: null })
  }
}

/** Oublie les refus affichés, ceux du compte connecté seulement. */
export function ignorerRefus(): void {
  const moi = useAuth.getState().user?.id
  poserEtat({ refus: lireEtat().refus.filter((r) => r.operation.utilisateurId !== moi) })
  void surLeDisque(() => stockage.ecrireRefus(lireEtat().refus)).catch(() => undefined)
}

/**
 * Efface les saisies en attente et les refus d'un compte, et eux seuls.
 * Réservé à la déconnexion volontaire, après que l'utilisateur a accepté de
 * perdre les siennes. Ce qu'un autre compte a laissé sur l'appareil (tablette
 * partagée, session expirée) reste : il le retrouvera à sa reconnexion.
 */
export async function oublierSaisiesDuCompte(utilisateurId: string): Promise<void> {
  // Relue d'abord : on n'efface pas à moitié une file pas encore lue.
  await chargerFile()
  const { file, refus, enVol } = lireEtat()
  const siennes = file.filter((o) => o.utilisateurId === utilisateurId)
  poserEtat({
    file: file.filter((o) => o.utilisateurId !== utilisateurId),
    refus: refus.filter((r) => r.operation.utilisateurId !== utilisateurId),
    enVol: siennes.some((o) => o.id === enVol) ? null : enVol,
    injoignable: false,
  })
  await surLeDisque(async () => {
    await stockage.effacer(siennes.map((o) => o.id))
    await stockage.ecrireRefus(lireEtat().refus)
  })
}

/** Le nombre de saisies du compte connecté qui n'ont pas encore atteint le serveur. */
export function saisiesEnAttente(): number {
  const moi = useAuth.getState().user?.id
  return moi ? lireEtat().file.filter((o) => o.utilisateurId === moi).length : 0
}

/** Pour l'interface : ce qui attend, ce qui part, ce qui a été refusé. */
export function useFileEnvoi() {
  const etat = useSyncExternalStore(abonner, lireEtat)
  const moi = useAuth((s) => s.user?.id)
  const miennes = moi ? etat.file.filter((o) => o.utilisateurId === moi) : []
  return {
    enAttente: miennes.length,
    parDiagnostic: (diagnosticId: string) => miennes.filter((o) => o.diagnosticId === diagnosticId).length,
    envoiEnCours: etat.enVol !== null,
    injoignable: etat.injoignable,
    refus: moi ? etat.refus.filter((r) => r.operation.utilisateurId === moi) : [],
  }
}
