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
import { loginLimiter, registerLimiter, twoFaLimiter } from "../middlewares/rate-limit.js";
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
function mergePrefs(cur: Record<string, unknown>, inc: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...cur };
  for (const [k, v] of Object.entries(inc)) {
    if (v && typeof v === "object" && !Array.isArray(v) && cur[k] && typeof cur[k] === "object") {
      out[k] = { ...(cur[k] as object), ...(v as object) };
    } else out[k] = v;
  }
  return out;
}
router.put("/preferences", requireAuth, async (req, res) => {
  const inc = (req.body ?? {}) as Record<string, unknown>;
  if (typeof inc !== "object" || Array.isArray(inc)) throw badRequest("Invalid preferences");
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
const googleRedirectUri = () => `${env.APP_URL}/api/auth/google/callback`;

// Démarre le flux : redirige vers l'écran de consentement Google.
router.get("/google", (_req, res) => {
  if (!googleConfigured()) {
    return res.redirect(`${env.APP_URL}/login?error=${encodeURIComponent("Connexion Google non disponible pour le moment")}`);
  }
  const state = jwt.sign({ n: crypto.randomUUID(), purpose: "oauth" }, env.JWT_ACCESS_SECRET, { expiresIn: "10m" });
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
  try {
    jwt.verify(state, env.JWT_ACCESS_SECRET);
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
    given_name?: string;
    family_name?: string;
  };
  if (!info.email) return fail("Email Google introuvable");
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

  const tokens = await issueTokens(user);
  const frag = new URLSearchParams({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
  res.redirect(`${env.APP_URL}/oauth-callback#${frag.toString()}`);
});

export default router;
