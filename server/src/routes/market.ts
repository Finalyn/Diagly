import { Router } from "express";

// Indexation des prix du catalogue sur le marché suisse de la construction.
//
// Les prix du catalogue Diagly sont une base de référence (période DIAGLY_BASE_INDEX).
// Ce endpoint renvoie un coefficient = indice courant / indice de base, calculé sur
// l'Indice suisse des prix de la construction (OFS / BFS, "Baupreisindex", base
// octobre 2020 = 100). Le front l'applique à tous les coûts estimés.
//
// Pas d'API temps réel gratuite fiable côté OFS (publication semestrielle via PxWeb) :
// la valeur courante est configurable par variable d'environnement et se met à jour
// côté serveur — sans redéployer le front — à chaque nouvelle publication OFS.
// Pour brancher un flux live plus tard : remplacer currentIndex par un fetch PxWeb.
const router = Router();

const num = (v: string | undefined, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : d;
};

// Base = période de référence des prix du catalogue. Courant = dernière publication OFS.
const BASE_INDEX = num(process.env.DIAGLY_BASE_INDEX, 100); // oct. 2020 = 100
const CURRENT_INDEX = num(process.env.DIAGLY_MARKET_INDEX, 112.3); // OFS avril 2025 (Suisse, construction)
const INDEX_DATE = process.env.DIAGLY_MARKET_INDEX_DATE || "2025-04";

router.get("/index", (_req, res) => {
  const coeff = Math.round((CURRENT_INDEX / BASE_INDEX) * 1000) / 1000;
  res.json({
    coeff,
    base: BASE_INDEX,
    index: CURRENT_INDEX,
    indexDate: INDEX_DATE,
    source: "Indice suisse des prix de la construction (OFS/BFS), base octobre 2020 = 100",
  });
});

export default router;
