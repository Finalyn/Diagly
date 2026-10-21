/**
 * Les e-mails des démos : confirmation, rappel, déplacement, annulation, pour
 * le visiteur et pour l'hôte.
 *
 * Un gabarit à part, plus soigné que celui des notifications : c'est souvent
 * le premier message que reçoit un futur client. Le logo en tête (joint, cid),
 * une carte blanche avec le rendez-vous en encadré, un bouton, puis les liens
 * pour déplacer ou annuler. Tableaux et styles en ligne, que toutes les
 * messageries rendent pareil.
 *
 * Chaque message porte aussi l'invitation d'agenda (.ics) : ouverte, elle
 * ajoute la démo à l'agenda du destinataire, et le déplacement ou
 * l'annulation la mettent à jour d'eux-mêmes (même UID, SEQUENCE suivante).
 */
import { env } from "./env.js";
import { dateEnLettres, heureEnLettres, quandEnLettres } from "./demos.js";

export interface DemoPourMail {
  id: string;
  nom: string;
  email: string;
  bureau: string | null;
  telephone: string | null;
  message: string | null;
  debut: Date;
  fin: Date;
  sequence: number;
  jetonClient: string;
  jetonHote: string;
  motif?: string | null;
}

export interface MailDemo {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  icalEvent?: { method: "REQUEST" | "CANCEL"; content: string; filename: string };
}

const BLEU = "#0167EA";
const ENCRE = "#0b1220";
const GRIS = "#5b6472";

const site = () => env.APP_URL.replace(/\/$/, "");
const lienClient = (d: DemoPourMail) => `${site()}/demo/${d.jetonClient}`;
/** Le lien qui ouvre directement la confirmation d'annulation. */
const lienAnnuler = (d: DemoPourMail) => `${lienClient(d)}?annuler`;
const lienHote = (d: DemoPourMail) => `${site()}/demo/${d.jetonHote}`;
const prenom = (nom: string) => nom.trim().split(/\s+/)[0] ?? nom;
const duree = () => `${env.DEMO_DUREE_MIN} minutes`;

function echapper(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------- gabarit

interface Contenu {
  /** Le petit mot au-dessus du titre. */
  surtitre: string;
  titre: string;
  paragraphes: string[];
  /** Le rendez-vous, en encadré : [libellé, valeur]. */
  details: [string, string][];
  /** L'encadré en rouge pâle : un rendez-vous annulé. */
  annule?: boolean;
  bouton?: { libelle: string; url: string };
  /** Des liens discrets sous le bouton : déplacer, annuler. */
  liens?: { libelle: string; url: string }[];
  apres?: string[];
  pied: string;
}

function gabaritDemo(c: Contenu): string {
  const p = (html: string) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${ENCRE}">${html}</p>`;
  const petit = (html: string) => `<p style="margin:0 0 8px;font-size:13px;line-height:1.55;color:${GRIS}">${html}</p>`;
  const fond = c.annule ? "#fdf2f2" : "#f4f7fd";
  const bord = c.annule ? "#f6d5d5" : "#dfe8f8";
  const details = c.details.map(([l, v], i) => `<tr>
<td style="padding:${i === 0 ? 0 : 10}px 16px 0 0;font-size:13px;line-height:1.5;color:${GRIS};white-space:nowrap;vertical-align:top">${l}</td>
<td style="padding:${i === 0 ? 0 : 10}px 0 0;font-size:15px;line-height:1.5;font-weight:600;color:${ENCRE};vertical-align:top">${v}</td>
</tr>`).join("\n");
  const bouton = c.bouton
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 6px"><tr><td style="background:${BLEU};border-radius:999px"><a href="${c.bouton.url}" style="display:inline-block;padding:13px 24px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none">${c.bouton.libelle}</a></td></tr></table>`
    : "";
  const liens = c.liens?.length
    ? `<p style="margin:${c.bouton ? 12 : 22}px 0 0;font-size:14px;line-height:1.6;color:${GRIS}">${c.liens.map((l) => `<a href="${l.url}" style="color:${BLEU};text-decoration:none;font-weight:500">${l.libelle}</a>`).join(`<span style="color:#c3cad6">&nbsp;&nbsp;·&nbsp;&nbsp;</span>`)}</p>`
    : "";
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#eef2f8">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f8;padding:32px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,Arial,sans-serif">
<tr><td style="padding:0 6px 20px"><img src="cid:logo-diagly" alt="Diagly" height="34" style="display:block;height:34px;width:auto;border:0"></td></tr>
<tr><td style="background:#ffffff;border:1px solid #e3e9f2;border-top:4px solid ${c.annule ? "#d64545" : BLEU};border-radius:18px;padding:30px 32px 26px">
<p style="margin:0 0 8px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;font-weight:600;color:${c.annule ? "#b83232" : BLEU}">${c.surtitre}</p>
<h1 style="margin:0 0 18px;font-size:23px;line-height:1.25;font-weight:700;letter-spacing:-0.01em;color:${ENCRE}">${c.titre}</h1>
${c.paragraphes.map(p).join("\n")}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 4px;background:${fond};border:1px solid ${bord};border-radius:14px">
<tr><td style="padding:18px 20px"><table role="presentation" cellpadding="0" cellspacing="0">${details}</table></td></tr>
</table>
${bouton}
${liens}
${c.apres?.length ? `<div style="margin-top:22px;padding-top:16px;border-top:1px solid #eef1f6">${c.apres.map(petit).join("\n")}</div>` : ""}
</td></tr>
<tr><td style="padding:18px 10px 0;font-size:12px;line-height:1.6;color:#8a93a3">${c.pied}<br>Diagly, logiciel suisse de diagnostic de bâtiment, publié par Finalyn.</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

/** Le même message, en texte brut, pour les messageries qui n'affichent pas le HTML. */
function texte(c: Contenu, lignesEnPlus: string[] = []): string {
  const nu = (h: string) => h.replace(/<br\s*\/?>/g, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
  return [
    nu(c.titre),
    "",
    ...c.paragraphes.map(nu).flatMap((x) => [x, ""]),
    ...c.details.map(([l, v]) => `${nu(l)} : ${nu(v)}`),
    "",
    ...(c.bouton ? [`${nu(c.bouton.libelle)} : ${c.bouton.url}`] : []),
    ...(c.liens ?? []).map((l) => `${nu(l.libelle)} : ${l.url}`),
    ...lignesEnPlus,
    ...(c.apres?.length ? ["", ...c.apres.map(nu)] : []),
    "",
    nu(c.pied),
  ].join("\n");
}

// ---------------------------------------------------------- invitation .ics

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const ics = (t: string) => t.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Les lignes de plus de 75 octets se replient, comme le veut la norme. */
function plier(ligne: string): string {
  const morceaux: string[] = [];
  let reste = ligne;
  while (Buffer.byteLength(reste, "utf8") > 74) {
    let n = 74;
    while (Buffer.byteLength(reste.slice(0, n), "utf8") > 74) n--;
    morceaux.push(reste.slice(0, n));
    reste = reste.slice(n);
  }
  morceaux.push(reste);
  return morceaux.join("\r\n ");
}

/**
 * L'invitation d'agenda de la démo. Le même UID d'un message à l'autre :
 * l'agenda du destinataire met à jour son rendez-vous au lieu d'en créer un
 * second.
 */
export function invitationDemo(d: DemoPourMail, methode: "REQUEST" | "CANCEL", pour: "client" | "hote"): string {
  const lieu = env.DEMO_VISIO_URL ?? "Visioconférence";
  const description = [
    pour === "client" ? "Démo de Diagly, du plan au rapport." : `Démo avec ${d.nom}${d.bureau ? ` (${d.bureau})` : ""}, ${d.email}${d.telephone ? `, ${d.telephone}` : ""}.`,
    env.DEMO_VISIO_URL ? `Visioconférence : ${env.DEMO_VISIO_URL}` : "Le lien de visioconférence suit avant le rendez-vous.",
    `Déplacer ou annuler : ${pour === "client" ? lienClient(d) : lienHote(d)}`,
  ].join("\n");
  const lignes = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Diagly//Demos//FR",
    "CALSCALE:GREGORIAN",
    `METHOD:${methode}`,
    "BEGIN:VEVENT",
    `UID:demo-${d.id}@diagly.ch`,
    `SEQUENCE:${d.sequence}`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(d.debut)}`,
    `DTEND:${stamp(d.fin)}`,
    `SUMMARY:${ics(pour === "client" ? "Démo Diagly" : `Démo Diagly : ${d.nom}${d.bureau ? ` (${d.bureau})` : ""}`)}`,
    `DESCRIPTION:${ics(description)}`,
    `LOCATION:${ics(lieu)}`,
    `ORGANIZER;CN=${ics(env.DEMO_HOTE_NOM)}:mailto:${env.DEMO_HOTE_EMAIL}`,
    `ATTENDEE;CN=${ics(d.nom)};ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=FALSE:mailto:${d.email}`,
    `STATUS:${methode === "CANCEL" ? "CANCELLED" : "CONFIRMED"}`,
    "TRANSP:OPAQUE",
    ...(methode === "REQUEST"
      ? ["BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Démo Diagly", "TRIGGER:-PT15M", "END:VALARM"]
      : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lignes.map(plier).join("\r\n") + "\r\n";
}

// --------------------------------------------------------------- les messages

function lignesDuRendezVous(d: DemoPourMail): [string, string][] {
  return [
    ["Date", echapper(dateEnLettres(d.debut).replace(/^./, (x) => x.toUpperCase()))],
    ["Heure", `${heureEnLettres(d.debut)} à ${heureEnLettres(d.fin)}`],
    ["Durée", duree()],
    ["Où", env.DEMO_VISIO_URL ? "En visioconférence" : "En visioconférence, le lien suit avant le rendez-vous"],
  ];
}

const lignesDuClient = (d: DemoPourMail): [string, string][] => [
  ["Nom", echapper(d.nom)],
  ["E-mail", `<a href="mailto:${echapper(d.email)}" style="color:${BLEU};text-decoration:none">${echapper(d.email)}</a>`],
  ...(d.telephone ? [["Téléphone", echapper(d.telephone)] as [string, string]] : []),
  ...(d.bureau ? [["Bureau", echapper(d.bureau)] as [string, string]] : []),
];

const quandCourt = (d: DemoPourMail) => `${dateEnLettres(d.debut).replace(/ \d{4}$/, "")} à ${heureEnLettres(d.debut)}`;

function message(to: string, subject: string, c: Contenu, o: { replyTo?: string; invitation?: { methode: "REQUEST" | "CANCEL"; contenu: string }; enPlus?: string[] } = {}): MailDemo {
  return {
    to,
    subject,
    html: gabaritDemo(c),
    text: texte(c, o.enPlus),
    replyTo: o.replyTo,
    icalEvent: o.invitation ? { method: o.invitation.methode, content: o.invitation.contenu, filename: "demo-diagly.ics" } : undefined,
  };
}

/** Au visiteur : sa démo est réservée. */
export function confirmationClient(d: DemoPourMail): MailDemo {
  return message(d.email, `Votre démo Diagly est confirmée : ${quandCourt(d)}`, {
    surtitre: "Démo Diagly",
    titre: "Votre démo est confirmée",
    paragraphes: [
      `Bonjour ${echapper(prenom(d.nom))},`,
      "Merci de votre intérêt pour Diagly. Nous vous montrerons l’outil en direct, du plan au rapport chiffré, et répondrons à toutes vos questions, sur vos propres bâtiments si vous le souhaitez.",
    ],
    details: lignesDuRendezVous(d),
    bouton: env.DEMO_VISIO_URL ? { libelle: "Rejoindre la visioconférence", url: env.DEMO_VISIO_URL } : undefined,
    liens: [{ libelle: "Déplacer le rendez-vous", url: lienClient(d) }, { libelle: "Annuler", url: lienAnnuler(d) }],
    apres: [
      "L’invitation est jointe à ce message : ouvrez-la pour ajouter la démo à votre agenda.",
      "Pour préparer la démo, vous pouvez nous envoyer les plans d’un bâtiment en répondant à ce message.",
    ],
    pied: "Une question avant la démo ? Répondez simplement à ce message.",
  }, { replyTo: env.DEMO_HOTE_EMAIL, invitation: { methode: "REQUEST", contenu: invitationDemo(d, "REQUEST", "client") } });
}

/** À l'hôte : une démo vient d'être réservée. */
export function nouvelleDemoHote(d: DemoPourMail, auHub: boolean): MailDemo {
  return message(env.DEMO_HOTE_EMAIL, `Nouvelle démo : ${d.nom}${d.bureau ? ` (${d.bureau})` : ""}, ${quandCourt(d)}`, {
    surtitre: "Nouvelle démo",
    titre: `${echapper(d.nom)} a réservé une démo`,
    paragraphes: [
      auHub
        ? "Le rendez-vous est inscrit dans votre agenda du Finalyn Hub."
        : "Le rendez-vous n’a pas pu être inscrit dans votre agenda du Finalyn Hub : ouvrez l’invitation jointe pour l’ajouter.",
    ],
    details: [...lignesDuRendezVous(d).slice(0, 2), ...lignesDuClient(d)],
    bouton: { libelle: "Déplacer ou annuler", url: lienHote(d) },
    apres: [
      ...(d.message ? [`<b style="color:${ENCRE}">Son message</b><br>${echapper(d.message).replace(/\n/g, "<br>")}`] : []),
      "Pour lui écrire, répondez à ce message : la réponse lui arrive directement.",
    ],
    pied: "Vous recevez ce message parce qu’une démo a été réservée sur diagly.ch.",
  }, {
    replyTo: d.email,
    // Inscrite au Hub, la démo arrive déjà dans l'agenda : l'invitation ferait doublon.
    invitation: auHub ? undefined : { methode: "REQUEST", contenu: invitationDemo(d, "REQUEST", "hote") },
  });
}

/** Au visiteur, la veille : la démo approche. */
export function rappelClient(d: DemoPourMail): MailDemo {
  return message(d.email, `Rappel : votre démo Diagly ${quandCourt(d)}`, {
    surtitre: "Rappel",
    titre: "Votre démo approche",
    paragraphes: [
      `Bonjour ${echapper(prenom(d.nom))},`,
      "Nous nous réjouissons de vous présenter Diagly. Voici le rendez-vous :",
    ],
    details: lignesDuRendezVous(d),
    bouton: env.DEMO_VISIO_URL ? { libelle: "Rejoindre la visioconférence", url: env.DEMO_VISIO_URL } : undefined,
    liens: [{ libelle: "Déplacer le rendez-vous", url: lienClient(d) }, { libelle: "Annuler", url: lienAnnuler(d) }],
    pied: "Un empêchement ? Déplacez le rendez-vous en un clic, ou répondez à ce message.",
  }, { replyTo: env.DEMO_HOTE_EMAIL });
}

/** Au visiteur et à l'hôte : la démo a changé d'heure. */
export function deplaceeClient(d: DemoPourMail, parLHote: boolean): MailDemo {
  return message(d.email, `Votre démo Diagly est déplacée : ${quandCourt(d)}`, {
    surtitre: "Démo déplacée",
    titre: "Votre démo a un nouvel horaire",
    paragraphes: [
      `Bonjour ${echapper(prenom(d.nom))},`,
      parLHote
        ? "Nous avons dû déplacer votre démo. Voici le nouvel horaire ; s’il ne vous convient pas, choisissez-en un autre en un clic."
        : "C’est noté : votre démo est déplacée. Voici le nouvel horaire.",
    ],
    details: lignesDuRendezVous(d),
    bouton: env.DEMO_VISIO_URL ? { libelle: "Rejoindre la visioconférence", url: env.DEMO_VISIO_URL } : undefined,
    liens: [{ libelle: "Choisir un autre horaire", url: lienClient(d) }, { libelle: "Annuler", url: lienAnnuler(d) }],
    apres: ["L’invitation jointe met à jour le rendez-vous dans votre agenda."],
    pied: "Une question ? Répondez simplement à ce message.",
  }, { replyTo: env.DEMO_HOTE_EMAIL, invitation: { methode: "REQUEST", contenu: invitationDemo(d, "REQUEST", "client") } });
}

export function deplaceeHote(d: DemoPourMail, parLHote: boolean, auHub: boolean): MailDemo {
  return message(env.DEMO_HOTE_EMAIL, `Démo déplacée : ${d.nom}, ${quandCourt(d)}`, {
    surtitre: "Démo déplacée",
    titre: parLHote ? "Vous avez déplacé la démo" : `${echapper(d.nom)} a déplacé sa démo`,
    paragraphes: [auHub ? "Votre agenda du Finalyn Hub est à jour." : "Votre agenda du Finalyn Hub n’a pas pu être mis à jour : corrigez l’horaire à la main."],
    details: [...lignesDuRendezVous(d).slice(0, 2), ...lignesDuClient(d)],
    bouton: { libelle: "Déplacer ou annuler", url: lienHote(d) },
    pied: "Vous recevez ce message parce qu’une démo réservée sur diagly.ch a changé.",
  }, { replyTo: d.email });
}

/** Au visiteur : la démo est annulée, par lui ou par l'hôte. */
export function annuleeClient(d: DemoPourMail, parLHote: boolean): MailDemo {
  return message(d.email, `Votre démo Diagly du ${quandCourt(d)} est annulée`, {
    surtitre: "Démo annulée",
    titre: "Votre démo est annulée",
    paragraphes: [
      `Bonjour ${echapper(prenom(d.nom))},`,
      parLHote
        ? `Nous devons malheureusement annuler votre démo${d.motif ? ` : ${echapper(d.motif.replace(/[.\s]+$/, ""))}.` : "."} Toutes nos excuses ; choisissez un autre créneau quand vous le souhaitez.`
        : "C’est noté, votre démo est annulée. Si vous souhaitez la reprogrammer, choisissez un nouveau créneau en un clic.",
    ],
    details: lignesDuRendezVous(d).slice(0, 2),
    annule: true,
    bouton: { libelle: "Choisir un nouveau créneau", url: `${site()}/#demo` },
    apres: ["L’invitation jointe retire le rendez-vous de votre agenda."],
    pied: "Une question ? Répondez simplement à ce message.",
  }, { replyTo: env.DEMO_HOTE_EMAIL, invitation: { methode: "CANCEL", contenu: invitationDemo(d, "CANCEL", "client") } });
}

export function annuleeHote(d: DemoPourMail, parLHote: boolean, auHub: boolean): MailDemo {
  return message(env.DEMO_HOTE_EMAIL, `Démo annulée : ${d.nom}, ${quandCourt(d)}`, {
    surtitre: "Démo annulée",
    titre: parLHote ? "Vous avez annulé la démo" : `${echapper(d.nom)} a annulé sa démo`,
    paragraphes: [
      auHub ? "Le rendez-vous est retiré de votre agenda du Finalyn Hub." : "Le rendez-vous n’a pas pu être retiré de votre agenda du Finalyn Hub : supprimez-le à la main.",
      ...(d.motif && !parLHote ? [`Son motif : ${echapper(d.motif)}`] : []),
    ],
    details: [...lignesDuRendezVous(d).slice(0, 2), ...lignesDuClient(d)],
    annule: true,
    pied: "Vous recevez ce message parce qu’une démo réservée sur diagly.ch a été annulée.",
  }, { replyTo: d.email });
}

/** Utile aux tests et aux journaux : le rendez-vous en une phrase. */
export const resumeDemo = (d: Pick<DemoPourMail, "debut" | "fin">) => quandEnLettres(d.debut, d.fin);
