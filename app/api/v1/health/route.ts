/**
 * Health Check Endpoint
 *
 * Returns system health status including Redis connectivity.
 * Used by monitoring services and deployment health checks.
 *
 * GET /api/v1/health
 * Returns 200 if healthy, 503 if unhealthy
 */

import { NextRequest, NextResponse } from 'next/server';
import { isRedisConfigured } from '@/lib/ratelimit/ratelimit';

interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  checks: {
    redis: {
      configured: boolean;
      required: boolean;
      status: 'ok' | 'missing' | 'error';
      message: string;
    };
  };
}

export async function GET(request: NextRequest): Promise<Response> {
  const isProduction = process.env.NODE_ENV === 'production';

  // Check Redis configuration
  const redisConfigured = isRedisConfigured();
  const redisRequired = isProduction;

  let redisStatus: 'ok' | 'missing' | 'error' = 'ok';
  let redisMessage = 'Redis is configured';

  if (!redisConfigured) {
    redisStatus = 'missing';
    redisMessage = 'Redis not configured (UPSTASH_REDIS_REST_URL/TOKEN missing)';
  }

  const isHealthy = redisRequired ? redisConfigured : true;
  const status = isHealthy ? 'healthy' : 'unhealthy';

  const response: HealthCheckResponse = {
    status,
    timestamp: new Date().toISOString(),
    checks: {
      redis: {
        configured: redisConfigured,
        required: redisRequired,
        status: redisStatus,
        message: redisMessage,
      },
    },
  };

  return NextResponse.json(response, {
    status: isHealthy ? 200 : 503,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
