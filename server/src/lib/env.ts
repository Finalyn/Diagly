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
  /** Comptes Finalyn qui gèrent l'annuaire des partenaires (en plus du rôle ADMIN), séparés par des virgules. */
  FINALYN_ADMINS: z.string().default("contact@finalyn.com"),
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
  // App iPhone/iPad (lib/apple.ts). Une seule clé .p8 sert aux notifications
  // (APNs) et à « Se connecter avec Apple » ; APPLE_PRIVATE_KEY est son contenu
  // en base64, pour tenir sur une ligne. Sans elle : pas de notifications sur
  // l'iPhone ni de révocation Apple, la connexion Apple marche quand même.
  APPLE_BUNDLE_ID: z.string().default("ch.diagly.app"),
  APPLE_TEAM_ID: z.string().optional(),
  APPLE_KEY_ID: z.string().optional(),
  APPLE_PRIVATE_KEY: z.string().optional(),
  // « Se connecter avec Apple » sur le site (lib/apple-web.ts) : l'identifiant
  // de service (Services ID) déclaré chez Apple, par ex. ch.diagly.web, rattaché
  // à l'App ID de l'app. Optionnel : sans lui (ou sans APP_URL en https), le
  // bouton Apple n'apparaît pas sur le site. L'app iPhone/iPad n'en dépend pas.
  APPLE_SERVICES_ID: z.string().optional(),
  // Bac à sable d'APNs : seulement pour une app compilée en développement.
  // TestFlight et l'App Store utilisent l'APNs de production.
  APNS_SANDBOX: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
});

/**
 * Une variable laissee vide dans .env vaut « absente », pas « chaine vide ».
 *
 * Le fichier .env.example livre toutes les options a vide, ce qui est la bonne
 * facon de documenter ce qui existe. Sans ce nettoyage, zod voit "" la ou le
 * schema attend undefined : API_KEY_PEPPER= faisait echouer le min(16) et le
 * serveur refusait de demarrer sur une installation neuve, alors que le code
 * sait tres bien se passer du poivre (il retombe sur JWT_ACCESS_SECRET).
 */
const sansValeursVides = (source: NodeJS.ProcessEnv): NodeJS.ProcessEnv =>
  Object.fromEntries(Object.entries(source).filter(([, v]) => v !== ""));

const parsed = schema.safeParse(sansValeursVides(process.env));
if (!parsed.success) {
  console.error("Invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

/**
 * L'URL publique est-elle utilisable pour construire un lien qu'un tiers va suivre ?
 *
 * APP_URL vaut localhost par defaut. Oublier de la renseigner en production ne
 * provoque aucune erreur au demarrage, mais casse silencieusement trois choses a la
 * fois : Google renvoie l'utilisateur sur localhost apres l'ecran de consentement,
 * le lien de reinitialisation du mot de passe pointe dans le vide, et l'invitation
 * d'equipe aussi. On prefere le dire fort et refuser d'envoyer qui que ce soit vers
 * un aller sans retour.
 */
export const urlPubliqueValide = (): boolean =>
  env.NODE_ENV !== "production" || !/^https?:\/\/(localhost|127\.0\.0\.1)/i.test(env.APP_URL);

if (!urlPubliqueValide()) {
  console.error(
    `[config] APP_URL vaut « ${env.APP_URL} » en production. La connexion Google, le lien de ` +
    "reinitialisation du mot de passe et les invitations d'equipe ne peuvent pas fonctionner. " +
    "Renseigner APP_URL=https://votre-domaine dans le fichier .env, puis redemarrer.",
  );
}
