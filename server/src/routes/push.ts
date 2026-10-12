import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middlewares/auth.js";
import { validateBody } from "../middlewares/validate.js";
import { env } from "../lib/env.js";
import { pushEnabled, sendPushToUser } from "../lib/push.js";
import { cleAppleConfiguree } from "../lib/apple.js";

const router = Router();

// Cle publique VAPID pour l'abonnement cote navigateur. PUBLIC.
router.get("/vapid", (_req, res) => {
  // `ios` : l'app iPhone/iPad peut recevoir des notifications (clé APNs configurée).
  res.json({ publicKey: env.VAPID_PUBLIC_KEY ?? null, enabled: pushEnabled, ios: cleAppleConfiguree() });
});

router.use(requireAuth);

const subSchema = z.object({
  endpoint: z.string().url().max(500), // = taille de la colonne, evite une erreur Prisma
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
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

const unsubSchema = z.object({ endpoint: z.string().min(1).max(500) });
router.post("/unsubscribe", validateBody(unsubSchema), async (req, res) => {
  const { endpoint } = req.body as z.infer<typeof unsubSchema>;
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: req.auth!.sub } });
  res.status(204).end();
});

// L'app iPhone/iPad enregistre son jeton APNs (à chaque démarrage : il peut changer).
const appareilSchema = z.object({ jeton: z.string().regex(/^[0-9a-fA-F]{32,200}$/) });
router.post("/appareil", validateBody(appareilSchema), async (req, res) => {
  const { jeton } = req.body as z.infer<typeof appareilSchema>;
  // Un même téléphone passé à un autre compte : le jeton change de propriétaire.
  await prisma.appareilPush.upsert({
    where: { jeton },
    create: { userId: req.auth!.sub, jeton },
    update: { userId: req.auth!.sub, vuLe: new Date() },
  });
  res.status(204).end();
});

// Déconnexion, ou notifications coupées dans l'app : l'appareil ne reçoit plus rien.
router.post("/appareil/retirer", validateBody(appareilSchema), async (req, res) => {
  const { jeton } = req.body as z.infer<typeof appareilSchema>;
  await prisma.appareilPush.deleteMany({ where: { jeton, userId: req.auth!.sub } });
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
