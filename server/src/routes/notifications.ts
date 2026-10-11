import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middlewares/auth.js";
import { validateQuery } from "../middlewares/validate.js";
import { canauxDisponibles } from "../lib/notifications.js";

const router = Router();
router.use(requireAuth);

/**
 * Le centre de notifications.
 *
 * Tout ce que l'application a signalé à cette personne, le plus récent
 * d'abord, avec le compte de ce qui n'a pas été lu. C'est la cloche en haut à
 * droite qui s'en sert, et c'est la seule trace durable : le push s'efface et
 * le courriel se perd dans une boîte.
 */

const listeQuery = z.object({
  limite: z.coerce.number().int().min(1).max(100).optional(),
  /** true : seulement ce qui n'a pas été lu. */
  nonLues: z.coerce.boolean().optional(),
});

router.get("/", validateQuery(listeQuery), async (req, res) => {
  const q = req.query as unknown as z.infer<typeof listeQuery>;
  const userId = req.auth!.sub;

  const [notifications, nonLues] = await Promise.all([
    prisma.notification.findMany({
      where: { userId, ...(q.nonLues ? { lueLe: null } : {}) },
      orderBy: { creeLe: "desc" },
      take: q.limite ?? 30,
    }),
    prisma.notification.count({ where: { userId, lueLe: null } }),
  ]);

  res.json({ notifications, nonLues, canaux: canauxDisponibles() });
});

/** Marque une notification comme lue. */
router.put("/:id/lue", async (req, res) => {
  const { count } = await prisma.notification.updateMany({
    where: { id: req.params.id, userId: req.auth!.sub },
    data: { lueLe: new Date() },
  });
  res.json({ lues: count });
});

/** Marque tout comme lu : le geste qu'on fait en fermant la cloche. */
router.put("/lues", async (req, res) => {
  const { count } = await prisma.notification.updateMany({
    where: { userId: req.auth!.sub, lueLe: null },
    data: { lueLe: new Date() },
  });
  res.json({ lues: count });
});

/** Efface une notification : on range sa cloche comme sa boîte. */
router.delete("/:id", async (req, res) => {
  await prisma.notification.deleteMany({ where: { id: req.params.id, userId: req.auth!.sub } });
  res.status(204).end();
});

export default router;
