// Modèle d'export + moteur de mapping des colonnes (ordre / intitulés / colonnes actives).
// Un modèle décrit, par onglet thématique, la liste ordonnée des colonnes à produire.
// Les onglets "data" (Bâtiment, Éléments, Plan de travaux) sont configurables ; le
// Chiffrage (synthèse) est fixe et généré directement depuis payload.costs.
// EGID est présent en tête de chaque onglet ligne-par-ligne (clé de jointure universelle).

import type { DiagnosticExport } from "./diagnostic-export.js";

export interface ColumnDef {
  key: string;
  label: string;
  active: boolean;
}
export interface SheetTemplate {
  id: "building" | "items" | "workplan";
  title: string;
  columns: ColumnDef[];
}
export interface ExportTemplate {
  id: string;
  name: string;
  sheets: SheetTemplate[];
}

const STATE_LABEL: Record<string, string> = { TRES_BON: "Très bon", BON: "Bon", MOYEN: "Moyen", MAUVAIS: "Mauvais" };
const BUILDING_TYPE_LABEL: Record<string, string> = {
  LOGEMENT: "Logement", VILLA: "Villa", CHALET: "Chalet", SCOLAIRE: "Scolaire", BUREAU: "Bureau",
  ADMINISTRATIF: "Administratif", INDUSTRIEL: "Industriel", HOTEL: "Hôtel", COMMERCIAL: "Commercial", AUTRE: "Autre",
};

// ---- Modèle standard livré par défaut ----
export const DEFAULT_TEMPLATE: ExportTemplate = {
  id: "default",
  name: "Modèle standard Diagly",
  sheets: [
    {
      id: "building",
      title: "Bâtiment",
      columns: [
        { key: "egid", label: "EGID", active: true },
        { key: "egrid", label: "EGRID", active: true },
        { key: "externalObjectNo", label: "N° objet ERP", active: true },
        { key: "parcelNumber", label: "Parcelle", active: true },
        { key: "name", label: "Désignation", active: true },
        { key: "street", label: "Rue", active: true },
        { key: "number", label: "N°", active: true },
        { key: "zip", label: "NPA", active: true },
        { key: "city", label: "Localité", active: true },
        { key: "canton", label: "Canton", active: true },
        { key: "east", label: "Coord. E (LV95)", active: false },
        { key: "north", label: "Coord. N (LV95)", active: false },
        { key: "buildingType", label: "Type", active: true },
        { key: "yearBuilt", label: "Année construction", active: true },
        { key: "renovationYear", label: "Année rénovation", active: false },
        { key: "nbApartments", label: "Nb logements", active: true },
        { key: "nbFloors", label: "Nb étages", active: true },
        { key: "builtArea", label: "Surface bâtie (m²)", active: false },
        { key: "floorArea", label: "Surface plancher (m²)", active: false },
        { key: "sre", label: "SRE (m²)", active: true },
        { key: "energyClassEnvelope", label: "Classe énerg. enveloppe", active: true },
        { key: "energyClassGlobal", label: "Classe énerg. globale", active: true },
      ],
    },
    {
      id: "items",
      title: "Éléments",
      columns: [
        { key: "egid", label: "EGID", active: true },
        { key: "egrid", label: "EGRID", active: false },
        { key: "externalObjectNo", label: "N° objet ERP", active: false },
        { key: "cfcCode", label: "Code CFC", active: true },
        { key: "cfcLabel", label: "Désignation", active: true },
        { key: "state", label: "État", active: true },
        { key: "priority", label: "Priorité", active: true },
        { key: "interventionYear", label: "Année d'intervention", active: true },
        { key: "observation", label: "Observation", active: true },
        { key: "works", label: "Travaux retenus", active: true },
        { key: "area", label: "Quantité", active: true },
        { key: "unit", label: "Unité", active: true },
        { key: "estimatedCost", label: "Réparation (CHF)", active: true },
        { key: "improvement", label: "Amélioration", active: false },
        { key: "improvementCost", label: "Amélioration (CHF)", active: true },
        { key: "norms", label: "Remise aux normes", active: false },
        { key: "normsCost", label: "Normes (CHF)", active: true },
      ],
    },
    {
      id: "workplan",
      title: "Plan de travaux",
      columns: [
        { key: "egid", label: "EGID", active: true },
        { key: "externalObjectNo", label: "N° objet ERP", active: false },
        { key: "cfcCode", label: "Code CFC", active: true },
        { key: "label", label: "Élément", active: true },
        { key: "interventionYear", label: "Année d'intervention", active: true },
        { key: "priority", label: "Priorité", active: true },
        { key: "amount", label: "Montant (CHF)", active: true },
      ],
    },
  ],
};

// ---- Construction des enregistrements plats (clé de colonne -> valeur) par onglet ----

type Rec = Record<string, string | number | null>;

function buildRecords(payload: DiagnosticExport): Record<SheetTemplate["id"], Rec[]> {
  const b = payload.building;
  const buildingRec: Rec = {
    ...b,
    buildingType: BUILDING_TYPE_LABEL[b.buildingType] ?? b.buildingType,
  };

  const items: Rec[] = payload.items.map((i) => ({
    egid: b.egid,
    egrid: b.egrid,
    externalObjectNo: b.externalObjectNo,
    cfcCode: i.cfcCode,
    cfcLabel: i.cfcLabel,
    state: i.state ? STATE_LABEL[i.state] ?? i.state : "À évaluer",
    priority: i.priority ?? "",
    interventionYear: i.interventionYear,
    observation: i.observation ?? "",
    works: i.works.join(" ; "),
    area: i.area,
    unit: i.unit ?? "",
    estimatedCost: i.estimatedCost,
    improvement: i.improvement ?? "",
    improvementCost: i.improvementCost,
    norms: i.norms ?? "",
    normsCost: i.normsCost,
  }));

  const workplan: Rec[] = payload.workPlan.map((w) => ({
    egid: w.egid,
    externalObjectNo: b.externalObjectNo,
    cfcCode: w.cfcCode,
    label: w.label,
    interventionYear: w.interventionYear,
    priority: w.priority ?? "",
    amount: w.amount,
  }));

  return { building: [buildingRec], items, workplan };
}

export interface SheetData {
  id: SheetTemplate["id"];
  title: string;
  /** Colonnes dont la valeur est un montant CHF (pour le format XLSX). */
  moneyKeys: Set<string>;
  headers: string[];
  keys: string[];
  rows: (string | number | null)[][];
}

const MONEY_KEYS = new Set(["estimatedCost", "improvementCost", "normsCost", "amount"]);

/** Projette le payload canonique en tableaux (par onglet) selon le modèle : ordre, intitulés, colonnes actives. */
export function applyTemplate(payload: DiagnosticExport, template: ExportTemplate): SheetData[] {
  const records = buildRecords(payload);
  return template.sheets.map((sheet) => {
    const active = sheet.columns.filter((c) => c.active);
    const recs = records[sheet.id] ?? [];
    return {
      id: sheet.id,
      title: sheet.title,
      moneyKeys: new Set(active.map((c) => c.key).filter((k) => MONEY_KEYS.has(k))),
      headers: active.map((c) => c.label),
      keys: active.map((c) => c.key),
      rows: recs.map((r) => active.map((c) => r[c.key] ?? null)),
    };
  });
}

/** Renvoie le modèle demandé : modèle enregistré du compte, sinon le modèle standard. */
export function resolveTemplate(
  prefs: Record<string, unknown> | undefined,
  templateId: string | undefined,
): ExportTemplate {
  const saved = (prefs?.exportTemplates as ExportTemplate[] | undefined) ?? [];
  const wanted = templateId ?? (prefs?.exportDefaultTemplateId as string | undefined);
  if (wanted && wanted !== "default") {
    const found = saved.find((t) => t.id === wanted);
    if (found) return found;
  }
  return DEFAULT_TEMPLATE;
}
