import type { WebhookDelivery } from "@prisma/client";
import { prisma } from "./prisma.js";
import { logger } from "./logger.js";
import { signPayload } from "./webhook.js";

const TICK_MS = 10_000;
const MAX_ATTEMPTS = 6;
// Backoff exponentiel (ms) après l'échec n° 1..5, puis échec définitif.
const BACKOFF_MS = [30_000, 120_000, 600_000, 3_600_000, 21_600_000];
const REQUEST_TIMEOUT_MS = 10_000;

async function markFailure(id: string, attempts: number, responseStatus: number | null, error: string | undefined) {
  if (attempts >= MAX_ATTEMPTS) {
    await prisma.webhookDelivery.update({ where: { id }, data: { status: "FAILED", attempts, responseStatus: responseStatus ?? undefined, error } });
  } else {
    const delay = BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)];
    await prisma.webhookDelivery.update({
      where: { id },
      data: { status: "PENDING", attempts, responseStatus: responseStatus ?? undefined, error, nextAttemptAt: new Date(Date.now() + delay) },
    });
  }
}

async function deliver(d: WebhookDelivery) {
  const ep = await prisma.webhookEndpoint.findUnique({ where: { id: d.endpointId } });
  if (!ep || !ep.active) {
    await prisma.webhookDelivery.update({ where: { id: d.id }, data: { status: "FAILED", error: "Endpoint inactif ou supprimé" } });
    return;
  }
  const body = JSON.stringify(d.payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const attempts = d.attempts + 1;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(ep.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Diagly-Webhooks/1.0",
        "X-Diagly-Event": d.eventType,
        "X-Diagly-Delivery": d.id,
        "X-Diagly-Timestamp": timestamp,
        "X-Diagly-Signature": signPayload(ep.secret, timestamp, body),
      },
      body,
      signal: ctrl.signal,
    });
    if (res.ok) {
      await prisma.webhookDelivery.update({ where: { id: d.id }, data: { status: "DELIVERED", attempts, responseStatus: res.status, deliveredAt: new Date(), error: null } });
    } else {
      await markFailure(d.id, attempts, res.status, `HTTP ${res.status}`);
    }
  } catch (e) {
    await markFailure(d.id, attempts, null, (e as Error)?.message?.slice(0, 500) ?? "Erreur réseau");
  } finally {
    clearTimeout(timer);
  }
}

let running = false;
async function tick() {
  if (running) return;
  running = true;
  try {
    const due = await prisma.webhookDelivery.findMany({
      where: { status: "PENDING", nextAttemptAt: { lte: new Date() } },
      orderBy: { nextAttemptAt: "asc" },
      take: 20,
    });
    for (const d of due) await deliver(d);
  } catch (err) {
    logger.error({ err }, "webhook worker tick failed");
  } finally {
    running = false;
  }
}

export function startWebhookWorker() {
  setInterval(tick, TICK_MS);
  logger.info("webhook delivery worker started");
}
