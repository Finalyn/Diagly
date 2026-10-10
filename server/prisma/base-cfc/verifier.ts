/**
 * Lot 1 : lire le classeur et dire ce qu'il contient, sans rien ecrire.
 *
 *   npx tsx prisma/base-cfc/verifier.ts <classeur.xlsx>
 *
 * C'est le controle qu'on passe avant l'import : si cette commande ne sort pas
 * proprement, l'import n'a aucune chance de bien se passer.
 */

import {
  assemblerArticle, assemblerEtapes, assemblerNomenclature, assemblerPostes, controler,
} from "../../../src/lib/base-cfc/assembler";
import { lireClasseur } from "./classeur";

const chemin = process.argv[2] ?? "C:/Users/switc/Downloads/DIAGLY_base_CFC_v3.xlsx";

const brut = await lireClasseur(chemin);
const articles = brut.articles.map(assemblerArticle);
const { etapes, liens } = assemblerEtapes(brut.visite);
const nomenclature = assemblerNomenclature(brut.nomenclature);
const postes = assemblerPostes(brut.postes);
const anomalies = controler({ articles, nomenclature, liens, etapes });

const compte = (liste: string[]) => {
  const m = new Map<string, number>();
  for (const x of liste) m.set(x, (m.get(x) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

console.log(`Classeur : ${chemin}`);
console.log(`  ${articles.length} articles, ${liens.length} relevés prévus, ${etapes.length} étapes`);
console.log(`  ${nomenclature.length} codes de nomenclature, ${postes.length} postes automatiques\n`);

console.log("Étapes de visite :");
for (const e of etapes) {
  const n = liens.filter((l) => l.etapeNumero === e.numero).length;
  console.log(`  ${e.numero} ${e.nom.padEnd(24)} ${e.zone.padEnd(16)} ${String(n).padStart(3)} articles`);
}

const multi = compte(liens.map((l) => l.articleId)).filter(([, n]) => n > 1);
console.log(`\nArticles relevés dans plusieurs étapes : ${multi.length}`);

console.log("\nGroupes d'alternatives :");
for (const [g, n] of compte(articles.map((a) => a.groupeAlternatives ?? "").filter(Boolean))) {
  console.log(`  ${g.padEnd(32)} ${n}`);
}

console.log("\nBases de quantité :");
for (const [b, n] of compte(articles.map((a) => a.baseQuantite))) console.log(`  ${b.padEnd(24)} ${n}`);

const bloquantes = anomalies.filter((a) => a.gravite === "bloquante");
const avertissements = anomalies.filter((a) => a.gravite === "avertissement");
console.log(`\nContrôles : ${bloquantes.length} bloquantes, ${avertissements.length} avertissements`);
for (const a of bloquantes) console.log(`  BLOQUANT  ${a.articleId ?? ""} ${a.message}`);
for (const [code, n] of compte(avertissements.map((a) => a.code))) console.log(`  ${code.padEnd(20)} ${n}`);

// Les parents absents ne sont pas une anomalie d'article mais de nomenclature :
// l'import devra creer le noeud manquant plutot que de refuser la cle etrangere.
const codes = new Set(nomenclature.map((n) => n.code));
const orphelins = [...new Set(nomenclature.map((n) => n.parentCode).filter((p): p is string => !!p && !codes.has(p)))];
console.log(`\nParents cités mais absents de la nomenclature : ${orphelins.length > 0 ? orphelins.join(", ") : "aucun"}`);

process.exit(bloquantes.length > 0 ? 1 : 0);
