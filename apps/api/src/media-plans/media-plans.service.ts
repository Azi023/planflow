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
import { PlanVersion } from '../entities/plan-version.entity';
import { BenchmarksService } from '../benchmarks/benchmarks.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
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
    @InjectRepository(PlanVersion)
    private readonly versionRepo: Repository<PlanVersion>,
    private readonly benchmarksService: BenchmarksService,
    private readonly auditService: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Version control ─────────────────────────────────────────────

  async createVersion(
    planId: string,
    changeType: string,
    changeSummary: string | null,
    userId?: string | null,
  ): Promise<PlanVersion> {
    const plan = await this.planRepo.findOne({
      where: { id: planId },
      relations: ['client', 'product', 'rows'],
    });
    if (!plan) throw new NotFoundException(`Plan ${planId} not found`);

    const lastVersion = await this.versionRepo
      .createQueryBuilder('v')
      .where('v.plan_id = :planId', { planId })
      .orderBy('v.version_number', 'DESC')
      .getOne();

    const versionNumber = (lastVersion?.versionNumber ?? 0) + 1;

    const snapshot = {
      campaignName: plan.campaignName,
      clientId: plan.clientId,
      clientName: plan.client?.name ?? null,
      productId: plan.productId,
      productName: plan.product?.name ?? null,
      totalBudget: plan.totalBudget,
      currency: plan.currency,
      status: plan.status,
      fee1Pct: plan.fee1Pct,
      fee1Label: plan.fee1Label,
      fee2Pct: plan.fee2Pct,
      fee2Label: plan.fee2Label,
      bufferPct: plan.bufferPct,
      variantName: plan.variantName,
      notes: plan.notes,
      rows: (plan.rows ?? []).map((r) => ({
        platform: r.platform,
        objective: r.objective,
        audienceType: r.audienceType,
        audienceName: r.audienceName,
        budget: r.budget,
        projectedKpis: r.projectedKpis,
        creative: r.creative,
        country: r.country,
        buyType: r.buyType,
        sortOrder: r.sortOrder,
      })),
    };

    return this.versionRepo.save(
      this.versionRepo.create({
        planId,
        versionNumber,
        snapshot,
        changeType,
        changeSummary,
        createdBy: userId ?? null,
      }),
    );
  }

  async getVersions(planId: string): Promise<PlanVersion[]> {
    return this.versionRepo.find({
      where: { planId },
      order: { versionNumber: 'DESC' },
    });
  }

  async getVersion(planId: string, versionId: string): Promise<PlanVersion> {
    const v = await this.versionRepo.findOne({
      where: { id: versionId, planId },
    });
    if (!v) throw new NotFoundException('Version not found');
    return v;
  }

  async restoreVersion(
    planId: string,
    versionId: string,
    userId: string,
  ): Promise<MediaPlan> {
    const version = await this.getVersion(planId, versionId);
    const snapshot = version.snapshot as Record<string, any>;

    // Delete existing rows
    await this.rowRepo.delete({ planId });

    // Restore rows from snapshot
    const rows = snapshot.rows ?? [];
    if (rows.length) {
      const entities = rows.map((r: Record<string, any>, idx: number) =>
        this.rowRepo.create({
          planId,
          platform: r.platform,
          objective: r.objective ?? null,
          audienceType: r.audienceType ?? null,
          audienceName: r.audienceName ?? null,
          budget: r.budget ?? null,
          projectedKpis: r.projectedKpis ?? {},
          creative: r.creative ?? null,
          country: r.country ?? null,
          buyType: r.buyType ?? null,
          sortOrder: r.sortOrder ?? idx,
        }),
      );
      await this.rowRepo.save(entities);
    }

    await this.createVersion(
      planId,
      'restored',
      `Restored to version ${version.versionNumber}`,
      userId,
    );

    this.auditService.log(
      'plan.version_restored',
      'media_plan',
      planId,
      userId,
      { restoredFromVersion: version.versionNumber },
    );

    return this.findOne(planId);
  }

  async diffVersions(
    planId: string,
    v1Id: string,
    v2Id: string,
  ): Promise<Record<string, unknown>> {
    const [v1, v2] = await Promise.all([
      this.getVersion(planId, v1Id),
      this.getVersion(planId, v2Id),
    ]);
    const s1 = v1.snapshot as Record<string, any>;
    const s2 = v2.snapshot as Record<string, any>;

    const fieldChanges: Array<{
      field: string;
      from: unknown;
      to: unknown;
    }> = [];

    for (const key of [
      'campaignName',
      'totalBudget',
      'currency',
      'status',
      'fee1Pct',
      'fee2Pct',
      'bufferPct',
      'notes',
    ]) {
      if (JSON.stringify(s1[key]) !== JSON.stringify(s2[key])) {
        fieldChanges.push({ field: key, from: s1[key], to: s2[key] });
      }
    }

    const rows1 = (s1.rows ?? []) as Array<Record<string, unknown>>;
    const rows2 = (s2.rows ?? []) as Array<Record<string, unknown>>;

    return {
      version1: v1.versionNumber,
      version2: v2.versionNumber,
      fieldChanges,
      rowsInV1: rows1.length,
      rowsInV2: rows2.length,
      rowsDiff: rows2.length - rows1.length,
    };
  }

  // ── CRUD ────────────────────────────────────────────────────────

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
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string): Promise<MediaPlan> {
    const plan = await this.planRepo.findOne({
      where: { id },
      relations: ['client', 'product', 'rows', 'rows.benchmark'],
    });
    if (!plan) throw new NotFoundException(`Plan ${id} not found`);
    return plan;
  }

  async create(
    dto: CreatePlanDto,
    userId?: string,
    userEmail?: string,
  ): Promise<MediaPlan> {
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

    if (!saved.referenceNumber) {
      const year = new Date().getFullYear();
      const count = await this.planRepo.count({
        where: { referenceNumber: Like(`JM-${year}-%`) },
      });
      await this.planRepo.update(saved.id, {
        referenceNumber: `JM-${year}-${String(count + 1).padStart(3, '0')}`,
      });
    }

    if (!dto.variantGroupId) {
      await this.planRepo.update(saved.id, { variantGroupId: saved.id });
    }

    if (dto.rows?.length) {
      await this.upsertRows(saved.id, dto.rows);
    }

    const result = await this.findOne(saved.id);

    // Hooks
    this.createVersion(saved.id, 'created', 'Plan created', userId).catch(
      () => {},
    );
    this.auditService.log(
      'plan.created',
      'media_plan',
      saved.id,
      userId ?? null,
      { campaignName: dto.campaignName },
      undefined,
      userEmail,
    );

    return result;
  }

  async update(
    id: string,
    dto: CreatePlanDto,
    userId?: string,
    userEmail?: string,
  ): Promise<MediaPlan> {
    const plan = await this.findOne(id);

    // Snapshot BEFORE applying changes (Task 2: version on every edit)
    const rowCount = (plan.rows ?? []).length;
    const changeSummary = dto.rows !== undefined
      ? `Updated ${dto.rows.length} row${dto.rows.length !== 1 ? 's' : ''}`
      : 'Plan details updated';
    this.createVersion(id, 'rows_updated', changeSummary, userId).catch(() => {});

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

    if (dto.variantGroupId !== undefined) {
      updated.variantGroupId = dto.variantGroupId;
    }

    await this.planRepo.save(updated);

    if (dto.rows !== undefined) {
      await this.rowRepo.delete({ planId: id });
      await this.upsertRows(id, dto.rows ?? []);
    }

    const result = await this.findOne(id);

    this.auditService.log(
      'plan.updated',
      'media_plan',
      id,
      userId ?? null,
      { campaignName: dto.campaignName, rowCount },
      undefined,
      userEmail,
    );

    return result;
  }

  /** Partial update — only merges fields that are provided (Task 7) */
  async partialUpdate(
    id: string,
    dto: Partial<CreatePlanDto>,
    userId?: string,
    userEmail?: string,
  ): Promise<MediaPlan> {
    const plan = await this.findOne(id);

    // Snapshot before applying changes
    this.createVersion(id, 'rows_updated', 'Plan partially updated', userId).catch(() => {});

    const patchFields: Record<string, unknown> = {};
    const scalarKeys = [
      'clientId', 'productId', 'campaignName', 'campaignPeriod', 'startDate',
      'endDate', 'bufferPct', 'totalBudget', 'fee1Pct', 'fee1Label', 'fee2Pct',
      'fee2Label', 'referenceNumber', 'preparedBy', 'currency', 'usdExchangeRate',
      'variantName', 'variantGroupId', 'notes',
    ] as const;

    for (const key of scalarKeys) {
      if (dto[key] !== undefined) {
        patchFields[key] = dto[key];
      }
    }

    if (Object.keys(patchFields).length > 0) {
      await this.planRepo.update(id, patchFields as Parameters<typeof this.planRepo.update>[1]);
    }

    if (dto.rows !== undefined) {
      await this.rowRepo.delete({ planId: id });
      await this.upsertRows(id, dto.rows ?? []);
    }

    const result = await this.findOne(id);

    this.auditService.log(
      'plan.updated',
      'media_plan',
      id,
      userId ?? null,
      { fields: Object.keys(patchFields), campaignName: result.campaignName },
      undefined,
      userEmail,
    );

    return result;
  }

  async delete(id: string, userId?: string): Promise<void> {
    const plan = await this.findOne(id);
    await this.planRepo.delete(id);
    this.auditService.log('plan.deleted', 'media_plan', id, userId ?? null, {
      campaignName: plan.campaignName,
    });
  }

  async updateStatus(
    id: string,
    newStatus: string,
    userRole: string,
    userId?: string,
    userEmail?: string,
  ): Promise<MediaPlan> {
    const plan = await this.findOne(id);
    const oldStatus = plan.status;

    const validTransitions: Record<string, string[]> = {
      draft: ['pending_review'],
      pending_review: ['draft', 'approved'],
      approved: ['sent'],
      sent: [],
    };

    if (!validTransitions[oldStatus]?.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition: ${oldStatus} → ${newStatus}`,
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

    // Version + audit hooks
    this.createVersion(
      id,
      'status_changed',
      `Status changed from ${oldStatus} to ${newStatus}`,
      userId,
    ).catch(() => {});
    this.auditService.log(
      'plan.status_changed',
      'media_plan',
      id,
      userId ?? null,
      {
        oldStatus,
        newStatus,
        campaignName: plan.campaignName,
      },
      undefined,
      userEmail,
    );

    // Email notification
    if (userEmail) {
      this.notifications.sendStatusChanged({
        recipientEmail: userEmail,
        campaignName: plan.campaignName ?? 'Untitled Plan',
        oldStatus,
        newStatus,
        changedBy: userEmail,
      });
    }

    return this.findOne(id);
  }

  async duplicate(planId: string, userId?: string): Promise<MediaPlan> {
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

    // Hooks
    this.createVersion(
      savedPlan.id,
      'duplicated',
      `Duplicated from ${original.referenceNumber ?? original.id}`,
      userId,
    ).catch(() => {});
    this.auditService.log(
      'plan.duplicated',
      'media_plan',
      savedPlan.id,
      userId ?? null,
      { sourceId: planId, sourceName: original.campaignName },
    );

    return this.findOne(savedPlan.id);
  }

  async bulkUpsertRows(
    planId: string,
    rows: Array<Record<string, any>>,
    userId?: string,
  ): Promise<MediaPlan> {
    const plan = await this.planRepo.findOne({ where: { id: planId } });
    if (!plan) throw new NotFoundException(`Plan ${planId} not found`);

    if (!rows || !rows.length) {
      return this.findOne(planId);
    }

    const toCreate = rows.filter((r) => !r.id);
    const toUpdate = rows.filter((r) => r.id);

    if (toUpdate.length) {
      await Promise.all(
        toUpdate.map((r) => {
          const { id, ...updates } = r;
          return this.rowRepo.update({ id, planId }, updates);
        }),
      );
    }

    if (toCreate.length) {
      await this.upsertRows(planId, toCreate as any);
    }

    // Version hook
    const total = toCreate.length + toUpdate.length;
    this.createVersion(
      planId,
      'rows_updated',
      `Updated ${total} row${total !== 1 ? 's' : ''}`,
      userId,
    ).catch(() => {});

    return this.findOne(planId);
  }

  async bulkDeleteRows(planId: string, rowIds: string[]): Promise<MediaPlan> {
    const plan = await this.planRepo.findOne({ where: { id: planId } });
    if (!plan) throw new NotFoundException(`Plan ${planId} not found`);
    await Promise.all(rowIds.map((id) => this.rowRepo.delete({ id, planId })));
    return this.findOne(planId);
  }

  /** Record a version on export (called from ExportController) */
  async recordExport(
    planId: string,
    format: string,
    userId?: string,
  ): Promise<void> {
    this.createVersion(
      planId,
      'exported',
      `Exported as ${format.toUpperCase()}`,
      userId,
    ).catch(() => {});
    this.auditService.log(
      'plan.exported',
      'media_plan',
      planId,
      userId ?? null,
      { format },
    );
  }

  /** Record a version on share (called from controller) */
  async recordShare(planId: string, userId?: string): Promise<void> {
    this.createVersion(planId, 'shared', 'Shared with client', userId).catch(
      () => {},
    );
    this.auditService.log(
      'plan.shared',
      'media_plan',
      planId,
      userId ?? null,
      {},
    );
  }

  // ── Private helpers ─────────────────────────────────────────────

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

    // Fetch plan's buffer percentage for high-estimate reduction
    const plan = await this.planRepo.findOne({ where: { id: planId } });
    const bufferPct = Number(plan?.bufferPct ?? 12);

    const rowEntities = await Promise.all(
      rows.map(async (r, idx) => {
        let projectedKpis = r.projectedKpis ?? {};
        let resolvedBenchmarkId = r.benchmarkId ?? null;

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
            // Apply buffer to high estimates
            if (bufferPct > 0) {
              const factor = 1 - bufferPct / 100;
              const buffered = kpis as unknown as Record<string, unknown>;
              for (const val of Object.values(buffered)) {
                if (
                  val &&
                  typeof val === 'object' &&
                  'high' in (val as Record<string, unknown>) &&
                  typeof (val as Record<string, number>).high === 'number'
                ) {
                  (val as Record<string, number>).high *= factor;
                }
              }
            }
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
