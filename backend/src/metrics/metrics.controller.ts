import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../modules/auth/decorators/public.decorator';
import { CircuitBreakerFactory } from '../common/utils/circuit-breaker';

interface MetricsResponse {
  timestamp: string;
  uptime: number;
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  circuitBreakers: Array<{
    name: string;
    state: string;
    failureCount: number;
    successCount: number;
  }>;
}

@ApiTags('Metrics')
@Controller('metrics')
export class MetricsController {
  private readonly startTime = Date.now();

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get application metrics' })
  @ApiResponse({
    status: 200,
    description: 'Application metrics for monitoring',
  })
  getMetrics(): MetricsResponse {
    const memoryUsage = process.memoryUsage();

    return {
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      memory: {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024),
        rss: Math.round(memoryUsage.rss / 1024 / 1024),
      },
      circuitBreakers: CircuitBreakerFactory.getAllStats().map((stat) => ({
        name: stat.name,
        state: stat.state,
        failureCount: stat.failureCount,
        successCount: stat.successCount,
      })),
    };
  }

  @Get('prometheus')
  @Public()
  @ApiOperation({ summary: 'Get metrics in Prometheus format' })
  @ApiResponse({
    status: 200,
    description: 'Prometheus-compatible metrics',
    content: {
      'text/plain': {
        schema: { type: 'string' },
      },
    },
  })
  getPrometheusMetrics(): string {
    const memoryUsage = process.memoryUsage();
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    const breakers = CircuitBreakerFactory.getAllStats();

    const lines: string[] = [
      '# HELP asm_uptime_seconds Application uptime in seconds',
      '# TYPE asm_uptime_seconds gauge',
      `asm_uptime_seconds ${uptime}`,
      '',
      '# HELP asm_memory_heap_used_bytes Heap memory used',
      '# TYPE asm_memory_heap_used_bytes gauge',
      `asm_memory_heap_used_bytes ${memoryUsage.heapUsed}`,
      '',
      '# HELP asm_memory_heap_total_bytes Total heap memory',
      '# TYPE asm_memory_heap_total_bytes gauge',
      `asm_memory_heap_total_bytes ${memoryUsage.heapTotal}`,
      '',
      '# HELP asm_memory_rss_bytes Resident set size',
      '# TYPE asm_memory_rss_bytes gauge',
      `asm_memory_rss_bytes ${memoryUsage.rss}`,
    ];

    if (breakers.length > 0) {
      lines.push('');
      lines.push('# HELP asm_circuit_breaker_state Circuit breaker state (0=closed, 1=open, 2=half-open)');
      lines.push('# TYPE asm_circuit_breaker_state gauge');
      for (const breaker of breakers) {
        const stateValue = breaker.state === 'CLOSED' ? 0 : breaker.state === 'OPEN' ? 1 : 2;
        lines.push(`asm_circuit_breaker_state{name="${breaker.name}"} ${stateValue}`);
      }

      lines.push('');
      lines.push('# HELP asm_circuit_breaker_failures Circuit breaker failure count');
      lines.push('# TYPE asm_circuit_breaker_failures counter');
      for (const breaker of breakers) {
        lines.push(`asm_circuit_breaker_failures{name="${breaker.name}"} ${breaker.failureCount}`);
      }
    }

    return lines.join('\n');
  }
}
