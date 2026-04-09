import { Body, Controller, Get, Ip, Param, Post } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { SharingService } from './sharing.service';
import { AuditService } from '../audit/audit.service';

@Controller('shared')
export class SharedPlanController {
  constructor(
    private readonly sharingService: SharingService,
    private readonly auditService: AuditService,
  ) {}

  @Public()
  @Get(':token')
  async getSharedPlan(@Param('token') token: string, @Ip() ip: string) {
    const plan = await this.sharingService.getSharedPlan(token);
    this.auditService.log(
      'shared.viewed',
      'media_plan',
      null,
      null,
      { token: token.slice(0, 8) + '...' },
      ip,
    );
    return plan;
  }

  @Public()
  @Post(':token/comments')
  async addComment(
    @Param('token') token: string,
    @Body() body: { content: string; authorName: string; authorEmail?: string },
    @Ip() ip: string,
  ) {
    const comment = await this.sharingService.addComment(token, body);
    this.auditService.log(
      'shared.commented',
      'media_plan',
      null,
      null,
      { authorName: body.authorName },
      ip,
    );
    return comment;
  }

  @Public()
  @Post(':token/approve')
  async approvePlan(
    @Param('token') token: string,
    @Body() body: { authorName: string },
    @Ip() ip: string,
  ) {
    const result = await this.sharingService.clientApprove(
      token,
      body.authorName,
    );
    this.auditService.log(
      'shared.approved',
      'media_plan',
      null,
      null,
      { authorName: body.authorName },
      ip,
    );
    return result;
  }

  @Public()
  @Post(':token/request-revision')
  async requestRevision(
    @Param('token') token: string,
    @Body() body: { authorName: string; reason?: string },
    @Ip() ip: string,
  ) {
    const result = await this.sharingService.clientRequestRevision(
      token,
      body.authorName,
      body.reason,
    );
    this.auditService.log(
      'shared.revision_requested',
      'media_plan',
      null,
      null,
      { authorName: body.authorName, reason: body.reason },
      ip,
    );
    return result;
  }
}
