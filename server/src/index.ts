import express from "express";
import "express-async-errors"; // rattrape les erreurs des handlers async -> errorHandler (évite les crashs)
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { join, resolve } from "node:path";
import { existsSync } from "node:fs";
import { env } from "./lib/env.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { errorHandler, notFoundHandler } from "./middlewares/error.js";

import authRouter from "./routes/auth.js";
import cfcRouter from "./routes/cfc.js";
import projectsRouter from "./routes/projects.js";
import operationsRouter from "./routes/operations.js";
import diagnosticsRouter from "./routes/diagnostics.js";
import plansRouter, { UPLOAD_DIR } from "./routes/plans.js";
import boardsRouter from "./routes/boards.js";
import eventsRouter from "./routes/events.js";
import assistantRouter from "./routes/assistant.js";
import geoRouter from "./routes/geo.js";
import marketRouter from "./routes/market.js";
import exportRouter from "./routes/export.js";
import apiKeysRouter from "./routes/api-keys.js";
import orgRouter from "./routes/org.js";
import supportRouter from "./routes/support.js";
import v1Router from "./routes/v1/index.js";
import shareRouter from "./routes/share.js";
import pushRouter from "./routes/push.js";
import { apiLimiter } from "./middlewares/rate-limit.js";
import { startReminderScheduler } from "./lib/scheduler.js";
import { startWebhookWorker } from "./lib/webhook-worker.js";
import webhooksRouter from "./routes/webhooks.js";
import mcpRouter from "./routes/mcp.js";

const app = express();

// Derriere le reverse proxy Infomaniak : req.ip reflete le vrai client (X-Forwarded-For),
// indispensable pour que le rate limiting fonctionne par IP et non globalement.
app.set("trust proxy", 1);

// En-tetes de securite (HSTS, nosniff, X-Frame-Options, Referrer-Policy, CSP…).
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'"],
        "style-src": ["'self'", "'unsafe-inline'"], // styles inline React (couleur d'accent, etc.)
        "img-src": ["'self'", "data:", "blob:"], // photos en data URL, apercu camera
        "font-src": ["'self'", "data:"],
        "connect-src": ["'self'", "https://api3.geo.admin.ch"], // API meme origine + autocompletion d'adresse
        "worker-src": ["'self'", "blob:"], // service worker + worker pdf.js
        "object-src": ["'none'"],
        "frame-ancestors": ["'self'"],
        "base-uri": ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false, // sinon bloque le chargement d'images/ressources same-origin
  }),
);

const allowedOrigins = env.CORS_ORIGIN.split(",").map((s) => s.trim());
const allowLocalhost = env.NODE_ENV !== "production"; // localhost autorise seulement hors prod
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin) || (allowLocalhost && /^http:\/\/localhost:\d+$/.test(origin))) cb(null, true);
    else cb(null, false);
  },
  credentials: true,
}));
app.use(express.json({ limit: "8mb" })); // photos d'observation stockées en data URL
app.use(pinoHttp({ logger }));

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, db: "up" });
  } catch (e) {
    res.status(503).json({ ok: false, db: "down" });
  }
});

// Backstop global anti-flood (genereux) sur toute l'API. /health reste non limite (monitoring).
app.use("/api", apiLimiter);

app.use("/api/auth", authRouter);
app.use("/api/cfc", cfcRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/operations", operationsRouter);
app.use("/api/diagnostics", diagnosticsRouter);
app.use("/api/plans", plansRouter);
app.use("/api/boards", boardsRouter);
app.use("/api/events", eventsRouter);
app.use("/api/assistant", assistantRouter);
app.use("/api/geo", geoRouter);
app.use("/api/market", marketRouter); // public : indice des prix de la construction (coefficient marché)
app.use("/api/export", exportRouter); // export structuré (JSON/CSV/XLSX) partagé avec la future API
app.use("/api/api-keys", apiKeysRouter); // gestion des clés d'API (auth JWT)
app.use("/api/org", orgRouter); // organisations & membres (gestion d'équipe)
app.use("/api/support", supportRouter); // centre d'aide : tickets de support
app.use("/api/v1", v1Router); // API REST publique v1 (auth par clé d'API)
app.use("/api/webhooks", webhooksRouter); // gestion des endpoints webhook (auth JWT)
app.use("/api/mcp", mcpRouter); // serveur MCP (Streamable HTTP, auth par clé d'API)
app.use("/api/share", shareRouter); // public (lecture seule, sans auth)
app.use("/api/push", pushRouter);

// Fichiers de plans uploadés (noms en UUID). nosniff + CSP stricte : meme si un fichier
// contenait du HTML/JS, le navigateur ne l'executera pas (defense contre le XSS stocke).
app.use("/uploads", express.static(UPLOAD_DIR, {
  setHeaders: (res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'; img-src 'self'; object-src 'none'");
  },
}));

// --- Frontends statiques (prod) : le même service Node sert le site + l'API ---
// STATIC_DIR = dossier du build web (dist). L'app mobile, si présente, est sous /mobile.
// NB : le site web utilise déjà des routes /app/* (dashboard) ; l'app mobile a donc
// son propre préfixe /mobile pour éviter toute collision au rechargement de page.
const STATIC_DIR = process.env.STATIC_DIR ? resolve(process.env.STATIC_DIR) : undefined;
if (STATIC_DIR && existsSync(STATIC_DIR)) {
  const mobileDir = join(STATIC_DIR, "mobile");
  if (existsSync(join(mobileDir, "index.html"))) {
    app.use("/mobile", express.static(mobileDir));
    app.get("/mobile/*", (_req, res) => res.sendFile(join(mobileDir, "index.html")));
  }
  app.use(express.static(STATIC_DIR));
  // Fallback SPA : toute route non-API/-uploads renvoie l'index du site web.
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/") || req.path.startsWith("/uploads/") || req.path === "/health") return next();
    res.sendFile(join(STATIC_DIR, "index.html"));
  });
  logger.info(`Serving static frontend from ${STATIC_DIR}`);
}

app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(env.PORT, () => {
  logger.info(`Diagly API listening on http://localhost:${env.PORT}`);
  startReminderScheduler();
  startWebhookWorker();
});

const shutdown = async (signal: string) => {
  logger.info({ signal }, "shutting down");
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
