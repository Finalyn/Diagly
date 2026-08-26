// Couche d'agrégation PORTEFEUILLE (owner-scoped) — partagée par l'API REST /v1/portfolio
// ET le serveur MCP. Répond aux questions à l'échelle des diagnostics sans rapatrier tout le détail :
// compteurs et totaux calculés côté serveur.
import { prisma } from "./prisma.js";
import { deriveInterventionYear, type PriorityCode } from "./diagnostic-export.js";
import { ownerScopeFor } from "./org-context.js";

const num = (v: unknown) => (v == null ? 0 : Number(v));
/** Budget d'un élément = somme des 3 enveloppes (réparation + amélioration + remise aux normes). */
const itemAmount = (i: RawItem) => num(i.estimatedCost) + num(i.improvementCost) + num(i.normsCost);

interface RawItem {
  cfcCode: string; cfcLabel: string; state: string | null; priority: string | null;
  estimatedCost: unknown; improvementCost: unknown; normsCost: unknown;
  interventionYear: number | null; notes: string | null; updatedAt: Date;
  diagnostic: { visitDate: Date | null; project: { id: string; name: string; canton: string; city: string; buildingType: string; egid: string | null; status: string } };
}

export interface ElementFilters {
  cfc?: string; state?: string; priority?: string; canton?: string; buildingType?: string;
  interventionYear?: number; egid?: string;
}

/** Charge les éléments des diagnostics du propriétaire (une requête), avec le contexte bâtiment. */
async function loadItems(ownerId: string): Promise<RawItem[]> {
  return prisma.diagnosticItem.findMany({
    where: { diagnostic: { project: { ...(await ownerScopeFor(ownerId)), operationId: null } } },
    select: {
      cfcCode: true, cfcLabel: true, state: true, priority: true,
      estimatedCost: true, improvementCost: true, normsCost: true,
      interventionYear: true, notes: true, updatedAt: true,
      diagnostic: { select: { visitDate: true, project: { select: { id: true, name: true, canton: true, city: true, buildingType: true, egid: true, status: true } } } },
    },
  }) as unknown as Promise<RawItem[]>;
}

const resolvedYear = (i: RawItem): number =>
  i.interventionYear ?? deriveInterventionYear((i.priority as PriorityCode | null) ?? null, (i.diagnostic.visitDate ? new Date(i.diagnostic.visitDate) : new Date()).getFullYear());

function matches(i: RawItem, f: ElementFilters): boolean {
  if (f.cfc && !i.cfcCode.startsWith(f.cfc)) return false;
  if (f.state && i.state !== f.state) return false;
  if (f.priority && i.priority !== f.priority) return false;
  if (f.canton && i.diagnostic.project.canton !== f.canton) return false;
  if (f.buildingType && i.diagnostic.project.buildingType !== f.buildingType) return false;
  if (f.egid && i.diagnostic.project.egid !== f.egid) return false;
  if (f.interventionYear != null && resolvedYear(i) !== f.interventionYear) return false;
  return true;
}

/** Recherche/liste des diagnostics (texte + filtres). */
export async function searchDiagnostics(
  ownerId: string,
  f: { query?: string; buildingType?: string; status?: string; canton?: string; egid?: string } = {},
  limit = 25,
) {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const where: any = { ...(await ownerScopeFor(ownerId)), operationId: null };
  if (f.buildingType) where.buildingType = f.buildingType;
  if (f.status) where.status = f.status;
  if (f.canton) where.canton = f.canton;
  if (f.egid) where.egid = f.egid;
  if (f.query) where.OR = [{ name: { contains: f.query } }, { city: { contains: f.query } }, { address: { contains: f.query } }];
  const projects = await prisma.project.findMany({ where, orderBy: { updatedAt: "desc" }, take: limit });
  return projects.map((p) => ({
    id: p.id, egid: p.egid ?? null, name: p.name, canton: p.canton, city: p.city,
    buildingType: p.buildingType, status: p.status, floorArea: p.floorArea ?? null,
  }));
}

/** Résumé de haut niveau des diagnostics — point d'entrée pour le raisonnement de l'assistant. */
export async function portfolioSummary(ownerId: string) {
  const [buildings, items] = await Promise.all([
    prisma.project.findMany({ where: { ...(await ownerScopeFor(ownerId)), operationId: null }, select: { canton: true, buildingType: true } }),
    loadItems(ownerId),
  ]);
  const byPriority = (["I", "II", "III"] as const).map((p) => {
    const list = items.filter((i) => i.priority === p);
    return { priority: p, count: list.length, budget: Math.round(list.reduce((s, i) => s + itemAmount(i), 0)) };
  });
  const byState = ["TRES_BON", "BON", "MOYEN", "MAUVAIS"].map((st) => ({ state: st, count: items.filter((i) => i.state === st).length }));
  const cantons = [...new Set(buildings.map((b) => b.canton))].sort();
  return {
    buildings: buildings.length,
    cantons,
    elements: items.length,
    totalPlannedBudget: Math.round(items.reduce((s, i) => s + itemAmount(i), 0)),
    byPriority,
    byState,
    note: "Budgets = somme des enveloppes réparation + amélioration + remise aux normes (planifié, hors honoraires/réserve/TVA). Les coûts réels ne sont pas encore suivis.",
  };
}

/**
 * Interroge les éléments des diagnostics par CFC / état / priorité / canton / année. Renvoie les compteurs
 * et le budget agrégés + un échantillon d'éléments (pour éviter de rapatrier tous les diagnostics).
 */
export async function queryElements(ownerId: string, f: ElementFilters, limit = 50) {
  const items = (await loadItems(ownerId)).filter((i) => matches(i, f));
  const buildings = new Set(items.map((i) => i.diagnostic.project.id));
  return {
    matched: items.length,
    buildingsConcerned: buildings.size,
    totalBudget: Math.round(items.reduce((s, i) => s + itemAmount(i), 0)),
    byPriority: (["I", "II", "III"] as const).map((p) => ({ priority: p, count: items.filter((i) => i.priority === p).length })),
    sample: items.slice(0, limit).map((i) => ({
      egid: i.diagnostic.project.egid, building: i.diagnostic.project.name, canton: i.diagnostic.project.canton,
      cfcCode: i.cfcCode, element: i.cfcLabel, state: i.state, priority: i.priority,
      interventionYear: resolvedYear(i), budget: Math.round(itemAmount(i)), observation: i.notes ?? undefined,
    })),
    truncated: items.length > limit,
  };
}

type GroupBy = "canton" | "year" | "priority" | "buildingType";
/** Agrège le budget planifié par canton / année d'intervention / priorité / type de bâtiment. */
export async function aggregateCosts(ownerId: string, groupBy: GroupBy, f: ElementFilters = {}) {
  const items = (await loadItems(ownerId)).filter((i) => matches(i, f));
  const keyOf = (i: RawItem): string => {
    if (groupBy === "canton") return i.diagnostic.project.canton;
    if (groupBy === "year") return String(resolvedYear(i));
    if (groupBy === "priority") return i.priority ?? "—";
    return i.diagnostic.project.buildingType;
  };
  const map = new Map<string, { budget: number; count: number }>();
  for (const i of items) {
    const k = keyOf(i);
    const e = map.get(k) ?? { budget: 0, count: 0 };
    e.budget += itemAmount(i); e.count += 1; map.set(k, e);
  }
  return {
    groupBy,
    groups: [...map.entries()].map(([key, v]) => ({ key, budget: Math.round(v.budget), count: v.count })).sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true })),
    total: Math.round(items.reduce((s, i) => s + itemAmount(i), 0)),
  };
}

/** Plan de travaux des diagnostics par année d'intervention (budget + nb éléments + répartition priorité). */
export async function portfolioWorkPlan(ownerId: string, f: ElementFilters = {}) {
  const items = (await loadItems(ownerId)).filter((i) => matches(i, f) && itemAmount(i) > 0);
  const map = new Map<number, { budget: number; count: number; byPriority: Record<string, number> }>();
  for (const i of items) {
    const y = resolvedYear(i);
    const e = map.get(y) ?? { budget: 0, count: 0, byPriority: { I: 0, II: 0, III: 0 } };
    e.budget += itemAmount(i); e.count += 1;
    if (i.priority) e.byPriority[i.priority] = (e.byPriority[i.priority] ?? 0) + 1;
    map.set(y, e);
  }
  return {
    years: [...map.entries()].map(([year, v]) => ({ year, budget: Math.round(v.budget), count: v.count, byPriority: v.byPriority })).sort((a, b) => a.year - b.year),
    total: Math.round(items.reduce((s, i) => s + itemAmount(i), 0)),
  };
}
