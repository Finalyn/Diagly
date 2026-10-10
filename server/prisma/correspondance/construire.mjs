/**
 * Lot 0 : la table de correspondance entre l'ancien catalogue et la base v3.
 *
 * Elle n'est pas calculee a l'import : elle est produite une fois, relue par
 * un humain, puis versionnee. La colonne « Ligne d'origine » du classeur ne
 * correspond a rien en base (verifie : au mieux 3 noms concordants sur 111 en
 * testant tous les decalages), et les diagnostics existants s'appuient pour
 * moitie sur une generation de catalogue que le classeur ne connait pas. Un
 * rapprochement automatique silencieux ferait donc perdre des releves.
 *
 *   node prisma/correspondance/construire.mjs <classeur.xlsx>
 *
 * Produit `correspondance.json`, a relire et a corriger a la main. Le script
 * d'import ne lit que ce fichier, jamais la ressemblance des noms.
 */

import { PrismaClient } from "@prisma/client";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";

const ICI = dirname(fileURLToPath(import.meta.url));
const CLASSEUR = process.argv[2] ?? "C:/Users/switc/Downloads/DIAGLY_base_CFC_v3.xlsx";

/** Sans accents ni ponctuation : « Façade ventilée » et « facade ventilee » sont le meme mot. */
const normaliser = (s) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Part des mots de l'un qui se retrouvent dans l'autre, dans les deux sens. */
function ressemblance(a, b) {
  const ma = new Set(normaliser(a).split(" ").filter((m) => m.length > 2));
  const mb = new Set(normaliser(b).split(" ").filter((m) => m.length > 2));
  if (ma.size === 0 || mb.size === 0) return 0;
  let communs = 0;
  for (const m of ma) if (mb.has(m)) communs++;
  return (2 * communs) / (ma.size + mb.size);
}

async function lireArticles() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(CLASSEUR);
  const ws = wb.getWorksheet("Articles");
  const entetes = ws.getRow(1).values.map((v) => String(v ?? "").trim());
  const articles = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const a = {};
    row.values.forEach((v, i) => { a[entetes[i]] = v; });
    if (a.ID) articles.push({ id: String(a.ID), nom: String(a.Article), cfc: String(a["Code CFC"]) });
  });
  return articles;
}

const p = new PrismaClient();
const nouveaux = await lireArticles();
const anciens = await p.catalogItem.findMany({
  where: { ownerId: null },
  select: { id: true, displayOrder: true, description: true, cfcCode: true, category: true },
  orderBy: { displayOrder: "asc" },
});
const usages = await p.diagnosticItem.groupBy({ by: ["catalogItemId"], _count: true });
const parAncien = new Map(usages.filter((u) => u.catalogItemId).map((u) => [u.catalogItemId, u._count]));

const lignes = anciens.map((ancien) => {
  const classement = nouveaux
    .map((n) => ({ n, score: ressemblance(ancien.description, n.nom) + (n.cfc === ancien.cfcCode ? 0.15 : 0) }))
    .sort((a, b) => b.score - a.score);
  const meilleur = classement[0];
  const suivant = classement[1];
  const exact = normaliser(ancien.description) === normaliser(meilleur?.n.nom);

  // Trois niveaux, et le doute est explicite : « sur » quand les noms sont
  // identiques, « a relire » quand un second candidat talonne le premier.
  let confiance = "aucune";
  if (exact) confiance = "sure";
  else if (meilleur && meilleur.score >= 0.6 && meilleur.score - (suivant?.score ?? 0) >= 0.15) confiance = "probable";
  else if (meilleur && meilleur.score >= 0.4) confiance = "a_relire";

  return {
    ancienId: ancien.id,
    ancienNom: ancien.description,
    ancienCfc: ancien.cfcCode,
    ancienOrdre: ancien.displayOrder,
    releves: parAncien.get(ancien.id) ?? 0,
    nouveauId: confiance === "aucune" ? null : meilleur.n.id,
    nouveauNom: confiance === "aucune" ? null : meilleur.n.nom,
    confiance,
    score: meilleur ? Math.round(meilleur.score * 100) / 100 : 0,
    autreCandidat: suivant && suivant.score >= 0.4 ? `${suivant.n.id} ${suivant.n.nom}` : null,
  };
});

// Les decisions humaines passent par-dessus le rapprochement : regenerer la
// table ne doit pas effacer ce qu'on a tranche.
const corrections = JSON.parse(readFileSync(resolve(ICI, "corrections.json"), "utf8")).corrections;
const parOrdre = new Map(corrections.map((c) => [c.ancienOrdre, c]));
let appliquees = 0;
for (const l of lignes) {
  const c = parOrdre.get(l.ancienOrdre);
  if (!c) continue;
  appliquees++;
  const cible = c.nouveauId ? nouveaux.find((n) => n.id === c.nouveauId) : null;
  l.nouveauId = c.nouveauId;
  l.nouveauNom = cible ? cible.nom : null;
  l.confiance = c.aDecider ? "a_decider" : "decidee";
  l.raison = c.raison;
  l.autreCandidat = null;
}

// Les articles utilises d'abord, et dans l'ordre du doute : c'est par la que
// commence la relecture.
const rang = { a_decider: 0, a_relire: 1, probable: 2, aucune: 3, decidee: 4, sure: 5 };
lignes.sort((a, b) => b.releves - a.releves || rang[a.confiance] - rang[b.confiance] || a.ancienOrdre - b.ancienOrdre);

const utilises = lignes.filter((l) => l.releves > 0);
const resume = {
  anciensArticles: lignes.length,
  utilisesParUnReleve: utilises.length,
  relevesConcernes: utilises.reduce((s, l) => s + l.releves, 0),
  correctionsAppliquees: appliquees,
  parConfiance: Object.fromEntries(
    ["sure", "decidee", "probable", "a_relire", "a_decider", "aucune"].map((c) => [c, lignes.filter((l) => l.confiance === c).length]),
  ),
  parConfianceParmiLesUtilises: Object.fromEntries(
    ["sure", "decidee", "probable", "a_relire", "a_decider", "aucune"].map((c) => [c, utilises.filter((l) => l.confiance === c).length]),
  ),
  nouveauxArticlesJamaisCibles: nouveaux
    .filter((n) => !lignes.some((l) => l.nouveauId === n.id))
    .map((n) => `${n.id} ${n.nom}`),
};

writeFileSync(
  resolve(ICI, "correspondance.json"),
  JSON.stringify({ genereLe: new Date().toISOString().slice(0, 10), resume, lignes }, null, 2),
  "utf8",
);
console.log(JSON.stringify(resume, null, 1));
await p.$disconnect();
