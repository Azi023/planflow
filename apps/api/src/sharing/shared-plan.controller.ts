import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { SharingService } from './sharing.service';

@Controller('shared')
export class SharedPlanController {
  constructor(private readonly sharingService: SharingService) {}

  @Public()
  @Get(':token')
  getSharedPlan(@Param('token') token: string) {
    return this.sharingService.getSharedPlan(token);
  }

  @Public()
  @Post(':token/comments')
  addComment(
    @Param('token') token: string,
    @Body()
    body: { content: string; authorName: string; authorEmail?: string },
  ) {
    return this.sharingService.addComment(token, body);
  }

  @Public()
  @Post(':token/approve')
  approvePlan(
    @Param('token') token: string,
    @Body() body: { authorName: string },
  ) {
    return this.sharingService.clientApprove(token, body.authorName);
  }

  @Public()
  @Post(':token/request-revision')
  requestRevision(
    @Param('token') token: string,
    @Body() body: { authorName: string; reason?: string },
  ) {
    return this.sharingService.clientRequestRevision(
      token,
      body.authorName,
      body.reason,
    );
  }

}
