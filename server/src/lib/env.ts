import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 chars"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 chars"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("7d"),
  // Poivre pour hasher les clés d'API. Si absent, on retombe sur JWT_ACCESS_SECRET (toujours présent).
  API_KEY_PEPPER: z.string().min(16).optional(),
  // SMTP pour les emails (invitations d'équipe). Si absent : dégradation gracieuse (lien copiable).
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default("Diagly <noreply@diagly.ch>"),
  // Adresse qui reçoit les demandes de support.
  SUPPORT_EMAIL: z.string().default("contact@finalyn.com"),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  // URL publique de l'app (pour construire les redirect_uri OAuth). En dev : localhost.
  APP_URL: z.string().default("http://localhost:4000"),
  // Google OAuth (optionnel : si absent, la connexion Google est simplement desactivee).
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  // Assistant IA (optionnel : si la cle est absente, l'assistant renvoie un message d'indisponibilite).
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-haiku-4-5-20251001"),
  // Notifications push (optionnel : si les cles VAPID sont absentes, le push est desactive).
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default("mailto:contact@diagly.ch"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
