import type { FastifyPluginAsync } from "fastify";
import { ingestFromAccount } from "../services/ingest.service.js";
import { getPlayerStats } from "../services/stats.service.js";
import { toInt } from "../utils/number.js";

export const refreshRoutes: FastifyPluginAsync = async (app) => {
  app.post("/api/players/:accountId/refresh", async (request, reply) => {
    const accountId = toInt(
      (request.params as { accountId?: string }).accountId,
    );
    if (!accountId) {
      return reply.code(400).send({ error: "Invalid accountId" });
    }

    const summary = await ingestFromAccount(accountId);
    const stats = await getPlayerStats(accountId, {});

    return reply.send({
      refreshMode: "manual",
      ...summary,
      lastRefreshedAt: stats.player.lastRefreshedAt,
    });
  });
};
