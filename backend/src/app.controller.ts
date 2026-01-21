import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('App')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Get API info' })
  @ApiResponse({
    status: 200,
    description: 'Returns API information',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'AI Scrum Master API' },
        version: { type: 'string', example: '1.0.0' },
        description: { type: 'string' },
      },
    },
  })
  getInfo(): { name: string; version: string; description: string } {
    return this.appService.getInfo();
  }
}
