import pino from "pino";
import { env } from "./env.js";

// Redaction : ne jamais logguer les secrets d'auth (JWT, clés d'API) présents dans les en-têtes.
const redact = { paths: ["req.headers.authorization", 'req.headers["x-api-key"]'], remove: true };

export const logger = pino(
  env.NODE_ENV === "development"
    ? { redact, transport: { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } } }
    : { level: "info", redact }
);
