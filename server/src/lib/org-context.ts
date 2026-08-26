import { prisma } from "./prisma.js";

// Contexte d'organisation d'un utilisateur — résout l'appartenance à la volée (toujours frais,
// pas de staleness côté JWT). Sert au partage du parc entre membres.
export interface OrgContext {
  userId: string;
  organizationId: string | null;
  orgRole: string | null;
}

export async function getOrgContext(userId: string): Promise<OrgContext> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { organizationId: true, orgRole: true } });
  return { userId, organizationId: u?.organizationId ?? null, orgRole: u?.orgRole ?? null };
}

/**
 * Fragment de filtre Prisma pour « les ressources accessibles » : tout le parc de l'organisation
 * si l'utilisateur en fait partie (via owner.organizationId), sinon uniquement ses propres ressources.
 * Applicable à Project ET Operation (les deux ont `ownerId` + relation `owner`), et en filtre niché
 * (ex. `project: ownerScope(ctx)`).
 */
export function ownerScope(ctx: OrgContext): { ownerId: string } | { owner: { organizationId: string } } {
  return ctx.organizationId ? { owner: { organizationId: ctx.organizationId } } : { ownerId: ctx.userId };
}

/** Raccourci : résout le contexte puis renvoie le scope. */
export async function ownerScopeFor(userId: string) {
  return ownerScope(await getOrgContext(userId));
}
