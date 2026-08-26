import { Router } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { requireApiKey } from "../middlewares/api-key-auth.js";
import { apiKeyLimiter } from "../middlewares/rate-limit.js";
import { buildMcpServer } from "../mcp/tools.js";
import { logger } from "../lib/logger.js";

// Serveur MCP (Streamable HTTP, sans état). Auth par clé d'API → périmètre strict au parc du
// propriétaire. Le client branche son assistant sur POST /api/mcp avec `Authorization: Bearer dgly_live_…`.
const router = Router();
router.use(requireApiKey);
router.use(apiKeyLimiter);

router.post("/", async (req, res) => {
  const server = buildMcpServer(req.auth!.sub);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => { transport.close(); server.close(); });
  try {
    await server.connect(transport);
    // Cast : req.auth (AccessTokenPayload) diffère du AuthInfo attendu par le SDK — non utilisé ici.
    await transport.handleRequest(req as never, res, req.body);
  } catch (err) {
    logger.error({ err }, "mcp request failed");
    if (!res.headersSent) res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal error" }, id: null });
  }
});

router.get("/", (_req, res) => res.status(405).json({ error: "MCP: utilisez POST (JSON-RPC 2.0)." }));

export default router;
