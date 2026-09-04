// Couche de sérialisation canonique d'un diagnostic — SOURCE UNIQUE partagée par
// l'export (Excel/CSV/JSON) et la future API REST. Ne produit que des données
// normalisées (aucune mise en forme). La logique de coûts, jusqu'ici dupliquée
// dans le front (ProjectRapports/ProjectMetres) et share.ts, est centralisée ici.

import { prisma } from "./prisma.js";
import { notFound } from "./http-error.js";
import { ownerScopeFor } from "./org-context.js";
import { marketCoeff } from "./market.js";

const TVA_PCT = 8.1;
const num = (v: unknown) => (v == null ? 0 : Number(v));

export type PriorityCode = "I" | "II" | "III";

/** Année d'intervention déduite de la priorité quand elle n'est pas saisie. */
export function deriveInterventionYear(priority: PriorityCode | null, baseYear: number): number {
  switch (priority) {
    case "I": return baseYear;       // urgent : immédiat
    case "II": return baseYear + 3;  // à moyen terme
    case "III": return baseYear + 7; // à long terme
    default: return baseYear + 5;    // non priorisé : horizon neutre
  }
}

export interface CostCascade {
  ht: number;
  honoraires: number;
  reserve: number;
  sousTotal: number;
  tva: number;
  total: number;
}

/** Cascade honoraires -> réserve (composée) -> TVA sur un montant HT. */
function cascade(ht: number, honoraryPct: number, reservePct: number): CostCascade {
  const honoraires = (ht * honoraryPct) / 100;
  const afterH = ht + honoraires;
  const reserve = (afterH * reservePct) / 100;
  const sousTotal = afterH + reserve;
  const tva = (sousTotal * TVA_PCT) / 100;
  return { ht, honoraires, reserve, sousTotal, tva, total: sousTotal + tva };
}

export interface CostTotals {
  htRepair: number;
  htImprovement: number;
  htNorms: number;
  ht: number;
  honoraryPct: number;
  honoraires: number;
  reservePct: number;
  reserve: number;
  sousTotal: number;
  tvaPct: number;
  tva: number;
  total: number;
  byPriority: { priority: PriorityCode; total: number; count: number }[];
}

/** Une variante de rénovation (scénario) : périmètre cumulatif + cascade de coûts. */
export interface ExportVariant extends CostCascade {
  id: "maintenance" | "renovation" | "energetique";
  name: string;
  scope: string;
  envelopes: string[]; // enveloppes incluses (Réparation / Amélioration / Remise aux normes)
  energyFocus: boolean; // scénario à visée énergétique (isolation / mise aux normes)
}

/** Coefficient marché (indice OFS des prix de la construction), pour les estimations de scénarios. */
const MARKET_COEFF = marketCoeff();

export interface ScenarioPacks {
  improvementPack: number; // rénovation intérieure estimée (finitions, confort) — depuis la surface de plancher
  energyPack: number; // isolation de l'enveloppe estimée — depuis façade / fenêtres / toiture
}

interface GeomLike {
  perimeter?: number | null; nbFloors?: number | null; floorHeight?: number | null;
  facadeArea?: number | null; windowPct?: number | null; roofType?: string | null;
  builtArea?: number | null; floorArea?: number | null;
}

/**
 * Estime les enveloppes de scénario à partir de la GÉOMÉTRIE du bâtiment (fiable, toujours disponible),
 * indépendamment des coûts par élément. Rénovation intérieure ≈ surface de plancher ; isolation ≈ enveloppe.
 */
export function computeScenarioPacks(p: GeomLike): ScenarioPacks {
  const perimeter = p.perimeter ?? 0;
  const nbFloors = p.nbFloors ?? 1;
  const fh = p.floorHeight ?? 2.7;
  const facade = p.facadeArea ?? (perimeter > 0 ? perimeter * nbFloors * fh : 0);
  const winPct = (p.windowPct ?? 30) / 100;
  const window = facade * winPct;
  const opaque = Math.max(facade - window, 0);
  const roofMult = p.roofType === "PENTE" ? 1.3 : p.roofType === "MIXTE" ? 1.15 : 1.0;
  const roof = (p.builtArea ?? 0) * roofMult;
  const floor = p.floorArea ?? 0;
  return {
    improvementPack: Math.round(floor * 120 * MARKET_COEFF), // rénovation intérieure CHF/m² plancher
    energyPack: Math.round((opaque * 220 + window * 250 + roof * 180) * MARKET_COEFF), // ITE + triple vitrage + toiture
  };
}

/**
 * 3 scénarios de rénovation cumulatifs : V1 Maintenance = réparation diagnostiquée ;
 * V2 Rénovation = + rénovation intérieure estimée ; V3 Énergétique = + isolation de l'enveloppe estimée.
 * Les enveloppes V2/V3 sont modélisées depuis la géométrie (indépendantes des coûts par élément).
 */
export function computeVariants(c: CostTotals, packs: ScenarioPacks): ExportVariant[] {
  const h = c.honoraryPct;
  const r = c.reservePct;
  const base = c.htRepair;
  return [
    {
      id: "maintenance",
      name: "Maintenance",
      scope: "Réparation des éléments dégradés — maintien en état, strict minimum.",
      envelopes: ["Réparation"],
      energyFocus: false,
      ...cascade(base, h, r),
    },
    {
      id: "renovation",
      name: "Rénovation",
      scope: "Réparation + rénovation intérieure estimée (finitions, confort, valeur d'usage).",
      envelopes: ["Réparation", "Rénovation intérieure"],
      energyFocus: false,
      ...cascade(base + packs.improvementPack, h, r),
    },
    {
      id: "energetique",
      name: "Rénovation énergétique",
      scope: "Réparation + rénovation intérieure + isolation de l'enveloppe estimée (façade, fenêtres, toiture).",
      envelopes: ["Réparation", "Rénovation intérieure", "Isolation enveloppe"],
      energyFocus: true,
      ...cascade(base + packs.improvementPack + packs.energyPack, h, r),
    },
  ];
}

interface ItemLike {
  estimatedCost?: unknown;
  improvementCost?: unknown;
  normsCost?: unknown;
  priority?: PriorityCode | null;
}

/**
 * Coûts d'un diagnostic (3 enveloppes + honoraires/réserve/TVA + par priorité).
 * Réserve composée sur (ht + honoraires) ; total = sousTotal × (1 + TVA).
 */
export function computeCostTotals(
  items: ItemLike[],
  project: { honoraryPct?: number | null; reservePct?: number | null },
): CostTotals {
  const htRepair = items.reduce((s, i) => s + num(i.estimatedCost), 0);
  const htImprovement = items.reduce((s, i) => s + num(i.improvementCost), 0);
  const htNorms = items.reduce((s, i) => s + num(i.normsCost), 0);
  const ht = htRepair + htImprovement + htNorms;
  const honoraryPct = project.honoraryPct ?? 0;
  const reservePct = project.reservePct ?? 0;
  const { honoraires, reserve, sousTotal, tva, total } = cascade(ht, honoraryPct, reservePct);
  const byPriority = (["I", "II", "III"] as const).map((priority) => ({
    priority,
    total: items
      .filter((i) => i.priority === priority)
      .reduce((s, i) => s + num(i.estimatedCost) + num(i.improvementCost) + num(i.normsCost), 0),
    count: items.filter((i) => i.priority === priority).length,
  }));
  return { htRepair, htImprovement, htNorms, ht, honoraryPct, honoraires, reservePct, reserve, sousTotal, tvaPct: TVA_PCT, tva, total, byPriority };
}

// ---- Forme canonique de l'export (= futur payload API) ----

export interface ExportBuilding {
  egid: string | null;
  egrid: string | null;
  externalObjectNo: string | null; // passthrough n° d'objet ERP (jointure secondaire)
  parcelNumber: string | null;
  name: string;
  street: string | null;
  number: string | null;
  zip: string | null;
  city: string;
  canton: string;
  east: number | null;
  north: number | null;
  buildingType: string;
  yearBuilt: number | null;
  renovationYear: number | null;
  nbApartments: number | null;
  nbFloors: number | null;
  builtArea: number | null;
  floorArea: number | null;
  sre: number | null;
  energyClassEnvelope: string | null;
  energyClassGlobal: string | null;
}

export interface ExportItem {
  cfcCode: string;
  cfcLabel: string;
  category: string | null;
  state: string | null;
  priority: PriorityCode | null;
  observation: string | null;
  works: string[];
  area: number | null;
  unit: string | null;
  estimatedCost: number | null;
  improvement: string | null;
  improvementCost: number | null;
  norms: string | null;
  normsCost: number | null;
  interventionYear: number;
}

export interface ExportWorkPlanLine {
  egid: string | null;
  cfcCode: string;
  label: string;
  interventionYear: number;
  amount: number;
  priority: PriorityCode | null;
}

export interface DiagnosticExport {
  meta: {
    exportVersion: string;
    generatedAt: string;
    reportVersion: string;
    author: string | null;
    diagnosticDate: string | null;
    status: string | null;
    baseYear: number;
  };
  building: ExportBuilding;
  items: ExportItem[];
  workPlan: ExportWorkPlanLine[];
  costs: CostTotals;
  /** Classe énergétique actuelle du bâtiment (référence pour l'axe énergétique des variantes). */
  energy: { classEnvelope: string | null; classGlobal: string | null };
  /** 3 scénarios de rénovation comparés. */
  variants: ExportVariant[];
}

// Sépare "Rue 12" en { street: "Rue", number: "12" } (heuristique, tolérante).
function splitAddress(address: string | null): { street: string | null; number: string | null } {
  if (!address) return { street: null, number: null };
  const m = address.match(/^(.*?)[\s,]+(\d+[a-zA-Z]?)$/);
  if (m) return { street: m[1].trim(), number: m[2].trim() };
  return { street: address.trim(), number: null };
}

/**
 * Construit la représentation canonique d'un diagnostic pour un projet donné.
 * Vérifie la propriété (ownerId). Prend le diagnostic le plus récent.
 */
export async function buildDiagnosticExport(projectId: string, ownerId: string): Promise<DiagnosticExport> {
  const project = await prisma.project.findFirst({ where: { id: projectId, ...(await ownerScopeFor(ownerId)) } });
  if (!project) throw notFound("Projet introuvable");

  const diagnostic = await prisma.diagnostic.findFirst({
    where: { projectId: project.id },
    orderBy: { createdAt: "desc" },
  });
  const rawItems = diagnostic
    ? await prisma.diagnosticItem.findMany({ where: { diagnosticId: diagnostic.id }, orderBy: { cfcCode: "asc" } })
    : [];

  const owner = await prisma.user.findUnique({ where: { id: ownerId } });
  const prefs = (owner?.preferences as Record<string, unknown>) ?? {};
  const company = (prefs.company as Record<string, unknown> | undefined) ?? undefined;
  const author =
    (company?.name as string | undefined) ||
    [owner?.firstName, owner?.lastName].filter(Boolean).join(" ") ||
    owner?.email ||
    null;

  const baseYear = (diagnostic?.visitDate ? new Date(diagnostic.visitDate) : new Date()).getFullYear();
  const { street, number } = splitAddress(project.address);
  const geo = (project.geoData as Record<string, unknown> | null) ?? null;

  const items: ExportItem[] = rawItems.map((it) => ({
    cfcCode: it.cfcCode,
    cfcLabel: it.cfcLabel,
    category: null,
    state: it.state,
    priority: (it.priority as PriorityCode | null) ?? null,
    observation: it.notes ?? null,
    works: Array.isArray(it.works) ? (it.works as string[]) : [],
    area: it.area ?? null,
    unit: it.unit ?? null,
    estimatedCost: it.estimatedCost == null ? null : Number(it.estimatedCost),
    improvement: it.improvement ?? null,
    improvementCost: it.improvementCost == null ? null : Number(it.improvementCost),
    norms: it.norms ?? null,
    normsCost: it.normsCost == null ? null : Number(it.normsCost),
    interventionYear: it.interventionYear ?? deriveInterventionYear((it.priority as PriorityCode | null) ?? null, baseYear),
  }));

  // Plan de travaux : une ligne par élément chiffré (réparation), trié par année puis priorité.
  const prioRank: Record<string, number> = { I: 0, II: 1, III: 2 };
  const workPlan: ExportWorkPlanLine[] = items
    .filter((i) => num(i.estimatedCost) + num(i.improvementCost) + num(i.normsCost) > 0)
    .map((i) => ({
      egid: project.egid ?? null,
      cfcCode: i.cfcCode,
      label: i.cfcLabel,
      interventionYear: i.interventionYear,
      amount: num(i.estimatedCost) + num(i.improvementCost) + num(i.normsCost),
      priority: i.priority,
    }))
    .sort((a, b) => a.interventionYear - b.interventionYear || (prioRank[a.priority ?? "III"] - prioRank[b.priority ?? "III"]));

  const building: ExportBuilding = {
    egid: project.egid ?? null,
    egrid: project.egrid ?? null,
    externalObjectNo: (geo?.externalObjectNo as string | undefined) ?? null,
    parcelNumber: project.parcelNumber ?? null,
    name: project.name,
    street,
    number,
    zip: project.postalCode ?? null,
    city: project.city,
    canton: project.canton,
    east: project.east ?? null,
    north: project.north ?? null,
    buildingType: project.buildingType,
    yearBuilt: project.yearBuilt ?? null,
    renovationYear: project.renovationYear ?? null,
    nbApartments: project.nbApartments ?? null,
    nbFloors: project.nbFloors ?? null,
    builtArea: project.builtArea ?? null,
    floorArea: project.floorArea ?? null,
    sre: project.sre ?? null,
    energyClassEnvelope: project.energyClassEnvelope ?? null,
    energyClassGlobal: project.energyClassGlobal ?? null,
  };

  const costs = computeCostTotals(rawItems as ItemLike[], project);

  return {
    meta: {
      exportVersion: "1.0",
      generatedAt: new Date().toISOString(),
      reportVersion: diagnostic ? `d${diagnostic.updatedAt.getFullYear()}.${diagnostic.updatedAt.getMonth() + 1}` : "1",
      author,
      diagnosticDate: diagnostic?.visitDate ? new Date(diagnostic.visitDate).toISOString().slice(0, 10) : null,
      status: diagnostic?.status ?? null,
      baseYear,
    },
    building,
    items,
    workPlan,
    costs,
    energy: { classEnvelope: project.energyClassEnvelope ?? null, classGlobal: project.energyClassGlobal ?? null },
    variants: computeVariants(costs, computeScenarioPacks(project)),
  };
}
