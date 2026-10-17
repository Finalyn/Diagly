import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { classeurDuMetre, exportMetresSchema, type ExportMetres } from "./export-metres.js";

const metre: ExportMetres = {
  batiment: "Immeuble Les Essais",
  adresse: "Chemin du Contrôle 12, Lausanne",
  le: "17.10.2026",
  mention: "À vérifier, selon SIA 416:2003",
  recapitulatif: [
    { classification: "Pièces", etage: "Rez", designation: "Sol", quantite: 89.48, unite: "m²", detail: null, total: false },
    { classification: "Pièces", etage: "1er au 3e", designation: "Sol", quantite: 120.5, unite: "m²", detail: "× 3 étages identiques", total: false },
    { classification: "Pièces", etage: null, designation: "Total sol", quantite: 209.98, unite: "m²", detail: "étages identiques compris", total: true },
    { classification: "Éléments comptés", etage: null, designation: "Total nombre", quantite: 24, unite: "pce", detail: null, total: true },
  ],
  detail: [
    { feuille: "101 · Plan du rez", etage: "Rez", local: "=HYPERLINK(\"x\")", classification: "Pièces", quantite: 20.12, unite: "m²", etagesIdentiques: 1, provenance: "IA", statut: "Validé" },
  ],
  sia416: [
    { etage: "Rez", etagesIdentiques: 1, grandeur: "SP, surface de plancher", parEtage: 102.08, total: 102.08, remarque: null, estTotal: false },
    { etage: "Total", etagesIdentiques: 0, grandeur: "SP, surface de plancher", parEtage: null, total: 762.08, remarque: null, estTotal: true },
  ],
};

describe("le classeur du métré", () => {
  it("refuse un contenu hors des formes admises", () => {
    expect(exportMetresSchema.safeParse({ ...metre, recapitulatif: [{ ...metre.recapitulatif[0], unite: "m3" }] }).success).toBe(false);
    expect(exportMetresSchema.safeParse(metre).success).toBe(true);
  });

  it("écrit trois onglets, quantités au centième, et neutralise les formules", async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await classeurDuMetre(metre));
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Récapitulatif", "Détail", "SIA 416"]);
    const r = wb.getWorksheet("Récapitulatif")!;
    expect(r.getRow(2).getCell(1).value).toBe("Classification");
    expect(r.getRow(3).getCell(4).value).toBe(89.48);
    expect(r.getRow(3).getCell(4).numFmt).toBe("#,##0.00");
    expect(r.getRow(5).font?.bold).toBe(true);
    const d = wb.getWorksheet("Détail")!;
    expect(d.getRow(3).getCell(3).value).toBe("'=HYPERLINK(\"x\")");
    const s = wb.getWorksheet("SIA 416")!;
    expect(String(s.getRow(1).getCell(1).value)).toContain("SIA 416:2003");
  });
});
