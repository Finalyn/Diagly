import type { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma.js";
import { unauthorized, forbidden } from "../lib/http-error.js";
import { hashApiKey, isApiKeyFormat } from "../lib/api-key.js";

/**
 * Authentification par clé d'API (API publique v1). Lit `Authorization: Bearer dgly_...`
 * ou l'en-tête `X-API-Key`. Pose `req.apiKey` et `req.auth` (owner) pour que toutes les
 * requêtes owner-scoped existantes fonctionnent inchangées.
 */
export async function requireApiKey(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const bearer = header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : undefined;
  const key = bearer ?? (req.headers["x-api-key"] as string | undefined);
  if (!isApiKeyFormat(key)) return next(unauthorized("Clé d'API manquante ou invalide."));

  const row = await prisma.apiKey.findUnique({ where: { tokenHash: hashApiKey(key) } });
  if (!row || row.revokedAt || (row.expiresAt && row.expiresAt.getTime() < Date.now())) {
    return next(unauthorized("Clé d'API invalide, expirée ou révoquée."));
  }

  const scopes = Array.isArray(row.scopes) ? (row.scopes as string[]) : ["read"];
  req.apiKey = { id: row.id, scopes };
  req.auth = { sub: row.userId, email: "", role: "API" };

  // Met à jour lastUsedAt au plus une fois par minute (évite une écriture par requête).
  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 60_000) {
    prisma.apiKey.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  }
  return next();
}

/** Exige un scope de lecture donné (v1 : toutes les clés ont "read"). A placer après requireApiKey. */
export function requireScope(scope: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.apiKey?.scopes.includes(scope)) return next(forbidden(`Scope requis : ${scope}`));
    return next();
  };
}
