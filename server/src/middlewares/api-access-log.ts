import type { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";

/**
 * Journalise chaque accès à l'API publique (table api_access_logs, auditable) + log pino structuré.
 * A monter EN PREMIER sur le routeur v1 pour capter aussi les échecs d'authentification.
 */
export function apiAccessLog(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  res.on("finish", () => {
    const durationMs = Date.now() - start;
    const ownerId = req.auth?.sub ?? "anonymous";
    prisma.apiAccessLog
      .create({
        data: {
          apiKeyId: req.apiKey?.id ?? null,
          userId: ownerId,
          method: req.method,
          path: req.originalUrl.slice(0, 400),
          status: res.statusCode,
          ip: (req.ip ?? "").slice(0, 64) || null,
          durationMs,
        },
      })
      .catch((err) => logger.error({ err }, "api access log write failed"));
    logger.info(
      { apiKeyId: req.apiKey?.id, ownerId, method: req.method, path: req.path, status: res.statusCode, durationMs },
      "api request",
    );
  });
  next();
}
