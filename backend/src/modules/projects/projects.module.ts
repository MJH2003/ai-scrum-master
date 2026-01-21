import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { DatabaseModule } from '../../database';
import { ProjectMemberGuard, ProjectRolesGuard } from './guards';

@Module({
  imports: [DatabaseModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectMemberGuard, ProjectRolesGuard],
  exports: [ProjectsService, ProjectMemberGuard, ProjectRolesGuard],
})
export class ProjectsModule {}
