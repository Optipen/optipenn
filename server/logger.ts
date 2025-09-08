import { format } from "date-fns";

export interface LogContext {
  requestId?: string;
  userId?: string;
  method?: string;
  path?: string;
  duration?: number;
  status?: number;
  [key: string]: any;
}

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface StructuredLog {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  stack?: string;
}

export class Logger {
  private static instance: Logger;

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private formatLog(level: LogLevel, message: string, context?: LogContext, error?: Error): string {
    const log: StructuredLog = {
      timestamp: new Date().toISOString(),
      level,
      message,
    };

    if (context) {
      log.context = context;
    }

    if (error?.stack) {
      log.stack = error.stack;
    }

    return JSON.stringify(log);
  }

  debug(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV === "development") {
      console.log(this.formatLog("debug", message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    console.log(this.formatLog("info", message, context));
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.formatLog("warn", message, context));
  }

  error(message: string, context?: LogContext, error?: Error): void {
    console.error(this.formatLog("error", message, context, error));
  }

  // Performance logging helper
  logPerformance(operation: string, duration: number, context?: LogContext): void {
    this.info(`Performance: ${operation}`, {
      ...context,
      duration,
      operation,
    });
  }

  // Request logging helper
  logRequest(method: string, path: string, status: number, duration: number, context?: LogContext): void {
    const level: LogLevel = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
    this.formatLog(level, `${method} ${path} ${status}`, {
      ...context,
      method,
      path,
      status,
      duration,
    });
  }
}

export const logger = Logger.getInstance();