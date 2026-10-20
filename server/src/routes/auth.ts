import express, { Router, type Response } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { env, urlPubliqueValide } from "../lib/env.js";
import { hashPassword, sha256, verifyPassword } from "../lib/hash.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../lib/jwt.js";
import { HttpError, badRequest, conflict, tooManyRequests, unauthorized } from "../lib/http-error.js";
import { validateBody } from "../middlewares/validate.js";
import { requireAuth } from "../middlewares/auth.js";
import { loginLimiter, passwordResetLimiter, registerLimiter, twoFaLimiter } from "../middlewares/rate-limit.js";
import { sendMail, mailConfigured, passwordResetEmail, codeEmail } from "../lib/mail.js";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { logger } from "../lib/logger.js";
import jwt from "jsonwebtoken";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { jetonDeRevocation, revoquerApple, verifierJetonApple, type ClientSiteApple, type IdentiteApple } from "../lib/apple.js";
import { DUREE_DEMANDE_MS, adresseDeRetourApple, demandeAppleWeb, nomDuPremierPassage, verifierEtatAppleWeb } from "../lib/apple-web.js";
import { CodesDeConnexion, challengeValide } from "../lib/pkce.js";
import { rotationTolerable } from "../lib/rotation-session.js";
import { EssaisDeCode, type RefusEssai } from "../lib/essais-code.js";
import { UPLOAD_DIR } from "./plans.js";
import { unlink } from "node:fs/promises";
import { join } from "node:path";

const router = Router();

const registerSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(100),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  companyName: z.string().min(1).max(150).optional(),
  phone: z.string().min(1).max(50).optional(),
  // NB : le role n'est PAS acceptable via l'inscription publique (escalade de privilege).
  // Tout nouveau compte est PARTICULIER ; l'attribution d'un role privilegie passe par la DB / un admin.
});

// Hash bcrypt factice (mot de passe aleatoire) : sert a egaliser le temps de reponse du
// login quand l'email n'existe pas, pour eviter l'enumeration des comptes par timing.
const DUMMY_PASSWORD_HASH = "$2b$12$RRvtmOT8kNB1YGJH075cnuq6uOPdH9M9RjzySmL6wBWV.Z32bFzn6";

const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

function publicUser<T extends { passwordHash: string; twoFactorSecret?: string | null; appleRefreshToken?: string | null }>(u: T) {
  // On ne renvoie jamais le hash du mot de passe ni le secret 2FA au client, ni
  // le jeton Apple, qui sert à révoquer l'accès à la suppression du compte.
  // Les champs retirés sont nommés pour être écartés, pas pour servir.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash: _p, twoFactorSecret: _s, appleRefreshToken: _a, ...rest } = u;
  return rest;
}

/** Convertit "7d" / "15m" / "3600" en ms pour expiresAt. */
function ttlToMs(ttl: string): number {
  const m = /^(\d+)([smhd])?$/.exec(ttl);
  if (!m) throw new Error(`Invalid TTL: ${ttl}`);
  const n = Number(m[1]);
  const unit = m[2] ?? "s";
  const mult = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit]!;
  return n * mult;
}

/** Une paire de jetons, et la ligne à enregistrer pour le jeton de rafraîchissement. */
function preparerJetons(user: { id: string; email: string; role: string }) {
  const accessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role });

  const jti = crypto.randomUUID();
  const refreshToken = signRefreshToken({ sub: user.id, jti });
  const expiresAt = new Date(Date.now() + ttlToMs(env.JWT_REFRESH_TTL));

  return {
    jetons: { accessToken, refreshToken },
    ligne: { id: jti, userId: user.id, tokenHash: sha256(refreshToken), expiresAt },
  };
}

async function issueTokens(user: { id: string; email: string; role: string }) {
  const { jetons, ligne } = preparerJetons(user);
  await prisma.refreshToken.create({ data: ligne });
  return jetons;
}

router.post("/register", registerLimiter, validateBody(registerSchema), async (req, res) => {
  const data = req.body as z.infer<typeof registerSchema>;

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw conflict("Email already registered");

  const user = await prisma.user.create({
    data: {
      email: data.email,
      passwordHash: await hashPassword(data.password),
      firstName: data.firstName,
      lastName: data.lastName,
      companyName: data.companyName,
      phone: data.phone,
      role: "PARTICULIER",
    },
  });

  const tokens = await issueTokens(user);
  res.status(201).json({ user: publicUser(user), ...tokens });
});

router.post("/login", loginLimiter, validateBody(loginSchema), async (req, res) => {
  const { email, password } = req.body as z.infer<typeof loginSchema>;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // Comparaison factice pour egaliser le temps de reponse (anti-enumeration par timing).
    await verifyPassword(password, DUMMY_PASSWORD_HASH);
    throw unauthorized("Invalid credentials");
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) throw unauthorized("Invalid credentials");

  // Si la 2FA est active : on ne délivre pas encore les tokens, on demande le code
  // (de l'application, ou envoyé par email).
  if (aLaDoubleAuth(user)) {
    return res.json(await ouvrirDoubleAuth(user));
  }

  const tokens = await issueTokens(user);
  res.json({ user: publicUser(user), ...tokens });
});

router.post("/refresh", validateBody(refreshSchema), async (req, res) => {
  const { refreshToken } = req.body as z.infer<typeof refreshSchema>;

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw unauthorized("Invalid refresh token");
  }

  const stored = await prisma.refreshToken.findUnique({ where: { id: payload.jti } });
  if (!stored) throw unauthorized("Refresh token not recognized");
  if (stored.tokenHash !== sha256(refreshToken)) throw unauthorized("Refresh token mismatch");
  if (stored.expiresAt < new Date()) throw unauthorized("Refresh token expired");

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw unauthorized("User no longer exists");

  // Rotation : l'ancien jeton est révoqué en désignant celui qui le remplace,
  // dans la même transaction. La condition sur revokedAt fait qu'une seule de
  // deux requêtes simultanées (deux onglets) le fait tourner ; l'autre passe
  // par la tolérance ci-dessous.
  if (!stored.revokedAt) {
    const nouveau = preparerJetons(user);
    const tourne = await prisma.$transaction(async (tx) => {
      const r = await tx.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: new Date(), replacedById: nouveau.ligne.id },
      });
      if (r.count === 0) return false;
      await tx.refreshToken.create({ data: nouveau.ligne });
      return true;
    });
    if (tourne) return res.json({ user: publicUser(user), ...nouveau.jetons });
  }

  // Jeton déjà remplacé. Si la rotation date de moins d'une minute et que la
  // session vit encore, la réponse s'est sans doute perdue (réseau du terrain) :
  // on émet une nouvelle paire plutôt que de couper la session. Au-delà, ou
  // après une déconnexion ou un changement de mot de passe, refus comme avant.
  const actuel = stored.revokedAt ? stored : await prisma.refreshToken.findUnique({ where: { id: stored.id } });
  const charger = (id: string) =>
    prisma.refreshToken.findUnique({ where: { id }, select: { revokedAt: true, replacedById: true, expiresAt: true } });
  if (!actuel || !(await rotationTolerable(actuel, charger))) throw unauthorized("Refresh token revoked");
  logger.info({ userId: user.id }, "jeton de rafraîchissement tout juste remplacé, présenté à nouveau : toléré");
  const tokens = await issueTokens(user);
  res.json({ user: publicUser(user), ...tokens });
});

router.post("/logout", validateBody(refreshSchema), async (req, res) => {
  const { refreshToken } = req.body as z.infer<typeof refreshSchema>;
  try {
    const payload = verifyRefreshToken(refreshToken);
    // Le jeton présenté a pu être remplacé sans que l'appareil reçoive le
    // nouveau (réponse de rotation perdue) : la session continue alors sur ses
    // remplaçants, révoqués eux aussi. Sans remplaçant noté, aucun ne revit
    // pendant la minute de tolérance.
    const maintenant = new Date();
    let id: string | null = payload.jti;
    for (let i = 0; i < 5 && id; i++) {
      const jeton: { revokedAt: Date | null; replacedById: string | null } | null = await prisma.refreshToken.findUnique({
        where: { id },
        select: { revokedAt: true, replacedById: true },
      });
      if (!jeton) break;
      await prisma.refreshToken.update({ where: { id }, data: { revokedAt: jeton.revokedAt ?? maintenant, replacedById: null } });
      id = jeton.replacedById;
    }
  } catch {
    // si le token est invalide on considère le logout réussi
  }
  res.status(204).end();
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.auth!.sub } });
  if (!user) throw badRequest("User not found");
  res.json({ user: publicUser(user) });
});

const updateProfileSchema = z.object({
  firstName: z.string().max(100).nullable().optional(),
  lastName: z.string().max(100).nullable().optional(),
  companyName: z.string().max(150).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
});
router.put("/me", requireAuth, validateBody(updateProfileSchema), async (req, res) => {
  const data = req.body as z.infer<typeof updateProfileSchema>;
  const user = await prisma.user.update({ where: { id: req.auth!.sub }, data });
  res.json({ user: publicUser(user) });
});

// Fusionne (2 niveaux) les préférences reçues avec l'existant.
// Clés interdites : `JSON.parse` crée bien une propriété propre `__proto__`, dont
// l'affectation modifierait le prototype de l'objet fusionné.
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function mergePrefs(cur: Record<string, unknown>, inc: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...cur };
  for (const [k, v] of Object.entries(inc)) {
    if (FORBIDDEN_KEYS.has(k)) continue;
    if (v && typeof v === "object" && !Array.isArray(v) && cur[k] && typeof cur[k] === "object") {
      out[k] = { ...(cur[k] as object), ...(v as object) };
    } else out[k] = v;
  }
  return out;
}
// Les preferences etaient acceptees telles quelles (n'importe quel JSON, sans limite de
// taille), alors qu'elles sont renvoyees a chaque /me, login et refresh, et que le logo
// et la couleur d'accent sont repris sur le RAPPORT PUBLIC. On borne donc la forme.
const txt = (max: number) => z.string().max(max).nullish();
const companySchema = z.object({
  name: txt(150), address: txt(200), postalCode: txt(20), city: txt(120),
  canton: txt(60), vatNumber: txt(40), iban: txt(40),
  // Coordonnees : elles paraissent en tete du rapport partage, pour que le
  // client sache a qui s'adresser sans chercher le site du bureau.
  phone: txt(40), email: txt(160), web: txt(200),
  // Logo : uniquement une image en data URL (une URL externe fuiterait vers un tiers
  // depuis le rapport client, et serait de toute facon bloquee par la CSP).
  logo: z.string().max(400_000).regex(/^data:image\/(png|jpeg|webp|svg\+xml);base64,/, "Logo invalide.").nullish(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur invalide.").nullish(),
}).strict().partial();

const exportColumn = z.object({ key: z.string().max(60), label: z.string().max(120), active: z.boolean() });
/**
 * Coordonnees de facturation.
 *
 * Distinctes de l'entreprise : la facture part souvent a une comptabilite, a
 * une autre adresse, avec une reference que le client exige sur ses factures.
 * `memeAdresse` evite de saisir deux fois la meme chose quand c'est le cas.
 */
const billingSchema = z.object({
  memeAdresse: z.boolean(),
  destinataire: txt(150), email: txt(160), reference: txt(80),
  address: txt(200), postalCode: txt(20), city: txt(120), canton: txt(60),
}).strict().partial();

const preferencesSchema = z.object({
  company: companySchema,
  billing: billingSchema,
  defaults: z.object({
    honoraryPct: z.number().min(0).max(100), reservePct: z.number().min(0).max(100),
    vatPct: z.number().min(0).max(100), unit: z.enum(["m", "cm", "mm"]),
  }).strict().partial(),
  notifications: z.object({
    emailDiagnostic: z.boolean(), calendarReminders: z.boolean(),
    weeklyDigest: z.boolean(), priorityAlerts: z.boolean(), relances: z.boolean(),
    analysesIA: z.boolean(),
  }).strict().partial(),
  exportTemplates: z.array(z.object({
    id: z.string().max(100), name: z.string().max(120),
    sheets: z.array(z.object({
      id: z.enum(["building", "items", "workplan"]),
      title: z.string().max(120),
      columns: z.array(exportColumn).max(80),
    })).max(10),
  })).max(20),
  exportDefaultTemplateId: z.string().max(100).nullish(),
}).strict().partial();

router.put("/preferences", requireAuth, validateBody(preferencesSchema), async (req, res) => {
  const inc = (req.body ?? {}) as Record<string, unknown>;
  const user = await prisma.user.findUnique({ where: { id: req.auth!.sub } });
  if (!user) throw badRequest("User not found");
  const cur = (user.preferences as Record<string, unknown>) ?? {};
  const updated = await prisma.user.update({ where: { id: user.id }, data: { preferences: mergePrefs(cur, inc) as Prisma.InputJsonValue } });
  res.json({ user: publicUser(updated) });
});

const changePwSchema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8).max(100) });
router.post("/change-password", requireAuth, validateBody(changePwSchema), async (req, res) => {
  const { currentPassword, newPassword } = req.body as z.infer<typeof changePwSchema>;
  const user = await prisma.user.findUnique({ where: { id: req.auth!.sub } });
  if (!user) throw badRequest("User not found");
  if (!(await verifyPassword(currentPassword, user.passwordHash))) throw unauthorized("Mot de passe actuel incorrect");
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(newPassword) } });
  // Securite : revoque toutes les sessions (refresh tokens) apres un changement de mot de passe.
  await prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
  res.json({ ok: true });
});

// ==================== Mot de passe oublie / reinitialisation ====================
//
// Le jeton est un JWT court signe avec JWT_ACCESS_SECRET : aucune table supplementaire.
// Il embarque une empreinte du hash actuel du mot de passe ("v") : des que le mot de passe
// change, tous les jetons emis avant deviennent invalides -> usage unique de fait.

const RESET_TTL = "30m";

function signResetToken(user: { id: string; passwordHash: string }): string {
  return jwt.sign(
    { sub: user.id, purpose: "pwreset", v: sha256(user.passwordHash).slice(0, 16) },
    env.JWT_ACCESS_SECRET,
    { expiresIn: RESET_TTL },
  );
}

// Demande de lien. Reponse TOUJOURS identique : ne revele pas si l'adresse existe.
router.post(
  "/forgot-password",
  passwordResetLimiter,
  validateBody(z.object({ email: z.string().email().toLowerCase() })),
  async (req, res) => {
    const { email } = req.body as { email: string };
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const url = `${env.APP_URL}/reset-password/${signResetToken(user)}`;
      const mail = passwordResetEmail(url);
      const sent = await sendMail({ to: user.email, ...mail });
      // Sans SMTP configure (dev), le lien part dans les logs plutot que d'etre perdu.
      if (!sent) logger.warn({ email: user.email, url }, "lien de reinitialisation non envoye (SMTP absent)");
    }
    // `mailConfigured` ne dépend pas du compte : il ne dit pas si l'adresse existe, mais
    // il évite de promettre un email que le serveur est incapable d'envoyer.
    res.json({ ok: true, mailConfigured: mailConfigured() });
  },
);

// Definition du nouveau mot de passe a partir du jeton recu par email.
router.post(
  "/reset-password",
  passwordResetLimiter,
  validateBody(z.object({ token: z.string().min(1), password: z.string().min(8).max(100) })),
  async (req, res) => {
    const { token, password } = req.body as { token: string; password: string };
    let payload: { sub: string; purpose?: string; v?: string };
    try {
      payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as typeof payload;
    } catch {
      throw badRequest("Lien expire ou invalide. Demandez-en un nouveau.");
    }
    if (payload.purpose !== "pwreset") throw badRequest("Lien invalide.");

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw badRequest("Lien invalide.");
    if (payload.v !== sha256(user.passwordHash).slice(0, 16)) {
      throw badRequest("Ce lien a deja ete utilise. Demandez-en un nouveau.");
    }

    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password) } });
    // Le compte a pu etre compromis : on coupe toutes les sessions existantes.
    await prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    res.json({ ok: true });
  },
);

// ============================ 2FA (application ou email) ============================

/**
 * Deux méthodes : l'application d'authentification (TOTP, avec un secret) ou un
 * code envoyé par email. Un compte activé avant l'email n'a pas de méthode
 * enregistrée : il a un secret, c'est donc l'application.
 */
type CompteDoubleAuth = { id: string; email: string; twoFactorEnabled: boolean; twoFactorSecret: string | null; twoFactorMethod: string | null };
const parEmail = (u: CompteDoubleAuth) => u.twoFactorMethod === "EMAIL";
function aLaDoubleAuth(u: CompteDoubleAuth) {
  return u.twoFactorEnabled && (parEmail(u) || !!u.twoFactorSecret);
}

/**
 * Le code par email voyage sans table : le ticket emporte son empreinte (HMAC
 * lié au compte), jamais le code lui-même. Vérifier, c'est recalculer
 * l'empreinte du code saisi. Le ticket expire avec le code, en 10 minutes.
 */
const CODE_TTL = "10m";
const empreinte = (userId: string, code: string) =>
  createHmac("sha256", env.JWT_ACCESS_SECRET).update(`2fa-email:${userId}:${code}`).digest("hex");
const memeEmpreinte = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const nouveauCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");
/** « c•••••@finalyn.com » : assez pour reconnaître sa boîte, pas assez pour la livrer. */
const masquer = (email: string) => {
  const [nom, domaine] = email.split("@");
  return `${nom.slice(0, 1)}${"•".repeat(Math.max(1, Math.min(nom.length - 1, 6)))}@${domaine}`;
};

async function envoyerCode(user: { id: string; email: string }, usage: "connexion" | "confirmation") {
  const code = nouveauCode();
  const parti = await sendMail({ to: user.email, ...codeEmail(code, usage) });
  if (!parti) throw badRequest("L'email avec votre code n'a pas pu partir. Réessayez dans un instant.");
  return empreinte(user.id, code);
}

/** Ticket court émis entre l'étape mot de passe et l'étape code 2FA. */
function sign2faTicket(userId: string, h?: string): string {
  return jwt.sign({ sub: userId, purpose: "2fa", ...(h ? { h } : {}) }, env.JWT_ACCESS_SECRET, { expiresIn: h ? CODE_TTL : "5m" });
}
function verify2faTicket(ticket: string, purpose = "2fa"): { sub: string; h?: string; expire: number } {
  const p = jwt.verify(ticket, env.JWT_ACCESS_SECRET) as { sub: string; purpose?: string; h?: string; exp?: number };
  if (p.purpose !== purpose) throw new Error("bad ticket");
  return { sub: p.sub, h: p.h, expire: (p.exp ?? 0) * 1000 };
}

/**
 * Les essais de code par ticket et par compte (lib/essais-code.ts) : cinq par
 * ticket, puis il ne sert plus ; un ticket qui a ouvert la session ne resservira
 * pas. Le ticket se reconnaît à son empreinte.
 */
const essais2fa = new EssaisDeCode();
const cleDeTicket = (ticket: string) => sha256(ticket);
function refusDEssai(refus: RefusEssai) {
  if (refus === "compte") return tooManyRequests("Trop de codes erronés sur ce compte. Réessayez dans un quart d'heure.");
  if (refus === "utilise") return unauthorized("Ce code a déjà servi, reconnectez-vous.");
  return unauthorized("Trop d'essais avec ce code, reconnectez-vous.");
}

/** La réponse de l'étape mot de passe quand un code est demandé (login et Google). */
async function ouvrirDoubleAuth(user: CompteDoubleAuth) {
  if (parEmail(user)) {
    const h = await envoyerCode(user, "connexion");
    return { twoFactorRequired: true as const, method: "email" as const, email: masquer(user.email), ticket: sign2faTicket(user.id, h) };
  }
  return { twoFactorRequired: true as const, method: "totp" as const, ticket: sign2faTicket(user.id) };
}

const codeSchema = z.object({ code: z.string().min(6).max(12) });
const cleanCode = (c: string) => c.replace(/\s/g, "");

// Étape 2 du login : vérifie le code de l'app d'authentification.
router.post(
  "/2fa/verify",
  twoFaLimiter,
  validateBody(z.object({ ticket: z.string().min(1), code: z.string().min(6).max(12) })),
  async (req, res) => {
    const { ticket, code } = req.body as { ticket: string; code: string };
    let t: { sub: string; h?: string; expire: number };
    try {
      t = verify2faTicket(ticket);
    } catch {
      throw unauthorized("Code expiré, reconnectez-vous.");
    }
    // L'essai est compté avant de lire le code, sans attente entre les deux :
    // des requêtes simultanées ne dépassent pas le compte.
    const cle = cleDeTicket(ticket);
    const refus = essais2fa.commencer(cle, t.sub, t.expire);
    if (refus) throw refusDEssai(refus);
    const user = await prisma.user.findUnique({ where: { id: t.sub } });
    if (!user || !aLaDoubleAuth(user)) throw unauthorized("2FA non configurée");
    const valide = parEmail(user)
      ? !!t.h && memeEmpreinte(empreinte(user.id, cleanCode(code)), t.h)
      : authenticator.verify({ token: cleanCode(code), secret: user.twoFactorSecret! });
    if (!valide) {
      const restants = essais2fa.echec(cle, user.id);
      throw unauthorized(restants > 0 ? "Code invalide" : "Code invalide. Trop d'essais avec ce code, reconnectez-vous.");
    }
    // Un ticket n'ouvre la session qu'une fois.
    if (!essais2fa.reussite(cle, user.id, t.expire)) throw refusDEssai("utilise");
    const tokens = await issueTokens(user);
    res.json({ user: publicUser(user), ...tokens });
  },
);

// Renvoie un code par email à l'étape de connexion (le précédent n'est pas arrivé).
router.post(
  "/2fa/resend",
  twoFaLimiter,
  validateBody(z.object({ ticket: z.string().min(1) })),
  async (req, res) => {
    const { ticket } = req.body as { ticket: string };
    let t: { sub: string; expire: number };
    try {
      t = verify2faTicket(ticket);
    } catch {
      throw unauthorized("Code expiré, reconnectez-vous.");
    }
    // Un ticket épuisé ou déjà utilisé ne rouvre pas cinq essais par ce détour.
    const cle = cleDeTicket(ticket);
    if (!essais2fa.utilisable(cle)) throw unauthorized("Ce code n'est plus valable, reconnectez-vous.");
    const user = await prisma.user.findUnique({ where: { id: t.sub } });
    if (!user || !aLaDoubleAuth(user) || !parEmail(user)) throw badRequest("Aucun code à renvoyer.");
    const etape = await ouvrirDoubleAuth(user);
    // Le nouveau code remplace l'ancien : l'ancien ticket ne sert plus.
    essais2fa.invalider(cle, t.expire);
    res.json(etape);
  },
);

// Les méthodes proposables : l'email n'en est une que si le serveur sait envoyer.
router.get("/2fa/options", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.auth!.sub }, select: { email: true } });
  res.json({ email: mailConfigured(), adresse: user ? masquer(user.email) : null });
});

// Envoie un code de confirmation au compte connecté (activer ou retirer la 2FA par email).
router.post("/2fa/email/code", requireAuth, twoFaLimiter, async (req, res) => {
  if (!mailConfigured()) throw badRequest("L'envoi d'emails n'est pas configuré sur ce serveur : la double authentification par email n'est pas disponible.");
  const user = await prisma.user.findUnique({ where: { id: req.auth!.sub } });
  if (!user) throw badRequest("User not found");
  const h = await envoyerCode(user, "confirmation");
  const ticket = jwt.sign({ sub: user.id, purpose: "2fa-confirm", h }, env.JWT_ACCESS_SECRET, { expiresIn: CODE_TTL });
  res.json({ ticket, email: masquer(user.email) });
});

/**
 * Le code de confirmation reçu par email, pour le compte connecté. Mêmes
 * limites d'essais que le code de connexion ; un ticket ne confirme qu'une fois.
 */
function codeDeConfirmationValide(userId: string, ticket: string | undefined, code: string) {
  if (!ticket) return false;
  let t: { sub: string; h?: string; expire: number };
  try {
    t = verify2faTicket(ticket, "2fa-confirm");
  } catch {
    return false;
  }
  if (t.sub !== userId || !t.h) return false;
  const cle = cleDeTicket(ticket);
  if (essais2fa.commencer(cle, userId, t.expire)) return false;
  if (!memeEmpreinte(empreinte(userId, cleanCode(code)), t.h)) {
    essais2fa.echec(cle, userId);
    return false;
  }
  return essais2fa.reussite(cle, userId, t.expire);
}

// Active la 2FA par email, une fois le code de confirmation saisi.
router.post(
  "/2fa/email/enable",
  requireAuth,
  twoFaLimiter,
  validateBody(z.object({ ticket: z.string().min(1), code: z.string().min(6).max(12) })),
  async (req, res) => {
    const { ticket, code } = req.body as { ticket: string; code: string };
    if (!codeDeConfirmationValide(req.auth!.sub, ticket, code)) throw badRequest("Code invalide ou expiré.");
    await prisma.user.update({
      where: { id: req.auth!.sub },
      data: { twoFactorEnabled: true, twoFactorMethod: "EMAIL", twoFactorSecret: null },
    });
    res.json({ enabled: true, method: "EMAIL" });
  },
);

// Démarre l'activation : génère un secret + QR à scanner. N'active pas encore.
router.post("/2fa/setup", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.auth!.sub } });
  if (!user) throw badRequest("User not found");
  // Sans ce garde-fou, démarrer l'application désactivait en silence une 2FA par
  // email déjà en place.
  if (aLaDoubleAuth(user)) throw badRequest("Désactivez d'abord la double authentification en place.");
  const secret = authenticator.generateSecret();
  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorSecret: secret, twoFactorEnabled: false },
  });
  const otpauth = authenticator.keyuri(user.email, "Diagly", secret);
  const qr = await QRCode.toDataURL(otpauth);
  res.json({ otpauth, qr, secret });
});

// Confirme le premier code et active la 2FA.
router.post("/2fa/enable", requireAuth, validateBody(codeSchema), async (req, res) => {
  const { code } = req.body as { code: string };
  const user = await prisma.user.findUnique({ where: { id: req.auth!.sub } });
  if (!user || !user.twoFactorSecret) throw badRequest("Lancez d'abord la configuration 2FA");
  if (!authenticator.verify({ token: cleanCode(code), secret: user.twoFactorSecret })) {
    throw badRequest("Code invalide");
  }
  await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true, twoFactorMethod: "TOTP" } });
  res.json({ enabled: true, method: "TOTP" });
});

// Désactive la 2FA : un code de l'application, ou le code de confirmation reçu par email.
router.post(
  "/2fa/disable",
  requireAuth,
  twoFaLimiter,
  validateBody(codeSchema.extend({ ticket: z.string().optional() })),
  async (req, res) => {
    const { code, ticket } = req.body as { code: string; ticket?: string };
    const user = await prisma.user.findUnique({ where: { id: req.auth!.sub } });
    if (!user || !aLaDoubleAuth(user)) return res.json({ enabled: false });
    const valide = parEmail(user)
      ? codeDeConfirmationValide(user.id, ticket, code)
      : authenticator.verify({ token: cleanCode(code), secret: user.twoFactorSecret! });
    if (!valide) throw badRequest("Code invalide");
    await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorMethod: null } });
    res.json({ enabled: false });
  },
);

// ============================ Google OAuth ============================

// La connexion Google demande aussi une URL publique atteignable : sans elle, Google
// affiche son ecran de consentement puis renvoie l'utilisateur sur une adresse morte.
const googleConfigured = () =>
  !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) && urlPubliqueValide();
const OAUTH_STATE_COOKIE = "diagly_oauth_state";

/** Lit un cookie sans dependance supplementaire (un seul cookie a lire dans toute l'app). */
function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
}
const googleRedirectUri = () => `${env.APP_URL}/api/auth/google/callback`;

// L'app iPhone/iPad ouvre ce même flux dans la fenêtre de connexion sécurisée
// d'iOS (ASWebAuthenticationSession), avec ?app=1 et l'empreinte (challenge)
// d'un secret qu'elle garde. Le retour se fait vers ch.diagly.app://oauth-callback,
// une adresse qu'une autre app installée peut déclarer aussi : il ne porte donc
// ni jetons ni ticket 2FA, seulement un code à usage unique, valable une minute,
// que l'app échange avec son secret (POST /app/echange, lib/pkce.ts).
const RETOUR_APP = `${env.APPLE_BUNDLE_ID}://oauth-callback`;
const codesApp = new CodesDeConnexion();

// Démarre le flux : redirige vers l'écran de consentement Google.
router.get("/google", (req, res) => {
  const depuisApp = req.query.app === "1";
  if (!googleConfigured()) {
    const msg = encodeURIComponent("Connexion Google non disponible pour le moment");
    return res.redirect(depuisApp ? `${RETOUR_APP}#error=${msg}` : `${env.APP_URL}/login?error=${msg}`);
  }
  // Sans empreinte, le retour ne pourrait pas s'échanger : c'est une version de
  // l'app d'avant cet échange, qui attendait des jetons dans l'adresse.
  const challenge = req.query.challenge;
  if (depuisApp && !challengeValide(challenge)) {
    const msg = encodeURIComponent("Mettez à jour l'app Diagly pour vous connecter avec Google.");
    return res.redirect(`${RETOUR_APP}#error=${msg}`);
  }
  // L'etat est lie au NAVIGATEUR qui a lance la connexion, via un cookie httpOnly.
  // Sans ce lien, un attaquant peut faire visiter a la victime une URL de retour portant
  // SON code d'autorisation : la victime se retrouve connectee au compte de l'attaquant
  // et travaille dedans sans le voir (CSRF de connexion).
  // L'empreinte de l'app voyage dans l'état signé, jusqu'au retour de Google.
  const nonce = crypto.randomUUID();
  const state = jwt.sign(
    { n: nonce, purpose: "oauth", ...(depuisApp ? { app: true, c: challenge } : {}) },
    env.JWT_ACCESS_SECRET,
    { expiresIn: "10m" },
  );
  res.cookie(OAUTH_STATE_COOKIE, nonce, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax", // doit survivre au retour depuis accounts.google.com
    maxAge: 10 * 60_000,
    path: "/api/auth",
  });
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID!,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

// Retour de Google : échange le code, trouve/crée l'utilisateur, renvoie au front avec les tokens.
router.get("/google/callback", async (req, res) => {
  const { code, state } = req.query as { code?: string; state?: string };
  // Retour vers l'app ou vers le site, selon l'endroit où la connexion est partie.
  // L'état n'est pas encore vérifié ici : il ne décide que de l'adresse de retour.
  const depuisApp = (() => {
    try { return !!(state && (jwt.decode(state) as { app?: boolean } | null)?.app); } catch { return false; }
  })();
  const fail = (msg: string) => res.redirect(depuisApp
    ? `${RETOUR_APP}#error=${encodeURIComponent(msg)}`
    : `${env.APP_URL}/login?error=${encodeURIComponent(msg)}`);

  if (!googleConfigured()) return fail("Google non configuré");
  if (!code || !state) return fail("Réponse Google invalide");
  const expectedNonce = readCookie(req.headers.cookie, OAUTH_STATE_COOKIE);
  res.clearCookie(OAUTH_STATE_COOKIE, { path: "/api/auth" }); // usage unique
  let st: { n?: string; purpose?: string; app?: boolean; c?: string };
  try {
    st = jwt.verify(state, env.JWT_ACCESS_SECRET) as typeof st;
    // Le retour doit correspondre a la demande partie de CE navigateur.
    if (st.purpose !== "oauth" || !st.n || !expectedNonce || st.n !== expectedNonce) throw new Error("state mismatch");
    // Une connexion partie de l'app porte l'empreinte du secret de l'app.
    if (st.app && !challengeValide(st.c)) throw new Error("challenge manquant");
  } catch {
    return fail("État OAuth invalide");
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) return fail("Échange du code Google échoué");
  const tokenData = (await tokenRes.json()) as { access_token?: string };
  if (!tokenData.access_token) return fail("Token Google manquant");

  const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  if (!infoRes.ok) return fail("Profil Google inaccessible");
  const info = (await infoRes.json()) as {
    email?: string;
    email_verified?: boolean;
    given_name?: string;
    family_name?: string;
  };
  if (!info.email) return fail("Email Google introuvable");
  // L'identite repose entierement sur cet email (il peut rattacher a un compte existant) :
  // on exige que Google l'ait VERIFIE, sinon n'importe qui pourrait revendiquer l'adresse.
  if (info.email_verified !== true) return fail("Adresse Google non verifiee");
  const email = info.email.toLowerCase();

  // Identité = email (vérifié par Google). On lie à un compte existant ou on le crée.
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(crypto.randomUUID() + crypto.randomUUID()), // inutilisable
        firstName: info.given_name,
        lastName: info.family_name,
        role: "PARTICULIER",
      },
    });
  }

  // L'app : seulement un code, lié au compte et à l'empreinte de son secret.
  // La session, ou l'étape 2FA, vient à l'échange (POST /app/echange).
  if (st.app && st.c) {
    const codeApp = codesApp.emettre(user.id, st.c);
    return res.redirect(`${RETOUR_APP}?code=${encodeURIComponent(codeApp)}`);
  }

  return terminerSurLeSite(res, user);
});

/**
 * Fin d'une connexion par redirection sur le site (Google, Apple) : la session,
 * ou l'étape du code 2FA, part dans le fragment de /oauth-callback. Un fragment
 * n'est envoyé à aucun serveur ; la page de retour le lit puis l'efface.
 * 303 : le retour d'Apple arrive par un POST, la page se charge en GET.
 */
async function terminerSurLeSite(res: Response, user: CompteDoubleAuth & { role: string }) {
  const retour = `${env.APP_URL}/oauth-callback`;
  // La 2FA s'applique AUSSI à ces parcours : sans ce contrôle, activer la 2FA sur un
  // compte lié à une adresse Gmail ou à un identifiant Apple serait contournable en un clic.
  if (aLaDoubleAuth(user)) {
    const etape = await ouvrirDoubleAuth(user);
    const frag = new URLSearchParams({
      twoFactorRequired: "1", ticket: etape.ticket, method: etape.method, ...("email" in etape ? { email: etape.email } : {}),
    });
    return res.redirect(303, `${retour}#${frag.toString()}`);
  }

  const tokens = await issueTokens(user);
  const frag = new URLSearchParams({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
  res.redirect(303, `${retour}#${frag.toString()}`);
}

const echangeSchema = z.object({
  code: z.string().min(20).max(200),
  verifier: z.string().min(43).max(128),
});

/**
 * L'app échange le code reçu au retour de Google, avec le secret dont
 * l'empreinte est partie à la demande. Réponse identique à une connexion par
 * mot de passe : la session, ou l'étape du code 2FA (le code par email part ici).
 */
router.post("/app/echange", loginLimiter, validateBody(echangeSchema), async (req, res) => {
  const { code, verifier } = req.body as z.infer<typeof echangeSchema>;
  const userId = codesApp.echanger(code, verifier);
  if (!userId) throw unauthorized("Connexion expirée. Recommencez la connexion avec Google.");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw unauthorized("Compte introuvable.");
  if (aLaDoubleAuth(user)) return res.json(await ouvrirDoubleAuth(user));
  const tokens = await issueTokens(user);
  res.json({ user: publicUser(user), ...tokens });
});

// ----------------------------------------------------- Se connecter avec Apple

const appleSchema = z.object({
  identityToken: z.string().min(20).max(5000),
  authorizationCode: z.string().max(1000).optional(),
  // Apple ne donne le nom qu'à la toute première connexion.
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
});

/**
 * Le compte d'une connexion Apple, depuis l'app ou depuis le site.
 *
 * Le compte se retrouve par l'identifiant Apple, puis par l'adresse si Apple
 * l'a vérifiée (une personne déjà inscrite avec cette adresse retrouve son
 * compte), sinon il est créé. Une adresse relais (@privaterelay.appleid.com)
 * fait un compte à part : c'est le choix de la personne de masquer son adresse.
 * L'identifiant Apple est le même pour l'app et le site tant que l'identifiant
 * de service est rattaché à l'App ID de l'app (même équipe, même groupe).
 * Les refus sont des HttpError (409 pour une adresse non vérifiée déjà prise).
 */
async function compteApple(identite: IdentiteApple, nom: { firstName?: string; lastName?: string }) {
  let user = await prisma.user.findFirst({ where: { appleSub: identite.sub } });
  if (!user && identite.email && identite.emailVerifie) {
    user = await prisma.user.findUnique({ where: { email: identite.email } });
  }
  if (!user) {
    if (!identite.email) throw badRequest("Apple n'a pas transmis d'adresse email : autorisez-la dans la fenêtre de connexion.");
    // L'adresse appartient déjà à un compte, mais Apple ne l'a pas vérifiée : on
    // ne peut ni l'y rattacher (n'importe qui pourrait la revendiquer) ni en
    // créer un second. La création échouait sur l'unicité de l'adresse (500).
    const adresseRefusee = conflict(
      "Un compte Diagly existe déjà avec cette adresse, mais Apple ne l'a pas confirmée. Connectez-vous avec votre mot de passe ou avec Google.",
    );
    if (await prisma.user.findUnique({ where: { email: identite.email }, select: { id: true } })) throw adresseRefusee;
    try {
      user = await prisma.user.create({
        data: {
          email: identite.email,
          passwordHash: await hashPassword(crypto.randomUUID() + crypto.randomUUID()), // inutilisable
          firstName: nom.firstName || undefined,
          lastName: nom.lastName || undefined,
          role: "PARTICULIER",
          appleSub: identite.sub,
        },
      });
    } catch (err) {
      // Compte créé entre-temps avec la même adresse (deux connexions simultanées).
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw identite.emailVerifie ? conflict("Ce compte vient d'être créé. Réessayez de vous connecter.") : adresseRefusee;
      }
      throw err;
    }
  } else if (user.appleSub !== identite.sub) {
    user = await prisma.user.update({ where: { id: user.id }, data: { appleSub: identite.sub } });
  }
  return user;
}

/**
 * De quoi révoquer l'accès à la suppression du compte, comme Apple l'exige.
 * Sans clé Apple, ou si Apple refuse l'échange, la connexion se fait quand même.
 */
async function garderJetonApple(userId: string, code: string, site?: ClientSiteApple) {
  const jeton = await jetonDeRevocation(code, site).catch(() => null);
  if (jeton) await prisma.user.update({ where: { id: userId }, data: { appleRefreshToken: jeton } });
}

/**
 * Connexion depuis l'app iPhone/iPad avec « Se connecter avec Apple ». L'app
 * envoie le jeton d'identité qu'iOS lui a remis ; on le vérifie auprès d'Apple.
 */
router.post("/apple", loginLimiter, validateBody(appleSchema), async (req, res) => {
  const corps = req.body as z.infer<typeof appleSchema>;
  let identite;
  try {
    identite = await verifierJetonApple(corps.identityToken);
  } catch (err) {
    logger.warn({ err }, "jeton Apple refusé");
    throw unauthorized("Connexion Apple refusée.");
  }

  const user = await compteApple(identite, corps);
  if (corps.authorizationCode) await garderJetonApple(user.id, corps.authorizationCode);

  // La 2FA s'applique aussi ici, comme pour Google.
  if (aLaDoubleAuth(user)) return res.json(await ouvrirDoubleAuth(user));
  const tokens = await issueTokens(user);
  res.json({ user: publicUser(user), ...tokens });
});

// --------------------------------------- Se connecter avec Apple, sur le site

// Apple n'accepte qu'une adresse de retour en https, sur un domaine déclaré chez
// lui : sans APP_URL publique en https, le bouton ne mènerait nulle part.
const appleWebConfiguree = () =>
  !!env.APPLE_SERVICES_ID && urlPubliqueValide() && env.APP_URL.startsWith("https://");
const APPLE_ETAT_COOKIE = "diagly_apple_etat";
// Apple revient par un POST venu de appleid.apple.com : un cookie SameSite=Lax
// n'y serait pas joint. None exige Secure ; le chemin le réserve à ce flux.
const cookieEtatApple = { httpOnly: true, secure: true, sameSite: "none" as const, path: "/api/auth/apple/web" };

// Les connexions que le site peut proposer, d'après la configuration du serveur.
// L'app iPhone/iPad a ses propres boutons et ne s'en sert pas.
router.get("/fournisseurs", (_req, res) => {
  res.json({ google: googleConfigured(), apple: appleWebConfiguree() });
});

// Démarre le flux : redirige vers appleid.apple.com (lib/apple-web.ts).
router.get("/apple/web", (_req, res) => {
  const servicesId = env.APPLE_SERVICES_ID;
  if (!servicesId || !appleWebConfiguree()) {
    return res.redirect(`${env.APP_URL}/login?error=${encodeURIComponent("Connexion Apple non disponible pour le moment")}`);
  }
  const { url, lien } = demandeAppleWeb({ servicesId, retour: adresseDeRetourApple(env.APP_URL), secret: env.JWT_ACCESS_SECRET });
  res.cookie(APPLE_ETAT_COOKIE, lien, { ...cookieEtatApple, maxAge: DUREE_DEMANDE_MS });
  res.redirect(url);
});

/**
 * Retour d'Apple, par un formulaire POST (code, id_token, state ; user au
 * premier passage ; error si la personne a renoncé). Même compte que depuis
 * l'app, même fin que le retour de Google sur le site.
 */
router.post("/apple/web/retour", express.urlencoded({ extended: false, limit: "20kb" }), async (req, res) => {
  const corps = (req.body ?? {}) as Record<string, unknown>;
  const champ = (nom: string) => (typeof corps[nom] === "string" ? (corps[nom] as string) : undefined);
  const fail = (msg?: string) =>
    res.redirect(303, msg ? `${env.APP_URL}/login?error=${encodeURIComponent(msg)}` : `${env.APP_URL}/login`);

  const lien = readCookie(req.headers.cookie, APPLE_ETAT_COOKIE);
  res.clearCookie(APPLE_ETAT_COOKIE, cookieEtatApple); // usage unique

  const servicesId = env.APPLE_SERVICES_ID;
  if (!servicesId || !appleWebConfiguree()) return fail("Connexion Apple non disponible pour le moment");
  // La personne a fermé la fenêtre d'Apple : retour à l'écran de connexion, sans message.
  const erreur = champ("error");
  if (erreur) return fail(erreur === "user_cancelled_authorize" ? undefined : "Connexion Apple refusée.");

  // Le retour doit correspondre à la demande partie de CE navigateur (CSRF de connexion).
  let attendu: { nonce: string };
  try {
    attendu = verifierEtatAppleWeb(champ("state"), lien, env.JWT_ACCESS_SECRET);
  } catch (err) {
    logger.warn({ err }, "état de la connexion Apple (site) refusé");
    return fail("La connexion Apple a expiré ou a été lancée ailleurs. Recommencez.");
  }

  const idToken = champ("id_token");
  if (!idToken) return fail("Réponse Apple invalide");
  let identite;
  try {
    identite = await verifierJetonApple(idToken, { audience: servicesId, nonce: attendu.nonce });
  } catch (err) {
    logger.warn({ err }, "jeton Apple (site) refusé");
    return fail("Connexion Apple refusée.");
  }

  let user;
  try {
    user = await compteApple(identite, nomDuPremierPassage(champ("user")));
  } catch (err) {
    if (err instanceof HttpError) return fail(err.message);
    throw err;
  }

  const code = champ("code");
  if (code) await garderJetonApple(user.id, code, { servicesId, retour: adresseDeRetourApple(env.APP_URL) });

  return terminerSurLeSite(res, user);
});

// ------------------------------------------------------- Supprimer son compte

const suppressionSchema = z.object({ confirmation: z.literal("SUPPRIMER") });

/**
 * Qui reprend les dossiers d'un membre d'équipe qui supprime son compte : le
 * propriétaire de l'équipe ; à défaut (cas anormal), un administrateur, sinon
 * le plus ancien des autres membres. null quand le compte est seul dans l'équipe.
 */
async function repreneurDesDossiers(organizationId: string, userId: string): Promise<string | null> {
  const autres = { organizationId, id: { not: userId } };
  const repreneur =
    (await prisma.user.findFirst({ where: { ...autres, orgRole: "OWNER" }, select: { id: true } })) ??
    (await prisma.user.findFirst({ where: { ...autres, orgRole: "ADMIN" }, orderBy: { createdAt: "asc" }, select: { id: true } })) ??
    (await prisma.user.findFirst({ where: autres, orderBy: { createdAt: "asc" }, select: { id: true } }));
  return repreneur?.id ?? null;
}

/**
 * Suppression du compte par son titulaire, depuis l'app ou le site (exigée par
 * Apple pour toute app où l'on peut créer un compte, et due au titre de la
 * nLPD). Tout ce qui appartient au compte part avec lui : dossiers, relevés,
 * photos, plans (fichiers compris), notifications, appareils. Sauf pour un
 * membre d'équipe : ses dossiers sont ceux de l'équipe, ils lui restent.
 */
router.post("/compte/supprimer", requireAuth, validateBody(suppressionSchema), async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.auth!.sub },
    select: { id: true, organizationId: true, orgRole: true, appleRefreshToken: true },
  });
  if (!user) throw unauthorized("Compte introuvable.");

  // Le propriétaire d'une équipe qui a d'autres membres : supprimer son compte
  // emporterait les dossiers que l'équipe partage. Il confie d'abord l'équipe.
  if (user.organizationId && user.orgRole === "OWNER") {
    const autres = await prisma.user.count({ where: { organizationId: user.organizationId, id: { not: user.id } } });
    if (autres > 0) {
      throw conflict("Vous êtes propriétaire d'une équipe qui a d'autres membres. Retirez-les ou confiez-leur l'équipe (Paramètres, Membres), puis supprimez votre compte.");
    }
  }

  // Un membre d'équipe (pas son propriétaire) : le parc se partage par le
  // propriétaire des dossiers (lib/org-context.ts), et la suppression du compte
  // emportait en cascade les dossiers qu'il avait créés pour l'équipe. Ils
  // passent au propriétaire de l'équipe, avec les opérations qui les regroupent
  // (même ownerId, même cascade), dans la même transaction que la suppression.
  const repreneur = user.organizationId && user.orgRole !== "OWNER"
    ? await repreneurDesDossiers(user.organizationId, user.id)
    : null;

  // Les fichiers des plans ne sont pas en base : ceux des dossiers qui partent
  // avec le compte sont effacés du disque, une fois la suppression faite.
  const plans = repreneur
    ? []
    : await prisma.plan.findMany({ where: { project: { ownerId: user.id } }, select: { fileName: true } });

  const dossiersConfies = await prisma.$transaction(async (tx) => {
    let confies = 0;
    if (repreneur) {
      confies = (await tx.project.updateMany({ where: { ownerId: user.id }, data: { ownerId: repreneur } })).count;
      await tx.operation.updateMany({ where: { ownerId: user.id }, data: { ownerId: repreneur } });
    }
    await tx.user.delete({ where: { id: user.id } });
    return confies;
  });

  await Promise.all(plans.map((p) => unlink(join(UPLOAD_DIR, p.fileName)).catch(() => undefined)));
  // Après la suppression : un échec de celle-ci ne laisse pas un compte privé de sa connexion Apple.
  if (user.appleRefreshToken) await revoquerApple(user.appleRefreshToken).catch(() => undefined);
  // Une équipe dont le seul membre vient de partir n'a plus de raison d'être.
  if (user.organizationId) {
    const restants = await prisma.user.count({ where: { organizationId: user.organizationId } });
    if (restants === 0) await prisma.organization.delete({ where: { id: user.organizationId } }).catch(() => undefined);
  }
  logger.info({ userId: user.id, repreneur, dossiersConfies }, "compte supprimé par son titulaire");
  res.status(204).end();
});

export default router;
