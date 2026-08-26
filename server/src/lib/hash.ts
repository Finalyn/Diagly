import bcrypt from "bcrypt";
import { createHash, randomBytes } from "node:crypto";
import { env } from "./env.js";

export const hashPassword = (plain: string) => bcrypt.hash(plain, env.BCRYPT_ROUNDS);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

/** Génère un opaque token aléatoire (pour usage avant JWT signing). */
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("hex");

/** SHA-256 d'un string. Utilisé pour stocker un refresh token sans le mettre en clair en DB. */
export const sha256 = (input: string) => createHash("sha256").update(input).digest("hex");
