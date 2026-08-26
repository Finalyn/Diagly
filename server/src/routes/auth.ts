import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { env } from "../lib/env.js";
import { hashPassword, sha256, verifyPassword } from "../lib/hash.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../lib/jwt.js";
import { badRequest, conflict, unauthorized } from "../lib/http-error.js";
import { validateBody } from "../middlewares/validate.js";
import { requireAuth } from "../middlewares/auth.js";
import { loginLimiter, passwordResetLimiter, registerLimiter, twoFaLimiter } from "../middlewares/rate-limit.js";
import { sendMail, passwordResetEmail } from "../lib/mail.js";
import { logger } from "../lib/logger.js";
import jwt from "jsonwebtoken";
import { authenticator } from "otplib";
import QRCode from "qrcode";

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

function publicUser<T extends { passwordHash: string; twoFactorSecret?: string | null }>(u: T) {
  // On ne renvoie jamais le hash du mot de passe ni le secret 2FA au client.
  const { passwordHash: _p, twoFactorSecret: _s, ...rest } = u;
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

async function issueTokens(user: { id: string; email: string; role: string }) {
  const accessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role });

  const jti = crypto.randomUUID();
  const refreshToken = signRefreshToken({ sub: user.id, jti });
  const expiresAt = new Date(Date.now() + ttlToMs(env.JWT_REFRESH_TTL));

  await prisma.refreshToken.create({
    data: {
      id: jti,
      userId: user.id,
      tokenHash: sha256(refreshToken),
      expiresAt,
    },
  });

  return { accessToken, refreshToken };
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

  // Si la 2FA est active : on ne délivre pas encore les tokens, on demande le code.
  if (user.twoFactorEnabled && user.twoFactorSecret) {
    return res.json({ twoFactorRequired: true, ticket: sign2faTicket(user.id) });
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
  if (stored.revokedAt) throw unauthorized("Refresh token revoked");
  if (stored.expiresAt < new Date()) throw unauthorized("Refresh token expired");
  if (stored.tokenHash !== sha256(refreshToken)) throw unauthorized("Refresh token mismatch");

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw unauthorized("User no longer exists");

  // Rotation : on révoque l'ancien et on émet une nouvelle paire.
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });
  const tokens = await issueTokens(user);
  res.json({ user: publicUser(user), ...tokens });
});

router.post("/logout", validateBody(refreshSchema), async (req, res) => {
  const { refreshToken } = req.body as z.infer<typeof refreshSchema>;
  try {
    const payload = verifyRefreshToken(refreshToken);
    await prisma.refreshToken.updateMany({
      where: { id: payload.jti, revokedAt: null },
      data: { revokedAt: new Date() },
    });
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
  // Logo : uniquement une image en data URL (une URL externe fuiterait vers un tiers
  // depuis le rapport client, et serait de toute facon bloquee par la CSP).
  logo: z.string().max(400_000).regex(/^data:image\/(png|jpeg|webp|svg\+xml);base64,/, "Logo invalide.").nullish(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur invalide.").nullish(),
}).strict().partial();

const exportColumn = z.object({ key: z.string().max(60), label: z.string().max(120), active: z.boolean() });
const preferencesSchema = z.object({
  company: companySchema,
  defaults: z.object({
    honoraryPct: z.number().min(0).max(100), reservePct: z.number().min(0).max(100),
    vatPct: z.number().min(0).max(100), unit: z.enum(["m", "cm", "mm"]),
  }).strict().partial(),
  notifications: z.object({
    emailDiagnostic: z.boolean(), calendarReminders: z.boolean(),
    weeklyDigest: z.boolean(), priorityAlerts: z.boolean(),
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
    res.json({ ok: true });
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

// ============================ 2FA (TOTP) ============================

/** Ticket court (5 min) émis entre l'étape mot de passe et l'étape code 2FA. */
function sign2faTicket(userId: string): string {
  return jwt.sign({ sub: userId, purpose: "2fa" }, env.JWT_ACCESS_SECRET, { expiresIn: "5m" });
}
function verify2faTicket(ticket: string): string {
  const p = jwt.verify(ticket, env.JWT_ACCESS_SECRET) as { sub: string; purpose?: string };
  if (p.purpose !== "2fa") throw new Error("bad ticket");
  return p.sub;
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
    let userId: string;
    try {
      userId = verify2faTicket(ticket);
    } catch {
      throw unauthorized("Session expirée, reconnectez-vous.");
    }
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) throw unauthorized("2FA non configurée");
    if (!authenticator.verify({ token: cleanCode(code), secret: user.twoFactorSecret })) {
      throw unauthorized("Code invalide");
    }
    const tokens = await issueTokens(user);
    res.json({ user: publicUser(user), ...tokens });
  },
);

// Démarre l'activation : génère un secret + QR à scanner. N'active pas encore.
router.post("/2fa/setup", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.auth!.sub } });
  if (!user) throw badRequest("User not found");
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
  await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true } });
  res.json({ enabled: true });
});

// Désactive la 2FA (code requis).
router.post("/2fa/disable", requireAuth, validateBody(codeSchema), async (req, res) => {
  const { code } = req.body as { code: string };
  const user = await prisma.user.findUnique({ where: { id: req.auth!.sub } });
  if (!user || !user.twoFactorSecret) return res.json({ enabled: false });
  if (!authenticator.verify({ token: cleanCode(code), secret: user.twoFactorSecret })) {
    throw badRequest("Code invalide");
  }
  await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: false, twoFactorSecret: null } });
  res.json({ enabled: false });
});

// ============================ Google OAuth ============================

const googleConfigured = () => !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
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

// Démarre le flux : redirige vers l'écran de consentement Google.
router.get("/google", (_req, res) => {
  if (!googleConfigured()) {
    return res.redirect(`${env.APP_URL}/login?error=${encodeURIComponent("Connexion Google non disponible pour le moment")}`);
  }
  // L'etat est lie au NAVIGATEUR qui a lance la connexion, via un cookie httpOnly.
  // Sans ce lien, un attaquant peut faire visiter a la victime une URL de retour portant
  // SON code d'autorisation : la victime se retrouve connectee au compte de l'attaquant
  // et travaille dedans sans le voir (CSRF de connexion).
  const nonce = crypto.randomUUID();
  const state = jwt.sign({ n: nonce, purpose: "oauth" }, env.JWT_ACCESS_SECRET, { expiresIn: "10m" });
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
  const fail = (msg: string) => res.redirect(`${env.APP_URL}/login?error=${encodeURIComponent(msg)}`);

  if (!googleConfigured()) return fail("Google non configuré");
  if (!code || !state) return fail("Réponse Google invalide");
  const expectedNonce = readCookie(req.headers.cookie, OAUTH_STATE_COOKIE);
  res.clearCookie(OAUTH_STATE_COOKIE, { path: "/api/auth" }); // usage unique
  try {
    const st = jwt.verify(state, env.JWT_ACCESS_SECRET) as { n?: string; purpose?: string };
    // Le retour doit correspondre a la demande partie de CE navigateur.
    if (st.purpose !== "oauth" || !st.n || !expectedNonce || st.n !== expectedNonce) throw new Error("state mismatch");
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

  // La 2FA s'applique AUSSI au parcours Google : sans ce controle, activer la 2FA sur un
  // compte lie a une adresse Gmail serait contournable en un clic.
  if (user.twoFactorEnabled && user.twoFactorSecret) {
    const frag = new URLSearchParams({ twoFactorRequired: "1", ticket: sign2faTicket(user.id) });
    return res.redirect(`${env.APP_URL}/oauth-callback#${frag.toString()}`);
  }

  const tokens = await issueTokens(user);
  const frag = new URLSearchParams({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
  res.redirect(`${env.APP_URL}/oauth-callback#${frag.toString()}`);
});

export default router;
