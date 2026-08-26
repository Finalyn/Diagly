import type { Request, Response, NextFunction } from "express";
import type { ZodSchema } from "zod";

/** Valide req.body contre un schéma Zod et remplace req.body par la version typée. */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return next(parsed.error);
    req.body = parsed.data;
    next();
  };
}

/** Valide req.query contre un schéma Zod. */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) return next(parsed.error);
    // @ts-expect-error — Express typings consider req.query readonly-ish; on assigne quand même.
    req.query = parsed.data;
    next();
  };
}
