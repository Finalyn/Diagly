import type { ApiDiagnosticItem } from '@/lib/api-types'

/**
 * La file d'envoi des relevés : ce qui a été saisi sur l'appareil et n'est pas
 * encore arrivé au serveur.
 *
 * Ce module est pur : il dit comment une saisie entre dans la file, et comment
 * la file se superpose à ce que le serveur renvoie. Le stockage et l'envoi
 * vivent dans file-envoi.ts.
 *
 * Le principe qui rend le reste simple : l'identifiant d'un relevé est choisi
 * par l'appareil au moment de la saisie (un UUID), pas par le serveur à la
 * réception. Une saisie hors-ligne a donc tout de suite son identifiant
 * définitif ; les modifications qui la suivent le désignent directement, sans
 * identifiant provisoire à réconcilier ; et une création renvoyée après une
 * coupure ne fait pas de doublon, le serveur reconnaissant l'identifiant.
 */

export type CorpsReleve = Partial<ApiDiagnosticItem>

interface Commun {
  /** Identifiant de l'opération elle-même (pas celui du relevé). */
  id: string
  /** Ordre de saisie. La file part dans cet ordre. */
  rang: number
  /** Le compte qui a saisi : une saisie ne part jamais sous un autre compte. */
  utilisateurId: string
  diagnosticId: string
  releveId: string
  /** Horodatage de la saisie (ms). */
  saisieLe: number
}

export type Operation =
  | (Commun & { type: 'creer'; corps: CorpsReleve })
  | (Commun & { type: 'modifier'; corps: CorpsReleve })
  | (Commun & { type: 'supprimer' })

/** Ce que l'entrée d'une saisie change dans la file, pour le stockage. */
export interface Changement {
  file: Operation[]
  /** Opérations à écrire (nouvelles ou complétées). */
  ecrites: Operation[]
  /** Identifiants d'opérations à effacer. */
  effacees: string[]
}

/**
 * Fait entrer une saisie dans la file.
 *
 * La file reste courte : une modification se fond dans la création ou la
 * modification encore en attente du même relevé, et la suppression d'un
 * relevé jamais envoyé efface tout simplement sa création. Une opération déjà
 * partie (`enVol`) n'est jamais touchée : sa requête est sur le réseau avec
 * l'ancien contenu, la suite doit donc venir après elle.
 */
export function entrer(file: Operation[], saisie: Operation, enVol: string | null = null): Changement {
  const attente = (op: Operation) => op.releveId === saisie.releveId && op.id !== enVol

  if (saisie.type === 'modifier') {
    const cible = [...file].reverse().find(attente)
    // Le relevé attend d'être supprimé : le modifier n'a plus d'objet.
    if (cible?.type === 'supprimer') return { file, ecrites: [], effacees: [] }
    if (cible) {
      const completee: Operation = { ...cible, corps: { ...cible.corps, ...saisie.corps } }
      return {
        file: file.map((op) => (op.id === cible.id ? completee : op)),
        ecrites: [completee],
        effacees: [],
      }
    }
    return { file: [...file, saisie], ecrites: [saisie], effacees: [] }
  }

  if (saisie.type === 'supprimer') {
    const retirees = file.filter(attente)
    const reste = file.filter((op) => !attente(op))
    // Créé ici et jamais parti : le serveur n'en a jamais entendu parler, il
    // n'y a rien à lui demander de supprimer.
    const jamaisEnvoye = retirees.some((op) => op.type === 'creer')
    if (jamaisEnvoye) return { file: reste, ecrites: [], effacees: retirees.map((op) => op.id) }
    return { file: [...reste, saisie], ecrites: [saisie], effacees: retirees.map((op) => op.id) }
  }

  return { file: [...file, saisie], ecrites: [saisie], effacees: [] }
}

/** Les valeurs d'un relevé que la création n'a pas précisées. */
function releveVierge(op: Operation & { type: 'creer' }): ApiDiagnosticItem {
  const date = new Date(op.saisieLe).toISOString()
  return {
    id: op.releveId,
    diagnosticId: op.diagnosticId,
    cfcCode: '',
    cfcLabel: '',
    catalogItemId: null,
    state: null,
    priority: null,
    notes: null,
    works: [],
    photos: [],
    area: null,
    unit: null,
    yearInstalled: null,
    interventionYear: null,
    estimatedCost: null,
    improvement: null,
    improvementCost: null,
    norms: null,
    normsCost: null,
    createdAt: date,
    updatedAt: date,
  }
}

/**
 * Les relevés d'un diagnostic tels que l'utilisateur doit les voir : ceux du
 * serveur, plus ce qui attend dans la file.
 *
 * Toute lecture de la liste passe par ici. Sans cela, un rafraîchissement
 * venu du serveur effaçait de l'écran une saisie pas encore envoyée, qui
 * réapparaissait à l'envoi : l'utilisateur la croyait perdue et la ressaisissait.
 */
export function superposer(
  releves: ApiDiagnosticItem[],
  file: Operation[],
  diagnosticId: string,
): ApiDiagnosticItem[] {
  let resultat = releves
  for (const op of file) {
    if (op.diagnosticId !== diagnosticId) continue
    const present = resultat.some((r) => r.id === op.releveId)
    if (op.type === 'supprimer') {
      resultat = resultat.filter((r) => r.id !== op.releveId)
    } else if (present) {
      // Une création déjà reçue par le serveur, mais pas encore retirée de la
      // file, se comporte comme une modification : son contenu prime.
      resultat = resultat.map((r) => (r.id === op.releveId ? { ...r, ...op.corps, id: r.id } : r))
    } else if (op.type === 'creer') {
      resultat = [...resultat, { ...releveVierge(op), ...op.corps, id: op.releveId, diagnosticId: op.diagnosticId }]
    }
    // Une modification d'un relevé absent (supprimé ailleurs) n'a rien à montrer.
  }
  return resultat
}

/** Le nombre de saisies en attente, par diagnostic. */
export function enAttenteParDiagnostic(file: Operation[]): Map<string, number> {
  const parDiag = new Map<string, number>()
  for (const op of file) parDiag.set(op.diagnosticId, (parDiag.get(op.diagnosticId) ?? 0) + 1)
  return parDiag
}
