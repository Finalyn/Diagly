/** Les criteres de reussite du brief, verifies en base apres import. */
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const attendu = { 1: 33, 2: 32, 3: 7, 4: 18, 5: 35, 6: 8, 7: 1 };
const etapes = await p.etapeVisite.findMany({ orderBy: { numero: "asc" }, include: { _count: { select: { articles: true } } } });
console.log("Étapes :");
let ok = true;
for (const e of etapes) {
  const n = e._count.articles;
  const bon = n === attendu[e.numero];
  if (!bon) ok = false;
  console.log(`  ${e.numero} ${e.nom.padEnd(24)} ${e.zone.padEnd(16)} ${String(n).padStart(3)} articles  ${bon ? "ok" : "ATTENDU " + attendu[e.numero]}`);
}
const a100 = await p.articleEtape.findMany({ where: { articleId: "A100" }, include: { etape: true } });
console.log(`\nA100 « Peinture intérieure – murs » : ${a100.map((x) => x.etape.nom).join(" + ")}`);
const compte = {
  articles: await p.article.count(),
  actifs: await p.article.count({ where: { actif: true } }),
  etats: await p.articleEtat.count(),
  nomenclature: await p.cfcNomenclature.count(),
  postes: await p.posteAutomatique.count(),
  liens: await p.articleEtape.count(),
};
console.log("\nVolumes :", JSON.stringify(compte));
const releves = await p.diagnosticItem.count();
const avecArticle = await p.diagnosticItem.count({ where: { NOT: { articleId: null } } });
const avecEtape = await p.diagnosticItem.count({ where: { NOT: { etapeNumero: null } } });
const sansRien = await p.diagnosticItem.count({ where: { articleId: null, catalogItemId: null } });
console.log(`Relevés : ${releves} au total, ${avecArticle} sur un article v3, ${avecEtape} rangés dans une étape, ${sansRien} orphelins`);
const lie = await p.article.findUnique({ where: { id: "A068" }, select: { nom: true, articleLieId: true } });
console.log(`Article lié : A068 « ${lie?.nom} » → ${lie?.articleLieId}`);
const groupes = await p.article.groupBy({ by: ["groupeAlternatives"], where: { NOT: { groupeAlternatives: null } }, _count: true });
console.log(`Groupes d'alternatives : ${groupes.length}`);
if (!ok || releves !== 75 || sansRien > 0) { console.error("\nÉCHEC"); process.exit(1); }
console.log("\nTous les critères vérifiés.");
await p.$disconnect();
