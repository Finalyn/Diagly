import { OpenAPIRegistry, OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import * as S from "../routes/v1/schemas.js";

// Génère le document OpenAPI 3 DEPUIS les schémas zod (jamais maintenu à la main).
export function buildOpenApiDocument() {
  const registry = new OpenAPIRegistry();

  registry.registerComponent("securitySchemes", "ApiKeyAuth", {
    type: "http", scheme: "bearer", bearerFormat: "dgly_live_...",
    description: "Clé d'API du compte. En-tête `Authorization: Bearer dgly_live_...` (ou `X-API-Key`).",
  });

  // Composants (schémas réutilisables)
  registry.register("Pagination", S.PaginationSchema);
  registry.register("Building", S.BuildingSchema);
  registry.register("Element", S.ElementSchema);
  registry.register("Costs", S.CostsSchema);
  registry.register("WorkPlanLine", S.WorkPlanLineSchema);
  registry.register("Variant", S.VariantSchema);
  registry.register("Diagnostic", S.DiagnosticSchema);
  registry.register("DiagnosticListItem", S.DiagnosticListItemSchema);
  registry.register("Error", S.ErrorSchema);

  const json = (schema: z.ZodTypeAny) => ({ content: { "application/json": { schema } } });
  const idParam = z.object({ id: z.string().openapi({ param: { name: "id", in: "path" }, description: "Identifiant de la ressource" }) });
  const errs = {
    401: { description: "Clé d'API manquante, invalide ou révoquée", ...json(S.ErrorSchema) },
    404: { description: "Ressource introuvable", ...json(S.ErrorSchema) },
    429: { description: "Quota de la clé dépassé", ...json(S.ErrorSchema) },
  };

  registry.registerPath({
    method: "get", path: "/diagnostics", tags: ["Diagnostics"], summary: "Liste des diagnostics",
    request: { query: S.diagnosticsQuery },
    responses: { 200: { description: "Liste paginée", ...json(S.DiagnosticListSchema) }, 401: errs[401], 429: errs[429] },
  });
  registry.registerPath({
    method: "get", path: "/diagnostics/{id}", tags: ["Diagnostics"], summary: "Détail d'un diagnostic",
    request: { params: idParam },
    responses: { 200: { description: "Diagnostic complet", ...json(S.DiagnosticSchema) }, ...errs },
  });
  registry.registerPath({
    method: "get", path: "/diagnostics/{id}/elements", tags: ["Diagnostics"], summary: "Éléments d'un diagnostic",
    request: { params: idParam },
    responses: { 200: { description: "Éléments (CFC, état, priorité, coûts)", ...json(z.object({ diagnosticId: z.string(), egid: z.string().nullable(), data: z.array(S.ElementSchema) })) }, ...errs },
  });
  registry.registerPath({
    method: "get", path: "/diagnostics/{id}/costs", tags: ["Diagnostics"], summary: "Chiffrage d'un diagnostic",
    request: { params: idParam },
    responses: { 200: { description: "Coûts + variantes", ...json(z.object({ diagnosticId: z.string(), egid: z.string().nullable(), costs: S.CostsSchema, variants: z.array(S.VariantSchema) })) }, ...errs },
  });
  registry.registerPath({
    method: "get", path: "/diagnostics/{id}/work-plan", tags: ["Diagnostics"], summary: "Plan de travaux par année",
    request: { params: idParam },
    responses: { 200: { description: "Lignes du plan de travaux", ...json(z.object({ diagnosticId: z.string(), egid: z.string().nullable(), data: z.array(S.WorkPlanLineSchema) })) }, ...errs },
  });
  registry.registerPath({
    method: "get", path: "/buildings", tags: ["Bâtiments"], summary: "Liste des bâtiments",
    request: { query: S.buildingsQuery },
    responses: { 200: { description: "Liste paginée", ...json(S.BuildingListSchema) }, 401: errs[401], 429: errs[429] },
  });
  registry.registerPath({
    method: "get", path: "/buildings/{id}", tags: ["Bâtiments"], summary: "Détail d'un bâtiment",
    request: { params: idParam },
    responses: { 200: { description: "Identification (EGID, adresse, géométrie)", ...json(S.BuildingSchema) }, ...errs },
  });

  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument({
    openapi: "3.0.0",
    info: {
      title: "Diagly API",
      version: "1.0.0",
      description: "API REST publique (lecture seule) des diagnostics bâtiment Diagly. EGID = clé de jointure universelle avec les systèmes immobiliers suisses.",
    },
    servers: [{ url: "/api/v1" }],
    security: [{ ApiKeyAuth: [] }],
  });
}
