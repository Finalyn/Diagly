import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middlewares/auth.js";
import { blockViewerWrites } from "../middlewares/org.js";
import { validateBody } from "../middlewares/validate.js";
import { badRequest, notFound, tooManyRequests } from "../lib/http-error.js";
import { ownerScopeFor } from "../lib/org-context.js";
import { sendMail, mailConfigured } from "../lib/mail.js";
import { messageAdressesInconnues, nomExpediteur, trierDestinataires } from "../lib/mails-visite.js";
import { messageDeQuota, quotaEnvois } from "../lib/quota-envois.js";

/**
 * Organisation de la visite d'un dossier.
 *
 * Trois choses : les interlocuteurs (gérance, propriétaire, concierge,
 * locataires), le plan de visite (rendez-vous, créneaux proposés,
 * préparation), et les mails envoyés à ces interlocuteurs, gardés en
 * historique. Les textes des mails sont composés par l'application : le
 * serveur envoie ce qu'on lui donne, sans le réécrire. Mais il décide seul à
 * qui (les interlocuteurs enregistrés du dossier), sous quel nom (celui du
 * compte, « via Diagly ») et combien (quota-envois.ts) : sinon le SMTP de
 * Diagly devenait un relais ouvert, vite bloqué, et les codes de double
 * authentification par email ne partaient plus.
 *
 * Le rendez-vous se recopie dans le calendrier (Event VISITE) et dans la date
 * de visite du diagnostic, pour que le tableau de bord et les rappels le
 * voient.
 */
const router = Router();
router.use(requireAuth);
router.use(blockViewerWrites);

async function projetAccessible(projectId: string, userId: string) {
  const p = await prisma.project.findFirst({
    where: { id: projectId, ...(await ownerScopeFor(userId)) },
    select: { id: true, name: true, address: true, postalCode: true, city: true, visitPlan: true },
  });
  if (!p) throw notFound("Dossier introuvable");
  return p;
}

const ROLES = ["GERANCE", "PROPRIETAIRE", "CONCIERGE", "LOCATAIRE", "ENTREPRISE", "AUTRE"] as const;

// ---- Lecture : tout ce que l'écran affiche, en un appel ----
router.get("/:projectId", async (req, res) => {
  const p = await projetAccessible(req.params.projectId, req.auth!.sub);
  const [contacts, mails] = await Promise.all([
    prisma.projectContact.findMany({ where: { projectId: p.id }, orderBy: { createdAt: "asc" } }),
    prisma.projectMail.findMany({ where: { projectId: p.id }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  res.json({ plan: p.visitPlan ?? null, contacts, mails, mailConfigured: mailConfigured() });
});

// ---- Plan de visite ----
const planSchema = z.object({
  startAt: z.string().nullable().optional(),
  durationMin: z.number().int().min(15).max(24 * 60).optional(),
  meetingPoint: z.string().max(255).nullable().optional(),
  openerContactId: z.string().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  creneaux: z.array(z.object({ startAt: z.string() })).max(5).optional(),
  checklist: z.record(z.string().max(60), z.boolean()).optional(),
});

router.put("/:projectId/plan", validateBody(planSchema), async (req, res) => {
  const userId = req.auth!.sub;
  const p = await projetAccessible(req.params.projectId, userId);
  const avant = (p.visitPlan ?? {}) as Record<string, unknown>;
  const plan: Record<string, unknown> = { ...avant, ...(req.body as object) };

  const debut = typeof plan.startAt === "string" && plan.startAt ? new Date(plan.startAt) : null;
  const duree = typeof plan.durationMin === "number" ? plan.durationMin : 120;

  // Le rendez-vous dans le calendrier : un seul Event par dossier, créé,
  // déplacé ou retiré avec lui.
  const eventId = typeof avant.eventId === "string" ? avant.eventId : null;
  const existant = eventId ? await prisma.event.findFirst({ where: { id: eventId } }) : null;
  if (debut && !Number.isNaN(debut.getTime())) {
    const data = {
      title: `Visite ${p.name}`,
      category: "VISITE" as const,
      location: [p.address, [p.postalCode, p.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || null,
      notes: typeof plan.meetingPoint === "string" && plan.meetingPoint ? `Rendez-vous : ${plan.meetingPoint}` : null,
      startAt: debut,
      endAt: new Date(debut.getTime() + duree * 60_000),
      projectId: p.id,
    };
    if (existant) {
      // Un déplacement réarme le rappel.
      await prisma.event.update({ where: { id: existant.id }, data: { ...data, ...(existant.startAt.getTime() !== debut.getTime() ? { reminderSentAt: null } : {}) } });
      plan.eventId = existant.id;
    } else {
      const ev = await prisma.event.create({ data: { ...data, userId } });
      plan.eventId = ev.id;
    }
  } else {
    if (existant) await prisma.event.delete({ where: { id: existant.id } });
    plan.eventId = null;
  }

  // La date de visite du diagnostic suit le rendez-vous.
  const diag = await prisma.diagnostic.findFirst({ where: { projectId: p.id }, orderBy: { createdAt: "asc" }, select: { id: true } });
  if (diag) await prisma.diagnostic.update({ where: { id: diag.id }, data: { visitDate: debut } });

  const maj = await prisma.project.update({ where: { id: p.id }, data: { visitPlan: plan as Prisma.InputJsonValue }, select: { visitPlan: true } });
  res.json({ plan: maj.visitPlan });
});

// ---- Interlocuteurs ----
const contactSchema = z.object({
  role: z.enum(ROLES),
  name: z.string().trim().min(1).max(150),
  company: z.string().max(150).nullable().optional(),
  email: z.string().email().max(255).nullable().optional().or(z.literal("")),
  phone: z.string().max(40).nullable().optional(),
  unit: z.string().max(80).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});
const vide = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

router.post("/:projectId/contacts", validateBody(contactSchema), async (req, res) => {
  const p = await projetAccessible(req.params.projectId, req.auth!.sub);
  const d = req.body as z.infer<typeof contactSchema>;
  const contact = await prisma.projectContact.create({
    data: { projectId: p.id, role: d.role, name: d.name, company: vide(d.company), email: vide(d.email), phone: vide(d.phone), unit: vide(d.unit), notes: vide(d.notes) },
  });
  res.status(201).json({ contact });
});

async function contactAccessible(id: string, userId: string) {
  const c = await prisma.projectContact.findFirst({ where: { id, project: await ownerScopeFor(userId) } });
  if (!c) throw notFound("Interlocuteur introuvable");
  return c;
}

router.put("/contacts/:id", validateBody(contactSchema.partial()), async (req, res) => {
  const c = await contactAccessible(req.params.id, req.auth!.sub);
  const d = req.body as Partial<z.infer<typeof contactSchema>>;
  const contact = await prisma.projectContact.update({
    where: { id: c.id },
    data: {
      ...(d.role ? { role: d.role } : {}),
      ...(d.name ? { name: d.name } : {}),
      ...("company" in d ? { company: vide(d.company) } : {}),
      ...("email" in d ? { email: vide(d.email) } : {}),
      ...("phone" in d ? { phone: vide(d.phone) } : {}),
      ...("unit" in d ? { unit: vide(d.unit) } : {}),
      ...("notes" in d ? { notes: vide(d.notes) } : {}),
    },
  });
  res.json({ contact });
});

router.delete("/contacts/:id", async (req, res) => {
  const c = await contactAccessible(req.params.id, req.auth!.sub);
  await prisma.projectContact.delete({ where: { id: c.id } });
  res.status(204).end();
});

// ---- Mails ----
const mailSchema = z.object({
  template: z.string().min(1).max(40),
  subject: z.string().trim().min(1).max(255),
  body: z.string().trim().min(1).max(20_000),
  recipients: z.array(z.object({ name: z.string().max(150), email: z.string().email().max(255) })).min(1).max(50),
  /** send : le serveur envoie. messagerie : ouvert chez l'utilisateur, on le note seulement. */
  mode: z.enum(["send", "messagerie"]),
});

const echapper = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const enHtml = (texte: string) =>
  `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#1d1d1f">${
    texte.split(/\n{2,}/).map((para) => `<p style="margin:0 0 12px">${echapper(para).replace(/\n/g, "<br>")}</p>`).join("")
  }</div>`;

router.post("/:projectId/mails", validateBody(mailSchema), async (req, res) => {
  const userId = req.auth!.sub;
  const p = await projetAccessible(req.params.projectId, userId);
  const d = req.body as z.infer<typeof mailSchema>;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, firstName: true, lastName: true, companyName: true, preferences: true },
  });
  const auteur = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "Diagly";

  let status = "MESSAGERIE";
  let recipients: { name: string; email: string }[] = d.recipients;
  if (d.mode === "send") {
    // Seulement les interlocuteurs du dossier. En mode messagerie, le mail part
    // de la messagerie de l'utilisateur : ses destinataires ne regardent que lui.
    const contacts = await prisma.projectContact.findMany({
      where: { projectId: p.id, email: { not: null } },
      select: { name: true, email: true },
    });
    const { retenus, inconnus } = trierDestinataires(d.recipients, contacts);
    if (inconnus.length) throw badRequest(messageAdressesInconnues(inconnus), { inconnus });
    if (!retenus.length) throw badRequest("Aucun destinataire.");

    // Réservé avant l'envoi : tout ou rien, et deux requêtes simultanées ne
    // passent pas ensemble sous le plafond.
    const verdict = quotaEnvois.reserver(userId, retenus.length);
    if (!verdict.ok) throw tooManyRequests(messageDeQuota(verdict, retenus.length));

    const societe = ((user?.preferences as { company?: { name?: string } } | null)?.company?.name) || user?.companyName || null;
    const fromName = nomExpediteur({ prenom: user?.firstName, nom: user?.lastName, societe });
    // Un envoi par destinataire : personne ne voit l'adresse des autres
    // (locataires d'un même immeuble).
    const resultats = await Promise.all(retenus.map((r) => sendMail({
      to: r.email, subject: d.subject, text: d.body, html: enHtml(d.body), replyTo: user?.email, fromName,
    })));
    status = resultats.every(Boolean) ? "ENVOYE" : "ECHEC";
    recipients = retenus;
  }

  const mail = await prisma.projectMail.create({
    data: { projectId: p.id, userId, authorName: auteur, template: d.template, subject: d.subject, body: d.body, recipients, status },
  });
  res.status(201).json({ mail });
});

export default router;
