import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "./env.js";

/**
 * Marqueur de type. Tous les jetons courts de l'app (ticket 2FA, état OAuth, lien de
 * réinitialisation) sont signés avec JWT_ACCESS_SECRET : sans ce marqueur, n'importe
 * lequel d'entre eux est accepté comme jeton d'accès.
 * - le ticket 2FA est remis APRÈS le mot de passe mais AVANT le code : il ouvrait donc
 *   le compte sans le second facteur ;
 * - l'état OAuth n'a pas de `sub` : les requêtes devenaient `where: { userId: undefined }`,
 *   c'est-à-dire SANS filtre côté Prisma, donc les données de tous les comptes.
 */
const ACCESS_TYP = "access";

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: string;
  typ?: string;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign({ ...payload, typ: ACCESS_TYP }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL,
  } as SignOptions);
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_TTL,
  } as SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
  // Seul un vrai jeton d'accès ouvre l'API, et il doit désigner un compte : un `sub`
  // vide se traduirait par une requête sans filtre de propriétaire.
  if (payload.typ !== ACCESS_TYP) throw new Error("wrong token type");
  if (typeof payload.sub !== "string" || payload.sub.length === 0) throw new Error("missing subject");
  return payload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
}
