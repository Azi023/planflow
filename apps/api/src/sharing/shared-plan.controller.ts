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
    @Body() body: Record<string, string>,
    @Ip() ip: string,
  ) {
    // Accept both 'authorName' and 'author' field names for compatibility
    const authorName = body.authorName ?? body.author ?? 'Anonymous';
    const normalizedBody = {
      content: body.content ?? '',
      authorName,
      authorEmail: body.authorEmail ?? body.email,
    };
    const comment = await this.sharingService.addComment(token, normalizedBody);
    this.auditService.log(
      'shared.commented',
      'media_plan',
      null,
      null,
      { authorName },
      ip,
    );
    return comment;
  }

  @Public()
  @Post(':token/approve')
  async approvePlan(
    @Param('token') token: string,
    @Body() body: Record<string, string>,
    @Ip() ip: string,
  ) {
    // authorName is optional — default to 'Client' if not provided
    const authorName = body.authorName ?? body.author ?? 'Client';
    const result = await this.sharingService.clientApprove(token, authorName);
    this.auditService.log(
      'shared.approved',
      'media_plan',
      null,
      null,
      { authorName },
      ip,
    );
    return result;
  }

  @Public()
  @Post(':token/request-revision')
  async requestRevision(
    @Param('token') token: string,
    @Body() body: Record<string, string>,
    @Ip() ip: string,
  ) {
    // Accept both 'reason' and 'comment' field names; authorName optional
    const authorName = body.authorName ?? body.author ?? 'Client';
    const reason = body.reason ?? body.comment;
    const result = await this.sharingService.clientRequestRevision(
      token,
      authorName,
      reason,
    );
    this.auditService.log(
      'shared.revision_requested',
      'media_plan',
      null,
      null,
      { authorName, reason },
      ip,
    );
    return result;
  }
}
