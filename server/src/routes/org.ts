import { Router } from "express";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { OrgRole } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middlewares/auth.js";
import { requireOrgRole } from "../middlewares/org.js";
import { validateBody } from "../middlewares/validate.js";
import { getOrgContext } from "../lib/org-context.js";
import { badRequest, notFound, forbidden } from "../lib/http-error.js";
import { env } from "../lib/env.js";
import { sendMail, invitationEmail, mailConfigured } from "../lib/mail.js";

const router = Router();
router.use(requireAuth);

const memberView = { id: true, email: true, firstName: true, lastName: true, orgRole: true } as const;
const inviteRole = z.enum(["ADMIN", "MEMBER", "VIEWER"]);

async function uniqueSlug(name: string) {
  const base = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) || "org";
  for (let i = 0; i < 5; i++) {
    const slug = i === 0 ? base : `${base}-${randomBytes(2).toString("hex")}`;
    if (!(await prisma.organization.findUnique({ where: { slug } }))) return slug;
  }
  return `${base}-${randomBytes(4).toString("hex")}`;
}

// Mon organisation (ou null) + mon rôle.
router.get("/", async (req, res) => {
  const ctx = await getOrgContext(req.auth!.sub);
  if (!ctx.organizationId) return res.json({ organization: null, role: null });
  const organization = await prisma.organization.findUnique({
    where: { id: ctx.organizationId },
    include: { _count: { select: { members: true } } },
  });
  res.json({ organization, role: ctx.orgRole });
});

// Créer une organisation (le créateur devient OWNER ; ses diagnostics existants rejoignent l'organisation).
router.post("/", validateBody(z.object({ name: z.string().min(1).max(150) })), async (req, res) => {
  const ctx = await getOrgContext(req.auth!.sub);
  if (ctx.organizationId) throw badRequest("Vous appartenez déjà à une organisation.");
  const { name } = req.body as { name: string };
  const org = await prisma.organization.create({ data: { name, slug: await uniqueSlug(name), ownerId: req.auth!.sub } });
  await prisma.user.update({ where: { id: req.auth!.sub }, data: { organizationId: org.id, orgRole: "OWNER" } });
  res.status(201).json({ organization: org, role: "OWNER" });
});

// ---- Membres (ADMIN+) ----
router.get("/members", requireOrgRole("ADMIN"), async (req, res) => {
  const ctx = await getOrgContext(req.auth!.sub);
  const members = await prisma.user.findMany({ where: { organizationId: ctx.organizationId }, select: memberView, orderBy: { createdAt: "asc" } });
  res.json({ members });
});

router.put("/members/:userId", requireOrgRole("ADMIN"), validateBody(z.object({ role: inviteRole })), async (req, res) => {
  const ctx = await getOrgContext(req.auth!.sub);
  const target = await prisma.user.findFirst({ where: { id: req.params.userId, organizationId: ctx.organizationId } });
  if (!target) throw notFound("Membre introuvable");
  if (target.orgRole === "OWNER") throw forbidden("Le rôle du propriétaire ne peut pas être modifié.");
  const updated = await prisma.user.update({ where: { id: target.id }, data: { orgRole: (req.body as { role: OrgRole }).role }, select: memberView });
  res.json({ member: updated });
});

router.delete("/members/:userId", requireOrgRole("ADMIN"), async (req, res) => {
  const ctx = await getOrgContext(req.auth!.sub);
  const target = await prisma.user.findFirst({ where: { id: req.params.userId, organizationId: ctx.organizationId } });
  if (!target) throw notFound("Membre introuvable");
  if (target.orgRole === "OWNER") throw forbidden("Le propriétaire ne peut pas être retiré.");
  // Retiré → repasse en solo (retrouve uniquement ses propres données).
  await prisma.user.update({ where: { id: target.id }, data: { organizationId: null, orgRole: null } });
  res.status(204).end();
});

// ---- Invitations (ADMIN+) ----
router.get("/invitations", requireOrgRole("ADMIN"), async (req, res) => {
  const ctx = await getOrgContext(req.auth!.sub);
  const invitations = await prisma.orgInvitation.findMany({
    where: { organizationId: ctx.organizationId!, acceptedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, role: true, expiresAt: true, createdAt: true, token: true },
  });
  res.json({ invitations });
});

router.post("/invitations", requireOrgRole("ADMIN"), validateBody(z.object({ email: z.string().email().max(255), role: inviteRole })), async (req, res) => {
  const ctx = await getOrgContext(req.auth!.sub);
  const { email, role } = req.body as { email: string; role: OrgRole };
  const org = await prisma.organization.findUnique({ where: { id: ctx.organizationId! } });
  const token = randomBytes(24).toString("base64url");
  const invitation = await prisma.orgInvitation.create({
    data: { organizationId: ctx.organizationId!, email: email.toLowerCase(), role, token, invitedById: req.auth!.sub, expiresAt: new Date(Date.now() + 14 * 864e5) },
    select: { id: true, email: true, role: true, expiresAt: true, createdAt: true, token: true },
  });
  const acceptUrl = `${env.APP_URL}/app/join/${token}`;
  const mail = invitationEmail(org!.name, role, acceptUrl);
  const emailSent = await sendMail({ to: email, ...mail });
  res.status(201).json({ invitation, acceptUrl, emailSent, mailConfigured: mailConfigured() });
});

router.delete("/invitations/:id", requireOrgRole("ADMIN"), async (req, res) => {
  const ctx = await getOrgContext(req.auth!.sub);
  const inv = await prisma.orgInvitation.findFirst({ where: { id: req.params.id, organizationId: ctx.organizationId! } });
  if (!inv) throw notFound("Invitation introuvable");
  await prisma.orgInvitation.delete({ where: { id: inv.id } });
  res.status(204).end();
});

// ---- Acceptation d'une invitation (tout compte connecté) ----
router.get("/invitations/token/:token", async (req, res) => {
  const inv = await prisma.orgInvitation.findUnique({ where: { token: req.params.token }, include: { organization: { select: { name: true } } } });
  if (!inv || inv.acceptedAt || inv.expiresAt < new Date()) throw notFound("Invitation invalide ou expirée.");
  res.json({ organizationName: inv.organization.name, role: inv.role, email: inv.email });
});

router.post("/invitations/token/:token/accept", async (req, res) => {
  const inv = await prisma.orgInvitation.findUnique({ where: { token: req.params.token } });
  if (!inv || inv.acceptedAt || inv.expiresAt < new Date()) throw notFound("Invitation invalide ou expirée.");
  const user = await prisma.user.findUnique({ where: { id: req.auth!.sub } });
  if (user!.organizationId) throw badRequest("Vous appartenez déjà à une organisation.");
  if (user!.email.toLowerCase() !== inv.email.toLowerCase()) throw forbidden(`Cette invitation est destinée à ${inv.email}.`);
  await prisma.$transaction([
    prisma.user.update({ where: { id: user!.id }, data: { organizationId: inv.organizationId, orgRole: inv.role } }),
    prisma.orgInvitation.update({ where: { id: inv.id }, data: { acceptedAt: new Date() } }),
  ]);
  res.json({ ok: true, organizationId: inv.organizationId, role: inv.role });
});

export default router;
