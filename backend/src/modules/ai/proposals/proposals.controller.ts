import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ProjectRole, ProposalStatus } from '@prisma/client';
import { ProposalsService } from './proposals.service';
import {
  ProposalDto,
  ProposalListItemDto,
  ApplyProposalDto,
  RejectProposalDto,
} from './dto';
import { ProjectMemberGuard, ProjectRolesGuard, ProjectRoles } from '../../projects/guards';
import { CurrentUser } from '../../auth';

@ApiTags('AI Proposals')
@ApiBearerAuth('JWT-auth')
@Controller('projects/:projectId/proposals')
@UseGuards(ProjectMemberGuard, ProjectRolesGuard)
export class ProposalsController {
  constructor(private readonly proposalsService: ProposalsService) {}

  @Get()
  @ProjectRoles(ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER, ProjectRole.VIEWER)
  @ApiOperation({ summary: 'List AI proposals for a project' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiQuery({ name: 'status', required: false, enum: ProposalStatus })
  @ApiResponse({ status: 200, type: [ProposalListItemDto] })
  async findAll(
    @Param('projectId') projectId: string,
    @Query('status') status?: ProposalStatus,
  ): Promise<ProposalListItemDto[]> {
    return this.proposalsService.findAll(projectId, status);
  }

  @Get(':proposalId')
  @ProjectRoles(ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER, ProjectRole.VIEWER)
  @ApiOperation({ summary: 'Get proposal details' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'proposalId', description: 'Proposal ID' })
  @ApiResponse({ status: 200, type: ProposalDto })
  async findById(
    @Param('projectId') projectId: string,
    @Param('proposalId') proposalId: string,
  ): Promise<ProposalDto> {
    return this.proposalsService.findById(projectId, proposalId);
  }

  @Post(':proposalId/apply')
  @ProjectRoles(ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER)
  @ApiOperation({ summary: 'Apply a proposal (create entities from AI suggestion)' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'proposalId', description: 'Proposal ID' })
  @ApiResponse({ status: 200, description: 'Proposal applied' })
  async apply(
    @Param('projectId') projectId: string,
    @Param('proposalId') proposalId: string,
    @Body() applyDto: ApplyProposalDto,
    @CurrentUser('id') userId: string,
  ): Promise<{ applied: boolean; created: any[] }> {
    return this.proposalsService.apply(projectId, proposalId, applyDto, userId);
  }

  @Post(':proposalId/reject')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ProjectRoles(ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER)
  @ApiOperation({ summary: 'Reject a proposal' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'proposalId', description: 'Proposal ID' })
  @ApiResponse({ status: 204, description: 'Proposal rejected' })
  async reject(
    @Param('projectId') projectId: string,
    @Param('proposalId') proposalId: string,
    @Body() rejectDto: RejectProposalDto,
    @CurrentUser('id') userId: string,
  ): Promise<void> {
    return this.proposalsService.reject(projectId, proposalId, rejectDto.reason, userId);
  }
}
