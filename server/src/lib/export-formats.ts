// Adaptateurs de format à partir de la couche canonique + du mapping.
// JSON = payload canonique brut (identique au futur endpoint API).
// CSV = un onglet à plat (séparateur ';', BOM UTF-8 pour Excel CH).
// XLSX = classeur exceljs : onglets data (mappés) + Chiffrage (synthèse fixe),
//        en-tête figée, largeurs, format CHF, dates suisses.

import ExcelJS from "exceljs";
import type { DiagnosticExport } from "./diagnostic-export.js";
import type { SheetData } from "./export-template.js";

const CHF_FMT = '#,##0" CHF"';
const HEADER_FILL = "FFEFF3F8";

/** dd.mm.yyyy depuis une date ISO (ou '' si nul). */
function swissDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

// ---- CSV ----
/**
 * Neutralise l'injection de formules : une note de diagnostic commencant par `=`, `+`,
 * `@` (ou une tabulation) est interpretee comme une FORMULE par Excel / LibreOffice a
 * l'ouverture du CSV, y compris des appels externes du type =HYPERLINK(...) ou DDE.
 * Le prefixe apostrophe force la cellule en texte. Les nombres negatifs restent intacts.
 */
function neutralizeFormula(s: string): string {
  if (!/^[=+@\t\r]/.test(s) && !(s.startsWith("-") && Number.isNaN(Number(s)))) return s;
  return `'${s}`;
}

export function toCsv(sheet: SheetData): string {
  const esc = (v: string | number | null) => {
    if (v == null) return "";
    if (typeof v === "number") return String(v); // un nombre ne peut pas etre une formule
    const s = neutralizeFormula(String(v));
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [sheet.headers.map(esc).join(";"), ...sheet.rows.map((r) => r.map(esc).join(";"))];
  return String.fromCharCode(0xfeff) + lines.join("\r\n"); // BOM UTF-8 pour Excel CH
}

// ---- XLSX ----
function styleHeader(ws: ExcelJS.Worksheet) {
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FF1F2937" } };
  header.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.border = { bottom: { style: "thin", color: { argb: "FFCBD5E1" } } };
    cell.alignment = { vertical: "middle" };
  });
  header.height = 20;
  ws.views = [{ state: "frozen", ySplit: 1 }]; // en-tête figée
}

function autoWidths(ws: ExcelJS.Worksheet, sheet: SheetData) {
  sheet.headers.forEach((h, c) => {
    let max = h.length;
    for (const row of sheet.rows) {
      const v = row[c];
      const len = v == null ? 0 : String(v).length;
      if (len > max) max = len;
    }
    ws.getColumn(c + 1).width = Math.min(Math.max(max + 2, 8), 60);
  });
}

function addDataSheet(wb: ExcelJS.Workbook, sheet: SheetData) {
  const ws = wb.addWorksheet(sheet.title, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.addRow(sheet.headers);
  for (const row of sheet.rows) ws.addRow(row);
  // Format CHF sur les colonnes montants
  sheet.keys.forEach((key, c) => {
    if (sheet.moneyKeys.has(key)) {
      const col = ws.getColumn(c + 1);
      col.numFmt = CHF_FMT;
      col.alignment = { horizontal: "right" };
    }
  });
  styleHeader(ws);
  autoWidths(ws, sheet);
}

function addCostsSheet(wb: ExcelJS.Workbook, payload: DiagnosticExport) {
  const ws = wb.addWorksheet("Chiffrage");
  const c = payload.costs;
  ws.addRow(["Poste", "Montant"]);
  const rows: [string, number][] = [
    ["Réparation (HT)", c.htRepair],
    ["Amélioration (HT)", c.htImprovement],
    ["Remise aux normes (HT)", c.htNorms],
    ["Travaux (HT)", c.ht],
    [`Honoraires (${c.honoraryPct}%)`, c.honoraires],
    [`Réserve (${c.reservePct}%)`, c.reserve],
    ["Sous-total", c.sousTotal],
    [`TVA ${c.tvaPct}%`, c.tva],
    ["Total TTC", c.total],
  ];
  for (const r of rows) ws.addRow(r);
  ws.addRow([]);
  ws.addRow(["Par priorité", "Montant", "Nombre"]);
  for (const p of c.byPriority) ws.addRow([`Priorité ${p.priority}`, p.total, p.count]);
  ws.addRow([]);
  ws.addRow(["Date du diagnostic", swissDate(payload.meta.diagnosticDate)]);
  ws.addRow(["Auteur", payload.meta.author ?? ""]);
  ws.addRow(["Généré le", swissDate(payload.meta.generatedAt)]);
  ws.addRow(["EGID", payload.building.egid ?? ""]);

  ws.getColumn(2).numFmt = CHF_FMT;
  ws.getColumn(1).width = 26;
  ws.getColumn(2).width = 16;
  ws.getColumn(3).width = 10;
  const header = ws.getRow(1);
  header.font = { bold: true };
  // Total TTC en gras
  ws.getRow(10).font = { bold: true };
  return ws;
}

function addVariantsSheet(wb: ExcelJS.Workbook, payload: DiagnosticExport) {
  const ws = wb.addWorksheet("Variantes", { views: [{ state: "frozen", ySplit: 1, xSplit: 1 }] });
  const v = payload.variants;
  ws.addRow(["Scénario de rénovation", ...v.map((x) => x.name)]);
  ws.addRow(["Périmètre", ...v.map((x) => x.envelopes.join(" + "))]);
  ws.addRow(["Travaux (HT)", ...v.map((x) => x.ht)]);
  ws.addRow(["Honoraires", ...v.map((x) => x.honoraires)]);
  ws.addRow(["Réserve", ...v.map((x) => x.reserve)]);
  ws.addRow(["Sous-total", ...v.map((x) => x.sousTotal)]);
  ws.addRow([`TVA ${payload.costs.tvaPct}%`, ...v.map((x) => x.tva)]);
  ws.addRow(["Total TTC", ...v.map((x) => x.total)]);
  ws.addRow(["Écart vs Maintenance", ...v.map((x) => x.total - v[0].total)]);
  ws.addRow(["Visée énergétique", ...v.map((x) => (x.energyFocus ? "Oui" : "—"))]);
  ws.addRow(["Classe énergétique actuelle", ...v.map(() => payload.energy.classGlobal ?? "—")]);

  for (let c = 2; c <= v.length + 1; c++) ws.getColumn(c).numFmt = CHF_FMT;
  ws.getColumn(1).width = 26;
  for (let c = 2; c <= v.length + 1; c++) ws.getColumn(c).width = 22;
  ws.getRow(1).font = { bold: true };
  ws.getRow(8).font = { bold: true }; // Total TTC
  return ws;
}

export async function toXlsx(payload: DiagnosticExport, sheets: SheetData[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Diagly";
  wb.created = new Date(payload.meta.generatedAt);
  for (const s of sheets) addDataSheet(wb, s);
  addVariantsSheet(wb, payload);
  addCostsSheet(wb, payload);
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
