import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Like, Repository } from 'typeorm';
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

  async findAll(
    opts: {
      page?: number;
      limit?: number;
      status?: string;
      clientId?: string;
      search?: string;
    } = {},
  ): Promise<{
    data: MediaPlan[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 20));

    const where: any = {};
    if (opts.status) where.status = opts.status;
    if (opts.clientId) where.clientId = opts.clientId;

    const qb = this.planRepo
      .createQueryBuilder('plan')
      .leftJoinAndSelect('plan.client', 'client')
      .leftJoinAndSelect('plan.product', 'product')
      .orderBy('plan.updatedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (opts.status) {
      qb.andWhere('plan.status = :status', { status: opts.status });
    }
    if (opts.clientId) {
      qb.andWhere('plan.clientId = :clientId', { clientId: opts.clientId });
    }
    if (opts.search) {
      qb.andWhere(
        '(plan.campaignName ILIKE :search OR plan.referenceNumber ILIKE :search)',
        { search: `%${opts.search}%` },
      );
    }

    const [data, total] = await qb.getManyAndCount();
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
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

  async bulkUpsertRows(
    planId: string,
    rows: Array<Record<string, any>>,
  ): Promise<MediaPlan> {
    const plan = await this.planRepo.findOne({ where: { id: planId } });
    if (!plan) throw new NotFoundException(`Plan ${planId} not found`);

    if (!rows || !rows.length) {
      return this.findOne(planId);
    }

    const toCreate = rows.filter((r) => !r.id);
    const toUpdate = rows.filter((r) => r.id);

    // Update existing rows
    if (toUpdate.length) {
      await Promise.all(
        toUpdate.map((r) => {
          const { id, ...updates } = r;
          return this.rowRepo.update({ id, planId }, updates);
        }),
      );
    }

    // Create new rows (with KPI calculation)
    if (toCreate.length) {
      await this.upsertRows(planId, toCreate as any);
    }

    return this.findOne(planId);
  }

  async bulkDeleteRows(planId: string, rowIds: string[]): Promise<MediaPlan> {
    const plan = await this.planRepo.findOne({ where: { id: planId } });
    if (!plan) throw new NotFoundException(`Plan ${planId} not found`);

    await Promise.all(rowIds.map((id) => this.rowRepo.delete({ id, planId })));

    return this.findOne(planId);
  }

  /** Normalise display-name → DB slug for platform lookup */
  private normalizePlatform(input: string): string {
    const map: Record<string, string> = {
      'meta + ig': 'meta_ig',
      'meta + instagram': 'meta_ig',
      'meta+ig': 'meta_ig',
      'meta only': 'meta',
      'ig only': 'ig',
      'ig follower': 'ig_follower',
      'meta page like': 'meta_page_like',
      'youtube video views': 'youtube_video',
      'youtube bumper': 'youtube_bumper',
      'demand gen': 'demand_gen',
      'performance max': 'perf_max',
    };
    const lower = input.trim().toLowerCase();
    return map[lower] ?? lower;
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
        let resolvedBenchmarkId = r.benchmarkId ?? null;

        // Auto-resolve benchmark if not provided but platform+objective+audienceType are
        if (
          !resolvedBenchmarkId &&
          r.platform &&
          r.objective &&
          r.audienceType
        ) {
          const normPlatform = this.normalizePlatform(r.platform);
          const normObjective = r.objective.trim().toLowerCase();
          const normAudience = r.audienceType.trim().toLowerCase();
          const matched = await this.benchmarkRepo.findOne({
            where: {
              platform: normPlatform,
              objective: normObjective,
              audienceType: normAudience,
            },
          });
          if (matched) {
            resolvedBenchmarkId = matched.id;
          }
        }

        if (resolvedBenchmarkId && r.budget) {
          const benchmark = await this.benchmarkRepo.findOne({
            where: { id: resolvedBenchmarkId },
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
          benchmarkId: resolvedBenchmarkId,
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
