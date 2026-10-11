import nodemailer from "nodemailer";
import { env } from "./env.js";
import { logger } from "./logger.js";

// Envoi d'emails (invitations d'équipe). Dégradation gracieuse : si le SMTP n'est pas configuré,
// on ne bloque rien (le lien d'invitation reste copiable dans l'UI).
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

export async function sendMail(opts: { to: string; subject: string; html: string; text?: string }): Promise<boolean> {
  const t = getTransport();
  if (!t) {
    logger.info({ to: opts.to, subject: opts.subject }, "SMTP non configuré — email non envoyé (dégradation gracieuse)");
    return false;
  }
  try {
    await t.sendMail({ from: env.SMTP_FROM, to: opts.to, subject: opts.subject, html: opts.html, text: opts.text });
    return true;
  } catch (err) {
    logger.error({ err, to: opts.to }, "échec envoi email");
    return false;
  }
}

/** Gabarit HTML du lien de réinitialisation de mot de passe (valable 30 minutes). */
export function passwordResetEmail(resetUrl: string) {
  return {
    subject: "Réinitialisation de votre mot de passe Diagly",
    text: `Vous avez demandé la réinitialisation de votre mot de passe Diagly. Lien valable 30 minutes : ${resetUrl}\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:auto">
      <h2 style="color:#1f2937">Réinitialisation de votre mot de passe</h2>
      <p>Vous avez demandé à définir un nouveau mot de passe pour votre compte Diagly.</p>
      <p style="margin:24px 0"><a href="${resetUrl}" style="background:#2563eb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Choisir un nouveau mot de passe</a></p>
      <p style="color:#6b7280;font-size:13px">Ou copiez ce lien : ${resetUrl}</p>
      <p style="color:#6b7280;font-size:13px">Ce lien est valable 30 minutes et ne fonctionne qu'une fois. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email : votre mot de passe actuel reste valable.</p>
    </div>`,
  };
}

/** Gabarit HTML d'invitation à rejoindre une organisation. */
export function invitationEmail(orgName: string, role: string, acceptUrl: string) {
  return {
    subject: `Invitation à rejoindre ${orgName} sur Diagly`,
    text: `Vous êtes invité·e à rejoindre l'organisation ${orgName} sur Diagly (rôle : ${role}). Acceptez ici : ${acceptUrl}`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:auto">
      <h2 style="color:#1f2937">Invitation à rejoindre ${orgName}</h2>
      <p>Vous êtes invité·e à rejoindre l'organisation <b>${orgName}</b> sur Diagly, avec le rôle <b>${role}</b>.</p>
      <p>Vous pourrez consulter${role === "VIEWER" ? "" : " et gérer"} les diagnostics de l'organisation.</p>
      <p style="margin:24px 0"><a href="${acceptUrl}" style="background:#2563eb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Rejoindre l'organisation</a></p>
      <p style="color:#6b7280;font-size:13px">Ou copiez ce lien : ${acceptUrl}</p>
    </div>`,
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
    html: `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:auto">
      <h2 style="color:#1f2937;font-size:18px">${echapper(n.titre)}</h2>
      <p style="color:#374151;line-height:1.5">${echapper(n.texte)}</p>
      ${lien ? `<p style="margin:24px 0"><a href="${lien}" style="background:#2563eb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Ouvrir dans Diagly</a></p>` : ""}
      <p style="color:#6b7280;font-size:12px;border-top:1px solid #e5e7eb;padding-top:12px;margin-top:24px">
        Vous recevez ce message parce que vous l'avez demandé dans vos réglages Diagly.
        Vous pouvez les changer à tout moment depuis Paramètres, Notifications.
      </p>
    </div>`,
  };
}

/** Un texte venu de la base ne doit pas pouvoir écrire du HTML dans un courriel. */
function echapper(texte: string): string {
  return texte
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
