type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  data?: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel: LogLevel =
  process.env.NODE_ENV === "production" ? "warn" : "debug";

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatEntry(entry: LogEntry): string {
  const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.context}]`;
  return `${prefix} ${entry.message}`;
}

function write(entry: LogEntry): void {
  if (!shouldLog(entry.level)) return;

  const formatted = formatEntry(entry);

  switch (entry.level) {
    case "error":
      console.error(formatted, entry.data ?? "");
      break;
    case "warn":
      console.warn(formatted, entry.data ?? "");
      break;
    case "debug":
      console.debug(formatted, entry.data ?? "");
      break;
    default:
      console.log(formatted, entry.data ?? "");
  }
}

export function createLogger(context: string) {
  return {
    debug(message: string, data?: unknown) {
      write({
        timestamp: new Date().toISOString(),
        level: "debug",
        context,
        message,
        data,
      });
    },
    info(message: string, data?: unknown) {
      write({
        timestamp: new Date().toISOString(),
        level: "info",
        context,
        message,
        data,
      });
    },
    warn(message: string, data?: unknown) {
      write({
        timestamp: new Date().toISOString(),
        level: "warn",
        context,
        message,
        data,
      });
    },
    error(message: string, data?: unknown) {
      write({
        timestamp: new Date().toISOString(),
        level: "error",
        context,
        message,
        data,
      });
    },
    child(subContext: string) {
      return createLogger(`${context}:${subContext}`);
    },
  };
}

export type Logger = ReturnType<typeof createLogger>;
