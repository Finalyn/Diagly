import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { mkdirSync, existsSync } from "node:fs";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middlewares/auth.js";
import { uploadLimiter } from "../middlewares/rate-limit.js";
import { validateBody } from "../middlewares/validate.js";
import { badRequest, notFound } from "../lib/http-error.js";
import { env } from "../lib/env.js";
import { sendMail } from "../lib/mail.js";
import { signStoredPath } from "../lib/file-token.js";

// Centre d'aide : tickets de support avec fil de discussion + pièces jointes (captures d'écran).
const router = Router();
router.use(requireAuth);

const UPLOAD_DIR = join(process.cwd(), "uploads");
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });
const IMG_EXT: Record<string, string> = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp" };
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => cb(null, `${randomUUID()}${IMG_EXT[file.mimetype] ?? ""}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 Mo
  fileFilter: (_req, file, cb) => cb(null, Object.keys(IMG_EXT).includes(file.mimetype)),
});

async function userName(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId } });
  return { name: [u?.firstName, u?.lastName].filter(Boolean).join(" ") || u!.email, email: u!.email };
}

// Upload d'une capture d'écran → renvoie son URL (relative).
router.post("/attachments", uploadLimiter, upload.single("file"), (req, res) => {
  if (!req.file) throw badRequest("Image invalide (PNG, JPG ou WEBP, 10 Mo max).");
  // `url` = valeur a renvoyer avec le message ; elle porte deja un jeton pour l'apercu immediat.
  res.status(201).json({ url: signStoredPath(req.file.filename) });
});

// Une piece jointe ne peut etre qu'un fichier issu de POST /attachments (nom en UUID).
// Sans ce filtre, le client pourrait stocker n'importe quelle URL externe ou un
// "javascript:..." qui serait ensuite rendu dans le fil de discussion.
const attachmentUrl = z
  .string()
  .regex(/^\/uploads\/[0-9a-f-]{36}\.(png|jpg|webp)(\?t=[\w.-]+)?$/i, "Piece jointe invalide.")
  // On ne stocke que le chemin : le jeton d'acces est resigne a chaque lecture.
  .transform((u) => u.split("?")[0]);

/** Re-signe les pieces jointes d'un message avant de les renvoyer au client. */
const withSignedAttachments = <T extends { attachments: unknown }>(m: T) => ({
  ...m,
  attachments: (Array.isArray(m.attachments) ? (m.attachments as string[]) : []).map(signStoredPath),
});

const messageBody = z.object({
  body: z.string().min(1).max(5000),
  attachments: z.array(attachmentUrl).max(6).optional(),
});
const createTicketSchema = messageBody.extend({
  subject: z.string().min(1).max(200),
  category: z.string().max(50).optional(),
});

// Créer un ticket (+ premier message) et notifier le support par email.
router.post("/tickets", validateBody(createTicketSchema), async (req, res) => {
  const data = req.body as z.infer<typeof createTicketSchema>;
  const { name, email } = await userName(req.auth!.sub);
  const ticket = await prisma.supportTicket.create({
    data: {
      userId: req.auth!.sub, email, subject: data.subject, category: data.category,
      messages: { create: { authorName: name, isSupport: false, body: data.body, attachments: data.attachments ?? [] } },
    },
  });
  const emailSent = await sendMail({
    to: env.SUPPORT_EMAIL,
    subject: `[Support Diagly] ${data.subject}`,
    text: `De : ${name} <${email}>\nCatégorie : ${data.category ?? "—"}\nTicket : ${ticket.id}\nPièces jointes : ${data.attachments?.length ?? 0}\n\n${data.body}`,
    html: `<div style="font-family:system-ui,sans-serif"><p><b>De :</b> ${name} &lt;${email}&gt;<br><b>Catégorie :</b> ${data.category ?? "—"}<br><b>Ticket :</b> ${ticket.id}</p><hr><p style="white-space:pre-wrap">${data.body.replace(/</g, "&lt;")}</p></div>`,
  });
  res.status(201).json({ ticket: { id: ticket.id, subject: ticket.subject, status: ticket.status, createdAt: ticket.createdAt }, emailSent });
});

// Liste de mes tickets (avec aperçu du dernier message).
router.get("/tickets", async (req, res) => {
  const rows = await prisma.supportTicket.findMany({
    where: { userId: req.auth!.sub },
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: { messages: { orderBy: { createdAt: "desc" }, take: 1 }, _count: { select: { messages: true } } },
  });
  res.json({
    tickets: rows.map((t) => ({
      id: t.id, subject: t.subject, category: t.category, status: t.status,
      createdAt: t.createdAt, updatedAt: t.updatedAt,
      messageCount: t._count.messages,
      lastMessage: t.messages[0]?.body.slice(0, 120) ?? "",
      lastIsSupport: t.messages[0]?.isSupport ?? false,
    })),
  });
});

// Détail d'un ticket + fil complet.
router.get("/tickets/:id", async (req, res) => {
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: req.params.id, userId: req.auth!.sub },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!ticket) throw notFound("Ticket introuvable");
  res.json({ ticket: { ...ticket, messages: ticket.messages.map(withSignedAttachments) } });
});

// Répondre / relancer sur un ticket.
router.post("/tickets/:id/messages", validateBody(messageBody), async (req, res) => {
  const ticket = await prisma.supportTicket.findFirst({ where: { id: req.params.id, userId: req.auth!.sub } });
  if (!ticket) throw notFound("Ticket introuvable");
  const data = req.body as z.infer<typeof messageBody>;
  const { name } = await userName(req.auth!.sub);
  const message = await prisma.supportMessage.create({
    data: { ticketId: ticket.id, authorName: name, isSupport: false, body: data.body, attachments: data.attachments ?? [] },
  });
  // Une relance client rouvre le ticket + touche updatedAt.
  await prisma.supportTicket.update({ where: { id: ticket.id }, data: { status: "OPEN" } });
  res.status(201).json({ message: withSignedAttachments(message) });
});

export default router;
