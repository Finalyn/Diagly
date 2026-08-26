import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middlewares/auth.js";
import { validateBody } from "../middlewares/validate.js";
import { badRequest, notFound } from "../lib/http-error.js";
import { WEBHOOK_EVENTS, newWebhookSecret } from "../lib/webhook.js";
import { assertPublicHttpUrl, UnsafeUrlError } from "../lib/safe-url.js";

/** Refuse les URL qui feraient appeler le reseau interne par le serveur (SSRF). */
async function assertDeliverableUrl(url: string) {
  try {
    await assertPublicHttpUrl(url);
  } catch (e) {
    if (e instanceof UnsafeUrlError) throw badRequest(e.message);
    throw e;
  }
}

// Gestion des endpoints webhook par le titulaire du compte (auth JWT).
const router = Router();
router.use(requireAuth);

const eventEnum = z.enum(WEBHOOK_EVENTS);
const urlSchema = z.string().url().max(500).refine((u) => /^https?:\/\//.test(u), "URL http(s) requise");
const createSchema = z.object({
  url: urlSchema,
  events: z.array(eventEnum).min(1),
  description: z.string().max(255).optional(),
});
const updateSchema = z.object({
  url: urlSchema.optional(),
  events: z.array(eventEnum).min(1).optional(),
  active: z.boolean().optional(),
  description: z.string().max(255).nullable().optional(),
});

router.get("/events", (_req, res) => res.json({ events: WEBHOOK_EVENTS }));

router.get("/", async (req, res) => {
  const endpoints = await prisma.webhookEndpoint.findMany({ where: { userId: req.auth!.sub }, orderBy: { createdAt: "desc" } });
  res.json({ endpoints });
});

router.post("/", validateBody(createSchema), async (req, res) => {
  const data = req.body as z.infer<typeof createSchema>;
  await assertDeliverableUrl(data.url);
  const endpoint = await prisma.webhookEndpoint.create({
    data: { userId: req.auth!.sub, url: data.url, events: data.events, description: data.description, secret: newWebhookSecret() },
  });
  res.status(201).json({ endpoint });
});

async function loadOwned(id: string, userId: string) {
  const ep = await prisma.webhookEndpoint.findFirst({ where: { id, userId } });
  if (!ep) throw notFound("Endpoint introuvable");
  return ep;
}

router.put("/:id", validateBody(updateSchema), async (req, res) => {
  await loadOwned(req.params.id, req.auth!.sub);
  const data = req.body as z.infer<typeof updateSchema>;
  if (data.url) await assertDeliverableUrl(data.url);
  const endpoint = await prisma.webhookEndpoint.update({ where: { id: req.params.id }, data });
  res.json({ endpoint });
});

router.delete("/:id", async (req, res) => {
  await loadOwned(req.params.id, req.auth!.sub);
  await prisma.webhookEndpoint.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

router.post("/:id/rotate-secret", async (req, res) => {
  await loadOwned(req.params.id, req.auth!.sub);
  const endpoint = await prisma.webhookEndpoint.update({ where: { id: req.params.id }, data: { secret: newWebhookSecret() } });
  res.json({ endpoint });
});

// Envoi d'un événement de test (ping) immédiat.
router.post("/:id/test", async (req, res) => {
  const ep = await loadOwned(req.params.id, req.auth!.sub);
  await prisma.webhookDelivery.create({
    data: {
      endpointId: ep.id, userId: req.auth!.sub, eventType: "webhook.test",
      payload: { id: `evt_test_${Date.now()}`, event: "webhook.test", occurredAt: new Date().toISOString(), data: { message: "Ping de test Diagly" } },
      nextAttemptAt: new Date(),
    },
  });
  res.status(202).json({ ok: true });
});

// Journal des livraisons d'un endpoint.
router.get("/:id/deliveries", async (req, res) => {
  await loadOwned(req.params.id, req.auth!.sub);
  const deliveries = await prisma.webhookDelivery.findMany({
    where: { endpointId: req.params.id }, orderBy: { createdAt: "desc" }, take: 50,
  });
  res.json({ deliveries });
});

// Rejeu d'une livraison (recrée une tentative immédiate).
router.post("/deliveries/:deliveryId/replay", async (req, res) => {
  const d = await prisma.webhookDelivery.findFirst({ where: { id: req.params.deliveryId, userId: req.auth!.sub } });
  if (!d) throw notFound("Livraison introuvable");
  const replay = await prisma.webhookDelivery.create({
    data: { endpointId: d.endpointId, userId: d.userId, eventType: d.eventType, payload: d.payload as object, nextAttemptAt: new Date() },
  });
  res.status(202).json({ delivery: replay });
});

export default router;
