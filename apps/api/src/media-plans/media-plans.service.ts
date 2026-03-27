import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { MediaPlan } from '../entities/media-plan.entity';
import { MediaPlanRow } from '../entities/media-plan-row.entity';
import { Benchmark } from '../entities/benchmark.entity';
import { BenchmarksService } from '../benchmarks/benchmarks.service';
import { CreatePlanDto } from './dto/create-plan.dto';

@Injectable()
export class MediaPlansService {
  constructor(
    @InjectRepository(MediaPlan)
    private readonly planRepo: Repository<MediaPlan>,
    @InjectRepository(MediaPlanRow)
    private readonly rowRepo: Repository<MediaPlanRow>,
    @InjectRepository(Benchmark)
    private readonly benchmarkRepo: Repository<Benchmark>,
    private readonly benchmarksService: BenchmarksService,
  ) {}

  findAll(): Promise<MediaPlan[]> {
    return this.planRepo.find({
      relations: ['client', 'product', 'rows'],
      order: { updatedAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<MediaPlan> {
    const plan = await this.planRepo.findOne({
      where: { id },
      relations: ['client', 'product', 'rows', 'rows.benchmark'],
    });
    if (!plan) throw new NotFoundException(`Plan ${id} not found`);
    return plan;
  }

  async create(dto: CreatePlanDto): Promise<MediaPlan> {
    const plan = this.planRepo.create({
      clientId: dto.clientId ?? null,
      productId: dto.productId ?? null,
      campaignName: dto.campaignName ?? null,
      campaignPeriod: dto.campaignPeriod ?? null,
      startDate: dto.startDate ?? null,
      endDate: dto.endDate ?? null,
      bufferPct: dto.bufferPct ?? 12,
      totalBudget: dto.totalBudget ?? null,
      fee1Pct: dto.fee1Pct ?? 15,
      fee1Label: dto.fee1Label ?? 'Management Fee',
      fee2Pct: dto.fee2Pct ?? null,
      fee2Label: dto.fee2Label ?? null,
      referenceNumber: dto.referenceNumber ?? null,
      preparedBy: dto.preparedBy ?? null,
      currency: dto.currency ?? 'LKR',
      usdExchangeRate: dto.usdExchangeRate ?? null,
      variantName: dto.variantName ?? 'Option 1',
      variantGroupId: dto.variantGroupId ?? null,
      notes: dto.notes ?? null,
    });
    const saved = await this.planRepo.save(plan);

    // Auto-generate reference number if not provided
    if (!saved.referenceNumber) {
      const year = new Date().getFullYear();
      const count = await this.planRepo.count({
        where: { referenceNumber: Like(`JM-${year}-%`) },
      });
      await this.planRepo.update(saved.id, {
        referenceNumber: `JM-${year}-${String(count + 1).padStart(3, '0')}`,
      });
    }

    // If no variantGroupId provided, use own id as group
    if (!dto.variantGroupId) {
      await this.planRepo.update(saved.id, { variantGroupId: saved.id });
    }

    if (dto.rows?.length) {
      await this.upsertRows(saved.id, dto.rows);
    }

    return this.findOne(saved.id);
  }

  async update(id: string, dto: CreatePlanDto): Promise<MediaPlan> {
    const plan = await this.findOne(id);
    const updated = this.planRepo.merge(plan, {
      clientId: dto.clientId,
      productId: dto.productId,
      campaignName: dto.campaignName,
      campaignPeriod: dto.campaignPeriod,
      startDate: dto.startDate,
      endDate: dto.endDate,
      bufferPct: dto.bufferPct,
      totalBudget: dto.totalBudget,
      fee1Pct: dto.fee1Pct,
      fee1Label: dto.fee1Label,
      fee2Pct: dto.fee2Pct,
      fee2Label: dto.fee2Label,
      referenceNumber: dto.referenceNumber,
      preparedBy: dto.preparedBy,
      currency: dto.currency,
      usdExchangeRate: dto.usdExchangeRate,
      variantName: dto.variantName,
      notes: dto.notes,
    });

    // Only update variantGroupId if explicitly provided
    if (dto.variantGroupId !== undefined) {
      updated.variantGroupId = dto.variantGroupId;
    }

    await this.planRepo.save(updated);

    if (dto.rows !== undefined) {
      await this.rowRepo.delete({ planId: id });
      await this.upsertRows(id, dto.rows ?? []);
    }

    return this.findOne(id);
  }

  async delete(id: string): Promise<void> {
    await this.findOne(id);
    await this.planRepo.delete(id);
  }

  async updateStatus(
    id: string,
    newStatus: string,
    userRole: string,
  ): Promise<MediaPlan> {
    const plan = await this.findOne(id);
    const current = plan.status;

    const validTransitions: Record<string, string[]> = {
      draft: ['pending_review'],
      pending_review: ['draft', 'approved'],
      approved: ['sent'],
      sent: [],
    };

    if (!validTransitions[current]?.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition: ${current} → ${newStatus}`,
      );
    }

    if (newStatus === 'approved' && userRole !== 'admin') {
      throw new ForbiddenException('Only admins can approve plans');
    }
    if (
      newStatus === 'sent' &&
      !['admin', 'account_manager'].includes(userRole)
    ) {
      throw new ForbiddenException(
        'Only admins and account managers can mark plans as sent',
      );
    }

    await this.planRepo.update(id, { status: newStatus });
    return this.findOne(id);
  }

  async duplicate(planId: string): Promise<MediaPlan> {
    const original = await this.findOne(planId);
    const rows = await this.rowRepo.find({
      where: { planId },
      order: { sortOrder: 'ASC' },
    });

    const year = new Date().getFullYear();
    const count = await this.planRepo.count({
      where: { referenceNumber: Like(`JM-${year}-%`) },
    });
    const refNumber = `JM-${year}-${String(count + 1).padStart(3, '0')}`;

    const newPlan = this.planRepo.create({
      clientId: original.clientId,
      productId: original.productId,
      campaignName: `Copy of ${original.campaignName ?? 'Plan'}`,
      campaignPeriod: original.campaignPeriod,
      startDate: original.startDate,
      endDate: original.endDate,
      bufferPct: original.bufferPct,
      totalBudget: original.totalBudget,
      fee1Pct: original.fee1Pct,
      fee1Label: original.fee1Label,
      fee2Pct: original.fee2Pct,
      fee2Label: original.fee2Label,
      referenceNumber: refNumber,
      preparedBy: original.preparedBy,
      currency: original.currency,
      usdExchangeRate: original.usdExchangeRate,
      variantName: original.variantName,
      notes: original.notes,
      status: 'draft',
    });

    const savedPlan = await this.planRepo.save(newPlan);
    await this.planRepo.update(savedPlan.id, {
      variantGroupId: savedPlan.id,
    });

    if (rows.length) {
      const clonedRows = rows.map((r) =>
        this.rowRepo.create({
          planId: savedPlan.id,
          platform: r.platform,
          audienceType: r.audienceType,
          adType: r.adType,
          objective: r.objective,
          audienceName: r.audienceName,
          audienceSize: r.audienceSize,
          targetingCriteria: r.targetingCriteria,
          creative: r.creative,
          budget: r.budget,
          benchmarkId: r.benchmarkId,
          projectedKpis: r.projectedKpis,
          sortOrder: r.sortOrder,
          country: r.country,
          buyType: r.buyType,
          platformRangeCpm: r.platformRangeCpm,
          platformRangeCpl: r.platformRangeCpl,
          notes: r.notes,
        }),
      );
      await this.rowRepo.save(clonedRows);
    }

    return this.findOne(savedPlan.id);
  }

  async bulkUpdateRows(
    planId: string,
    rows: Array<{
      id: string;
      platform?: string;
      objective?: string;
      audienceType?: string;
      budget?: number;
    }>,
  ): Promise<MediaPlan> {
    const plan = await this.planRepo.findOne({ where: { id: planId } });
    if (!plan) throw new NotFoundException(`Plan ${planId} not found`);

    await Promise.all(
      rows.map((r) => {
        const { id, ...updates } = r;
        return this.rowRepo.update({ id, planId }, updates);
      }),
    );

    return this.findOne(planId);
  }

  async bulkDeleteRows(planId: string, rowIds: string[]): Promise<MediaPlan> {
    const plan = await this.planRepo.findOne({ where: { id: planId } });
    if (!plan) throw new NotFoundException(`Plan ${planId} not found`);

    await Promise.all(rowIds.map((id) => this.rowRepo.delete({ id, planId })));

    return this.findOne(planId);
  }

  findByGroup(groupId: string): Promise<MediaPlan[]> {
    return this.planRepo.find({
      where: { variantGroupId: groupId },
      relations: ['client', 'product', 'rows', 'rows.benchmark'],
      order: { createdAt: 'ASC' },
    });
  }

  private async upsertRows(
    planId: string,
    rows: CreatePlanDto['rows'],
  ): Promise<void> {
    if (!rows?.length) return;

    const rowEntities = await Promise.all(
      rows.map(async (r, idx) => {
        let projectedKpis = r.projectedKpis ?? {};

        if (r.benchmarkId && r.budget) {
          const benchmark = await this.benchmarkRepo.findOne({
            where: { id: r.benchmarkId },
          });
          if (benchmark) {
            const kpis = this.benchmarksService.computeKpis(
              benchmark,
              r.budget,
            );
            projectedKpis = kpis as unknown as Record<string, unknown>;
          }
        }

        return this.rowRepo.create({
          planId,
          platform: r.platform,
          audienceType: r.audienceType ?? null,
          adType: r.adType ?? null,
          objective: r.objective ?? null,
          audienceName: r.audienceName ?? null,
          audienceSize: r.audienceSize ?? null,
          targetingCriteria: r.targetingCriteria ?? null,
          creative: r.creative ?? null,
          budget: r.budget ?? null,
          benchmarkId: r.benchmarkId ?? null,
          projectedKpis,
          sortOrder: r.sortOrder ?? idx,
          country: r.country ?? null,
          buyType: r.buyType ?? null,
          platformRangeCpm: r.platformRangeCpm ?? null,
          platformRangeCpl: r.platformRangeCpl ?? null,
          notes: r.notes ?? null,
        });
      }),
    );

    await this.rowRepo.save(rowEntities);
  }
}
