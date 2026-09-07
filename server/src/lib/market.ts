// Indexation des coûts sur le marché suisse de la construction.
//
// Les prix du catalogue sont une base de référence rattachée à une période. Le
// coefficient = indice courant / indice de base les ramène au marché du moment.
// Source unique pour toute l'application : la route /api/market/index, les
// estimations de scénarios et la réindexation des dossiers lisent tous d'ici.
//
// L'OFS publie deux fois par an (avril et octobre). Pas d'API temps réel : la
// valeur courante est une variable d'environnement, modifiable côté serveur sans
// redéployer, et la réindexation propage le changement aux dossiers existants.

const num = (v: string | undefined, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : d;
};

/** Période de référence des prix du catalogue. */
export const BASE_INDEX = num(process.env.DIAGLY_BASE_INDEX, 100);
/**
 * Indice courant. Par défaut égal à la base : les prix du catalogue sont ceux du
 * marché actuel, fournis tels quels par le bureau, et ne doivent pas être majorés.
 * Renseigner DIAGLY_MARKET_INDEX et DIAGLY_MARKET_INDEX_DATE le jour où le
 * catalogue vieillit et qu'on veut le suivre sur l'indice OFS sans le ressaisir.
 */
export const CURRENT_INDEX = num(process.env.DIAGLY_MARKET_INDEX, BASE_INDEX);
export const INDEX_DATE = process.env.DIAGLY_MARKET_INDEX_DATE || "";
export const INDEX_SOURCE =
  process.env.DIAGLY_MARKET_INDEX_SOURCE ||
  "Prix du catalogue du bureau, au marché actuel, sans indexation";

/** Coefficient appliqué à tous les coûts estimés. */
export const marketCoeff = () => Math.round((CURRENT_INDEX / BASE_INDEX) * 1000) / 1000;

/**
 * Coefficient présumé des coûts écrits avant l'existence de la colonne cost_index.
 * La production n'a jamais servi autre chose que 1.123, donc c'est la seule valeur
 * possible pour ces lignes. À ne pas confondre avec le coefficient courant : si
 * celui-ci change, les anciennes lignes doivent quand même partir de 1.123.
 */
export const LEGACY_COST_INDEX = num(process.env.DIAGLY_LEGACY_COST_INDEX, 1.123);

export const marketInfo = () => ({
  coeff: marketCoeff(),
  base: BASE_INDEX,
  index: CURRENT_INDEX,
  indexDate: INDEX_DATE,
  source: INDEX_SOURCE,
});
