import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { ingestManualInput } from "../services/ingest.service.js";
import { parseMatchRefsFromHttpcacheBuffer } from "../utils/httpcache-parser.js";
import { toInt } from "../utils/number.js";

const manualSchema = z.object({
  accountId: z.number().int().positive().optional(),
  steamId: z.string().min(2).optional(),
  matchId: z.union([z.number().int().positive(), z.string().min(1)]).optional(),
  matchIds: z
    .array(z.union([z.number().int().positive(), z.string().min(1)]))
    .optional(),
});

export const ingestRoutes: FastifyPluginAsync = async (app) => {
  app.post("/api/ingest/manual", async (request, reply) => {
    const parsed = manualSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "Invalid request body",
        details: parsed.error.issues,
      });
    }

    const body = parsed.data;
    const matchIds = [
      ...(body.matchId ? [body.matchId] : []),
      ...(body.matchIds ?? []),
    ]
      .map((value) => toInt(value))
      .filter((value): value is number => value !== null);

    const summary = await ingestManualInput({
      accountId: body.accountId,
      steamId: body.steamId,
      matchIds,
    });

    return reply.send({
      source: body.accountId ? "account" : "manual",
      ...summary,
    });
  });

  app.post("/api/ingest/httpcache", async (request, reply) => {
    const files = request.files();
    const refs: number[] = [];

    for await (const file of files) {
      const chunks: Buffer[] = [];
      for await (const chunk of file.file) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      const parsedRefs = parseMatchRefsFromHttpcacheBuffer(
        Buffer.concat(chunks),
      );
      parsedRefs.forEach((entry) => refs.push(entry.matchId));
    }

    const uniqueMatchIds = [...new Set(refs)];
    if (uniqueMatchIds.length === 0) {
      return reply.code(400).send({
        error: "No match IDs were found in uploaded files.",
      });
    }

    const summary = await ingestManualInput({
      matchIds: uniqueMatchIds,
    });

    return reply.send({
      source: "httpcache",
      parsedMatchIds: uniqueMatchIds.length,
      ...summary,
    });
  });
};
