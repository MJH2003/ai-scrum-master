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

interface AuditUser {
  userId: string;
  email?: string;
}

/**
 * Audit Log Interceptor
 * Logs sensitive operations for security and compliance
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger('AuditLog');

  // Operations that should be audited
  private readonly auditableOperations = new Set([
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
  ]);

  // Sensitive paths that always get logged regardless of method
  private readonly sensitivePaths = [
    '/auth/login',
    '/auth/register',
    '/auth/logout',
    '/auth/refresh',
    '/auth/reset-password',
    '/users/me',
    '/projects/:projectId/members',
  ];

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url, ip, headers } = request;
    const user = request.user as AuditUser | undefined;
    const correlationId = headers['x-correlation-id'] as string;

    const shouldAudit =
      this.auditableOperations.has(method) ||
      this.isSensitivePath(url);

    if (!shouldAudit) {
      return next.handle();
    }

    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: (response) => {
          const duration = Date.now() - startTime;
          this.logAuditEvent({
            type: 'SUCCESS',
            method,
            url,
            userId: user?.userId || 'anonymous',
            ip: ip || 'unknown',
            correlationId,
            duration,
            statusCode: 200,
          });
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          this.logAuditEvent({
            type: 'FAILURE',
            method,
            url,
            userId: user?.userId || 'anonymous',
            ip: ip || 'unknown',
            correlationId,
            duration,
            statusCode: error.status || 500,
            error: error.message,
          });
        },
      }),
    );
  }

  private isSensitivePath(url: string): boolean {
    const urlPath = url.split('?')[0]; // Remove query params
    return this.sensitivePaths.some((pattern) => {
      const regex = new RegExp(
        '^' + pattern.replace(/:[^/]+/g, '[^/]+') + '(/.*)?$',
      );
      return regex.test(urlPath);
    });
  }

  private logAuditEvent(event: {
    type: 'SUCCESS' | 'FAILURE';
    method: string;
    url: string;
    userId: string;
    ip: string;
    correlationId?: string;
    duration: number;
    statusCode: number;
    error?: string;
  }): void {
    const logData = {
      audit: true,
      ...event,
      timestamp: new Date().toISOString(),
    };

    if (event.type === 'SUCCESS') {
      this.logger.log(JSON.stringify(logData));
    } else {
      this.logger.warn(JSON.stringify(logData));
    }
  }
}
