import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middlewares/auth.js";
import { validateBody } from "../middlewares/validate.js";
import { env } from "../lib/env.js";
import { pushEnabled, sendPushToUser } from "../lib/push.js";

const router = Router();

// Cle publique VAPID pour l'abonnement cote navigateur. PUBLIC.
router.get("/vapid", (_req, res) => {
  res.json({ publicKey: env.VAPID_PUBLIC_KEY ?? null, enabled: pushEnabled });
});

router.use(requireAuth);

const subSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

router.post("/subscribe", validateBody(subSchema), async (req, res) => {
  const { endpoint, keys } = req.body as z.infer<typeof subSchema>;
  const sub = await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId: req.auth!.sub, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    update: { userId: req.auth!.sub, p256dh: keys.p256dh, auth: keys.auth },
  });
  res.status(201).json({ id: sub.id });
});

const unsubSchema = z.object({ endpoint: z.string().min(1) });
router.post("/unsubscribe", validateBody(unsubSchema), async (req, res) => {
  const { endpoint } = req.body as z.infer<typeof unsubSchema>;
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: req.auth!.sub } });
  res.status(204).end();
});

router.post("/test", async (req, res) => {
  const sent = await sendPushToUser(req.auth!.sub, {
    title: "Diagly",
    body: "Notification de test reçue. Tout fonctionne.",
    url: "/app/dashboard",
    tag: "diagly-test",
  });
  res.json({ sent });
});

export default router;
