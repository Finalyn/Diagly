/**
 * Les notifications : un seul endroit qui décide et qui envoie.
 *
 * Une notification arrive par trois canaux, et ils ne jouent pas le même rôle.
 * Le centre de notifications, la cloche en haut à droite, reçoit tout : c'est
 * la trace, elle ne se perd pas et elle se relit. Le push prévient sur le
 * moment, quand l'application est fermée. L'email double le message pour ce
 * qui engage, parce qu'on relit ses courriels le soir et pas ses notifications.
 *
 * Les deux derniers suivent les réglages de la personne, le premier non : une
 * notification qu'on a choisi de ne pas recevoir par courriel doit quand même
 * se retrouver dans la cloche, sinon elle n'existe nulle part.
 *
 * La décision est séparée de l'envoi (`canauxVoulus`) pour se tester sans base
 * ni réseau : c'est elle qui respecte ou trahit le choix de l'utilisateur.
 */

import { prisma } from "./prisma.js";
import {
  canauxVoulus, type Canaux, type ReglagesNotification, type TypeNotification,
} from "./notifications-regles.js";
import { sendPushToUser, pushEnabled } from "./push.js";
import { mailConfigured, sendMail, notificationEmail } from "./mail.js";
import { logger } from "./logger.js";

export type { TypeNotification, ReglagesNotification, Canaux } from "./notifications-regles.js";
export { TYPES_NOTIFICATION, canauxVoulus } from "./notifications-regles.js";

export interface Notification {
  titre: string;
  texte?: string | null;
  /** Où mène la notification quand on la touche. */
  url?: string | null;
  /**
   * Clé de regroupement. Deux notifications de même clé n'en font qu'une, mise
   * à jour : pendant une visite, trente ouvrages urgents ne doivent pas donner
   * trente messages.
   */
  cle?: string | null;
}

/**
 * Enregistre la notification et l'envoie par les canaux voulus.
 *
 * Ne lève jamais : une notification qui échoue ne doit pas faire échouer
 * l'action qui l'a déclenchée. On veut bien manquer un rappel, pas perdre un
 * relevé.
 */
export async function notifier(
  userId: string,
  type: TypeNotification,
  n: Notification,
): Promise<Canaux & { enregistree: boolean }> {
  const muet = { centre: false, push: false, email: false, enregistree: false };
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, preferences: true },
    });
    if (!user) return muet;

    const reglages = ((user.preferences as { notifications?: ReglagesNotification } | null) ?? {}).notifications;
    const canaux = canauxVoulus(reglages, type, canauxDisponibles());

    // La trace d'abord : si la suite échoue, la notification existe quand même.
    if (n.cle) {
      await prisma.notification.upsert({
        where: { userId_cle: { userId, cle: n.cle } },
        create: { userId, type, titre: n.titre, texte: n.texte ?? null, url: n.url ?? null, cle: n.cle },
        // Une notification remise à jour redevient non lue : son contenu a changé.
        update: { type, titre: n.titre, texte: n.texte ?? null, url: n.url ?? null, lueLe: null, creeLe: new Date() },
      });
    } else {
      await prisma.notification.create({
        data: { userId, type, titre: n.titre, texte: n.texte ?? null, url: n.url ?? null },
      });
    }

    if (canaux.push) {
      await sendPushToUser(userId, {
        title: n.titre,
        body: n.texte ?? "",
        url: n.url ?? "/app/dashboard",
        tag: n.cle ?? undefined,
      });
    }

    if (canaux.email) {
      const gabarit = notificationEmail({ titre: n.titre, texte: n.texte ?? "", url: n.url ?? null });
      await sendMail({ to: user.email, ...gabarit });
    }

    return { ...canaux, enregistree: true };
  } catch (err) {
    logger.error({ err, type, userId }, "notification non envoyée");
    return muet;
  }
}

/** Variante non bloquante, pour les routes qui ne doivent pas attendre. */
export function notifierSansAttendre(userId: string, type: TypeNotification, n: Notification): void {
  notifier(userId, type, n).catch(() => undefined);
}

/** Ce que le serveur sait faire, pour que l'écran des réglages le dise. */
export function canauxDisponibles() {
  return { push: pushEnabled, email: mailConfigured() };
}
