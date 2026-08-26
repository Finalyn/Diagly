import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";

const tooMany = { error: "Trop de tentatives. Reessayez dans quelques minutes." };

/** Backstop global anti-flood par IP sur /api (genereux : n'entrave pas l'usage normal). */
export const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 600,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: tooMany,
});

/** Import de fichiers (plans) : quota PAR UTILISATEUR pour eviter le remplissage du disque. */
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 40,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Trop d'imports de fichiers. Reessayez plus tard." },
  keyGenerator: (req: Request) => req.auth?.sub ?? ipKeyGenerator(req.ip ?? ""),
});

/** Login : freine le brute-force de mot de passe (par IP). */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: tooMany,
});

/** Inscription : freine la creation de comptes en masse (par IP). */
export const registerLimiter = rateLimit({
  windowMs: 60 * 60_000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: tooMany,
});

/** Mot de passe oublie : freine l'envoi en masse d'emails et le sondage d'adresses (par IP). */
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60_000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: tooMany,
});

/** Verification 2FA : freine le brute-force du code TOTP (par IP). */
export const twoFaLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: tooMany,
});

/** API publique v1 : quota PAR CLÉ d'API (retombe sur l'IP si pas de clé). A placer apres requireApiKey. */
export const apiKeyLimiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Rate limit exceeded for this API key." },
  keyGenerator: (req: Request) => req.apiKey?.id ?? ipKeyGenerator(req.ip ?? ""),
});

/** Endpoints IA payants : quota PAR UTILISATEUR (protege la facture Anthropic). A placer apres requireAuth. */
export const aiLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 40,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Limite d'utilisation de l'assistant atteinte. Reessayez dans quelques minutes." },
  keyGenerator: (req: Request) => req.auth?.sub ?? ipKeyGenerator(req.ip ?? ""),
});
