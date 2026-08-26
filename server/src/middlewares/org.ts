import type { Request, Response, NextFunction } from "express";
import { getOrgContext } from "../lib/org-context.js";
import { forbidden } from "../lib/http-error.js";

/** Bloque les mutations (méthodes non idempotentes de lecture) pour les membres VIEWER. */
export async function blockViewerWrites(req: Request, _res: Response, next: NextFunction) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
  const ctx = await getOrgContext(req.auth!.sub);
  if (ctx.orgRole === "VIEWER") return next(forbidden("Compte en lecture seule : action non autorisée."));
  return next();
}

const RANK: Record<string, number> = { OWNER: 4, ADMIN: 3, MEMBER: 2, VIEWER: 1 };

/** Exige au moins le rôle d'organisation `min` (OWNER > ADMIN > MEMBER > VIEWER). */
export function requireOrgRole(min: "OWNER" | "ADMIN" | "MEMBER") {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const ctx = await getOrgContext(req.auth!.sub);
    if (!ctx.organizationId || (RANK[ctx.orgRole ?? ""] ?? 0) < RANK[min]) {
      return next(forbidden("Rôle insuffisant dans l'organisation."));
    }
    return next();
  };
}
