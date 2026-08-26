import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middlewares/auth.js";
import { validateBody } from "../middlewares/validate.js";
import { notFound } from "../lib/http-error.js";
import { mintApiKey } from "../lib/api-key.js";

// Gestion des clés d'API par le titulaire du compte (auth JWT). Le secret n'est renvoyé
// qu'une seule fois, à la création.
const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const keys = await prisma.apiKey.findMany({ where: { userId: req.auth!.sub }, orderBy: { createdAt: "desc" } });
  res.json({
    keys: keys.map((k) => ({
      id: k.id, name: k.name, keyPrefix: k.keyPrefix, scopes: k.scopes,
      lastUsedAt: k.lastUsedAt, revokedAt: k.revokedAt, createdAt: k.createdAt,
    })),
  });
});

const createSchema = z.object({ name: z.string().min(1).max(120) });
router.post("/", validateBody(createSchema), async (req, res) => {
  const { name } = req.body as z.infer<typeof createSchema>;
  const { key, tokenHash, keyPrefix } = mintApiKey();
  const row = await prisma.apiKey.create({
    data: { userId: req.auth!.sub, name, tokenHash, keyPrefix, scopes: ["read"] },
  });
  // `key` (plaintext) n'est renvoyé qu'ici, jamais stocké ni re-affiché.
  res.status(201).json({ id: row.id, name: row.name, keyPrefix, key, createdAt: row.createdAt });
});

// Révocation (soft : conserve la piste d'audit).
router.delete("/:id", async (req, res) => {
  const row = await prisma.apiKey.findFirst({ where: { id: req.params.id, userId: req.auth!.sub } });
  if (!row) throw notFound("Clé introuvable");
  await prisma.apiKey.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
  res.status(204).end();
});

export default router;
