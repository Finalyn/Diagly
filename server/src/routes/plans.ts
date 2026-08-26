import { Router } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { mkdirSync, existsSync, unlink } from "node:fs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middlewares/auth.js";
import { uploadLimiter } from "../middlewares/rate-limit.js";
import { validateQuery, validateBody } from "../middlewares/validate.js";
import { notFound, badRequest } from "../lib/http-error.js";
import { ownerScopeFor } from "../lib/org-context.js";
import { blockViewerWrites } from "../middlewares/org.js";
import { signUploadPath } from "../lib/file-token.js";

const router = Router();
router.use(requireAuth);
router.use(blockViewerWrites);

export const UPLOAD_DIR = join(process.cwd(), "uploads");
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

// L'extension du fichier stocke est DERIVEE du type MIME valide (jamais du nom fourni par
// le client) : empeche d'ecrire un fichier <uuid>.html servi ensuite en text/html (XSS stocke).
const EXT_BY_MIME: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};
const ALLOWED = Object.keys(EXT_BY_MIME);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => cb(null, `${randomUUID()}${EXT_BY_MIME[file.mimetype] ?? ""}`),
  }),
  limits: { fileSize: 30 * 1024 * 1024 }, // 30 Mo
  fileFilter: (_req, file, cb) => cb(null, ALLOWED.includes(file.mimetype)),
});

async function assertProjectOwned(projectId: string, ownerId: string) {
  const p = await prisma.project.findFirst({ where: { id: projectId, ...(await ownerScopeFor(ownerId)) } });
  if (!p) throw notFound("Project not found");
}

/** Ajoute l'URL signee du fichier : c'est le seul moyen d'y acceder depuis le navigateur. */
const withFileUrl = <T extends { fileName: string }>(plan: T) => ({ ...plan, fileUrl: signUploadPath(plan.fileName) });

const listQuery = z.object({ projectId: z.string().min(1) });

router.get("/", validateQuery(listQuery), async (req, res) => {
  const { projectId } = req.query as unknown as z.infer<typeof listQuery>;
  await assertProjectOwned(projectId, req.auth!.sub);
  const plans = await prisma.plan.findMany({ where: { projectId }, orderBy: { createdAt: "desc" } });
  res.json({ plans: plans.map(withFileUrl), count: plans.length });
});

router.post("/", uploadLimiter, upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) throw badRequest("Aucun fichier valide (PDF, PNG, JPG ou WEBP, 30 Mo max)");
  const projectId = String(req.body.projectId ?? "");
  if (!projectId) throw badRequest("projectId requis");
  await assertProjectOwned(projectId, req.auth!.sub);
  const name = String(req.body.name ?? "").trim() || file.originalname;
  const plan = await prisma.plan.create({
    data: { projectId, name, fileName: file.filename, mimeType: file.mimetype, size: file.size },
  });
  res.status(201).json({ plan: withFileUrl(plan) });
});

const updatePlanSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  scalePxPerM: z.number().positive().nullable().optional(),
  annotations: z.array(z.unknown()).optional(),
});

router.put("/:id", validateBody(updatePlanSchema), async (req, res) => {
  const plan = await prisma.plan.findFirst({
    where: { id: req.params.id, project: await ownerScopeFor(req.auth!.sub) },
  });
  if (!plan) throw notFound("Plan not found");
  const data = req.body as z.infer<typeof updatePlanSchema>;
  const updated = await prisma.plan.update({
    where: { id: plan.id },
    data: {
      name: data.name,
      scalePxPerM: data.scalePxPerM,
      annotations: data.annotations as object[] | undefined,
    },
  });
  res.json({ plan: withFileUrl(updated) });
});

router.delete("/:id", async (req, res) => {
  const plan = await prisma.plan.findFirst({
    where: { id: req.params.id, project: await ownerScopeFor(req.auth!.sub) },
  });
  if (!plan) throw notFound("Plan not found");
  await prisma.plan.delete({ where: { id: plan.id } });
  unlink(join(UPLOAD_DIR, plan.fileName), () => undefined); // best-effort
  res.status(204).end();
});

export default router;
