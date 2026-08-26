import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

// Étend zod avec .openapi() — la spec OpenAPI est générée depuis ces schémas (jamais à la main).
extendZodWithOpenApi(z);

// ---- Query (filtres / pagination / tri) — partagés validation + OpenAPI ----
export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1).openapi({ description: "Page (1-indexée)" }),
  pageSize: z.coerce.number().int().min(1).max(100).default(20).openapi({ description: "Taille de page (max 100)" }),
});

export const diagnosticsQuery = paginationQuery.extend({
  status: z.enum(["NON_PLANIFIE", "PLANIFIE", "EN_COURS", "EN_REVUE", "TERMINE", "ARCHIVE"]).optional(),
  buildingType: z.string().max(30).optional().openapi({ description: "Type de bâtiment (LOGEMENT, VILLA, …)" }),
  canton: z.string().max(2).optional(),
  egid: z.string().max(20).optional().openapi({ description: "Filtre par EGID (registre GWR)" }),
  from: z.string().datetime().optional().openapi({ description: "Créé à partir de (ISO 8601)" }),
  to: z.string().datetime().optional().openapi({ description: "Créé jusqu'à (ISO 8601)" }),
  sort: z.enum(["createdAt", "-createdAt", "updatedAt", "-updatedAt", "name", "-name"]).default("-createdAt"),
});
export const buildingsQuery = paginationQuery.extend({
  buildingType: z.string().max(30).optional(),
  canton: z.string().max(2).optional(),
  egid: z.string().max(20).optional(),
  sort: z.enum(["createdAt", "-createdAt", "name", "-name"]).default("-createdAt"),
});

// ---- Réponses ----
export const PaginationSchema = z.object({
  page: z.number(), pageSize: z.number(), total: z.number(), totalPages: z.number(),
}).openapi("Pagination");

export const BuildingSchema = z.object({
  id: z.string(),
  egid: z.string().nullable().openapi({ description: "Identifiant fédéral du bâtiment (clé de jointure)" }),
  egrid: z.string().nullable(),
  parcelNumber: z.string().nullable(),
  name: z.string(),
  street: z.string().nullable(),
  number: z.string().nullable(),
  zip: z.string().nullable(),
  city: z.string(),
  canton: z.string(),
  east: z.number().nullable(),
  north: z.number().nullable(),
  buildingType: z.string(),
  yearBuilt: z.number().nullable(),
  nbApartments: z.number().nullable(),
  nbFloors: z.number().nullable(),
  builtArea: z.number().nullable(),
  floorArea: z.number().nullable(),
  sre: z.number().nullable(),
  energyClassGlobal: z.string().nullable(),
}).openapi("Building");

export const ElementSchema = z.object({
  cfcCode: z.string(),
  cfcLabel: z.string(),
  state: z.string().nullable().openapi({ description: "État : TRES_BON | BON | MOYEN | MAUVAIS" }),
  priority: z.string().nullable().openapi({ description: "Priorité : I | II | III" }),
  observation: z.string().nullable(),
  works: z.array(z.string()),
  area: z.number().nullable(),
  unit: z.string().nullable(),
  estimatedCost: z.number().nullable(),
  improvementCost: z.number().nullable(),
  normsCost: z.number().nullable(),
  interventionYear: z.number().openapi({ description: "Année d'intervention planifiée" }),
}).openapi("Element");

export const CostsSchema = z.object({
  htRepair: z.number(), htImprovement: z.number(), htNorms: z.number(), ht: z.number(),
  honoraryPct: z.number(), honoraires: z.number(), reservePct: z.number(), reserve: z.number(),
  sousTotal: z.number(), tvaPct: z.number(), tva: z.number(), total: z.number(),
  byPriority: z.array(z.object({ priority: z.string(), total: z.number(), count: z.number() })),
}).openapi("Costs");

export const WorkPlanLineSchema = z.object({
  egid: z.string().nullable(),
  cfcCode: z.string(),
  label: z.string(),
  interventionYear: z.number(),
  amount: z.number(),
  priority: z.string().nullable(),
}).openapi("WorkPlanLine");

export const VariantSchema = z.object({
  id: z.string(), name: z.string(), scope: z.string(), envelopes: z.array(z.string()), energyFocus: z.boolean(),
  ht: z.number(), honoraires: z.number(), reserve: z.number(), sousTotal: z.number(), tva: z.number(), total: z.number(),
}).openapi("Variant");

export const DiagnosticSchema = z.object({
  id: z.string(),
  egid: z.string().nullable(),
  status: z.string().nullable(),
  visitDate: z.string().nullable(),
  building: BuildingSchema,
  elements: z.array(ElementSchema),
  costs: CostsSchema,
  workPlan: z.array(WorkPlanLineSchema),
  variants: z.array(VariantSchema),
}).openapi("Diagnostic");

export const DiagnosticListItemSchema = z.object({
  id: z.string(),
  egid: z.string().nullable(),
  name: z.string(),
  status: z.string(),
  buildingType: z.string(),
  city: z.string(),
  canton: z.string(),
  floorArea: z.number().nullable(),
  total: z.number().nullable().openapi({ description: "Total TTC estimé (CHF)" }),
  createdAt: z.string(),
  updatedAt: z.string(),
}).openapi("DiagnosticListItem");

export const DiagnosticListSchema = z.object({ data: z.array(DiagnosticListItemSchema), pagination: PaginationSchema }).openapi("DiagnosticList");
export const BuildingListSchema = z.object({ data: z.array(BuildingSchema), pagination: PaginationSchema }).openapi("BuildingList");
export const ErrorSchema = z.object({ error: z.string() }).openapi("Error");
