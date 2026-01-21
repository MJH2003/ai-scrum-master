import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getInfo(): { name: string; version: string; description: string } {
    return {
      name: 'AI Scrum Master API',
      version: '1.0.0',
      description: 'AI-native agile project management platform backend',
    };
  }
}
