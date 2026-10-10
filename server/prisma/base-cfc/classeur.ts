/**
 * Lecture brute du classeur : des feuilles vers des lignes nommees.
 *
 * Tout ce qui est jugement sur les valeurs vit dans `src/lib/base-cfc`, qui se
 * teste sans Excel. Ici on ne fait que transformer des cellules en objets, et
 * surtout on force la lecture du code CFC en texte : lu en nombre, « 221.0 »
 * deviendrait 221 et se confondrait avec un autre ouvrage.
 */

import ExcelJS from "exceljs";
import type { Ligne } from "../../../src/lib/base-cfc/assembler";

/** Les onglets qu'on importe. Les autres sont de la documentation interne. */
export const ONGLETS = {
  articles: "Articles",
  visite: "Ordre de visite",
  postes: "Postes automatiques",
  nomenclature: "Nomenclature CFC",
} as const;

/**
 * Colonnes dont la valeur doit rester du texte, quoi qu'en dise le tableur.
 *
 * Les codes CFC seulement : « 221.0 » lu en nombre devient 221, et se confond
 * avec un autre ouvrage. La ligne d'origine, elle, est bien un numero de ligne.
 */
const TOUJOURS_TEXTE = new Set(["Code CFC", "Code parent"]);

function valeur(cell: ExcelJS.Cell, entete: string): unknown {
  const v = cell.value;
  if (v === null || v === undefined) return null;
  // Une formule : on prend son resultat, jamais sa formule.
  const brut = typeof v === "object" && v !== null && "result" in v ? (v as { result: unknown }).result : v;
  if (typeof brut === "object" && brut !== null && "richText" in brut) {
    return (brut as { richText: { text: string }[] }).richText.map((t) => t.text).join("");
  }
  if (TOUJOURS_TEXTE.has(entete) && typeof brut === "number") {
    // Un code lu en nombre a deja perdu son zero final : on le signale plutot
    // que de le recomposer au jugé.
    throw new Error(
      `La colonne « ${entete} » a ete lue comme un nombre (${brut}). Le classeur doit la contenir en texte, sinon « 221.0 » devient 221.`,
    );
  }
  return brut;
}

export function lireFeuille(wb: ExcelJS.Workbook, nom: string): Ligne[] {
  const ws = wb.getWorksheet(nom);
  if (!ws) throw new Error(`Onglet « ${nom} » absent du classeur`);
  const entetes: string[] = [];
  ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    entetes[col] = String(cell.value ?? "").trim();
  });

  const lignes: Ligne[] = [];
  ws.eachRow({ includeEmpty: false }, (row, numero) => {
    if (numero === 1) return;
    const ligne: Ligne = {};
    let vide = true;
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      const entete = entetes[col];
      if (!entete) return;
      const v = valeur(cell, entete);
      ligne[entete] = v;
      if (v !== null && String(v).trim() !== "") vide = false;
    });
    if (!vide) lignes.push(ligne);
  });
  return lignes;
}

export async function lireClasseur(chemin: string) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(chemin);
  return {
    articles: lireFeuille(wb, ONGLETS.articles),
    visite: lireFeuille(wb, ONGLETS.visite),
    postes: lireFeuille(wb, ONGLETS.postes),
    nomenclature: lireFeuille(wb, ONGLETS.nomenclature),
  };
}
