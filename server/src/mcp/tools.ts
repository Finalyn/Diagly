import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { portfolioSummary, searchDiagnostics, queryElements, aggregateCosts, portfolioWorkPlan } from "../lib/portfolio.js";
import { buildDiagnosticExport } from "../lib/diagnostic-export.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
const text = (o: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(o, null, 2) }] });
const errText = (msg: string) => ({ content: [{ type: "text" as const, text: msg }], isError: true });

// Filtres partagés par plusieurs outils (portefeuille).
const elementFilterShape = {
  cfc: z.string().optional().describe("Préfixe de code CFC. Ex. '221' = fenêtres/portes extérieures, '224' = toiture, '226' = façades, '242' = chauffage."),
  state: z.enum(["TRES_BON", "BON", "MOYEN", "MAUVAIS"]).optional().describe("État de l'élément. MAUVAIS = fin de vie / à remplacer ; MOYEN = dégradé."),
  priority: z.enum(["I", "II", "III"]).optional().describe("Priorité d'intervention. I = urgent, II = à moyen terme, III = à long terme."),
  canton: z.string().optional().describe("Code canton suisse (ex. 'VD', 'GE')."),
  buildingType: z.string().optional().describe("Type de bâtiment : LOGEMENT, VILLA, BUREAU, ADMINISTRATIF, SCOLAIRE, HOTEL, COMMERCIAL, INDUSTRIEL, CHALET, AUTRE."),
  interventionYear: z.number().int().optional().describe("Année d'intervention planifiée (ex. 2028)."),
  egid: z.string().optional().describe("Identifiant fédéral du bâtiment (EGID) pour cibler un bâtiment précis."),
};

/**
 * Construit un serveur MCP dont TOUS les outils sont strictement limités aux diagnostics du
 * propriétaire `ownerId` (résolu depuis la clé d'API). Aucun outil ne voit d'autres organisations.
 */
export function buildMcpServer(ownerId: string) {
  const server = new McpServer(
    { name: "diagly", version: "1.0.0" },
    {
      instructions:
        "Accès en lecture aux diagnostics de bâtiment Diagly du client (données reliées et granulaires, jusqu'à l'élément terrain). " +
        "Commencez par `portfolio_summary` pour cadrer les diagnostics, puis affinez avec `query_elements`, `aggregate_costs` et `work_plan`. " +
        "Les outils renvoient des compteurs et totaux déjà agrégés côté serveur : préférez-les à la lecture bâtiment par bâtiment. " +
        "Budgets = somme des enveloppes réparation + amélioration + remise aux normes (planifié). EGID = clé de jointure.",
    },
  );

  server.registerTool(
    "portfolio_summary",
    {
      title: "Résumé des diagnostics",
      description:
        "Vue d'ensemble des diagnostics du client : nombre de bâtiments, cantons couverts, nombre d'éléments diagnostiqués, budget planifié total, répartition par priorité (I/II/III) et par état. " +
        "À appeler EN PREMIER pour cadrer l'échelle avant toute question ciblée.",
    },
    async () => text(await portfolioSummary(ownerId)),
  );

  server.registerTool(
    "search_diagnostics",
    {
      title: "Rechercher des diagnostics",
      description:
        "Recherche/liste les diagnostics (un par bâtiment) des diagnostics, par texte libre (nom, ville, adresse) et/ou filtres (type, statut, canton, EGID). " +
        "Renvoie une liste compacte (id, EGID, nom, canton, type, statut). Utilisez l'`id` renvoyé avec `get_diagnostic` pour le détail complet.",
      inputSchema: {
        query: z.string().optional().describe("Texte libre : nom du bâtiment, ville ou adresse."),
        buildingType: elementFilterShape.buildingType,
        status: z.string().optional().describe("Statut du diagnostic : NON_PLANIFIE, PLANIFIE, EN_COURS, EN_REVUE, TERMINE, ARCHIVE."),
        canton: elementFilterShape.canton,
        egid: elementFilterShape.egid,
        limit: z.number().int().min(1).max(100).optional().describe("Nombre max de résultats (défaut 25)."),
      },
    },
    async (a: any) => text(await searchDiagnostics(ownerId, a, a.limit ?? 25)),
  );

  server.registerTool(
    "get_diagnostic",
    {
      title: "Détail d'un diagnostic",
      description:
        "Détail complet d'un bâtiment : identification (EGID, adresse), tous les éléments (code CFC, état, priorité, observation, coûts par enveloppe, année d'intervention), " +
        "le chiffrage (sous-totaux, honoraires, réserve, TVA, total TTC), le plan de travaux et les 3 scénarios de rénovation. Utiliser l'`id` obtenu via `search_diagnostics`.",
      inputSchema: { id: z.string().describe("Identifiant du diagnostic/bâtiment (champ `id` de search_diagnostics).") },
    },
    async (a: any) => {
      try {
        const p = await buildDiagnosticExport(a.id, ownerId);
        return text({ id: a.id, building: p.building, elements: p.items, costs: p.costs, workPlan: p.workPlan, variants: p.variants });
      } catch {
        return errText("Diagnostic introuvable dans vos diagnostics (id inconnu ou hors périmètre).");
      }
    },
  );

  server.registerTool(
    "query_elements",
    {
      title: "Interroger les éléments des diagnostics",
      description:
        "Interroge les éléments SUR L'ENSEMBLE DES DIAGNOSTICS par code CFC, état, priorité, canton, type, année ou EGID. " +
        "Conçu pour l'agrégation : renvoie le nombre d'éléments correspondants, le nombre de bâtiments concernés, le budget total, la répartition par priorité, et un ÉCHANTILLON d'éléments (pas tous les diagnostics). " +
        "Exemples : fenêtres en fin de vie = {cfc:'221', state:'MAUVAIS'} ; éléments priorité I = {priority:'I'} ; ce qui tombe en 2028 = {interventionYear:2028}.",
      inputSchema: { ...elementFilterShape, limit: z.number().int().min(1).max(200).optional().describe("Taille de l'échantillon d'éléments détaillés renvoyés (défaut 50). Les compteurs/totaux couvrent TOUS les diagnostics.") },
    },
    async (a: any) => text(await queryElements(ownerId, a, a.limit ?? 50)),
  );

  server.registerTool(
    "aggregate_costs",
    {
      title: "Agréger les coûts des diagnostics",
      description:
        "Agrège le budget planifié des diagnostics en sommes par dimension : par canton, par année d'intervention, par priorité ou par type de bâtiment. Filtres optionnels (CFC, état, priorité, canton…). " +
        "Exemples : budget par canton = {groupBy:'canton'} ; budget par année (dont 2028) = {groupBy:'year'} ; budget des fenêtres par canton = {groupBy:'canton', cfc:'221'}.",
      inputSchema: { groupBy: z.enum(["canton", "year", "priority", "buildingType"]).describe("Dimension d'agrégation."), ...elementFilterShape },
    },
    async (a: any) => text(await aggregateCosts(ownerId, a.groupBy, a)),
  );

  server.registerTool(
    "work_plan",
    {
      title: "Plan de travaux des diagnostics",
      description:
        "Plan de travaux consolidé des diagnostics, PAR ANNÉE d'intervention : budget total, nombre d'éléments et répartition par priorité pour chaque année. " +
        "Idéal pour la question 'quel budget en 2028 ?' ou pour projeter la charge d'entretien sur plusieurs années. Filtres optionnels (canton, priorité, CFC, type).",
      inputSchema: elementFilterShape,
    },
    async (a: any) => text(await portfolioWorkPlan(ownerId, a)),
  );

  return server;
}
