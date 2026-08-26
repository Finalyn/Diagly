import type { Project } from "@prisma/client";

function splitAddress(address: string | null): { street: string | null; number: string | null } {
  if (!address) return { street: null, number: null };
  const m = address.match(/^(.*?)[\s,]+(\d+[a-zA-Z]?)$/);
  if (m) return { street: m[1].trim(), number: m[2].trim() };
  return { street: address.trim(), number: null };
}

/** Identification d'un bâtiment (EGID = clé de jointure) — depuis un Project. */
export function toBuilding(p: Project) {
  const { street, number } = splitAddress(p.address);
  return {
    id: p.id,
    egid: p.egid ?? null,
    egrid: p.egrid ?? null,
    parcelNumber: p.parcelNumber ?? null,
    name: p.name,
    street,
    number,
    zip: p.postalCode ?? null,
    city: p.city,
    canton: p.canton,
    east: p.east ?? null,
    north: p.north ?? null,
    buildingType: p.buildingType,
    yearBuilt: p.yearBuilt ?? null,
    nbApartments: p.nbApartments ?? null,
    nbFloors: p.nbFloors ?? null,
    builtArea: p.builtArea ?? null,
    floorArea: p.floorArea ?? null,
    sre: p.sre ?? null,
    energyClassGlobal: p.energyClassGlobal ?? null,
  };
}

/** Ligne de liste de diagnostic. */
export function toDiagnosticListItem(p: Project) {
  return {
    id: p.id,
    egid: p.egid ?? null,
    name: p.name,
    status: p.status,
    buildingType: p.buildingType,
    city: p.city,
    canton: p.canton,
    floorArea: p.floorArea ?? null,
    total: p.totalBudget != null ? Number(p.totalBudget) : null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

/** Traduit "-createdAt" → { createdAt: "desc" } pour Prisma orderBy. */
export function parseSort(sort: string) {
  const desc = sort.startsWith("-");
  const field = desc ? sort.slice(1) : sort;
  return { [field]: desc ? "desc" : "asc" } as Record<string, "asc" | "desc">;
}
