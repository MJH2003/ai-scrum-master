import { Logger } from '@nestjs/common';

export interface CircuitBreakerOptions {
  name: string;
  failureThreshold: number;
  successThreshold: number;
  timeout: number; // Time window for failures in ms
  resetTimeout: number; // Time before trying again after opening in ms
}

export enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN', // Blocking all requests
  HALF_OPEN = 'HALF_OPEN', // Testing if service is back
}

/**
 * Circuit Breaker Pattern Implementation
 * Protects against cascading failures in external services (e.g., AI providers)
 */
export class CircuitBreaker {
  private readonly logger = new Logger(CircuitBreaker.name);
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private nextRetryTime = 0;

  constructor(private readonly options: CircuitBreakerOptions) {}

  get currentState(): CircuitState {
    return this.state;
  }

  get isOpen(): boolean {
    return this.state === CircuitState.OPEN;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() >= this.nextRetryTime) {
        this.transitionTo(CircuitState.HALF_OPEN);
      } else {
        throw new CircuitBreakerOpenError(
          `Circuit breaker "${this.options.name}" is open. Retry after ${new Date(this.nextRetryTime).toISOString()}`,
        );
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.options.successThreshold) {
        this.transitionTo(CircuitState.CLOSED);
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.successCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionTo(CircuitState.OPEN);
    } else if (
      this.state === CircuitState.CLOSED &&
      this.failureCount >= this.options.failureThreshold
    ) {
      this.transitionTo(CircuitState.OPEN);
    }
  }

  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;

    if (newState === CircuitState.OPEN) {
      this.nextRetryTime = Date.now() + this.options.resetTimeout;
      this.logger.warn(
        `Circuit breaker "${this.options.name}" OPENED. Will retry at ${new Date(this.nextRetryTime).toISOString()}`,
      );
    } else if (newState === CircuitState.HALF_OPEN) {
      this.successCount = 0;
      this.logger.log(
        `Circuit breaker "${this.options.name}" is HALF-OPEN. Testing connection...`,
      );
    } else if (newState === CircuitState.CLOSED) {
      this.failureCount = 0;
      this.successCount = 0;
      this.logger.log(
        `Circuit breaker "${this.options.name}" CLOSED. Service recovered.`,
      );
    }
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.failureCount = 0;
    this.successCount = 0;
    this.transitionTo(CircuitState.CLOSED);
  }

  /**
   * Get circuit breaker stats
   */
  getStats(): {
    name: string;
    state: CircuitState;
    failureCount: number;
    successCount: number;
    lastFailureTime: Date | null;
    nextRetryTime: Date | null;
  } {
    return {
      name: this.options.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime
        ? new Date(this.lastFailureTime)
        : null,
      nextRetryTime: this.nextRetryTime ? new Date(this.nextRetryTime) : null,
    };
  }
}

export class CircuitBreakerOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}

/**
 * Factory for creating circuit breakers with common configurations
 */
export class CircuitBreakerFactory {
  private static readonly breakers = new Map<string, CircuitBreaker>();

  static getOrCreate(name: string, options?: Partial<CircuitBreakerOptions>): CircuitBreaker {
    if (!this.breakers.has(name)) {
      const fullOptions: CircuitBreakerOptions = {
        name,
        failureThreshold: options?.failureThreshold ?? 5,
        successThreshold: options?.successThreshold ?? 2,
        timeout: options?.timeout ?? 30000, // 30 seconds
        resetTimeout: options?.resetTimeout ?? 60000, // 1 minute
      };
      this.breakers.set(name, new CircuitBreaker(fullOptions));
    }
    return this.breakers.get(name)!;
  }

  static getAllStats(): Array<ReturnType<CircuitBreaker['getStats']>> {
    return Array.from(this.breakers.values()).map((breaker) =>
      breaker.getStats(),
    );
  }

  static reset(name: string): void {
    const breaker = this.breakers.get(name);
    if (breaker) {
      breaker.reset();
    }
  }

  static resetAll(): void {
    this.breakers.forEach((breaker) => breaker.reset());
  }
}
