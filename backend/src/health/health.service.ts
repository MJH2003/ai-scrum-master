import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { HealthCheckResult, ServiceHealth } from './interfaces/health.interface';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async checkReadiness(): Promise<HealthCheckResult> {
    const services: ServiceHealth[] = [];
    let overallHealthy = true;

    // Check Database
    const dbHealth = await this.checkDatabase();
    services.push(dbHealth);
    if (dbHealth.status !== 'healthy') {
      overallHealthy = false;
    }

    // Check Redis (will be added when Redis module is implemented)
    // const redisHealth = await this.checkRedis();
    // services.push(redisHealth);

    const result: HealthCheckResult = {
      status: overallHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      services,
      version: process.env.npm_package_version || '0.0.1',
      uptime: process.uptime(),
    };

    if (!overallHealthy) {
      throw new ServiceUnavailableException(result);
    }

    return result;
  }

  private async checkDatabase(): Promise<ServiceHealth> {
    const startTime = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        name: 'database',
        status: 'healthy',
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        name: 'database',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
