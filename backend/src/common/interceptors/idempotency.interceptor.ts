import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

/**
 * Simple in-memory store for idempotency keys
 * In production, use Redis for distributed environments
 */
interface IdempotencyRecord {
  response: unknown;
  statusCode: number;
  createdAt: number;
}

const idempotencyStore = new Map<string, IdempotencyRecord>();
const IDEMPOTENCY_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of idempotencyStore.entries()) {
    if (now - record.createdAt > IDEMPOTENCY_TTL) {
      idempotencyStore.delete(key);
    }
  }
}, 60 * 60 * 1000); // Clean up every hour

/**
 * Idempotency Interceptor
 * Ensures POST operations can be safely retried without side effects
 * 
 * Usage: Include `Idempotency-Key` header in POST requests
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    
    // Only apply to POST requests
    if (request.method !== 'POST') {
      return next.handle();
    }

    const idempotencyKey = request.headers['idempotency-key'] as string;
    if (!idempotencyKey) {
      // No idempotency key, proceed normally
      return next.handle();
    }

    // Create a unique key combining user ID and idempotency key
    const user = request.user as { userId?: string } | undefined;
    const uniqueKey = `${user?.userId || 'anonymous'}:${request.path}:${idempotencyKey}`;

    // Check if we've seen this request before
    const existingRecord = idempotencyStore.get(uniqueKey);
    if (existingRecord) {
      this.logger.debug(`Returning cached response for idempotency key: ${idempotencyKey}`);
      response.status(existingRecord.statusCode);
      return of(existingRecord.response);
    }

    // Check if request is in progress (prevent race conditions)
    const inProgressKey = `${uniqueKey}:in_progress`;
    if (idempotencyStore.has(inProgressKey)) {
      throw new ConflictException(
        'A request with this idempotency key is already in progress',
      );
    }

    // Mark as in progress
    idempotencyStore.set(inProgressKey, {
      response: null,
      statusCode: 0,
      createdAt: Date.now(),
    });

    return next.handle().pipe(
      tap({
        next: (responseBody) => {
          // Store the successful response
          idempotencyStore.set(uniqueKey, {
            response: responseBody,
            statusCode: response.statusCode,
            createdAt: Date.now(),
          });
          idempotencyStore.delete(inProgressKey);
          this.logger.debug(`Cached response for idempotency key: ${idempotencyKey}`);
        },
        error: () => {
          // Remove in-progress marker on error (allow retry)
          idempotencyStore.delete(inProgressKey);
        },
      }),
    );
  }
}
