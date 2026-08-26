import { createHmac } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";
import { logger } from "./logger.js";
import { randomToken } from "./hash.js";

// Événements couverts (v1).
export const WEBHOOK_EVENTS = [
  "diagnostic.finalise",
  "rapport.genere",
  "element.modifie",
  "plan_travaux.mis_a_jour",
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

// Fenêtre de coalescing (absorbe la rafale de modifications rejouée à la reconnexion hors-ligne).
const COALESCE_DELAY_MS = 20_000;

export const newWebhookSecret = () => `whsec_${randomToken(24)}`;

/** Signature HMAC-SHA256 du payload : `sha256=hex(hmac(secret, "<timestamp>.<body>"))`. */
export function signPayload(secret: string, timestamp: string, body: string) {
  return `sha256=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
}

/**
 * Émet un événement vers les endpoints du compte abonnés à ce type. Payload MINIMAL
 * (identifiants + EGID) : le destinataire rappelle l'API pour l'état à jour. Les événements
 * `element.modifie` / `plan_travaux.mis_a_jour` sont coalescés par diagnostic (une seule
 * livraison PENDING par (endpoint, event, diagnostic) sur ~20s). Fire-and-forget.
 */
export async function emitEvent(
  userId: string,
  event: WebhookEvent,
  data: Record<string, unknown>,
  opts?: { coalesceDiagnosticId?: string },
) {
  const endpoints = await prisma.webhookEndpoint.findMany({ where: { userId, active: true } });
  const subscribed = endpoints.filter((e) => Array.isArray(e.events) && (e.events as string[]).includes(event));
  if (!subscribed.length) return;

  const occurredAt = new Date().toISOString();
  const eventId = `evt_${randomToken(10)}`;

  for (const ep of subscribed) {
    const coalesceKey = opts?.coalesceDiagnosticId ? `${event}:diagnostic:${opts.coalesceDiagnosticId}` : null;
    if (coalesceKey) {
      const pending = await prisma.webhookDelivery.findFirst({
        where: { endpointId: ep.id, coalesceKey, status: "PENDING", attempts: 0 },
      });
      if (pending) continue; // déjà planifié dans la fenêtre → on ne recrée pas
    }
    await prisma.webhookDelivery.create({
      data: {
        endpointId: ep.id,
        userId,
        eventType: event,
        coalesceKey,
        payload: { id: eventId, event, occurredAt, data } as unknown as Prisma.InputJsonValue,
        nextAttemptAt: new Date(Date.now() + (coalesceKey ? COALESCE_DELAY_MS : 0)),
      },
    });
  }
}

/** Variante non bloquante : à appeler depuis les handlers sans await (n'entrave pas la réponse HTTP). */
export function fireEvent(userId: string, event: WebhookEvent, data: Record<string, unknown>, opts?: { coalesceDiagnosticId?: string }) {
  emitEvent(userId, event, data, opts).catch((err) => logger.error({ err, event }, "webhook emit failed"));
}
