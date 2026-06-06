import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { syncPatchesIfNeeded } from "../services/patch.service.js";
import { getGlobalStats } from "../services/global-stats.service.js";

const globalQuery = z.object({
  patchId: z.string().optional(),
  rank: z.coerce.number().int().positive().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  region: z.string().optional(),
});

export const globalRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/global-stats", async (request, reply) => {
    const parsed = globalQuery.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "Invalid query",
        details: parsed.error.issues,
      });
    }

    const payload = await getGlobalStats(parsed.data);
    return reply.send(payload);
  });

  app.get("/api/patches", async () => {
    const patches = await syncPatchesIfNeeded();
    return patches.map((patch) => ({
      patchId: patch.patchId,
      title: patch.patchId,
      releasedAt: patch.releasedAt.toISOString(),
      endedAt: patch.endedAt?.toISOString() ?? null,
    }));
  });
};
