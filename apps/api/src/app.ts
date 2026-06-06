import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { globalRoutes } from "./routes/global.routes.js";
import { ingestRoutes } from "./routes/ingest.routes.js";
import { refreshRoutes } from "./routes/refresh.routes.js";
import { statsRoutes } from "./routes/stats.routes.js";
import { registerRefreshScheduler } from "./services/refresh.service.js";

function corsOrigins(): string | string[] {
  const raw = process.env.ORIGIN?.trim();
  if (!raw) return "http://localhost:5173";

  const origins = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return origins.length === 1 ? origins[0]! : origins;
}

export function buildApp() {
  const app = Fastify({
    logger: {
      transport:
        process.env.NODE_ENV === "development"
          ? { target: "pino-pretty" }
          : undefined,
    },
  });

  app.register(cors, {
    origin: corsOrigins(),
  });

  app.register(multipart, {
    limits: {
      fileSize: 20 * 1024 * 1024,
      files: 100,
    },
  });

  app.get("/health", async () => ({ status: "ok" }));
  app.register(ingestRoutes);
  app.register(statsRoutes);
  app.register(refreshRoutes);
  app.register(globalRoutes);
  registerRefreshScheduler(app);

  return app;
}
