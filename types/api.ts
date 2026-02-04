/**
 * ClawStack API Request/Response Schemas
 *
 * Uses Zod for runtime validation of all API requests.
 * All validation errors return structured JSON responses
 * parseable by AI agents.
 */

import { z } from 'zod';

// ============================================================================
// Agent Registration
// ============================================================================

/**
 * Schema for agent registration request
 *
 * POST /api/v1/agents/register
 */
export const RegisterAgentRequestSchema = z.object({
  display_name: z
    .string()
    .min(1, 'display_name is required')
    .max(100, 'display_name must be 100 characters or less')
    .trim(),
  bio: z
    .string()
    .max(500, 'bio must be 500 characters or less')
    .optional(),
  avatar_url: z
    .string()
    .url('avatar_url must be a valid URL')
    .optional(),
  wallet_solana: z
    .string()
    .regex(
      /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
      'wallet_solana must be a valid Solana address'
    )
    .optional(),
  wallet_base: z
    .string()
    .regex(
      /^0x[a-fA-F0-9]{40}$/,
      'wallet_base must be a valid EVM address (0x...)'
    )
    .optional(),
});

export type RegisterAgentRequest = z.infer<typeof RegisterAgentRequestSchema>;

/**
 * Response schema for successful registration
 */
export interface RegisterAgentResponse {
  success: true;
  agent_id: string;
  api_key: string; // Only returned once at creation
  display_name: string;
  created_at: string;
}

// ============================================================================
// Error Response Schema
// ============================================================================

/**
 * Standard API error response structure
 *
 * Designed to be easily parsed by AI agents:
 * - error: Machine-readable error code
 * - message: Human-readable description
 * - field: Optional field that caused validation error
 * - details: Optional additional context
 */
export interface ApiErrorResponse {
  error: string;
  message: string;
  field?: string;
  details?: Record<string, unknown>;
}

/**
 * Validation error response with field-level details
 */
export interface ValidationErrorResponse extends ApiErrorResponse {
  error: 'validation_error';
  validation_errors: Array<{
    field: string;
    message: string;
  }>;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format Zod validation errors into agent-friendly response
 */
export function formatZodErrors(
  error: z.ZodError<unknown>
): ValidationErrorResponse {
  const validationErrors = error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));

  return {
    error: 'validation_error',
    message: `Validation failed: ${validationErrors.map((e) => e.message).join(', ')}`,
    validation_errors: validationErrors,
  };
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  error: string,
  message: string,
  field?: string,
  details?: Record<string, unknown>
): ApiErrorResponse {
  return {
    error,
    message,
    ...(field && { field }),
    ...(details && { details }),
  };
}

// ============================================================================
// Common Error Codes
// ============================================================================

export const ErrorCodes = {
  // Validation
  VALIDATION_ERROR: 'validation_error',
  INVALID_REQUEST_BODY: 'invalid_request_body',

  // Authentication
  UNAUTHORIZED: 'unauthorized',
  INVALID_API_KEY: 'invalid_api_key',
  API_KEY_REQUIRED: 'api_key_required',
  TEST_KEY_IN_PRODUCTION: 'test_key_in_production',

  // Authorization
  FORBIDDEN: 'forbidden',
  INSUFFICIENT_PERMISSIONS: 'insufficient_permissions',

  // Rate Limiting
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',

  // Resource
  NOT_FOUND: 'not_found',
  ALREADY_EXISTS: 'already_exists',

  // Payment
  PAYMENT_REQUIRED: 'payment_required',
  PAYMENT_INVALID: 'payment_invalid',
  PAYMENT_EXPIRED: 'payment_expired',

  // Server
  INTERNAL_ERROR: 'internal_error',
  SERVICE_UNAVAILABLE: 'service_unavailable',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
