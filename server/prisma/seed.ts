/**
 * Seed Prisma : charge le catalogue de référence (CFC + items diagnostiquables)
 * depuis seed-data.json (exporté de la base de dev).
 *
 * Idempotent : si le catalogue est déjà rempli, ne fait rien. C'est donc sûr de
 * le relancer à chaque build/déploiement.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = resolve(__dirname, "seed-data.json");

const prisma = new PrismaClient();

async function main() {
  // Compte admin, créé une seule fois, sur une base vide. Son mot de passe ne
  // figure plus dans le code (le dépôt est public) : il vient de
  // SEED_ADMIN_PASSWORD, sinon il est tiré au hasard et affiché une seule fois
  // dans la console du déploiement.
  if ((await prisma.user.count()) === 0) {
    const fourni = process.env.SEED_ADMIN_PASSWORD;
    const motDePasse = fourni && fourni.length >= 12 ? fourni : randomBytes(18).toString("base64url");
    await prisma.user.create({
      data: {
        email: "contact@finalyn.com",
        passwordHash: await bcrypt.hash(motDePasse, 12),
        firstName: "Finalyn",
        lastName: "Admin",
        companyName: "Finalyn",
        role: "ADMIN",
      },
    });
    console.log(fourni
      ? "Compte admin créé : contact@finalyn.com (mot de passe de SEED_ADMIN_PASSWORD)."
      : `Compte admin créé : contact@finalyn.com, mot de passe provisoire ${motDePasse} (à changer à la première connexion).`);
  }

  const existing = await prisma.catalogItem.count();
  if (existing > 0) {
    console.log(`Catalogue déjà présent (${existing} items) — seed ignoré.`);
    return;
  }

  const { cfc, items } = JSON.parse(readFileSync(DATA_PATH, "utf-8")) as {
    cfc: unknown[];
    items: unknown[];
  };

  if (cfc.length) {
    await prisma.cfcCatalogEntry.createMany({ data: cfc as never, skipDuplicates: true });
  }
  if (items.length) {
    await prisma.catalogItem.createMany({ data: items as never, skipDuplicates: true });
  }

  console.log(`Seed OK : cfc_catalog=${cfc.length}, catalog_items=${items.length}`);
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
