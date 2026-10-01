/**
 * Reconstruit le jeu de démonstration de Diagly.
 *
 * Cinq bâtiments suisses qui ne se ressemblent pas : un administratif des années
 * soixante-dix, un locatif des années quatre-vingt, une villa récente, une école,
 * un chalet de montagne. Un parc homogène ferait une démonstration confortable et
 * fausse : c'est devant la variété que l'outil se juge.
 *
 * Les relevés sont tirés du catalogue réel du bureau, avec son vocabulaire, ses
 * unités et ses prix par état. Rien n'est inventé côté métier : seules les
 * adresses, les surfaces et les états le sont.
 *
 *   node scripts/demo-reconstruire.mjs [--vider]
 *
 * --vider supprime d'abord les projets existants du compte de démonstration.
 */
import { PrismaClient } from "@prisma/client";
import { deflateSync } from "node:zlib";

const prisma = new PrismaClient();
const EMAIL_DEMO = "demo@diagly.ch";
const vider = process.argv.includes("--vider");

/* ------------------------------------------------------------- les vignettes */

/**
 * Une photo de démonstration, en PNG uni.
 *
 * On ne fabrique pas de fausses photos de bâtiment : une image inventée de façade
 * fissurée serait montrée en clientèle comme un vrai constat. Une vignette unie
 * dit ce qu'elle est, remplit la galerie et fait taire l'alerte « sans photo »
 * sans prétendre documenter quoi que ce soit.
 */
function vignettePng(r, v, b, largeur = 480, hauteur = 360) {
  const bloc = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const corps = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(corps) >>> 0);
    return Buffer.concat([len, corps, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largeur, 0);
  ihdr.writeUInt32BE(hauteur, 4);
  ihdr[8] = 8;   // 8 bits par canal
  ihdr[9] = 2;   // couleur vraie, sans alpha
  const brut = Buffer.alloc(hauteur * (1 + largeur * 3));
  for (let y = 0; y < hauteur; y++) {
    const ligne = y * (1 + largeur * 3);
    brut[ligne] = 0; // filtre « aucun »
    for (let x = 0; x < largeur; x++) {
      // Une bande légèrement plus claire en diagonale : de quoi reconnaître une
      // vignette d'un aplat accidentel, sans écrire de texte faute de police.
      const bande = ((x + y) % 120 < 8) ? 14 : 0;
      const i = ligne + 1 + x * 3;
      brut[i] = Math.min(255, r + bande);
      brut[i + 1] = Math.min(255, v + bande);
      brut[i + 2] = Math.min(255, b + bande);
    }
  }
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloc("IHDR", ihdr),
    bloc("IDAT", deflateSync(brut, { level: 9 })),
    bloc("IEND", Buffer.alloc(0)),
  ]);
  return "data:image/png;base64," + png.toString("base64");
}

const TABLE_CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = TABLE_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ -1;
}

const PHOTO_CLAIRE = vignettePng(196, 200, 206);
const PHOTO_SOMBRE = vignettePng(150, 154, 162);

/* --------------------------------------------------------------- les bâtiments */

const BATIMENTS = [
  {
    name: "Immeuble Gare 12",
    address: "Avenue de la Gare 12", postalCode: "1700", city: "Fribourg", canton: "FR",
    buildingType: "ADMINISTRATIF", yearBuilt: 1972, nbFloors: 5, nbApartments: 0,
    floorArea: 2100, builtArea: 460, perimeter: 88, floorHeight: 2.9, nbStaircases: 2,
    sre: 2100, status: "EN_COURS", roofType: "PLAT",
    // Un bâtiment de 1972 jamais rénové : l'enveloppe a vécu, les techniques aussi.
    severite: "lourde",
  },
  {
    name: "Résidence du Lac",
    address: "Chemin des Roseaux 14", postalCode: "1007", city: "Lausanne", canton: "VD",
    buildingType: "LOGEMENT", yearBuilt: 1985, nbFloors: 6, nbApartments: 24,
    floorArea: 3200, builtArea: 540, perimeter: 96, floorHeight: 2.6, nbStaircases: 2,
    sre: 3200, status: "EN_COURS", roofType: "PLAT",
    severite: "moyenne",
  },
  {
    name: "Villa Belmont",
    address: "Route de Belmont 8", postalCode: "1092", city: "Belmont-sur-Lausanne", canton: "VD",
    buildingType: "VILLA", yearBuilt: 2003, nbFloors: 2, nbApartments: 1,
    floorArea: 240, builtArea: 130, perimeter: 48, floorHeight: 2.5, nbStaircases: 1,
    sre: 240, status: "PLANIFIE", roofType: "PANS",
    severite: "legere",
  },
  {
    name: "École des Vergers",
    address: "Rue des Vergers 3", postalCode: "1950", city: "Sion", canton: "VS",
    buildingType: "SCOLAIRE", yearBuilt: 1990, nbFloors: 3, nbApartments: 0,
    floorArea: 2800, builtArea: 980, perimeter: 142, floorHeight: 3.2, nbStaircases: 3,
    sre: 2800, status: "EN_REVUE", roofType: "PLAT",
    severite: "moyenne",
  },
  {
    name: "Chalet Belalp",
    address: "Chemin du Glacier 22", postalCode: "3914", city: "Blatten", canton: "VS",
    buildingType: "CHALET", yearBuilt: 1978, nbFloors: 3, nbApartments: 2,
    floorArea: 180, builtArea: 90, perimeter: 40, floorHeight: 2.4, nbStaircases: 1,
    sre: 180, status: "NON_PLANIFIE", roofType: "PANS",
    severite: "lourde",
  },
];

/** Combien d'ouvrages dans chaque état, selon l'âge et l'entretien du bâtiment. */
const PROFILS = {
  lourde:  ["MAUVAIS", "MAUVAIS", "MOYEN", "MOYEN", "MOYEN", "BON", "MAUVAIS", "MOYEN", "BON", "MOYEN", "MAUVAIS", "MOYEN", "BON", "MOYEN"],
  moyenne: ["MOYEN", "BON", "MOYEN", "BON", "MOYEN", "BON", "TRES_BON", "MOYEN", "BON", "MOYEN", "BON", "TRES_BON", "MOYEN", "BON"],
  // Même une villa de 2003 a ses points d'usure : joints, production de chaleur,
  // protections solaires. Un dossier entièrement vert ne se rencontre pas.
  legere:  ["BON", "TRES_BON", "MOYEN", "BON", "TRES_BON", "BON", "MOYEN", "BON", "TRES_BON", "BON", "MOYEN", "BON", "TRES_BON", "BON"],
};

/** Priorité déduite de l'état, comme le fait l'application. */
const PRIORITE = { MAUVAIS: "I", MOYEN: "II", BON: "III", TRES_BON: "III" };

const prixDeLEtat = (c, s) => ({
  TRES_BON: c.priceTbe, BON: c.priceBon, MOYEN: c.priceMoyen, MAUVAIS: c.priceMauvais,
}[s]);

const travauxDeLEtat = (c, s) => ({
  TRES_BON: c.workTbe, BON: c.workBon, MOYEN: c.workMoyen, MAUVAIS: c.workMauvais,
}[s]);

/**
 * Quantité plausible pour un ouvrage, lue dans son unité.
 *
 * L'unité n'est pas décorative : un ouvrage au forfait multiplié par une surface
 * de façade donne un chalet de cent quatre-vingts mètres carrés à trois millions.
 * On lit donc l'unité avant de choisir la géométrie qui lui correspond, et le
 * forfait vaut un.
 */
function quantite(c, b) {
  const u = (c.unit ?? "").toLowerCase();
  const facade = b.perimeter * b.nbFloors * b.floorHeight;
  const toiture = b.builtArea * (b.roofType === "PANS" ? 1.3 : 1.05);

  if (u.startsWith("forfait")) return 1;
  if (u.includes("étage")) return b.nbFloors;
  if (u.includes("ml")) return Math.round(b.perimeter);
  if (u.includes("vitrine")) return Math.max(1, Math.round(b.builtArea * 0.05));
  if (u.includes("fenêtre")) return Math.round(facade * 0.3);
  if (u.includes("toiture")) return Math.round(toiture);
  if (u.includes("sp")) return Math.round(b.floorArea);
  if (u.includes("pce") || u.endsWith("/u")) {
    // Des pièces : portes, radiateurs, sanitaires. Le nombre suit le bâtiment.
    return Math.max(1, b.nbApartments > 0 ? b.nbApartments : b.nbFloors * 2);
  }
  if (u.includes("m²")) {
    // Un mètre carré sans précision : l'enveloppe pour les CFC 21 et 22, le
    // plancher pour les finitions intérieures des CFC 27 et 28.
    const cfc = (c.cfcCode ?? "").slice(0, 2);
    if (cfc === "21" || cfc === "22") return Math.round(facade * 0.85);
    if (cfc === "27" || cfc === "28") return Math.round(b.floorArea * 0.6);
    return Math.round(b.floorArea * 0.4);
  }
  return 1;
}

async function main() {
  const demo = await prisma.user.findUnique({ where: { email: EMAIL_DEMO }, select: { id: true } });
  if (!demo) throw new Error(`Compte ${EMAIL_DEMO} introuvable.`);

  if (vider) {
    const anciens = await prisma.project.findMany({ where: { ownerId: demo.id }, select: { id: true } });
    const ids = anciens.map((x) => x.id);
    const diags = await prisma.diagnostic.findMany({ where: { projectId: { in: ids } }, select: { id: true } });
    await prisma.diagnosticItem.deleteMany({ where: { diagnosticId: { in: diags.map((d) => d.id) } } });
    await prisma.diagnostic.deleteMany({ where: { projectId: { in: ids } } });
    await prisma.project.deleteMany({ where: { id: { in: ids } } });
    console.log(`${ids.length} ancien(s) projet(s) supprimé(s).`);
  }

  // On prend des ouvrages qui portent vraiment un prix : un relevé sans montant
  // ne montrerait ni le chiffrage ni le rapport, c'est-à-dire l'essentiel.
  const catalogue = await prisma.catalogItem.findMany({
    where: { OR: [{ priceMoyen: { not: null } }, { priceMauvais: { not: null } }] },
    orderBy: { displayOrder: "asc" },
  });
  if (catalogue.length < 14) throw new Error(`Catalogue trop maigre : ${catalogue.length} articles chiffrés.`);
  console.log(`${catalogue.length} articles chiffrés disponibles.`);

  for (const b of BATIMENTS) {
    const { severite, ...champs } = b;
    const projet = await prisma.project.create({
      data: { ...champs, ownerId: demo.id, windowPct: 30, honoraryPct: 12, reservePct: 12 },
    });
    const diag = await prisma.diagnostic.create({
      data: {
        projectId: projet.id,
        status: "IN_PROGRESS",
        visitDate: new Date(Date.UTC(2026, 8, 10 + BATIMENTS.indexOf(b))),
      },
    });

    // On répartit les relevés sur tout le catalogue plutôt que de prendre les
    // quatorze premiers : un dossier n'est pas le début de la nomenclature.
    //
    // Et on choisit un article qui porte un prix POUR L'ÉTAT qu'on va poser : la
    // plupart des ouvrages n'ont rien à faire en très bon état, et les retenir
    // donnerait un dossier à quatre cents francs, exact mais qui ne montre rien.
    const pas = Math.max(1, Math.floor(catalogue.length / 14));
    const etats = PROFILS[severite];
    const dejaPris = new Set();
    let n = 0;

    for (let i = 0; i < 14; i++) {
      const state = etats[i % etats.length];
      const depart = (i * pas + BATIMENTS.indexOf(b) * 3) % catalogue.length;
      let c = null;
      for (let k = 0; k < catalogue.length; k++) {
        const cand = catalogue[(depart + k) % catalogue.length];
        if (dejaPris.has(cand.id)) continue;
        if (Number(prixDeLEtat(cand, state) ?? 0) > 0) { c = cand; break }
      }
      if (!c) continue
      dejaPris.add(c.id);
      const prix = Number(prixDeLEtat(c, state) ?? 0);
      const aire = quantite(c, b);
      const degrade = state === "MOYEN" || state === "MAUVAIS";

      await prisma.diagnosticItem.create({
        data: {
          diagnosticId: diag.id,
          catalogItemId: c.id,
          cfcCode: c.cfcCode ?? "—",
          cfcLabel: c.description,
          state,
          priority: PRIORITE[state],
          area: aire,
          unit: c.unit,
          estimatedCost: prix > 0 ? prix * aire : 0,
          works: [travauxDeLEtat(c, state)].filter((w) => w && w !== "Néant"),
          // Les ouvrages dégradés portent deux vignettes, les autres une seule :
          // c'est l'usage, on photographie ce qui pose problème.
          photos: degrade ? [PHOTO_SOMBRE, PHOTO_CLAIRE] : [PHOTO_CLAIRE],
          quantityManual: false,
          costManual: false,
        },
      });
      n++;
    }
    // Contrôle de vraisemblance : un diagnostic de rénovation se situe entre une
    // centaine et deux mille francs du mètre carré de plancher. Au-delà, ce n'est
    // pas un dossier ambitieux, c'est une erreur de quantité, et une démonstration
    // qui porte un chiffre faux se montre en clientèle.
    const items = await prisma.diagnosticItem.findMany({
      where: { diagnosticId: diag.id }, select: { estimatedCost: true },
    });
    const total = items.reduce((s, i) => s + Number(i.estimatedCost ?? 0), 0);
    const parM2 = total / b.floorArea;
    const alerte = parM2 < 80 || parM2 > 2200 ? `  /!\\ ${Math.round(parM2)} CHF/m², invraisemblable` : "";
    console.log(`${projet.name.padEnd(20)} ${n} relevés · ${String(Math.round(total)).padStart(8)} CHF · ${String(Math.round(parM2)).padStart(5)} CHF/m²${alerte}`);
  }

  const total = await prisma.diagnosticItem.count();
  console.log(`\nTerminé. ${BATIMENTS.length} bâtiments, ${total} relevés.`);
}

main()
  .catch((e) => { console.error(e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
