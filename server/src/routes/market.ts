import { Router } from "express";
import { marketInfo } from "../lib/market.js";

// Indice des prix de la construction appliqué aux coûts. Public : le rapport
// partagé au client doit pouvoir afficher la base de prix sans connexion.
const router = Router();

router.get("/index", (_req, res) => res.json(marketInfo()));

export default router;
