/**
 * Structured request logger.
 *
 * Outputs JSON lines in production (easy to pipe into Datadog / Logtail / etc.)
 * and a readable format in development.
 *
 * Swap the transport by replacing `write()` — everything else stays the same.
 */

type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

function write(entry: LogEntry) {
  const { level, ...rest } = entry;
  if (process.env.NODE_ENV === "production") {
    // JSON lines — structured logging for log aggregators
    process.stdout.write(JSON.stringify({ level, ...rest }) + "\n");
  } else {
    const prefix = level === "error" ? "✖" : level === "warn" ? "⚠" : "→";
    console.log(`${prefix} [${rest.timestamp}] ${rest.message}`, rest);
  }
}

function log(level: LogLevel, message: string, context: Record<string, unknown> = {}) {
  write({ level, message, timestamp: new Date().toISOString(), ...context });
}

export const logger = {
  info:  (message: string, ctx?: Record<string, unknown>) => log("info",  message, ctx),
  warn:  (message: string, ctx?: Record<string, unknown>) => log("warn",  message, ctx),
  error: (message: string, ctx?: Record<string, unknown>) => log("error", message, ctx),

  /** Log an incoming API request. Call at the top of every route handler. */
  request(req: Request, context: Record<string, unknown> = {}) {
    const url = new URL(req.url);
    log("info", `${req.method} ${url.pathname}`, {
      path: url.pathname,
      method: req.method,
      ...context,
    });
  },

  /** Log the outgoing response. */
  response(
    req: Request,
    statusCode: number,
    durationMs: number,
    context: Record<string, unknown> = {}
  ) {
    const url = new URL(req.url);
    const level: LogLevel = statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";
    log(level, `${req.method} ${url.pathname} → ${statusCode} (${durationMs}ms)`, {
      path: url.pathname,
      method: req.method,
      status: statusCode,
      duration_ms: durationMs,
      ...context,
    });
  },
};
