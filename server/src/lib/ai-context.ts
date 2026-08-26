// Construit le contexte texte fourni a l'IA (assistant + guide) : TOUTES les donnees
// d'un diagnostic (etats, priorites, quantites, couts, annees d'intervention/renovation,
// enveloppes amelioration/normes, notes, etiquette energetique, geo) + un apercu du parc.
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";
import { deriveInterventionYear, type PriorityCode } from "./diagnostic-export.js";

const STATE_LABEL: Record<string, string> = {
  TRES_BON: "tres bon",
  BON: "bon",
  MOYEN: "moyen",
  MAUVAIS: "mauvais",
};
const PRIO_LABEL: Record<string, string> = {
  I: "I (urgent/securite)",
  II: "II (moyen terme)",
  III: "III (confort/long terme)",
};

const n = (v: unknown): number => (v == null ? 0 : Number(v));
/** Montant CHF au format suisse 1'234'567. */
const chf = (v: number): string => Math.round(v).toLocaleString("fr-CH").replace(/[\s  ]/g, "'");

type Scope = Prisma.ProjectWhereInput;

/** Montant total retenu d'un element : reparation + amelioration + remise aux normes. */
function itemAmount(it: { estimatedCost: unknown; improvementCost: unknown; normsCost: unknown }): number {
  return n(it.estimatedCost) + n(it.improvementCost) + n(it.normsCost);
}

/**
 * Contexte DETAILLE d'un projet pour l'IA. Renvoie null si le projet n'existe pas / hors scope.
 * `maxItems` borne la taille (defaut 150 lignes d'elements).
 */
export async function buildProjectContext(
  projectId: string,
  scope: Scope,
  maxItems = 150,
): Promise<string | null> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, ...scope },
    include: {
      diagnostics: { include: { items: true }, orderBy: { createdAt: "asc" } },
      operation: { select: { name: true } },
    },
  });
  if (!project) return null;

  const out: string[] = [];
  out.push("=== DIAGNOSTIC OUVERT (donnees completes, utilise-les pour repondre) ===");
  out.push(`Nom: ${project.name}`);
  out.push(
    `Adresse: ${project.address}${project.postalCode ? `, ${project.postalCode}` : ""} ${project.city} (${project.canton})` +
      (project.parcelNumber ? ` · parcelle ${project.parcelNumber}` : "") +
      (project.egid ? ` · EGID ${project.egid}` : ""),
  );
  out.push(
    `Batiment: type ${project.buildingType}` +
      (project.yearBuilt ? ` · construit en ${project.yearBuilt}` : " · annee de construction inconnue") +
      (project.renovationYear ? ` · derniere renovation ${project.renovationYear}` : "") +
      (project.nbApartments != null ? ` · ${project.nbApartments} logement(s)` : "") +
      (project.nbFloors != null ? ` · ${project.nbFloors} etage(s)` : "") +
      (project.nbStaircases != null ? ` · ${project.nbStaircases} cage(s) d'escalier` : ""),
  );
  const surfaces = [
    project.floorArea != null ? `plancher ${project.floorArea} m2` : null,
    project.builtArea != null ? `emprise ${project.builtArea} m2` : null,
    project.facadeArea != null ? `facade ${project.facadeArea} m2` : null,
    project.terrainArea != null ? `terrain ${project.terrainArea} m2` : null,
    project.perimeter != null ? `perimetre ${project.perimeter} m` : null,
    `${project.windowPct}% de vitrage`,
    project.roofType ? `toiture ${project.roofType}` : null,
  ].filter(Boolean);
  if (surfaces.length) out.push(`Geometrie: ${surfaces.join(" · ")}`);
  out.push(`Statut: ${project.status}` + (project.operation ? ` · operation ${project.operation.name}` : ""));

  // Etiquette energetique (si un certificat a ete importe)
  if (project.energyClassGlobal || project.energyClassEnvelope || project.sre || project.energyAgent) {
    out.push(
      "Etiquette energetique: " +
        [
          project.energyClassGlobal ? `classe globale ${project.energyClassGlobal}` : null,
          project.energyClassEnvelope ? `classe enveloppe ${project.energyClassEnvelope}` : null,
          project.energyAgent ? `agent ${project.energyAgent}` : null,
          project.sre != null ? `SRE ${project.sre} m2` : null,
          project.energyConsumptionHeat != null ? `chaleur ${project.energyConsumptionHeat} kWh/m2/an` : null,
          project.energyConsumptionElec != null ? `electricite ${project.energyConsumptionElec} kWh/m2/an` : null,
          project.energyRefYear ? `annee ref ${project.energyRefYear}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
    );
  }

  // Elements de tous les diagnostics du projet
  const allItems = project.diagnostics.flatMap((d) =>
    d.items.map((it) => ({ ...it, visitDate: d.visitDate, diagStatus: d.status })),
  );
  const baseYear = (project.diagnostics.find((d) => d.visitDate)?.visitDate ?? new Date()).getFullYear();
  const resolvedYear = (it: (typeof allItems)[number]): number =>
    it.interventionYear ?? deriveInterventionYear((it.priority as PriorityCode | null) ?? null, baseYear);

  const evaluated = allItems.filter((it) => it.state);
  const totalRetained = allItems.reduce((s, it) => s + itemAmount(it), 0);

  // Estimation de la derniere renovation a partir de l'annee de pose la plus recente des elements
  // (aucun registre public ne fournit l'annee de renovation). Non ecrite en base : indicative.
  if (project.renovationYear == null) {
    const installYears = allItems
      .map((it) => it.yearInstalled)
      .filter((y): y is number => typeof y === "number" && y > (project.yearBuilt ?? 0));
    if (installYears.length) {
      const est = Math.max(...installYears);
      out.push(`Renovation estimee (d'apres l'annee de pose la plus recente des elements): ~${est} (indicatif, a confirmer).`);
    }
  }

  // Agregats par priorite
  const byPrio: Record<string, { count: number; amount: number }> = {};
  for (const it of allItems) {
    const p = it.priority ?? "non-priorise";
    (byPrio[p] ??= { count: 0, amount: 0 }).count++;
    byPrio[p].amount += itemAmount(it);
  }
  // Agregats par annee d'intervention (planning de renovation)
  const byYear: Record<number, { count: number; amount: number }> = {};
  for (const it of allItems) {
    if (itemAmount(it) <= 0 && !it.state) continue;
    const y = resolvedYear(it);
    (byYear[y] ??= { count: 0, amount: 0 }).count++;
    byYear[y].amount += itemAmount(it);
  }
  // Agregats par etat
  const byState: Record<string, number> = {};
  for (const it of allItems) if (it.state) byState[it.state] = (byState[it.state] ?? 0) + 1;

  out.push("");
  out.push(
    `SYNTHESE: ${allItems.length} element(s) au total, ${evaluated.length} evalue(s), ${allItems.length - evaluated.length} a evaluer. ` +
      `Cout total retenu (reparations + ameliorations + remises aux normes): ${chf(totalRetained)} CHF HT.`,
  );
  if (Object.keys(byState).length)
    out.push(
      "Par etat: " +
        Object.entries(byState)
          .map(([s, c]) => `${STATE_LABEL[s] ?? s} ${c}`)
          .join(", "),
    );
  out.push(
    "Par priorite: " +
      ["I", "II", "III", "non-priorise"]
        .filter((p) => byPrio[p])
        .map((p) => `${PRIO_LABEL[p] ?? p}: ${byPrio[p].count} elem., ${chf(byPrio[p].amount)} CHF`)
        .join(" · "),
  );
  const years = Object.keys(byYear)
    .map(Number)
    .sort((a, b) => a - b);
  if (years.length)
    out.push(
      "Planning de renovation par annee d'intervention: " +
        years.map((y) => `${y}: ${chf(byYear[y].amount)} CHF (${byYear[y].count} elem.)`).join(" · "),
    );

  // Detail des elements (borne)
  out.push("");
  out.push(`DETAIL DES ELEMENTS (${Math.min(allItems.length, maxItems)}/${allItems.length}):`);
  for (const it of allItems.slice(0, maxItems)) {
    const parts = [
      `[${it.cfcCode}] ${it.cfcLabel}`,
      it.state ? `etat ${STATE_LABEL[it.state] ?? it.state}` : "non evalue",
      it.priority ? `prio ${it.priority}` : null,
      it.area != null ? `${it.area}${it.unit ? " " + it.unit.replace(/^CHF\s*\/?\s*/i, "") : ""}` : null,
      it.estimatedCost != null ? `reparation ${chf(n(it.estimatedCost))} CHF` : null,
      it.improvement ? `amelioration: ${it.improvement}${it.improvementCost != null ? ` (${chf(n(it.improvementCost))} CHF)` : ""}` : null,
      it.norms ? `remise aux normes: ${it.norms}${it.normsCost != null ? ` (${chf(n(it.normsCost))} CHF)` : ""}` : null,
      it.yearInstalled ? `pose ${it.yearInstalled}` : null,
      `intervention ${resolvedYear(it)}${it.interventionYear == null ? " (deduite)" : ""}`,
      Array.isArray(it.works) && (it.works as unknown[]).length ? `travaux: ${(it.works as string[]).join(", ")}` : null,
      Array.isArray(it.photos) && (it.photos as unknown[]).length ? `${(it.photos as unknown[]).length} photo(s)` : null,
      it.notes ? `note: ${it.notes}` : null,
    ].filter(Boolean);
    out.push("- " + parts.join(" · "));
  }
  if (allItems.length > maxItems) out.push(`... (${allItems.length - maxItems} element(s) supplementaires non listes)`);

  // Notes de diagnostic
  const diagNotes = project.diagnostics.filter((d) => d.notes).map((d) => d.notes);
  if (diagNotes.length) out.push(`Notes de diagnostic: ${diagNotes.join(" | ")}`);

  return out.join("\n");
}

/** Version COMPACTE d'un projet (pour le guide vision : age, type, energie). */
export async function buildProjectBrief(projectId: string, scope: Scope): Promise<string | null> {
  const p = await prisma.project.findFirst({
    where: { id: projectId, ...scope },
    select: {
      buildingType: true, yearBuilt: true, renovationYear: true, canton: true, city: true,
      energyClassGlobal: true, energyAgent: true, roofType: true,
    },
  });
  if (!p) return null;
  return (
    `Contexte du batiment: type ${p.buildingType}` +
    (p.yearBuilt ? `, construit en ${p.yearBuilt}` : ", annee de construction inconnue") +
    (p.renovationYear ? `, derniere renovation ${p.renovationYear}` : "") +
    `, a ${p.city} (${p.canton})` +
    (p.roofType ? `, toiture ${p.roofType}` : "") +
    (p.energyClassGlobal ? `, classe energetique ${p.energyClassGlobal}` : "") +
    (p.energyAgent ? `, chauffage ${p.energyAgent}` : "") +
    ". Tiens compte de l'age du batiment et de l'annee de la derniere renovation pour juger l'usure attendue."
  );
}

/** Apercu du parc : liste courte de tous les diagnostics accessibles (pour repondre sur n'importe lequel). */
export async function buildPortfolioBrief(scope: Scope, excludeProjectId?: string, max = 40): Promise<string | null> {
  const projects = await prisma.project.findMany({
    where: scope,
    orderBy: { updatedAt: "desc" },
    take: max + (excludeProjectId ? 1 : 0),
    select: {
      id: true, name: true, city: true, canton: true, buildingType: true, status: true,
      yearBuilt: true, renovationYear: true,
      diagnostics: { select: { items: { select: { state: true, estimatedCost: true, improvementCost: true, normsCost: true } } } },
    },
  });
  const rows = projects.filter((p) => p.id !== excludeProjectId).slice(0, max);
  if (rows.length === 0) return null;
  const lines = rows.map((p) => {
    const items = p.diagnostics.flatMap((d) => d.items);
    const total = items.reduce((s, it) => s + itemAmount(it), 0);
    const evaluated = items.filter((it) => it.state).length;
    return (
      `- ${p.name} (${p.city}, ${p.canton}) · ${p.buildingType}` +
      (p.yearBuilt ? ` ${p.yearBuilt}` : "") +
      (p.renovationYear ? `, reno. ${p.renovationYear}` : "") +
      ` · statut ${p.status} · ${items.length} elem. (${evaluated} eval.) · ${chf(total)} CHF`
    );
  });
  return (
    `=== TOUS TES DIAGNOSTICS (${rows.length}${projects.length > rows.length ? "+" : ""}) ===\n` +
    "Tu peux repondre sur n'importe lequel. Pour le detail complet d'un autre diagnostic, demande a l'utilisateur de l'ouvrir.\n" +
    lines.join("\n")
  );
}
