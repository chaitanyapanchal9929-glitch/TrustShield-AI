import cookieParser from "cookie-parser";
import express, { type ErrorRequestHandler, type Express } from "express";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.set("trust proxy", 1);
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
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
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const status =
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
      ? error.status
      : 500;
  req.log.error({ errorName: error instanceof Error ? error.name : "unknown" }, "Request failed");
  res.status(status >= 400 && status < 500 ? status : 500).json({
    error: status === 413 ? "Request body is too large." : "Unable to complete the request.",
  });
};

app.use(errorHandler);

export default app;
