import type { FastifyInstance } from "fastify";
import cron from "node-cron";
import { prisma } from "../lib/prisma.js";
import { ingestFromAccount } from "./ingest.service.js";

const DAILY_REFRESH_CRON = "0 4 * * *";

export function registerRefreshScheduler(app: FastifyInstance) {
  const task = cron.schedule(
    DAILY_REFRESH_CRON,
    async () => {
      app.log.info("Starting daily player refresh job.");
      const players = await prisma.player.findMany({
        select: { accountId: true },
      });

      for (const player of players) {
        try {
          await ingestFromAccount(player.accountId);
          app.log.info(
            { accountId: player.accountId },
            "Daily refresh complete",
          );
        } catch (error) {
          app.log.error(
            { err: error, accountId: player.accountId },
            "Daily refresh failed",
          );
        }
      }
    },
    {
      timezone: "UTC",
    },
  );

  app.addHook("onClose", async () => {
    task.stop();
  });
}
