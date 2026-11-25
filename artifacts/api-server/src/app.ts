import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

function safeRequestUrl(url?: string): string | undefined {
  const path = url?.split("?")[0];
  if (!path) return path;
  return path
    .replace(/^\/api\/card\/[^/]+/, "/api/card/[redacted]")
    .replace(/^\/api\/admin\/token\/[^/]+/, "/api/admin/token/[redacted]");
}

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: safeRequestUrl(req.url),
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
