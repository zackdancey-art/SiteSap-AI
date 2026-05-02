import morgan from "morgan";

morgan.token("reqid", (req) => req.headers["x-request-id"] as string || "-");

export const httpLogger = morgan(":method :url :status :res[content-length] - :response-time ms reqid=:reqid");
