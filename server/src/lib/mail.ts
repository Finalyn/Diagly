import nodemailer from "nodemailer";
import { readFileSync } from "node:fs";
import { env } from "./env.js";
import { logger } from "./logger.js";

// Envoi d'emails : mot de passe oublié, invitations, notifications, code de
// connexion, mails de visite. Dégradation gracieuse : si le SMTP n'est pas
// configuré, rien ne bloque (le lien reste copiable, le mail s'ouvre dans la
// messagerie), et l'appelant le sait par le retour de sendMail.
export const mailConfigured = () => Boolean(env.SMTP_HOST && env.SMTP_PORT);

let transport: nodemailer.Transporter | null = null;
function getTransport() {
  if (!mailConfigured()) return null;
  if (!transport) {
    transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }
  return transport;
}

/**
 * Le logo, joint au message et appelé par son identifiant (cid).
 *
 * Une image distante est bloquée par défaut dans la plupart des messageries
 * d'entreprise ; jointe, elle s'affiche tout de suite. PNG et non SVG : Outlook
 * et Gmail n'affichent pas le SVG. Lu une fois ; s'il manque, le message part
 * sans logo plutôt que pas du tout.
 */
const CID_LOGO = "logo-diagly";
let logo: Buffer | null | undefined;
function logoDiagly(): Buffer | null {
  if (logo === undefined) {
    try { logo = readFileSync(new URL("../../assets/diagly-logo.png", import.meta.url)); }
    catch { logo = null; logger.warn("logo des emails introuvable (server/assets/diagly-logo.png)"); }
  }
  return logo;
}

export async function sendMail(opts: {
  to: string; subject: string; html: string; text?: string; replyTo?: string; fromName?: string
  /** Une invitation d'agenda (.ics) : les messageries proposent alors de l'ajouter, ou la mettent à jour. */
  icalEvent?: { method: "REQUEST" | "CANCEL"; content: string; filename?: string }
}): Promise<boolean> {
  const t = getTransport();
  if (!t) {
    logger.info({ to: opts.to, subject: opts.subject }, "SMTP non configuré : email non envoyé (dégradation gracieuse)");
    return false;
  }
  try {
    // fromName : le nom de l'expéditeur réel (le diagnostiqueur), l'adresse reste
    // celle du serveur ; les réponses vont à replyTo.
    const from = opts.fromName && env.SMTP_FROM ? `"${opts.fromName.replace(/"/g, "")}" <${env.SMTP_FROM.replace(/^.*<|>.*$/g, "")}>` : env.SMTP_FROM;
    const image = opts.html.includes(`cid:${CID_LOGO}`) ? logoDiagly() : null;
    await t.sendMail({
      from, to: opts.to, subject: opts.subject, html: opts.html, text: opts.text, replyTo: opts.replyTo,
      attachments: image ? [{ filename: "diagly.png", content: image, cid: CID_LOGO }] : undefined,
      icalEvent: opts.icalEvent
        ? { method: opts.icalEvent.method, content: opts.icalEvent.content, filename: opts.icalEvent.filename ?? "invitation.ics" }
        : undefined,
    });
    return true;
  } catch (err) {
    logger.error({ err, to: opts.to }, "échec envoi email");
    return false;
  }
}

/** Un texte venu de la base ne doit pas pouvoir écrire du HTML dans un courriel. */
function echapper(texte: string): string {
  return texte
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Le gabarit commun des emails de Diagly.
 *
 * Tableaux et styles en ligne : c'est ce que les messageries rendent toutes de
 * la même façon. Le logo en tête, une carte blanche, un seul bouton, puis la
 * raison pour laquelle on reçoit le message.
 */
function gabarit(o: { titre: string; paragraphes: string[]; bouton?: { libelle: string; url: string }; apres?: string[]; pied: string }) {
  const p = (html: string) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#1d1d1f">${html}</p>`
  const petit = (html: string) => `<p style="margin:0 0 10px;font-size:13px;line-height:1.5;color:#6e6e73">${html}</p>`
  return `<!doctype html><html lang="fr"><body style="margin:0;padding:0;background:#f5f5f7">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:32px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">
<tr><td style="padding:0 4px 18px"><img src="cid:${CID_LOGO}" alt="Diagly" height="34" style="display:block;height:34px;width:auto;border:0"></td></tr>
<tr><td style="background:#ffffff;border:1px solid #e8e8ed;border-radius:16px;padding:32px 32px 22px">
<h1 style="margin:0 0 18px;font-size:20px;line-height:1.3;font-weight:600;color:#1d1d1f">${o.titre}</h1>
${o.paragraphes.map(p).join("\n")}
${o.bouton ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 22px"><tr><td style="background:#2563eb;border-radius:10px"><a href="${o.bouton.url}" style="display:inline-block;padding:12px 20px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none">${o.bouton.libelle}</a></td></tr></table>` : ""}
${(o.apres ?? []).map(petit).join("\n")}
</td></tr>
<tr><td style="padding:16px 8px 0;font-size:12px;line-height:1.5;color:#86868b">${o.pied}<br>Diagly, diagnostic et planification de rénovation de bâtiments.</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

/** Gabarit du lien de réinitialisation de mot de passe (valable 30 minutes). */
export function passwordResetEmail(resetUrl: string) {
  return {
    subject: "Réinitialisation de votre mot de passe Diagly",
    text: `Vous avez demandé la réinitialisation de votre mot de passe Diagly.\n\nChoisir un nouveau mot de passe (lien valable 30 minutes, utilisable une fois) :\n${resetUrl}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email : votre mot de passe actuel reste valable.`,
    html: gabarit({
      titre: "Réinitialisation de votre mot de passe",
      paragraphes: ["Vous avez demandé à définir un nouveau mot de passe pour votre compte Diagly."],
      bouton: { libelle: "Choisir un nouveau mot de passe", url: resetUrl },
      apres: [
        `Ou copiez ce lien dans votre navigateur :<br><span style="word-break:break-all">${echapper(resetUrl)}</span>`,
        "Ce lien est valable 30 minutes et ne fonctionne qu’une fois.",
      ],
      pied: "Si vous n’êtes pas à l’origine de cette demande, ignorez cet email : votre mot de passe actuel reste valable.",
    }),
  };
}

const ROLE_LABEL: Record<string, string> = { OWNER: "Propriétaire", ADMIN: "Administrateur", MEMBER: "Membre", VIEWER: "Lecture seule" };

/** Gabarit d'invitation à rejoindre une organisation. */
export function invitationEmail(orgName: string, role: string, acceptUrl: string) {
  const libelle = ROLE_LABEL[role] ?? role;
  const droits = role === "VIEWER"
    ? "Vous pourrez consulter ses diagnostics et ses rapports."
    : role === "ADMIN"
      ? "Vous pourrez consulter et modifier ses diagnostics, gérer l’équipe et la base de données."
      : "Vous pourrez consulter et modifier ses diagnostics.";
  return {
    subject: `Invitation à rejoindre ${orgName} sur Diagly`,
    text: `Vous avez reçu une invitation à rejoindre l'équipe ${orgName} sur Diagly, avec le rôle ${libelle}.\n${droits.replace(/’/g, "'")}\n\nAccepter l'invitation :\n${acceptUrl}`,
    html: gabarit({
      titre: `Rejoindre ${echapper(orgName)}`,
      paragraphes: [
        `Vous avez reçu une invitation à rejoindre l’équipe <b>${echapper(orgName)}</b> sur Diagly, avec le rôle <b>${libelle}</b>.`,
        droits,
      ],
      bouton: { libelle: "Accepter l’invitation", url: acceptUrl },
      apres: [`Ou copiez ce lien dans votre navigateur :<br><span style="word-break:break-all">${echapper(acceptUrl)}</span>`],
      pied: "Vous recevez ce message parce qu’un administrateur de cette équipe a saisi votre adresse.",
    }),
  };
}

/**
 * Gabarit d'une notification envoyée par courriel.
 *
 * Même texte que la cloche et que le push : trois formulations différentes du
 * même fait feraient douter de laquelle est la bonne. Le lien ramène à
 * l'endroit exact dont il est question, pas à l'accueil.
 */
export function notificationEmail(n: { titre: string; texte: string; url: string | null }) {
  const lien = n.url ? `${env.APP_URL.replace(/\/$/, "")}${n.url}` : null;
  return {
    subject: n.titre,
    text: `${n.titre}

${n.texte}${lien ? `

${lien}` : ""}

Vous recevez ce message parce que vous l'avez demandé dans vos réglages Diagly.`,
    html: gabarit({
      titre: echapper(n.titre),
      paragraphes: n.texte ? [echapper(n.texte)] : [],
      bouton: lien ? { libelle: "Ouvrir dans Diagly", url: lien } : undefined,
      pied: "Vous recevez ce message parce que vous l’avez demandé dans vos réglages Diagly. Vous pouvez les changer à tout moment depuis Paramètres, Notifications.",
    }),
  };
}

/**
 * Le code à usage unique de la double authentification par email.
 *
 * Le code est dans l'objet : il se lit dans la notification du téléphone sans
 * ouvrir le message. Valable 10 minutes, un seul usage.
 */
export function codeEmail(code: string, usage: "connexion" | "confirmation") {
  const espace = `${code.slice(0, 3)} ${code.slice(3)}`;
  const pourquoi = usage === "connexion"
    ? "Voici votre code pour terminer la connexion à Diagly."
    : "Voici votre code pour confirmer le changement de votre double authentification.";
  return {
    subject: `${espace} est votre code Diagly`,
    text: `${pourquoi}\n\n${espace}\n\nIl est valable 10 minutes. Si vous n'êtes pas à l'origine de cette demande, changez votre mot de passe : quelqu'un le connaît.`,
    html: gabarit({
      titre: usage === "connexion" ? "Votre code de connexion" : "Votre code de confirmation",
      paragraphes: [
        pourquoi,
        `<span style="display:inline-block;margin:6px 0;padding:12px 18px;border-radius:12px;background:#f5f5f7;font-size:28px;font-weight:600;letter-spacing:6px;color:#1d1d1f">${espace}</span>`,
      ],
      apres: ["Il est valable 10 minutes et ne sert qu’une fois."],
      pied: "Si vous n’êtes pas à l’origine de cette demande, changez votre mot de passe : quelqu’un le connaît.",
    }),
  };
}

/**
 * La demande de mise en relation, telle que la reçoit le partenaire.
 *
 * Elle part au nom de l'utilisateur (nom affiché, réponse directe à son
 * adresse) : le partenaire répond à la personne, pas à Diagly. Le dossier
 * joint est un résumé en clair, et le rapport un lien en lecture seule.
 */
export function demandePartenaireEmail(d: {
  partenaire: string; auteur: string; societe: string | null; email: string; telephone: string | null;
  objet: string; message: string; dossier: string | null; lienRapport: string | null;
}) {
  const qui = d.societe ? `${d.auteur} (${d.societe})` : d.auteur;
  const coordonnees = [d.email, d.telephone].filter(Boolean).join(" · ");
  const lignes = (t: string) => echapper(t).replace(/\n/g, "<br>");
  return {
    subject: `${d.objet} (via Diagly)`,
    text: `Bonjour,

${qui} vous contacte par Diagly.

Objet : ${d.objet}

${d.message}
${d.dossier ? `
Le bâtiment concerné
${d.dossier}
` : ""}${d.lienRapport ? `
Rapport de diagnostic (lecture seule) :
${d.lienRapport}
` : ""}
Coordonnées : ${coordonnees}
Pour répondre, répondez simplement à ce message.

Vous recevez ce message parce que ${d.partenaire} figure dans l'annuaire des prestataires de Diagly, tenu par Finalyn.`,
    html: gabarit({
      titre: echapper(d.objet),
      paragraphes: [
        `<b>${echapper(qui)}</b> vous contacte par Diagly.`,
        lignes(d.message),
        ...(d.dossier
          ? [`<span style="display:block;padding:14px 16px;border-radius:12px;background:#f5f5f7;font-size:14px;line-height:1.6;color:#1d1d1f"><b>Le bâtiment concerné</b><br>${lignes(d.dossier)}</span>`]
          : []),
      ],
      bouton: d.lienRapport ? { libelle: "Consulter le rapport", url: d.lienRapport } : undefined,
      apres: [
        `Coordonnées : ${echapper(coordonnees)}`,
        "Pour répondre, répondez simplement à ce message : il arrive directement chez votre interlocuteur.",
      ],
      pied: `Vous recevez ce message parce que ${echapper(d.partenaire)} figure dans l’annuaire des prestataires de Diagly, tenu par Finalyn.`,
    }),
  };
}
