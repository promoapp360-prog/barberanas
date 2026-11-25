import app from "./app";
import { logger } from "./lib/logger";
import {
  ensureDefaultPromo,
  ensureDefaultReminderSettings,
} from "./lib/loyalty-store";
import {
  isOneSignalReady,
  verifyOneSignalConnection,
} from "./lib/one-signal-reminders";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

Promise.all([ensureDefaultPromo(), ensureDefaultReminderSettings()])
  .then(() => {
    if (isOneSignalReady()) {
      void verifyOneSignalConnection().then((ready) => {
        logger.info({ ready }, "OneSignal app connection check completed");
      });
    }
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }

      logger.info({ port }, "Server listening");
    });
  })
  .catch((err: unknown) => {
    logger.error({ err }, "Unable to initialize loyalty data");
    process.exit(1);
  });
