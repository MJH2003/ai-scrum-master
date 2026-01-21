import { Injectable, LoggerService as NestLoggerService, Scope } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'verbose';

interface LogContext {
  correlationId?: string;
  userId?: string;
  projectId?: string;
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  correlationId?: string;
  userId?: string;
  projectId?: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  metadata?: Record<string, unknown>;
}

@Injectable({ scope: Scope.TRANSIENT })
export class LoggerService implements NestLoggerService {
  private context?: string;
  private logContext: LogContext = {};
  private logLevel: LogLevel = 'debug';

  private readonly logLevels: Record<LogLevel, number> = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
    verbose: 4,
  };

  constructor(private readonly configService?: ConfigService) {
    if (configService) {
      this.logLevel = (configService.get<string>('LOG_LEVEL') as LogLevel) || 'debug';
    }
  }

  setContext(context: string): this {
    this.context = context;
    return this;
  }

  setLogContext(context: LogContext): this {
    this.logContext = { ...this.logContext, ...context };
    return this;
  }

  private shouldLog(level: LogLevel): boolean {
    return this.logLevels[level] <= this.logLevels[this.logLevel];
  }

  private formatLog(
    level: LogLevel,
    message: string,
    context?: string,
    metadata?: Record<string, unknown>,
    error?: Error,
  ): string {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: context || this.context,
      correlationId: this.logContext.correlationId,
      userId: this.logContext.userId,
      projectId: this.logContext.projectId,
      metadata,
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    // Remove undefined values
    Object.keys(entry).forEach((key) => {
      if (entry[key as keyof LogEntry] === undefined) {
        delete entry[key as keyof LogEntry];
      }
    });

    return JSON.stringify(entry);
  }

  log(message: string, context?: string): void;
  log(message: string, metadata?: Record<string, unknown>, context?: string): void;
  log(
    message: string,
    contextOrMetadata?: string | Record<string, unknown>,
    context?: string,
  ): void {
    if (!this.shouldLog('info')) return;

    const [meta, ctx] = this.parseArgs(contextOrMetadata, context);
    console.log(this.formatLog('info', message, ctx, meta));
  }

  error(message: string, trace?: string, context?: string): void;
  error(message: string, error?: Error, context?: string): void;
  error(
    message: string,
    traceOrError?: string | Error,
    context?: string,
  ): void {
    if (!this.shouldLog('error')) return;

    let error: Error | undefined;
    let ctx = context;

    if (traceOrError instanceof Error) {
      error = traceOrError;
    } else if (typeof traceOrError === 'string') {
      error = new Error(traceOrError);
    }

    console.error(this.formatLog('error', message, ctx, undefined, error));
  }

  warn(message: string, context?: string): void;
  warn(message: string, metadata?: Record<string, unknown>, context?: string): void;
  warn(
    message: string,
    contextOrMetadata?: string | Record<string, unknown>,
    context?: string,
  ): void {
    if (!this.shouldLog('warn')) return;

    const [meta, ctx] = this.parseArgs(contextOrMetadata, context);
    console.warn(this.formatLog('warn', message, ctx, meta));
  }

  debug(message: string, context?: string): void;
  debug(message: string, metadata?: Record<string, unknown>, context?: string): void;
  debug(
    message: string,
    contextOrMetadata?: string | Record<string, unknown>,
    context?: string,
  ): void {
    if (!this.shouldLog('debug')) return;

    const [meta, ctx] = this.parseArgs(contextOrMetadata, context);
    console.debug(this.formatLog('debug', message, ctx, meta));
  }

  verbose(message: string, context?: string): void;
  verbose(message: string, metadata?: Record<string, unknown>, context?: string): void;
  verbose(
    message: string,
    contextOrMetadata?: string | Record<string, unknown>,
    context?: string,
  ): void {
    if (!this.shouldLog('verbose')) return;

    const [meta, ctx] = this.parseArgs(contextOrMetadata, context);
    console.log(this.formatLog('verbose', message, ctx, meta));
  }

  private parseArgs(
    contextOrMetadata?: string | Record<string, unknown>,
    context?: string,
  ): [Record<string, unknown> | undefined, string | undefined] {
    if (typeof contextOrMetadata === 'string') {
      return [undefined, contextOrMetadata];
    }
    return [contextOrMetadata, context];
  }
}
