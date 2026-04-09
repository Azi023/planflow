import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { PlanTemplate } from '../entities/plan-template.entity';
import { MediaPlan } from '../entities/media-plan.entity';
import { MediaPlanRow } from '../entities/media-plan-row.entity';
import { Benchmark } from '../entities/benchmark.entity';
import { BenchmarksService } from '../benchmarks/benchmarks.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { CreateFromTemplateDto } from './dto/create-from-template.dto';

@Injectable()
export class TemplatesService {
  constructor(
    @InjectRepository(PlanTemplate)
    private readonly templateRepo: Repository<PlanTemplate>,
    @InjectRepository(MediaPlan)
    private readonly planRepo: Repository<MediaPlan>,
    @InjectRepository(MediaPlanRow)
    private readonly rowRepo: Repository<MediaPlanRow>,
    @InjectRepository(Benchmark)
    private readonly benchmarkRepo: Repository<Benchmark>,
    private readonly benchmarksService: BenchmarksService,
  ) {}

  findAll(userId: string): Promise<PlanTemplate[]> {
    return this.templateRepo.find({
      where: [{ createdById: userId }, { isGlobal: true }],
      order: { useCount: 'DESC', createdAt: 'DESC' },
    });
  }

  findOne(id: string): Promise<PlanTemplate | null> {
    return this.templateRepo.findOne({ where: { id } });
  }

  async create(dto: CreateTemplateDto, userId: string): Promise<PlanTemplate> {
    const rows: Record<string, unknown>[] = (dto.templateRows ?? []).map(
      (r) => ({
        platform: r.platform,
        objective: r.objective,
        audienceType: r.audienceType,
        audienceName: r.audienceName,
        audienceSize: r.audienceSize,
        targetingCriteria: r.targetingCriteria,
        creative: r.creative,
        country: r.country,
        buyType: r.buyType,
        budgetPct: r.budgetPct,
      }),
    );
    const template = new PlanTemplate();
    template.name = dto.name;
    template.description = dto.description ?? null;
    template.category = dto.category ?? null;
    template.isGlobal = dto.isGlobal ?? false;
    template.templateRows = rows;
    template.createdById = userId;
    return this.templateRepo.save(template);
  }

  async createFromPlan(
    planId: string,
    userId: string,
    name: string,
    description?: string,
    category?: string,
    isGlobal?: boolean,
  ): Promise<PlanTemplate> {
    const plan = await this.planRepo.findOne({ where: { id: planId } });
    if (!plan) throw new NotFoundException(`Plan ${planId} not found`);

    const rows = await this.rowRepo.find({
      where: { planId },
      order: { sortOrder: 'ASC' },
    });

    const totalRowBudget = rows.reduce(
      (s, r) => s + (Number(r.budget) || 0),
      0,
    );

    const templateRows = rows.map((r) => ({
      platform: r.platform,
      objective: r.objective,
      audienceType: r.audienceType,
      audienceName: r.audienceName,
      audienceSize: r.audienceSize,
      targetingCriteria: r.targetingCriteria,
      creative: r.creative,
      country: r.country,
      buyType: r.buyType,
      budgetPct:
        totalRowBudget > 0
          ? Math.round(((Number(r.budget) || 0) / totalRowBudget) * 10000) / 100
          : 0,
    }));

    const template = this.templateRepo.create({
      name,
      description: description ?? null,
      category: category ?? null,
      clientId: plan.clientId,
      productId: plan.productId,
      fee1Pct: plan.fee1Pct,
      fee1Label: plan.fee1Label,
      fee2Pct: plan.fee2Pct,
      fee2Label: plan.fee2Label,
      bufferPct: plan.bufferPct,
      currency: plan.currency,
      notes: plan.notes,
      templateRows,
      createdById: userId,
      isGlobal: isGlobal ?? false,
    });

    return this.templateRepo.save(template);
  }

  async useTemplate(
    templateId: string,
    dto: CreateFromTemplateDto,
    userId: string,
  ): Promise<MediaPlan> {
    const template = await this.templateRepo.findOne({
      where: { id: templateId },
    });
    if (!template)
      throw new NotFoundException(`Template ${templateId} not found`);

    const fee1 = Number(template.fee1Pct ?? 15) / 100;
    const fee2 = Number(template.fee2Pct ?? 0) / 100;
    const totalFee = fee1 + fee2;
    const mediaSpend =
      totalFee > 0 ? dto.totalBudget / (1 + totalFee) : dto.totalBudget;

    const year = new Date().getFullYear();
    const count = await this.planRepo.count({
      where: { referenceNumber: Like(`JM-${year}-%`) },
    });
    const refNumber = `JM-${year}-${String(count + 1).padStart(3, '0')}`;

    const plan = this.planRepo.create({
      clientId: dto.clientId ?? template.clientId,
      productId: dto.productId ?? template.productId,
      campaignName: dto.campaignName,
      totalBudget: dto.totalBudget,
      startDate: dto.startDate ?? null,
      endDate: dto.endDate ?? null,
      fee1Pct: template.fee1Pct,
      fee1Label: template.fee1Label,
      fee2Pct: template.fee2Pct,
      fee2Label: template.fee2Label,
      bufferPct: template.bufferPct,
      currency: dto.currency ?? template.currency,
      notes: template.notes,
      variantName: 'Option 1',
      status: 'draft',
      referenceNumber: refNumber,
      preparedBy: userId,
    });

    const savedPlan = await this.planRepo.save(plan);
    await this.planRepo.update(savedPlan.id, {
      variantGroupId: savedPlan.id,
    });

    const rows = await Promise.all(
      template.templateRows.map(async (tr, idx) => {
        const rowBudget = Math.round(
          mediaSpend * ((tr.budgetPct as number) / 100),
        );

        // Resolve benchmark and compute KPIs
        let benchmarkId: string | null = null;
        let projectedKpis: Record<string, unknown> = {};
        const platform = tr.platform as string;
        const objective = tr.objective as string;
        const audienceType = tr.audienceType as string;

        if (platform && objective && audienceType) {
          const normPlatform = this.normalizePlatform(platform);
          const normObjective = objective.trim().toLowerCase();
          const normAudience = audienceType.trim().toLowerCase();
          const matched = await this.benchmarkRepo.findOne({
            where: {
              platform: normPlatform,
              objective: normObjective,
              audienceType: normAudience,
            },
          });
          if (matched) {
            benchmarkId = matched.id;
            if (rowBudget > 0) {
              projectedKpis = this.benchmarksService.computeKpis(
                matched,
                rowBudget,
              ) as unknown as Record<string, unknown>;
            }
          }
        }

        return this.rowRepo.create({
          planId: savedPlan.id,
          platform,
          objective: objective ?? null,
          audienceType: audienceType ?? null,
          audienceName: (tr.audienceName as string) ?? null,
          audienceSize: (tr.audienceSize as string) ?? null,
          targetingCriteria: (tr.targetingCriteria as string) ?? null,
          creative: (tr.creative as string) ?? null,
          country: (tr.country as string) ?? null,
          buyType: (tr.buyType as string) ?? null,
          budget: rowBudget,
          benchmarkId,
          sortOrder: idx,
          projectedKpis,
        });
      }),
    );

    if (rows.length) {
      await this.rowRepo.save(rows);
    }

    await this.templateRepo.increment({ id: templateId }, 'useCount', 1);

    const result = await this.planRepo.findOne({
      where: { id: savedPlan.id },
      relations: ['client', 'product', 'rows'],
    });
    return result!;
  }

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

  async delete(id: string, userId: string, userRole: string): Promise<void> {
    const template = await this.templateRepo.findOne({ where: { id } });
    if (!template) throw new NotFoundException(`Template ${id} not found`);
    if (template.createdById !== userId && userRole !== 'admin') {
      throw new NotFoundException(`Template ${id} not found`);
    }
    await this.templateRepo.delete(id);
  }
}
