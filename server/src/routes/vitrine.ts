import { Router } from "express";
import rateLimit from "express-rate-limit";
import { logger } from "../lib/logger.js";

/**
 * Le peu que la page publique a le droit de montrer d'un bâtiment.
 *
 * La démonstration d'adresse doit afficher une vraie valeur, sinon elle ne prouve
 * rien. Mais interroger le registre fédéral depuis le navigateur livrerait la
 * réponse entière dans l'onglet réseau : étages, logements, emprise au sol,
 * surface énergétique. Tout ce qu'il faut pour se passer de nous.
 *
 * L'appel est donc fait ici, et seule l'année de construction ressort. Le reste
 * n'atteint jamais le visiteur.
 */

const IDENTIFIE = "https://api3.geo.admin.ch/rest/services/api/MapServer/identify";

// Le registre ne porte pas toujours l'année exacte ; il donne alors une période, codée.
const PERIODES: Record<number, string> = {
  8011: "avant 1919", 8012: "1919 à 1945", 8013: "1946 à 1960", 8014: "1961 à 1970",
  8015: "1971 à 1980", 8016: "1981 à 1985", 8017: "1986 à 1990", 8018: "1991 à 1995",
  8019: "1996 à 2000", 8020: "2001 à 2005", 8021: "2006 à 2010", 8022: "2011 à 2015",
  8023: "2016 à 2020", 8024: "dès 2021",
};

// Page publique, sans compte : on borne ce qu'une même adresse IP peut demander.
const limiteur = rateLimit({
  windowMs: 60_000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de recherches, réessayez dans un instant." },
});

const router = Router();

const coord = (v: unknown, min: number, max: number): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

/**
 * GET /api/vitrine/annee?lat=&lon=
 * Rend { annee } ou { annee: null } si le point n'est rattaché à aucun bâtiment.
 * Les bornes couvrent la Suisse : inutile de relayer une requête pour Tokyo.
 */
router.get("/annee", limiteur, async (req, res) => {
  const lat = coord(req.query.lat, 45.5, 48);
  const lon = coord(req.query.lon, 5.7, 10.6);
  if (lat === null || lon === null) return res.status(400).json({ error: "Coordonnées hors de Suisse." });

  try {
    const u = new URL(IDENTIFIE);
    u.searchParams.set("geometry", `${lon},${lat}`);
    u.searchParams.set("geometryType", "esriGeometryPoint");
    u.searchParams.set("layers", "all:ch.bfs.gebaeude_wohnungs_register");
    u.searchParams.set("tolerance", "8");
    u.searchParams.set("sr", "4326");
    u.searchParams.set("mapExtent", `${lon - 0.001},${lat - 0.001},${lon + 0.001},${lat + 0.001}`);
    u.searchParams.set("imageDisplay", "600,400,96");

    const controle = new AbortController();
    const minuteur = setTimeout(() => controle.abort(), 6000);
    const reponse = await fetch(u, { signal: controle.signal });
    clearTimeout(minuteur);
    if (!reponse.ok) return res.json({ annee: null });

    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const a = (await reponse.json() as any)?.results?.[0]?.attributes;
    const exacte = typeof a?.gbauj === "number" ? String(a.gbauj) : null;
    const periode = typeof a?.gbaup === "number" ? PERIODES[a.gbaup] ?? null : null;
    // Rien d'autre ne sort d'ici : ni l'emprise, ni les logements, ni les étages.
    return res.json({ annee: exacte ?? periode });
  } catch (e) {
    logger.warn({ err: e }, "vitrine: registre des bâtiments injoignable");
    return res.json({ annee: null });
  }
});

export default router;
