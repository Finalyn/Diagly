/**
 * Reprise des relevés existants après l'ajout de `localisation`.
 *
 * Avant cette colonne, un article du catalogue n'était relevable qu'une fois, à
 * l'étape où son rang le plaçait : les revêtements dans les logements, la
 * menuiserie dans la cage d'escalier. Le relevé portait donc déjà une
 * localisation — implicite, celle de l'étape — et c'est elle qu'on écrit ici.
 *
 * Sans cette passe, un dossier déjà saisi verrait ses relevés cesser d'être
 * reconnus : l'éditeur les cherche désormais par article *et* localisation, et
 * un NULL ne répond à aucun des deux côtés. Le diagnostiqueur croirait tout à
 * refaire et créerait des doublons.
 *
 *   node scripts/backfill-localisation.mjs [--dry]
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const dry = process.argv.includes("--dry");

/** Rangs des étapes de visite, identiques à src/lib/visit-steps.ts. */
const ETAPE_COMMUNS = 2;   // Cage d'escalier
const ETAPE_LOGEMENTS = 5; // Appartements / surfaces principales

const localisationDeLetape = (step) =>
  step === ETAPE_COMMUNS ? "COMMUNS" : step === ETAPE_LOGEMENTS ? "LOGEMENTS" : null;

const catalogue = await prisma.catalogItem.findMany({ select: { id: true, displayOrder: true } });
const etapeParArticle = new Map(
  catalogue.map((c) => [c.id, Math.floor((c.displayOrder ?? 0) / 1000)]),
);

const items = await prisma.diagnosticItem.findMany({
  where: { localisation: null, catalogItemId: { not: null } },
  select: { id: true, catalogItemId: true, cfcLabel: true },
});

const parLocalisation = { COMMUNS: [], LOGEMENTS: [] };
for (const it of items) {
  const loc = localisationDeLetape(etapeParArticle.get(it.catalogItemId));
  if (loc) parLocalisation[loc].push(it.id);
}

for (const [loc, ids] of Object.entries(parLocalisation)) {
  console.log(`${loc.padEnd(10)} ${String(ids.length).padStart(4)} relevé(s)`);
  if (!dry && ids.length) {
    await prisma.diagnosticItem.updateMany({ where: { id: { in: ids } }, data: { localisation: loc } });
  }
}
console.log(
  `${items.length - parLocalisation.COMMUNS.length - parLocalisation.LOGEMENTS.length} `
  + "relevé(s) laissés sans localisation (façade, toiture, locaux techniques, abords).",
);
if (dry) console.log("\n--dry : rien n'a été écrit.");
await prisma.$disconnect();
