/**
 * Une réponse de l'API Messages reçue en flux, remise en un seul morceau.
 *
 * La lecture d'un jeu de plans par un modèle qui réfléchit prend plusieurs
 * minutes. Demandée d'un bloc, sa réponse n'envoie ses en-têtes qu'une fois
 * entièrement rédigée, et fetch (undici) abandonne au bout de cinq minutes
 * sans en-têtes : la lecture serait payée et perdue. En flux, les en-têtes
 * arrivent tout de suite et l'API envoie des signes de vie en attendant.
 *
 * On ne garde du flux que ce dont la route a besoin : le texte de la réponse
 * (la réflexion n'est pas affichée), la raison de l'arrêt, une éventuelle
 * erreur survenue en cours de route, et les jetons consommés : c'est ce que
 * l'analyse coûte, réflexion comprise, et le journal du serveur le garde. Les événements arrivent découpés au
 * hasard du réseau : un événement peut se trouver à cheval sur deux morceaux,
 * d'où la mémoire de ce qui n'est pas encore complet.
 */
/** Jetons d'une réponse : l'entrée (images et consigne) et la sortie (réflexion comprise). */
export interface JetonsDuFlux {
  entree: number;
  sortie: number;
}

export class AssembleurDeFlux {
  private enAttente = "";
  private texte = "";
  private arret: string | null = null;
  private erreur: string | null = null;
  private jetons: JetonsDuFlux = { entree: 0, sortie: 0 };

  /** Un morceau du flux, tel que reçu. */
  pousser(morceau: string): void {
    this.enAttente = (this.enAttente + morceau).replace(/\r\n?/g, "\n");
    let fin = this.enAttente.indexOf("\n\n");
    while (fin >= 0) {
      this.traiter(this.enAttente.slice(0, fin));
      this.enAttente = this.enAttente.slice(fin + 2);
      fin = this.enAttente.indexOf("\n\n");
    }
  }

  /** La réponse complète, une fois le flux fermé. */
  terminer(): { texte: string; arret: string | null; erreur: string | null; jetons: JetonsDuFlux } {
    if (this.enAttente.trim()) this.traiter(this.enAttente);
    this.enAttente = "";
    return { texte: this.texte, arret: this.arret, erreur: this.erreur, jetons: this.jetons };
  }

  private traiter(evenement: string): void {
    const donnees = evenement
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trimStart())
      .join("\n");
    if (!donnees) return;
    type Usage = { input_tokens?: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number; output_tokens?: number };
    let e: {
      type?: string;
      delta?: { type?: string; text?: string; stop_reason?: string };
      error?: { type?: string; message?: string };
      message?: { usage?: Usage };
      usage?: Usage;
    };
    try {
      e = JSON.parse(donnees);
    } catch {
      return;
    }
    if (e.type === "content_block_delta" && e.delta?.type === "text_delta") this.texte += e.delta.text ?? "";
    else if (e.type === "message_start" && e.message?.usage) {
      // L'entrée est connue dès le départ, cache compris.
      const u = e.message.usage;
      this.jetons = {
        entree: (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0),
        sortie: u.output_tokens ?? 0,
      };
    } else if (e.type === "message_delta") {
      if (e.delta?.stop_reason) this.arret = e.delta.stop_reason;
      // La sortie arrive en total cumulé avec la fin du message.
      if (typeof e.usage?.output_tokens === "number") this.jetons = { ...this.jetons, sortie: e.usage.output_tokens };
    } else if (e.type === "error") this.erreur = e.error?.type ?? "error";
  }
}

/** Le premier objet JSON d'un texte : le modèle peut l'entourer d'une phrase malgré la consigne. */
export function objetJson(texte: string): unknown {
  const debut = texte.indexOf("{");
  const fin = texte.lastIndexOf("}");
  if (debut < 0 || fin <= debut) return null;
  try {
    return JSON.parse(texte.slice(debut, fin + 1)) as unknown;
  } catch {
    return null;
  }
}
