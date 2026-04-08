import { Injectable, NotFoundException, GoneException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { MediaPlan } from '../entities/media-plan.entity';
import { PlanComment } from '../entities/plan-comment.entity';

@Injectable()
export class SharingService {
  constructor(
    @InjectRepository(MediaPlan)
    private readonly planRepo: Repository<MediaPlan>,
    @InjectRepository(PlanComment)
    private readonly commentRepo: Repository<PlanComment>,
  ) {}

  async enableSharing(
    planId: string,
    expiresInDays?: number,
  ): Promise<{ shareToken: string; shareUrl: string }> {
    const plan = await this.planRepo.findOne({ where: { id: planId } });
    if (!plan) throw new NotFoundException(`Plan ${planId} not found`);

    const token = randomBytes(32).toString('hex');
    const expiresAt =
      expiresInDays != null
        ? new Date(Date.now() + expiresInDays * 86400000)
        : null;

    await this.planRepo.update(planId, {
      shareToken: token,
      shareEnabled: true,
      shareExpiresAt: expiresAt,
    });

    return { shareToken: token, shareUrl: `/shared/${token}` };
  }

  async disableSharing(planId: string): Promise<void> {
    const plan = await this.planRepo.findOne({ where: { id: planId } });
    if (!plan) throw new NotFoundException(`Plan ${planId} not found`);
    await this.planRepo.update(planId, {
      shareEnabled: false,
    });
  }

  async getSharedPlan(token: string): Promise<Record<string, unknown>> {
    const plan = await this.planRepo.findOne({
      where: { shareToken: token, shareEnabled: true },
      relations: ['client', 'product', 'rows'],
    });

    if (!plan) throw new NotFoundException('Plan not found or sharing disabled');

    if (plan.shareExpiresAt && new Date() > plan.shareExpiresAt) {
      throw new GoneException('Share link has expired');
    }

    const comments = await this.commentRepo.find({
      where: { planId: plan.id },
      order: { createdAt: 'DESC' },
    });

    const sortedRows = (plan.rows ?? []).sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
    );

    return {
      campaignName: plan.campaignName,
      clientName: plan.client?.name ?? null,
      productName: plan.product?.name ?? null,
      campaignPeriod: plan.campaignPeriod,
      startDate: plan.startDate,
      endDate: plan.endDate,
      totalBudget: plan.totalBudget,
      currency: plan.currency,
      variantName: plan.variantName,
      preparedBy: plan.preparedBy,
      notes: plan.notes,
      referenceNumber: plan.referenceNumber,
      status: plan.status,
      rows: sortedRows.map((row) => ({
        platform: row.platform,
        objective: row.objective,
        audienceName: row.audienceName,
        audienceSize: row.audienceSize,
        creative: row.creative,
        country: row.country,
        budget: row.budget,
        projectedKpis: row.projectedKpis,
      })),
      comments: comments.map((c) => ({
        id: c.id,
        authorName: c.authorName,
        content: c.content,
        isClient: c.isClient,
        createdAt: c.createdAt,
      })),
    };
  }

  async addComment(
    token: string,
    data: { content: string; authorName: string; authorEmail?: string },
  ): Promise<Record<string, unknown>> {
    const plan = await this.planRepo.findOne({
      where: { shareToken: token, shareEnabled: true },
    });
    if (!plan) throw new NotFoundException('Plan not found or sharing disabled');

    if (plan.shareExpiresAt && new Date() > plan.shareExpiresAt) {
      throw new GoneException('Share link has expired');
    }

    const comment = this.commentRepo.create({
      planId: plan.id,
      content: data.content,
      authorName: data.authorName,
      authorEmail: data.authorEmail ?? null,
      isClient: true,
      isRead: false,
    });
    const saved = await this.commentRepo.save(comment);
    return {
      id: saved.id,
      authorName: saved.authorName,
      content: saved.content,
      createdAt: saved.createdAt,
    };
  }

  async getComments(planId: string): Promise<PlanComment[]> {
    return this.commentRepo.find({
      where: { planId },
      order: { createdAt: 'DESC' },
    });
  }

  async markCommentsRead(planId: string): Promise<void> {
    await this.commentRepo.update({ planId, isRead: false }, { isRead: true });
  }

  async clientApprove(
    token: string,
    authorName: string,
  ): Promise<Record<string, unknown>> {
    const plan = await this.planRepo.findOne({
      where: { shareToken: token, shareEnabled: true },
    });
    if (!plan) throw new NotFoundException('Plan not found or sharing disabled');
    if (plan.shareExpiresAt && new Date() > plan.shareExpiresAt) {
      throw new GoneException('Share link has expired');
    }

    if (plan.status !== 'pending_review' && plan.status !== 'approved') {
      throw new BadRequestException(
        `Cannot approve a plan with status "${plan.status}". Plan must be in review.`,
      );
    }

    await this.planRepo.update(plan.id, { status: 'approved' });

    const comment = this.commentRepo.create({
      planId: plan.id,
      content: `Plan approved by client`,
      authorName,
      isClient: true,
      isRead: false,
    });
    await this.commentRepo.save(comment);

    return { success: true, newStatus: 'approved', message: 'Plan approved' };
  }

  async clientRequestRevision(
    token: string,
    authorName: string,
    reason?: string,
  ): Promise<Record<string, unknown>> {
    const plan = await this.planRepo.findOne({
      where: { shareToken: token, shareEnabled: true },
    });
    if (!plan) throw new NotFoundException('Plan not found or sharing disabled');
    if (plan.shareExpiresAt && new Date() > plan.shareExpiresAt) {
      throw new GoneException('Share link has expired');
    }

    await this.planRepo.update(plan.id, { status: 'draft' });

    const msg = reason
      ? `Revision requested: ${reason}`
      : 'Revision requested by client';
    const comment = this.commentRepo.create({
      planId: plan.id,
      content: msg,
      authorName,
      isClient: true,
      isRead: false,
    });
    await this.commentRepo.save(comment);

    return { success: true, newStatus: 'draft', message: msg };
  }

}
