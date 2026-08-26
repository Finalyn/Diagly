import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken, type AccessTokenPayload } from "../lib/jwt.js";
import { unauthorized, forbidden } from "../lib/http-error.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AccessTokenPayload;
      /** Renseigné par requireApiKey (API publique v1) : clé utilisée pour la requête. */
      apiKey?: { id: string; scopes: string[] };
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return next(unauthorized("Missing Bearer token"));
  }
  const token = header.slice("Bearer ".length).trim();
  try {
    const payload = verifyAccessToken(token);
    // Deuxieme verrou : tout le cloisonnement des donnees repose sur `sub`. S'il manquait,
    // les filtres Prisma `where: { userId: sub }` deviendraient des requetes SANS filtre.
    if (!payload.sub) return next(unauthorized("Invalid token"));
    req.auth = payload;
    return next();
  } catch {
    return next(unauthorized("Invalid or expired token"));
  }
}

/** Exige un role precis (a utiliser APRES requireAuth). Ex : requireRole("ADMIN"). */
export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(unauthorized("Authentication required"));
    if (!roles.includes(req.auth.role)) return next(forbidden("Insufficient permissions"));
    return next();
  };
}
