import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { LoggerService } from '../logger/logger.service';

declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
      startTime?: number;
    }
  }
}

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  constructor(private readonly logger: LoggerService) {
    this.logger.setContext('HTTP');
  }

  use(req: Request, res: Response, next: NextFunction): void {
    const correlationId =
      (req.headers['x-correlation-id'] as string) || uuidv4();

    req.correlationId = correlationId;
    req.startTime = Date.now();

    res.setHeader('x-correlation-id', correlationId);

    this.logger.setLogContext({ correlationId });
    this.logger.debug(`→ ${req.method} ${req.originalUrl}`, {
      method: req.method,
      url: req.originalUrl,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });

    res.on('finish', () => {
      const duration = Date.now() - (req.startTime || Date.now());
      const logMethod = res.statusCode >= 400 ? 'warn' : 'debug';

      this.logger[logMethod](`← ${req.method} ${req.originalUrl} ${res.statusCode}`, {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
      });
    });

    next();
  }
}
