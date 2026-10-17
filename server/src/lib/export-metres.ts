/**
 * Le classeur Excel du métré d'un jeu de plans (outil Métrés).
 *
 * Le navigateur calcule le métré : c'est lui qui tient les plans, leurs
 * échelles et les formes validées (src/lib/plans/export-metres.ts). Le serveur
 * le met en forme avec la bibliothèque de l'export des diagnostics : trois
 * onglets (Récapitulatif, Détail, SIA 416), en-têtes figées, quantités au
 * centième, totaux en gras, et la mention qui rappelle que les surfaces SIA
 * 416 sont à vérifier.
 *
 * Le contenu vient du navigateur : sa forme et sa taille sont bornées, et les
 * textes qui commenceraient par une formule sont neutralisés comme dans
 * l'export des diagnostics.
 */
import ExcelJS from "exceljs";
import { z } from "zod";
import { neutralizeFormula } from "./export-formats.js";

const UNITES = ["m²", "ml", "pce"] as const;
const texte = (max: number) => z.string().max(max);
const nombre = z.number().finite().min(-1e9).max(1e9);

const ligneRecap = z.object({
  classification: texte(80),
  etage: texte(160).nullable(),
  designation: texte(120),
  quantite: nombre,
  unite: z.enum(UNITES),
  detail: texte(200).nullable(),
  total: z.boolean(),
});

const ligneDetail = z.object({
  feuille: texte(200),
  etage: texte(160),
  local: texte(200),
  classification: texte(80),
  quantite: nombre.nullable(),
  unite: z.enum(UNITES),
  etagesIdentiques: z.number().int().min(0).max(60),
  provenance: texte(80),
  statut: texte(120),
});

const ligneSia = z.object({
  etage: texte(160),
  etagesIdentiques: z.number().int().min(0).max(60),
  grandeur: texte(80),
  parEtage: nombre.nullable(),
  total: nombre.nullable(),
  remarque: texte(200).nullable(),
  estTotal: z.boolean(),
});

export const exportMetresSchema = z.object({
  batiment: texte(200),
  adresse: texte(300),
  le: texte(20),
  mention: texte(120),
  recapitulatif: z.array(ligneRecap).max(5000),
  detail: z.array(ligneDetail).max(20000),
  sia416: z.array(ligneSia).max(5000),
});

export type ExportMetres = z.infer<typeof exportMetresSchema>;

const ENTETE = "FFEFF3F8";
const TOTAL = "FFF8FAFC";
const FORMAT_MESURE = "#,##0.00";
const FORMAT_PIECES = "#,##0";

const t = (s: string | null | undefined) => (s == null ? "" : neutralizeFormula(s));

/** Titre du classeur sur la première ligne, en-têtes sur la deuxième, figées. */
function feuille(wb: ExcelJS.Workbook, nom: string, titre: string, entetes: string[], largeurs: number[]) {
  const ws = wb.addWorksheet(nom, { views: [{ state: "frozen", ySplit: 2 }] });
  ws.addRow([titre]).font = { bold: true, size: 12 };
  const h = ws.addRow(entetes);
  h.font = { bold: true, color: { argb: "FF1F2937" } };
  h.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ENTETE } };
    c.border = { bottom: { style: "thin", color: { argb: "FFCBD5E1" } } };
  });
  largeurs.forEach((l, i) => { ws.getColumn(i + 1).width = l; });
  return ws;
}

function formatQuantite(cell: ExcelJS.Cell, unite: string) {
  cell.numFmt = unite === "pce" ? FORMAT_PIECES : FORMAT_MESURE;
  cell.alignment = { horizontal: "right" };
}

function enGras(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TOTAL } }; });
}

export async function classeurDuMetre(m: ExportMetres): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Diagly";
  wb.created = new Date();
  const titre = `Métré · ${m.batiment}${m.adresse ? ` · ${m.adresse}` : ""} · ${m.le}`;

  // Récapitulatif : chaque classification détaillée par étage, puis ses totaux.
  const r = feuille(wb, "Récapitulatif", titre, ["Classification", "Étage", "Désignation", "Quantité", "Unité", "Détail"], [22, 30, 26, 14, 8, 34]);
  let precedente = "";
  for (const l of m.recapitulatif) {
    if (l.classification !== precedente && precedente) r.addRow([]);
    precedente = l.classification;
    const row = r.addRow([t(l.classification), l.total ? "" : t(l.etage), t(l.designation), l.quantite, l.unite, t(l.detail)]);
    formatQuantite(row.getCell(4), l.unite);
    if (l.total) enGras(row);
    else row.getCell(2).alignment = { indent: 1 };
  }

  const d = feuille(wb, "Détail", titre, ["Feuille", "Étage", "Local ou objet", "Classification", "Quantité", "Unité", "Étages identiques", "Provenance", "Statut"], [30, 22, 30, 20, 12, 8, 10, 26, 26]);
  for (const l of m.detail) {
    const row = d.addRow([t(l.feuille), t(l.etage), t(l.local), t(l.classification), l.quantite, l.unite, l.etagesIdentiques, t(l.provenance), t(l.statut)]);
    formatQuantite(row.getCell(5), l.unite);
  }
  d.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: 9 } };

  const s = feuille(wb, "SIA 416", `${titre} · ${m.mention}`, ["Étage", "Étages identiques", "Grandeur", "Par étage (m²)", "Total (m²)", "Remarque"], [24, 10, 36, 16, 16, 36]);
  let etage = "";
  for (const l of m.sia416) {
    if (l.etage !== etage && etage) s.addRow([]);
    etage = l.etage;
    const row = s.addRow([t(l.etage), l.estTotal ? "" : l.etagesIdentiques, t(l.grandeur), l.parEtage, l.total, t(l.remarque)]);
    formatQuantite(row.getCell(4), "m²");
    formatQuantite(row.getCell(5), "m²");
    if (l.estTotal) enGras(row);
  }
  s.addRow([]);
  s.addRow([m.mention]).font = { italic: true, color: { argb: "FF92400E" } };

  return Buffer.from(await wb.xlsx.writeBuffer());
}
