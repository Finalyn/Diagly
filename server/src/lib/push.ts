import webpush from "web-push";
import { prisma } from "./prisma.js";
import { env } from "./env.js";
import { logger } from "./logger.js";
import { cleAppleConfiguree, envoyerApns } from "./apple.js";

export const pushEnabled = !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);

/** Un canal de notification poussée existe : le navigateur (VAPID) ou l'iPhone (APNs). */
export const pushDisponible = () => pushEnabled || cleAppleConfiguree();

if (pushEnabled) {
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * Envoie une notification à tous les appareils d'un utilisateur : navigateurs
 * (push web) et iPhone/iPad (APNs). Nettoie les abonnements morts.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  const [web, ios] = await Promise.all([envoyerWeb(userId, payload), envoyerIos(userId, payload)]);
  return web + ios;
}

async function envoyerIos(userId: string, payload: PushPayload): Promise<number> {
  if (!cleAppleConfiguree()) return 0;
  const appareils = await prisma.appareilPush.findMany({ where: { userId } });
  const issues = await Promise.all(appareils.map(async (a) => {
    const issue = await envoyerApns(a.jeton, { titre: payload.title, texte: payload.body, url: payload.url, fil: payload.tag });
    // L'app a été désinstallée, ou le jeton ne vaut plus rien : on l'oublie.
    if (issue === "perime") await prisma.appareilPush.delete({ where: { id: a.id } }).catch(() => undefined);
    return issue === "envoye" ? 1 : 0;
  }));
  return issues.reduce<number>((n, x) => n + x, 0);
}

async function envoyerWeb(userId: string, payload: PushPayload): Promise<number> {
  if (!pushEnabled) return 0;
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload)
        );
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        // 404 / 410 : abonnement expiré ou révoqué -> on le supprime.
        if (code === 404 || code === 410) {
          await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => undefined);
        } else {
          logger.warn({ code }, "push send failed");
        }
      }
    })
  );
  return sent;
}
