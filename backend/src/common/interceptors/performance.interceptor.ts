import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

/**
 * Performance Logging Interceptor
 * Tracks request duration and logs slow requests
 */
@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Performance');
  private readonly slowThresholdMs: number;

  constructor(slowThresholdMs = 1000) {
    this.slowThresholdMs = slowThresholdMs;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url } = request;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          if (duration > this.slowThresholdMs) {
            this.logger.warn(
              `Slow request: ${method} ${url} took ${duration}ms`,
            );
          }
        },
        error: () => {
          const duration = Date.now() - startTime;
          if (duration > this.slowThresholdMs) {
            this.logger.warn(
              `Slow failed request: ${method} ${url} took ${duration}ms`,
            );
          }
        },
      }),
    );
  }
}
