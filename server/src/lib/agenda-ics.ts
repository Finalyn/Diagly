/**
 * Les occupations d'un agenda publié en iCalendar (.ics).
 *
 * La prise de démo de diagly.ch ne propose que les créneaux où l'hôte est
 * libre. Son agenda, celui du Finalyn Hub, se lit par un flux .ics privé
 * (DEMO_AGENDA_ICS) : chaque événement du flux occupe un intervalle, et un
 * créneau qui le touche n'est pas proposé.
 *
 * Le Hub écrit ses heures « flottantes », à lire à Zurich ; une heure en UTC
 * (suffixe Z) est lue comme telle, une heure avec TZID est lue à Zurich (le
 * seul fuseau de l'équipe). Une journée entière occupe la journée, comme dans
 * la prise de rendez-vous du Hub.
 */
import { env } from "./env.js";
import { instantSuisse } from "./heure-suisse.js";
import { logger } from "./logger.js";

/** Un intervalle occupé, en millisecondes UTC, fin exclue. */
export interface Occupation {
  debut: number;
  fin: number;
}

const JOUR = 86_400_000;

/** « 20261028 » -> « 2026-10-28 ». */
const tirets = (d: string) => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;

/** Le lendemain d'une date « AAAA-MM-JJ ». */
function lendemain(date: string): string {
  const t = new Date(`${date}T00:00:00Z`).getTime() + JOUR;
  return new Date(t).toISOString().slice(0, 10);
}

interface Valeur { date: string; heure: string | null; utc: boolean }

/** « DTSTART;TZID=Europe/Zurich:20261028T100000 » -> { date, heure, utc }. */
function lireDate(ligne: string | undefined): Valeur | null {
  if (!ligne) return null;
  const v = ligne.slice(ligne.indexOf(":") + 1).trim();
  const m = v.match(/^(\d{8})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  return { date: tirets(m[1]), heure: m[2] ? `${m[2]}:${m[3]}` : null, utc: Boolean(m[5]) };
}

function instant(v: Valeur): number {
  if (!v.heure) return instantSuisse(v.date, "00:00").getTime();
  if (v.utc) return Date.parse(`${v.date}T${v.heure}:00Z`);
  return instantSuisse(v.date, v.heure).getTime();
}

/** La durée ISO 8601 d'un événement (« PT1H30M », « P1D »), en millisecondes. */
function duree(texte: string | undefined): number | null {
  const m = texte?.slice(texte.indexOf(":") + 1).trim().match(/^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return null;
  const [, w, d, h, mi, s] = m.map((x) => Number(x ?? 0));
  return ((w * 7 + d) * 24 * 3600 + h * 3600 + mi * 60 + s) * 1000;
}

/** Les intervalles occupés d'un flux iCalendar. */
export function occupationsDuFlux(ics: string): Occupation[] {
  // Les lignes longues sont repliées : une ligne qui commence par un blanc continue la précédente.
  const texte = ics.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
  const sortie: Occupation[] = [];
  for (const bloc of texte.split("BEGIN:VEVENT").slice(1)) {
    const corps = bloc.split("END:VEVENT")[0];
    const lignes = corps.split("\n");
    const champ = (nom: string) => lignes.find((l) => l.startsWith(`${nom}:`) || l.startsWith(`${nom};`));
    // Un événement annulé ou « disponible » n'occupe rien, une journée de
    // télétravail non plus : on reste joignable pour une démo en visioconférence.
    if (/^STATUS:CANCELLED/m.test(corps) || /^TRANSP:TRANSPARENT/m.test(corps)) continue;
    if (/^CATEGORIES:.*\bteletravail\b/im.test(corps)) continue;
    const debut = lireDate(champ("DTSTART"));
    if (!debut) continue;
    const t0 = instant(debut);
    const finLue = lireDate(champ("DTEND"));
    let t1: number;
    if (finLue) t1 = instant(finLue);
    else if (duree(champ("DURATION")) != null) t1 = t0 + duree(champ("DURATION"))!;
    else t1 = debut.heure ? t0 : instantSuisse(lendemain(debut.date), "00:00").getTime();
    // Une fin avant le début : un événement qui passe minuit sans changer de date.
    if (t1 < t0) t1 += JOUR;
    sortie.push({ debut: t0, fin: t1 });
  }
  return sortie.sort((a, b) => a.debut - b.debut);
}

/** Combien de temps on garde le flux lu : la page des démos le demande à chaque visite. */
const FRAIS_MS = 2 * 60_000;
/** Si le flux ne répond plus, la dernière lecture reste valable une journée. */
const PERIME_MS = 24 * 3600_000;

let cache: { lu: number; occupations: Occupation[] } | null = null;

/**
 * Les occupations de l'agenda de l'hôte.
 *
 * null quand aucun agenda n'est configuré (en développement) : tous les
 * créneaux sont alors proposés. Lève une erreur quand l'agenda est configuré
 * mais injoignable et qu'aucune lecture récente n'existe : mieux vaut ne rien
 * proposer qu'un créneau déjà pris.
 */
export async function occupationsDeLAgenda(o: { frais?: boolean } = {}): Promise<Occupation[] | null> {
  const url = env.DEMO_AGENDA_ICS;
  if (!url) return null;
  if (!o.frais && cache && Date.now() - cache.lu < FRAIS_MS) return cache.occupations;
  try {
    const controle = new AbortController();
    const minuteur = setTimeout(() => controle.abort(), 8000);
    const reponse = await fetch(url, { signal: controle.signal, headers: { Accept: "text/calendar" } });
    clearTimeout(minuteur);
    if (!reponse.ok) throw new Error(`agenda : HTTP ${reponse.status}`);
    const occupations = occupationsDuFlux(await reponse.text());
    cache = { lu: Date.now(), occupations };
    return occupations;
  } catch (e) {
    logger.warn({ err: (e as Error).message }, "démos : agenda de l'hôte injoignable");
    if (cache && Date.now() - cache.lu < PERIME_MS) return cache.occupations;
    throw new Error("L'agenda est momentanément injoignable.");
  }
}

/** Pour les tests : oublie la dernière lecture. */
export function oublierLAgenda(): void {
  cache = null;
}
