import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { SecurityUtils } from '../utils/security.utils';

/**
 * API Key Guard for external integrations
 * Use with @UseGuards(ApiKeyGuard) on routes that should accept API key auth
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly apiKeyHash: string | undefined;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('API_KEY');
    if (apiKey) {
      this.apiKeyHash = SecurityUtils.hash(apiKey);
    }
  }

  canActivate(context: ExecutionContext): boolean {
    if (!this.apiKeyHash) {
      // API key authentication not configured, deny access
      throw new UnauthorizedException('API key authentication not configured');
    }

    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = this.extractApiKey(request);

    if (!apiKey) {
      throw new UnauthorizedException('API key is required');
    }

    const providedHash = SecurityUtils.hash(apiKey);
    if (!SecurityUtils.constantTimeCompare(providedHash, this.apiKeyHash)) {
      throw new UnauthorizedException('Invalid API key');
    }

    // Mark request as API key authenticated
    (request as Request & { apiKeyAuth: boolean }).apiKeyAuth = true;

    return true;
  }

  private extractApiKey(request: Request): string | undefined {
    // Check X-API-Key header first
    const headerKey = request.headers['x-api-key'] as string;
    if (headerKey) {
      return headerKey;
    }

    // Check Authorization header with ApiKey scheme
    const authHeader = request.headers['authorization'];
    if (authHeader?.startsWith('ApiKey ')) {
      return authHeader.slice(7);
    }

    // Check query parameter (less secure, for webhooks)
    const queryKey = request.query['api_key'] as string;
    if (queryKey) {
      return queryKey;
    }

    return undefined;
  }
}
