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
