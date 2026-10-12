/**
 * Pas un tiret cadratin dans ce que le site affiche.
 *
 * C'est une règle d'écriture de la maison : le tiret cadratin « — » ne paraît
 * ni dans l'application, ni dans les rapports, ni dans les courriels. Elle se
 * perd vite, parce qu'un clavier ne le produit pas par accident mais qu'un
 * texte collé depuis ailleurs en apporte toujours.
 *
 * Le contrôle lit les sources plutôt que les écrans : un écran se vérifie au
 * moment où on le regarde, un fichier se vérifie à chaque exécution. Il laisse
 * de côté les lignes de commentaire, qui ne s'affichent nulle part, et les
 * fichiers de test, dont celui-ci, qui doivent pouvoir nommer le caractère
 * qu'ils interdisent.
 *
 * Il vit du côté serveur parce que c'est là qu'on lit le disque : la
 * configuration TypeScript du client ne connaît pas les modules de Node.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const TIRET = "—";
const RACINES = ["src", "server/src", "public"];
const EXTENSIONS = [".ts", ".tsx", ".js", ".css", ".html"];

/** La racine du dépôt, d'où qu'on lance les tests : elle porte src/ et server/. */
function racineDuDepot(): string {
  let d = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (existsSync(join(d, "src")) && existsSync(join(d, "server"))) return d;
    const parent = dirname(d);
    if (parent === d) break;
    d = parent;
  }
  return process.cwd();
}

function fichiers(racine: string): string[] {
  let trouves: string[] = [];
  if (!existsSync(racine)) return trouves;
  for (const nom of readdirSync(racine)) {
    const chemin = join(racine, nom);
    if (statSync(chemin).isDirectory()) {
      if (nom === "node_modules" || nom === "dist") continue;
      trouves = trouves.concat(fichiers(chemin));
      continue;
    }
    if (nom.includes(".test.")) continue;
    if (EXTENSIONS.some((e) => nom.endsWith(e))) trouves.push(chemin);
  }
  return trouves;
}

describe("les textes du site", () => {
  it("n'emploient pas de tiret cadratin", () => {
    const racine = racineDuDepot();
    const fautes: string[] = [];
    let lus = 0;
    for (const sous of RACINES) {
      for (const fichier of fichiers(resolve(racine, sous))) {
        lus++;
        const lignes = readFileSync(fichier, "utf8").split("\n");
        let bloc = false;
        lignes.forEach((ligne, i) => {
          const nu = ligne.trim();
          const ouvre = nu.startsWith("/*") || nu.startsWith("{/*");
          const estCommentaire =
            bloc || ouvre || nu.startsWith("//") || nu.startsWith("*");
          if (ouvre && !nu.includes("*/")) bloc = true;
          else if (bloc && nu.includes("*/")) bloc = false;
          if (!estCommentaire && ligne.includes(TIRET)) {
            fautes.push(
              fichier.slice(racine.length + 1) + ":" + (i + 1) + " " + nu.slice(0, 90),
            );
          }
        });
      }
    }
    // Un contrôle qui ne lit rien ne prouve rien.
    expect(lus).toBeGreaterThan(100);
    expect(fautes, fautes.join("\n")).toEqual([]);
  });
});
