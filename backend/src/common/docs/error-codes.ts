/**
 * Error Codes Documentation for AI Scrum Master API
 *
 * All error responses follow this format:
 * {
 *   "statusCode": number,
 *   "error": {
 *     "code": string,
 *     "message": string,
 *     "details"?: any,
 *     "correlationId"?: string
 *   },
 *   "timestamp": string,
 *   "path": string
 * }
 */

export const ErrorCodes = {
  // Authentication Errors (AUTH_xxx)
  AUTH_INVALID_CREDENTIALS: {
    code: 'AUTH_INVALID_CREDENTIALS',
    status: 401,
    message: 'Invalid email or password',
  },
  AUTH_TOKEN_EXPIRED: {
    code: 'AUTH_TOKEN_EXPIRED',
    status: 401,
    message: 'JWT token has expired',
  },
  AUTH_TOKEN_INVALID: {
    code: 'AUTH_TOKEN_INVALID',
    status: 401,
    message: 'JWT token is invalid or malformed',
  },
  AUTH_REFRESH_TOKEN_INVALID: {
    code: 'AUTH_REFRESH_TOKEN_INVALID',
    status: 401,
    message: 'Refresh token is invalid or expired',
  },
  AUTH_EMAIL_NOT_VERIFIED: {
    code: 'AUTH_EMAIL_NOT_VERIFIED',
    status: 403,
    message: 'Email address has not been verified',
  },
  AUTH_ACCOUNT_LOCKED: {
    code: 'AUTH_ACCOUNT_LOCKED',
    status: 403,
    message: 'Account has been locked due to too many failed attempts',
  },

  // Authorization Errors (AUTHZ_xxx)
  AUTHZ_INSUFFICIENT_PERMISSIONS: {
    code: 'AUTHZ_INSUFFICIENT_PERMISSIONS',
    status: 403,
    message: 'You do not have permission to perform this action',
  },
  AUTHZ_PROJECT_ACCESS_DENIED: {
    code: 'AUTHZ_PROJECT_ACCESS_DENIED',
    status: 403,
    message: 'You do not have access to this project',
  },
  AUTHZ_ROLE_REQUIRED: {
    code: 'AUTHZ_ROLE_REQUIRED',
    status: 403,
    message: 'A specific role is required for this action',
  },

  // Resource Errors (RESOURCE_xxx)
  RESOURCE_NOT_FOUND: {
    code: 'RESOURCE_NOT_FOUND',
    status: 404,
    message: 'The requested resource was not found',
  },
  RESOURCE_ALREADY_EXISTS: {
    code: 'RESOURCE_ALREADY_EXISTS',
    status: 409,
    message: 'A resource with this identifier already exists',
  },
  RESOURCE_CONFLICT: {
    code: 'RESOURCE_CONFLICT',
    status: 409,
    message: 'The resource has been modified by another request',
  },

  // Validation Errors (VALIDATION_xxx)
  VALIDATION_FAILED: {
    code: 'VALIDATION_FAILED',
    status: 400,
    message: 'Request validation failed',
  },
  VALIDATION_EMAIL_INVALID: {
    code: 'VALIDATION_EMAIL_INVALID',
    status: 400,
    message: 'Invalid email format',
  },
  VALIDATION_PASSWORD_WEAK: {
    code: 'VALIDATION_PASSWORD_WEAK',
    status: 400,
    message: 'Password does not meet security requirements',
  },

  // Rate Limiting Errors (RATE_xxx)
  RATE_LIMIT_EXCEEDED: {
    code: 'RATE_LIMIT_EXCEEDED',
    status: 429,
    message: 'Too many requests. Please try again later.',
  },
  RATE_AI_QUOTA_EXCEEDED: {
    code: 'RATE_AI_QUOTA_EXCEEDED',
    status: 429,
    message: 'AI request quota exceeded for this period',
  },

  // AI Service Errors (AI_xxx)
  AI_SERVICE_UNAVAILABLE: {
    code: 'AI_SERVICE_UNAVAILABLE',
    status: 503,
    message: 'AI service is temporarily unavailable',
  },
  AI_PROVIDER_ERROR: {
    code: 'AI_PROVIDER_ERROR',
    status: 502,
    message: 'AI provider returned an error',
  },
  AI_CIRCUIT_BREAKER_OPEN: {
    code: 'AI_CIRCUIT_BREAKER_OPEN',
    status: 503,
    message:
      'AI service circuit breaker is open due to repeated failures. Please try again later.',
  },
  AI_INVALID_RESPONSE: {
    code: 'AI_INVALID_RESPONSE',
    status: 502,
    message: 'AI provider returned an invalid response',
  },
  AI_TIMEOUT: {
    code: 'AI_TIMEOUT',
    status: 504,
    message: 'AI request timed out',
  },

  // Project Errors (PROJECT_xxx)
  PROJECT_NOT_FOUND: {
    code: 'PROJECT_NOT_FOUND',
    status: 404,
    message: 'Project not found',
  },
  PROJECT_MEMBER_EXISTS: {
    code: 'PROJECT_MEMBER_EXISTS',
    status: 409,
    message: 'User is already a member of this project',
  },
  PROJECT_OWNER_CANNOT_LEAVE: {
    code: 'PROJECT_OWNER_CANNOT_LEAVE',
    status: 400,
    message: 'Project owner cannot leave the project. Transfer ownership first.',
  },

  // Sprint Errors (SPRINT_xxx)
  SPRINT_NOT_FOUND: {
    code: 'SPRINT_NOT_FOUND',
    status: 404,
    message: 'Sprint not found',
  },
  SPRINT_ALREADY_ACTIVE: {
    code: 'SPRINT_ALREADY_ACTIVE',
    status: 409,
    message: 'A sprint is already active for this project',
  },
  SPRINT_DATES_INVALID: {
    code: 'SPRINT_DATES_INVALID',
    status: 400,
    message: 'Sprint start date must be before end date',
  },
  SPRINT_COMPLETED: {
    code: 'SPRINT_COMPLETED',
    status: 400,
    message: 'Cannot modify a completed sprint',
  },

  // Story Errors (STORY_xxx)
  STORY_NOT_FOUND: {
    code: 'STORY_NOT_FOUND',
    status: 404,
    message: 'Story not found',
  },
  STORY_SPRINT_LOCKED: {
    code: 'STORY_SPRINT_LOCKED',
    status: 400,
    message: 'Cannot modify story that is locked to a sprint',
  },

  // Task Errors (TASK_xxx)
  TASK_NOT_FOUND: {
    code: 'TASK_NOT_FOUND',
    status: 404,
    message: 'Task not found',
  },
  TASK_INVALID_STATUS_TRANSITION: {
    code: 'TASK_INVALID_STATUS_TRANSITION',
    status: 400,
    message: 'Invalid task status transition',
  },

  // Server Errors (SERVER_xxx)
  SERVER_INTERNAL_ERROR: {
    code: 'SERVER_INTERNAL_ERROR',
    status: 500,
    message: 'An unexpected error occurred',
  },
  SERVER_DATABASE_ERROR: {
    code: 'SERVER_DATABASE_ERROR',
    status: 500,
    message: 'Database operation failed',
  },
  SERVER_EXTERNAL_SERVICE_ERROR: {
    code: 'SERVER_EXTERNAL_SERVICE_ERROR',
    status: 502,
    message: 'External service returned an error',
  },
} as const;

export type ErrorCode = keyof typeof ErrorCodes;

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  errorCode: ErrorCode,
  details?: unknown,
  correlationId?: string,
) {
  const error = ErrorCodes[errorCode];
  const errorObj: {
    code: string;
    message: string;
    details?: unknown;
    correlationId?: string;
  } = {
    code: error.code,
    message: error.message,
  };

  if (details) {
    errorObj.details = details;
  }
  if (correlationId) {
    errorObj.correlationId = correlationId;
  }

  return {
    statusCode: error.status,
    error: errorObj,
    timestamp: new Date().toISOString(),
  };
}
