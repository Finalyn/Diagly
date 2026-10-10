/**
 * Lot 2 : importer la base CFC v3 et reprendre les diagnostics existants.
 *
 *   npx tsx prisma/base-cfc/importer.ts [classeur.xlsx]            apercu
 *   npx tsx prisma/base-cfc/importer.ts [classeur.xlsx] --appliquer  ecrit
 *
 * Reexecutable : relance a l'identique, il ne change rien et le dit. C'est ce
 * qui permet de le rejouer sur un autre environnement, ou apres une correction
 * du classeur, sans se demander ce qu'il va casser.
 *
 * Deux regles tiennent tout le reste :
 *   - un article utilise par un releve n'est jamais supprime, il est desactive ;
 *   - un releve dont l'article n'a pas de repreneur garde son ancien article.
 * Le rapport dit ce qui a ete fait, et surtout ce qui ne l'a pas ete.
 */

import { Prisma, PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  assemblerArticle, assemblerEtapes, assemblerNomenclature, assemblerPostes, controler,
  type ArticleBase, type NoeudCfc,
} from "../../../src/lib/base-cfc/assembler";
import { choisirEtape, redirection, type Correspondance } from "../../../src/lib/base-cfc/migration";
import { lireClasseur } from "./classeur";

const ICI = dirname(fileURLToPath(import.meta.url));
const CLASSEUR = process.argv.find((a) => a.endsWith(".xlsx")) ?? "C:/Users/switc/Downloads/DIAGLY_base_CFC_v3.xlsx";
const APPLIQUER = process.argv.includes("--appliquer");

const prisma = new PrismaClient();

/** Ce que l'import a fait, ou ferait. */
const rapport = {
  nomenclature: { crees: 0, modifies: 0, parentsRecrees: [] as string[] },
  articles: { crees: 0, modifies: 0, inchanges: 0, desactives: [] as string[] },
  etats: { ecrits: 0 },
  etapes: { crees: 0, liens: 0 },
  postes: { ecrits: 0 },
  releves: {
    total: 0,
    redirigesVersArticle: 0,
    reclassesDansEtape: 0,
    etapeIndecise: [] as string[],
    sansRepreneur: [] as string[],
  },
  aTrancher: [] as string[],
};

// ---------------------------------------------------------------- nomenclature

/**
 * La nomenclature, parents d'abord.
 *
 * Un noeud cite un parent qui n'existe pas dans le classeur (le code 10). On le
 * cree plutot que de couper la branche : sans lui, ses enfants remonteraient a
 * la racine et l'arborescence de l'ecran /app/cfc deviendrait fausse. Son
 * libelle dit qu'il manque, pour qu'on le complete.
 */
function completerParents(noeuds: NoeudCfc[]): NoeudCfc[] {
  const connus = new Set(noeuds.map((n) => n.code));
  const ajouts: NoeudCfc[] = [];
  for (const n of noeuds) {
    if (n.parentCode && !connus.has(n.parentCode)) {
      connus.add(n.parentCode);
      ajouts.push({
        code: n.parentCode,
        libelle: `Code ${n.parentCode} (absent du classeur, libellé à compléter)`,
        niveau: Math.max(1, n.niveau - 1),
        parentCode: null,
      });
      rapport.nomenclature.parentsRecrees.push(n.parentCode);
    }
  }
  return [...ajouts, ...noeuds];
}

async function importerNomenclature(noeuds: NoeudCfc[]) {
  const complets = completerParents(noeuds);
  const existants = new Map((await prisma.cfcNomenclature.findMany()).map((n) => [n.code, n]));

  // Par niveau croissant : un parent doit exister avant son enfant.
  for (const n of [...complets].sort((a, b) => a.niveau - b.niveau)) {
    const avant = existants.get(n.code);
    if (avant && avant.libelle === n.libelle && avant.niveau === n.niveau && avant.parentCode === n.parentCode) continue;
    if (avant) rapport.nomenclature.modifies++;
    else rapport.nomenclature.crees++;
    if (!APPLIQUER) continue;
    await prisma.cfcNomenclature.upsert({
      where: { code: n.code },
      create: { code: n.code, libelle: n.libelle, niveau: n.niveau, parentCode: n.parentCode },
      update: { libelle: n.libelle, niveau: n.niveau, parentCode: n.parentCode },
    });
  }
}

// --------------------------------------------------------------------- articles

const MEMES_CHAMPS: (keyof ArticleBase)[] = [
  "cfcCode", "nom", "domaineRapport", "groupeAlternatives", "echafaudage",
  "uniteEntretien", "uniteRemplacement", "baseQuantite", "indicationQuantite",
  "coefficient", "noteDiagnostiqueur", "ligneOrigine",
];

async function importerArticles(articles: ArticleBase[]) {
  const existants = new Map((await prisma.article.findMany()).map((a) => [a.id, a]));

  for (const a of articles) {
    const avant = existants.get(a.id);
    const donnees = {
      cfcCode: a.cfcCode, nom: a.nom, domaineRapport: a.domaineRapport,
      groupeAlternatives: a.groupeAlternatives, echafaudage: a.echafaudage,
      uniteEntretien: a.uniteEntretien, uniteRemplacement: a.uniteRemplacement,
      baseQuantite: a.baseQuantite, indicationQuantite: a.indicationQuantite,
      coefficient: a.coefficient, noteDiagnostiqueur: a.noteDiagnostiqueur,
      ligneOrigine: a.ligneOrigine, actif: true,
    };

    rapport.etats.ecrits += a.etats.length;
    const identique = avant
      && avant.actif
      && MEMES_CHAMPS.every((c) => String(avant[c as keyof typeof avant] ?? "") === String(a[c] ?? ""));
    if (identique) rapport.articles.inchanges++;
    else if (avant) rapport.articles.modifies++;
    else rapport.articles.crees++;

    if (!APPLIQUER) continue;
    await prisma.article.upsert({ where: { id: a.id }, create: { id: a.id, ...donnees }, update: donnees });

    // Les etats sont remplaces en bloc : un etat retire du classeur doit
    // disparaitre, et comparer six lignes coute plus cher que les reecrire.
    await prisma.articleEtat.deleteMany({ where: { articleId: a.id } });
    await prisma.articleEtat.createMany({
      data: a.etats.map((e) => ({
        articleId: a.id, etat: e.etat, travaux: e.travaux,
        prix: e.prix === null ? null : new Prisma.Decimal(e.prix),
        partPrixMauvais: e.partPrixMauvais, unite: e.unite,
      })),
    });
  }

  // Le lien entre articles se pose apres, quand les deux existent.
  if (APPLIQUER) {
    for (const [de, vers] of LIENS_ARTICLES) {
      if (!articles.some((a) => a.id === de) || !articles.some((a) => a.id === vers)) continue;
      await prisma.article.update({ where: { id: de }, data: { articleLieId: vers } });
    }
  }

  // Ce qui n'est plus dans le classeur est desactive, jamais supprime.
  const gardes = new Set(articles.map((a) => a.id));
  for (const [id, a] of existants) {
    if (gardes.has(id) || !a.actif) continue;
    rapport.articles.desactives.push(id);
    if (APPLIQUER) await prisma.article.update({ where: { id }, data: { actif: false } });
  }
}

/**
 * Les articles qui portent l'amelioration d'un autre.
 *
 * Le classeur l'ecrit en note (« Amelioration chiffree via l'article A064 »)
 * et non dans une colonne : la relation est donc posee ici, en clair, plutot
 * que devinee par analyse du texte de la note.
 */
const LIENS_ARTICLES: [string, string][] = [["A068", "A064"]];

// ----------------------------------------------------------------- les etapes

async function importerEtapes(
  etapes: { numero: number; nom: string; zone: string }[],
  liens: { articleId: string; etapeNumero: number; ordreDansEtape: number }[],
) {
  const existantes = new Map((await prisma.etapeVisite.findMany()).map((e) => [e.numero, e]));
  for (const e of etapes) {
    const avant = existantes.get(e.numero);
    if (avant && avant.nom === e.nom && avant.zone === e.zone) continue;
    rapport.etapes.crees++;
    if (!APPLIQUER) continue;
    await prisma.etapeVisite.upsert({
      where: { numero: e.numero },
      create: e,
      update: { nom: e.nom, zone: e.zone },
    });
  }

  rapport.etapes.liens = liens.length;
  if (!APPLIQUER) return;
  // L'ordre de visite vient en bloc du classeur : c'est lui la source.
  await prisma.articleEtape.deleteMany({});
  await prisma.articleEtape.createMany({ data: liens });
}

async function importerPostes(postes: Awaited<ReturnType<typeof assemblerPostes>>) {
  for (const p of postes) {
    rapport.postes.ecrits++;
    if (!APPLIQUER) continue;
    const donnees = {
      libelle: p.libelle, declencheur: p.declencheur, unite: p.unite,
      prix: new Prisma.Decimal(p.prix), regleQuantite: p.regleQuantite, remarque: p.remarque,
    };
    await prisma.posteAutomatique.upsert({
      where: { cfcCode: p.cfcCode },
      create: { cfcCode: p.cfcCode, ...donnees },
      update: donnees,
    });
  }
}

// -------------------------------------------------------------- les diagnostics

type LigneCorrespondance = Correspondance & { ancienNom: string; releves: number };

async function migrerReleves(
  liens: { articleId: string; etapeNumero: number }[],
  etapes: { numero: number; zone: string }[],
) {
  const chemin = resolve(ICI, "..", "correspondance", "correspondance.json");
  const table = JSON.parse(readFileSync(chemin, "utf8")).lignes as LigneCorrespondance[];
  const parOrdre = new Map(table.map((l) => [l.ancienOrdre, l]));

  const anciens = new Map(
    (await prisma.catalogItem.findMany({ select: { id: true, displayOrder: true, description: true } }))
      .map((c) => [c.id, c]),
  );
  // Les etapes viennent du classeur et non de la base : en apercu, la base ne
  // les a pas encore et le rapport annoncerait zero reclassement.
  const etapesParArticle = new Map<string, number[]>();
  for (const l of [...liens].sort((a, b) => a.etapeNumero - b.etapeNumero)) {
    etapesParArticle.set(l.articleId, [...(etapesParArticle.get(l.articleId) ?? []), l.etapeNumero]);
  }
  const zones = new Map(etapes.map((e) => [e.numero, e.zone]));

  const releves = await prisma.diagnosticItem.findMany({
    select: { id: true, catalogItemId: true, articleId: true, etapeNumero: true, localisation: true, cfcLabel: true },
  });
  rapport.releves.total = releves.length;

  for (const r of releves) {
    const ancien = r.catalogItemId ? anciens.get(r.catalogItemId) : null;
    const correspondance = ancien ? parOrdre.get(ancien.displayOrder) : undefined;

    const { articleId: nouveau, aTrancher } = redirection(correspondance);
    if (aTrancher) rapport.aTrancher.push(`${ancien?.description} (${correspondance?.releves} relevé(s))`);
    if (!nouveau) {
      rapport.releves.sansRepreneur.push(ancien?.description ?? r.cfcLabel);
      continue;
    }

    const { etape, parDefaut } = choisirEtape(etapesParArticle.get(nouveau) ?? [], r.localisation, zones);
    if (parDefaut) rapport.releves.etapeIndecise.push(`${ancien?.description} → ${nouveau} (étape ${etape})`);

    const dejaFait = r.articleId === nouveau && r.etapeNumero === etape;
    if (dejaFait) continue;
    if (r.articleId !== nouveau) rapport.releves.redirigesVersArticle++;
    if (etape !== null && r.etapeNumero !== etape) rapport.releves.reclassesDansEtape++;
    if (!APPLIQUER) continue;
    await prisma.diagnosticItem.update({
      where: { id: r.id },
      data: { articleId: nouveau, etapeNumero: etape ?? undefined },
    });
  }
}

// ------------------------------------------------------------------- execution

const brut = await lireClasseur(CLASSEUR);
const articles = brut.articles.map(assemblerArticle);
const { etapes, liens } = assemblerEtapes(brut.visite);
const nomenclature = assemblerNomenclature(brut.nomenclature);
const postes = assemblerPostes(brut.postes);

const bloquantes = controler({ articles, nomenclature, liens, etapes }).filter((a) => a.gravite === "bloquante");
if (bloquantes.length > 0) {
  console.error(`Import refusé : ${bloquantes.length} anomalies bloquantes.`);
  for (const a of bloquantes) console.error(`  ${a.articleId ?? ""} ${a.message}`);
  process.exit(1);
}

await importerNomenclature(nomenclature);
await importerArticles(articles);
await importerEtapes(etapes, liens);
await importerPostes(postes);
await migrerReleves(liens, etapes);

const titre = APPLIQUER ? "IMPORT APPLIQUÉ" : "APERÇU (rien n'est écrit, ajoutez --appliquer)";
console.log(`\n${"=".repeat(64)}\n${titre}\n${"=".repeat(64)}`);
console.log(`Nomenclature  ${rapport.nomenclature.crees} créés, ${rapport.nomenclature.modifies} modifiés`);
if (rapport.nomenclature.parentsRecrees.length > 0) {
  console.log(`              parents recréés (libellé à compléter) : ${rapport.nomenclature.parentsRecrees.join(", ")}`);
}
console.log(`Articles      ${rapport.articles.crees} créés, ${rapport.articles.modifies} modifiés, ${rapport.articles.inchanges} inchangés`);
if (rapport.articles.desactives.length > 0) console.log(`              désactivés : ${rapport.articles.desactives.join(", ")}`);
console.log(`États         ${rapport.etats.ecrits} réécrits`);
console.log(`Étapes        ${rapport.etapes.crees} écrites, ${rapport.etapes.liens} liens article/étape réécrits`);
console.log(`Postes auto   ${rapport.postes.ecrits} écrits`);
console.log(`\nRelevés       ${rapport.releves.total} au total`);
console.log(`              ${rapport.releves.redirigesVersArticle} redirigés vers un article v3`);
console.log(`              ${rapport.releves.reclassesDansEtape} reclassés dans une étape`);
console.log(`              ${rapport.releves.sansRepreneur.length} sans repreneur, laissés sur leur ancien article :`);
for (const [nom, n] of compter(rapport.releves.sansRepreneur)) console.log(`                 ${nom} (${n})`);
if (rapport.releves.etapeIndecise.length > 0) {
  console.log(`              ${rapport.releves.etapeIndecise.length} rangés par défaut dans la première étape, à vérifier :`);
  for (const [nom, n] of compter(rapport.releves.etapeIndecise)) console.log(`                 ${nom} (${n})`);
}
if (rapport.aTrancher.length > 0) {
  console.log(`\nÀ trancher dans corrections.json :`);
  for (const [nom, n] of compter(rapport.aTrancher)) console.log(`   ${nom} (${n})`);
}

function compter(liste: string[]): [string, number][] {
  const m = new Map<string, number>();
  for (const x of liste) m.set(x, (m.get(x) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

await prisma.$disconnect();
