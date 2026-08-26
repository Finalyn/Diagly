import { Router } from "express";
import type { Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middlewares/auth.js";
import { validateQuery, validateBody } from "../middlewares/validate.js";
import { badRequest } from "../lib/http-error.js";
import { buildDiagnosticExport, type DiagnosticExport } from "../lib/diagnostic-export.js";
import { fireEvent } from "../lib/webhook.js";
import { applyTemplate, resolveTemplate, DEFAULT_TEMPLATE, type ExportTemplate } from "../lib/export-template.js";
import { toCsv, toXlsx } from "../lib/export-formats.js";

// Export structuré d'un diagnostic. La sérialisation (buildDiagnosticExport) est la
// même couche que la future API ; ici on ajoute la projection (mapping) et les formats.
// GET  : format via query, modèle enregistré/par défaut (résolu depuis les préférences).
// POST : idem mais accepte un modèle EN LIGNE (édition de colonnes non enregistrée).
const router = Router();
router.use(requireAuth);

function slug(s: string) {
  return (
    (s || "diagnostic").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "diagnostic"
  );
}
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

async function emit(
  res: Response,
  payload: DiagnosticExport,
  format: "json" | "csv" | "xlsx",
  template: ExportTemplate,
  sheet: "building" | "items" | "workplan" | undefined,
) {
  const base = `diagly-${slug(payload.building.name)}-${payload.meta.generatedAt.slice(0, 10)}`;
  if (format === "json") {
    res.json(payload);
    return;
  }
  const sheets = applyTemplate(payload, template);
  if (format === "csv") {
    const wanted = sheet ?? "items";
    const data = sheets.find((s) => s.id === wanted);
    if (!data) throw badRequest("Onglet inconnu");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${base}-${wanted}.csv"`);
    res.send(toCsv(data));
    return;
  }
  const buffer = await toXlsx(payload, sheets);
  res.setHeader("Content-Type", XLSX_MIME);
  res.setHeader("Content-Disposition", `attachment; filename="${base}.xlsx"`);
  res.send(buffer);
}

async function templateFromPrefs(userId: string, templateId: string | undefined) {
  const owner = await prisma.user.findUnique({ where: { id: userId } });
  const prefs = (owner?.preferences as Record<string, unknown>) ?? {};
  return resolveTemplate(prefs, templateId);
}

// Modèle standard livré par défaut (base éditable pour la personnalisation côté client).
router.get("/default-template", (_req, res) => {
  res.json({ template: DEFAULT_TEMPLATE });
});

const exportQuery = z.object({
  format: z.enum(["json", "csv", "xlsx"]).default("json"),
  template: z.string().max(100).optional(),
  sheet: z.enum(["building", "items", "workplan"]).optional(),
});

router.get("/projects/:id", validateQuery(exportQuery), async (req, res) => {
  const q = req.query as unknown as z.infer<typeof exportQuery>;
  const payload = await buildDiagnosticExport(req.params.id, req.auth!.sub); // vérifie la propriété
  const template = q.format === "json" ? DEFAULT_TEMPLATE : await templateFromPrefs(req.auth!.sub, q.template);
  if (q.format !== "json") fireEvent(req.auth!.sub, "rapport.genere", { projectId: req.params.id, egid: payload.building.egid, kind: "export", format: q.format });
  await emit(res, payload, q.format, template, q.sheet);
});

// Modèle en ligne (édition non enregistrée) — validation permissive : ce sont les données du compte.
const columnSchema = z.object({ key: z.string().max(60), label: z.string().max(120), active: z.boolean() });
const sheetSchema = z.object({
  id: z.enum(["building", "items", "workplan"]),
  title: z.string().max(120),
  columns: z.array(columnSchema).max(80),
});
const templateSchema = z.object({ id: z.string().max(100), name: z.string().max(120), sheets: z.array(sheetSchema).max(10) });
const postBody = z.object({
  format: z.enum(["json", "csv", "xlsx"]),
  sheet: z.enum(["building", "items", "workplan"]).optional(),
  template: templateSchema.optional(),
  templateId: z.string().max(100).optional(),
});

router.post("/projects/:id", validateBody(postBody), async (req, res) => {
  const b = req.body as z.infer<typeof postBody>;
  const payload = await buildDiagnosticExport(req.params.id, req.auth!.sub);
  const template = b.template ?? (await templateFromPrefs(req.auth!.sub, b.templateId));
  if (b.format !== "json") fireEvent(req.auth!.sub, "rapport.genere", { projectId: req.params.id, egid: payload.building.egid, kind: "export", format: b.format });
  await emit(res, payload, b.format, template, b.sheet);
});

export default router;
