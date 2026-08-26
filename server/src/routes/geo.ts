import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { logger } from "../lib/logger.js";

// Affectation précise via le cadastre RDPPF / ÖREB (extract-2.0), un service par canton,
// sans clé mais SANS CORS -> il DOIT être appelé côté serveur (pas depuis le navigateur).
const router = Router();
router.use(requireAuth);

const RDPPF: Record<string, string> = {
  VD: "https://www.rdppf.vd.ch/ws/RdppfSVC.svc",
  GE: "https://ge.ch/terecadastrews/RdppfSVC.svc",
};

/* eslint-disable @typescript-eslint/no-explicit-any */
const legendText = (r: any): string | undefined => {
  const lt = r?.LegendText ?? r?.Legend_Text;
  if (Array.isArray(lt)) return lt[0]?.Text ?? lt[0]?.text;
  if (typeof lt === "string") return lt;
  return lt?.Text;
};

function findRestrictions(obj: any): any[] | null {
  if (!obj || typeof obj !== "object") return null;
  if (Array.isArray(obj.RestrictionOnLandownership)) return obj.RestrictionOnLandownership;
  for (const k of Object.keys(obj)) {
    const r = findRestrictions(obj[k]);
    if (r) return r;
  }
  return null;
}

// Libellé FR lisible d'un thème ÖREB (codes fédéraux + cantonaux), avec repli par mot-clé.
const THEME_FR: Record<string, string> = {
  "ch.Nutzungsplanung": "Affectation",
  "ch.Laermempfindlichkeitsstufen": "Sensibilité au bruit",
  "ch.StatischeWaldgrenzen": "Lisière de forêt",
  "ch.Waldabstandslinien": "Distance à la forêt",
  "ch.BaulinienNationalstrassen": "Alignement (route nationale)",
  "ch.BaulinienEisenbahnanlagen": "Alignement (chemin de fer)",
  "ch.ProjektierungszonenNationalstrassen": "Zone réservée (route nationale)",
  "ch.ProjektierungszonenEisenbahnanlagen": "Zone réservée (chemin de fer)",
  "ch.ProjektierungszonenFlughafenanlagen": "Zone réservée (aéroport)",
  "ch.BelasteteStandorte": "Site pollué",
  "ch.BelasteteStandorteMilitaer": "Site pollué (militaire)",
  "ch.BelasteteStandorteZivileFlugplaetze": "Site pollué (aviation)",
  "ch.BelasteteStandorteOeffentlicherVerkehr": "Site pollué (transports publics)",
  "ch.Grundwasserschutzzonen": "Zone de protection des eaux",
  "ch.Grundwasserschutzareale": "Périmètre de protection des eaux",
};
function themeLabel(code: string): string {
  if (THEME_FR[code]) return THEME_FR[code];
  const c = code.toLowerCase();
  if (c.includes("nutzungsplan") || c.includes("affectation")) return "Affectation";
  if (c.includes("laerm") || c.includes("bruit")) return "Sensibilité au bruit";
  if (c.includes("baulinien") || c.includes("limite")) return "Limite des constructions";
  if (c.includes("belastet") || c.includes("pollu")) return "Site pollué";
  if (c.includes("grundwasser") || c.includes("gewaesser") || c.includes("eaux")) return "Protection des eaux";
  if (c.includes("wald") || c.includes("foret")) return "Forêt";
  if (c.includes("naturgefahr") || c.includes("gefahren") || c.includes("danger")) return "Danger naturel";
  if (c.includes("projektierungszone")) return "Zone réservée";
  // repli : nettoie le code (ch.VD.XxxYyy -> "Xxx Yyy")
  return code.replace(/^ch\.[A-Z]{0,2}\.?/, "").replace(/([a-z])([A-Z])/g, "$1 $2");
}

router.get("/affectation", async (req, res) => {
  const canton = String(req.query.canton ?? "").toUpperCase();
  const base = RDPPF[canton];
  if (!base) {
    res.json({ supported: false }); // canton non couvert -> le client garde l'affectation harmonisée
    return;
  }
  let egrid = req.query.egrid ? String(req.query.egrid) : "";
  const east = Number(req.query.east), north = Number(req.query.north);

  try {
    if (!egrid && Number.isFinite(east) && Number.isFinite(north)) {
      const xml = await (await fetch(`${base}/getegrid/xml/?EN=${east},${north}`)).text();
      egrid = (xml.match(/<egrid>([^<]+)<\/egrid>/i)?.[1] ?? "").trim();
    }
    if (!egrid) {
      res.json({ supported: true, egrid: null, affectation: null });
      return;
    }
    const j = await (await fetch(`${base}/extract/json/?EGRID=${encodeURIComponent(egrid)}`)).json();
    const rest = findRestrictions(j) ?? [];

    const affects: { label: string; sub?: string; pct?: number }[] = [];
    const restrictions: { theme: string; legend: string }[] = [];
    let noise: string | undefined;
    const seenR = new Set<string>();
    for (const x of rest) {
      const code = x?.Theme?.Code as string | undefined;
      const label = legendText(x);
      if (!code || !label) continue;
      const theme = themeLabel(code);
      const key = theme + "|" + label;
      if (!seenR.has(key)) { seenR.add(key); restrictions.push({ theme, legend: label }); }
      if (code === "ch.Nutzungsplanung") {
        affects.push({ label, sub: x?.Theme?.SubCode, pct: Number(x?.PartInPercent) || undefined });
      } else if (code === "ch.Laermempfindlichkeitsstufen" && !noise) {
        noise = label;
      }
    }
    // Affectation principale : la zone d'affectation primaire, sinon la plus grande part.
    const primary =
      affects.find((a) => /primaire|grundnutzung/i.test(a.sub ?? "")) ??
      affects.slice().sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0))[0];

    res.json({
      supported: true,
      egrid,
      affectation: primary?.label ?? null,
      affectations: affects.map((a) => a.label),
      noise: noise ?? null,
      restrictions,
    });
  } catch (e) {
    logger.warn({ err: (e as Error).message }, "rdppf affectation error");
    res.json({ supported: true, egrid: egrid || null, affectation: null, error: true });
  }
});

export default router;
