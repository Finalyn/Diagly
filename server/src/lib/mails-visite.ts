/**
 * Les règles d'envoi des mails de visite, sans base ni réseau.
 *
 * Ces mails partent par le SMTP de Diagly, de l'adresse du serveur. Pour que
 * ce ne soit pas un relais ouvert, deux choses sont fixées ici plutôt que
 * reçues de l'application : à qui le mail peut partir (les interlocuteurs
 * enregistrés du dossier, rien d'autre) et le nom affiché de l'expéditeur
 * (celui du compte, suivi de « via Diagly »).
 */

export interface Destinataire {
  name: string;
  email: string;
}

const normaliser = (email: string) => email.trim().toLowerCase();

/**
 * Sépare les adresses demandées entre celles des interlocuteurs du dossier,
 * retenues avec le nom enregistré, et les autres, refusées.
 *
 * Une adresse demandée deux fois ne part qu'une fois. La casse ne compte pas :
 * « Gerance@Exemple.ch » est l'interlocuteur enregistré en minuscules.
 */
export function trierDestinataires(
  demandes: readonly { email: string }[],
  contacts: readonly { name: string; email: string | null }[],
): { retenus: Destinataire[]; inconnus: string[] } {
  const parAdresse = new Map<string, Destinataire>();
  for (const c of contacts) {
    if (!c.email || !c.email.trim()) continue;
    const cle = normaliser(c.email);
    if (!parAdresse.has(cle)) parAdresse.set(cle, { name: c.name, email: c.email.trim() });
  }

  const vues = new Set<string>();
  const retenus: Destinataire[] = [];
  const inconnus: string[] = [];
  for (const d of demandes) {
    const cle = normaliser(d.email);
    if (!cle || vues.has(cle)) continue;
    vues.add(cle);
    const contact = parAdresse.get(cle);
    if (contact) retenus.push(contact);
    else inconnus.push(d.email.trim());
  }
  return { retenus, inconnus };
}

/** Le refus des adresses qui ne sont pas des interlocuteurs, et ce qu'on peut faire. */
export function messageAdressesInconnues(inconnus: readonly string[]): string {
  if (inconnus.length > 1) {
    return `Ces adresses ne sont pas des interlocuteurs du dossier : ${inconnus.join(", ")}. `
      + "Ajoutez-les aux interlocuteurs pour leur écrire depuis Diagly, ou ouvrez le mail dans votre messagerie.";
  }
  return `Cette adresse n'est pas un interlocuteur du dossier : ${inconnus[0]}. `
    + "Ajoutez-la aux interlocuteurs pour lui écrire depuis Diagly, ou ouvrez le mail dans votre messagerie.";
}

/** Longueur au-delà de laquelle un nom d'expéditeur est coupé. */
const LONGUEUR_NOM = 80;

/**
 * Le nom affiché de l'expéditeur : « Prénom Nom via Diagly », ou le nom de
 * l'entreprise quand le compte n'a pas de nom.
 *
 * Il vient du compte, jamais de la requête : un nom libre ferait passer un
 * mail parti de Diagly pour celui d'une banque ou d'une régie. « via Diagly »
 * dit d'où il part vraiment ; les réponses, elles, vont à l'adresse de
 * l'utilisateur (Reply-To). Sans nom ni entreprise : « Diagly » seul, plutôt
 * qu'une adresse email affichée comme un nom.
 */
export function nomExpediteur(u: { prenom?: string | null; nom?: string | null; societe?: string | null }): string {
  const propre = (t: string | null | undefined) =>
    // Ni guillemets, ni chevrons, ni retours à la ligne : rien qui puisse
    // fermer le nom et réécrire l'en-tête From.
    (t ?? "").replace(/[\p{Cc}"<>\\]/gu, " ").replace(/\s+/g, " ").trim();
  const personne = [propre(u.prenom), propre(u.nom)].filter(Boolean).join(" ");
  const base = (personne || propre(u.societe)).slice(0, LONGUEUR_NOM).trim();
  return base ? `${base} via Diagly` : "Diagly";
}
