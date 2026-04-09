import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { MediaPlan } from '../entities/media-plan.entity';
import { MediaPlanRow } from '../entities/media-plan-row.entity';
import { Client } from '../entities/client.entity';
import { Product } from '../entities/product.entity';
import { CampaignActual } from '../entities/campaign-actual.entity';

export interface RecentPlan {
  id: string;
  campaignName: string | null;
  clientName: string | null;
  productName: string | null;
  totalBudget: number | null;
  currency: string;
  status: string;
  createdAt: Date;
  variantCount: number;
}

export interface ClientSummaryItem {
  clientId: string;
  clientName: string;
  planCount: number;
  totalBudget: number;
  productCount: number;
}

export interface PlatformBreakdownItem {
  platform: string;
  planCount: number;
  totalBudget: number;
}

export interface CampaignDeliveryItem {
  planId: string;
  variantGroupId: string;
  campaignName: string | null;
  clientName: string | null;
  status: string;
  deliveryPct: number | null;
  hasActuals: boolean;
}

export interface DashboardStats {
  totalClients: number;
  totalProducts: number;
  totalPlans: number;
  plansThisMonth: number;
  totalBudgetAllocated: number;
  currency: string;
  recentPlans: RecentPlan[];
  clientSummary: ClientSummaryItem[];
  platformBreakdown: PlatformBreakdownItem[];
  campaignDelivery: CampaignDeliveryItem[];
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(MediaPlan)
    private readonly planRepo: Repository<MediaPlan>,
    @InjectRepository(MediaPlanRow)
    private readonly rowRepo: Repository<MediaPlanRow>,
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(CampaignActual)
    private readonly actualRepo: Repository<CampaignActual>,
  ) {}

  async getStats(): Promise<DashboardStats> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalClients, totalProducts] = await Promise.all([
      this.clientRepo.count(),
      this.productRepo.count(),
    ]);

    // Count unique plan groups (each group = one campaign)
    const allPlans = await this.planRepo.find({
      relations: ['client', 'product'],
      order: { createdAt: 'DESC' },
    });

    // Deduplicate by variantGroupId, exclude placeholder plans
    const groupMap = new Map<string, MediaPlan[]>();
    for (const plan of allPlans) {
      if (plan.campaignName?.includes('Meta Historical Actuals')) continue;
      const key = plan.variantGroupId ?? plan.id;
      const group = groupMap.get(key) ?? [];
      group.push(plan);
      groupMap.set(key, group);
    }

    const uniqueGroups = Array.from(groupMap.values());
    const totalPlans = uniqueGroups.length;

    const plansThisMonth = uniqueGroups.filter((group) => {
      const primary = group[0];
      // Use startDate if available (more accurate for imported plans),
      // otherwise fall back to createdAt
      const relevantDate = primary.startDate
        ? new Date(primary.startDate)
        : primary.createdAt;
      return relevantDate >= monthStart;
    }).length;

    const totalBudgetAllocated = uniqueGroups.reduce((sum, group) => {
      const primary = group[0];
      return sum + (Number(primary.totalBudget) || 0);
    }, 0);

    // Recent plans — up to 5 unique groups
    const recentPlans: RecentPlan[] = uniqueGroups.slice(0, 5).map((group) => {
      const primary = group[0];
      return {
        id: primary.variantGroupId ?? primary.id,
        campaignName: primary.campaignName,
        clientName: primary.client?.name ?? null,
        productName: primary.product?.name ?? null,
        totalBudget: primary.totalBudget ? Number(primary.totalBudget) : null,
        currency: primary.currency,
        status: primary.status,
        createdAt: primary.createdAt,
        variantCount: group.length,
      };
    });

    // Client summary — include ALL clients, even those with 0 plans
    const [allClients, allProducts] = await Promise.all([
      this.clientRepo.find({ order: { name: 'ASC' } }),
      this.productRepo.find(),
    ]);

    const productCountByClient = new Map<string, number>();
    for (const p of allProducts) {
      productCountByClient.set(
        p.clientId,
        (productCountByClient.get(p.clientId) ?? 0) + 1,
      );
    }

    const clientPlanData = new Map<
      string,
      { planCount: number; totalBudget: number }
    >();
    for (const group of uniqueGroups) {
      const primary = group[0];
      if (!primary.clientId) continue;
      const entry = clientPlanData.get(primary.clientId) ?? {
        planCount: 0,
        totalBudget: 0,
      };
      entry.planCount += 1;
      entry.totalBudget += Number(primary.totalBudget) || 0;
      clientPlanData.set(primary.clientId, entry);
    }

    // Aggregate actual spend per client from campaign_actuals
    const actualsSpendByClient = new Map<string, number>();
    const actualsRows = await this.actualRepo
      .createQueryBuilder('a')
      .innerJoin('a.plan', 'plan')
      .select('plan.client_id', 'clientId')
      .addSelect('SUM(CAST(a.actual_spend AS numeric))', 'totalSpend')
      .where('a.actual_spend IS NOT NULL')
      .andWhere('plan.client_id IS NOT NULL')
      .groupBy('plan.client_id')
      .getRawMany<{ clientId: string; totalSpend: string }>();
    for (const row of actualsRows) {
      actualsSpendByClient.set(row.clientId, Number(row.totalSpend) || 0);
    }

    const clientSummary: ClientSummaryItem[] = allClients
      .map((client) => {
        const planData = clientPlanData.get(client.id) ?? {
          planCount: 0,
          totalBudget: 0,
        };
        const actualSpend = actualsSpendByClient.get(client.id) ?? 0;
        // Use plan budget if available, otherwise fall back to actual spend
        const budget =
          planData.totalBudget > 0 ? planData.totalBudget : actualSpend;
        return {
          clientId: client.id,
          clientName: client.name,
          planCount: planData.planCount,
          totalBudget: budget,
          productCount: productCountByClient.get(client.id) ?? 0,
        };
      })
      .sort(
        (a, b) =>
          b.totalBudget - a.totalBudget ||
          a.clientName.localeCompare(b.clientName),
      );

    // Platform breakdown from rows
    const rows = await this.rowRepo
      .createQueryBuilder('row')
      .select('row.platform', 'platform')
      .addSelect('COUNT(DISTINCT row.plan_id)', 'planCount')
      .addSelect('SUM(CAST(row.budget AS numeric))', 'totalBudget')
      .where('row.budget IS NOT NULL')
      .groupBy('row.platform')
      .orderBy('"totalBudget"', 'DESC')
      .getRawMany<{
        platform: string;
        planCount: string;
        totalBudget: string;
      }>();

    // Aggregate rows that share the same platform
    const platformMap = new Map<string, PlatformBreakdownItem>();
    for (const r of rows) {
      const existing = platformMap.get(r.platform);
      if (existing) {
        existing.planCount += Number(r.planCount);
        existing.totalBudget += Number(r.totalBudget) || 0;
      } else {
        platformMap.set(r.platform, {
          platform: r.platform,
          planCount: Number(r.planCount),
          totalBudget: Number(r.totalBudget) || 0,
        });
      }
    }
    const platformBreakdown = Array.from(platformMap.values()).sort(
      (a, b) => b.totalBudget - a.totalBudget,
    );

    // Campaign delivery for approved/sent plans
    const activePlans = await this.planRepo.find({
      where: { status: In(['approved', 'sent']) },
      relations: ['client', 'rows'],
    });

    // Filter out placeholder plans from campaign delivery
    const realActivePlans = activePlans.filter(
      (p) => !p.campaignName?.includes('Meta Historical Actuals'),
    );

    const campaignDelivery: CampaignDeliveryItem[] = await Promise.all(
      realActivePlans.map(async (plan) => {
        const actuals = await this.actualRepo.find({
          where: { planId: plan.id },
        });

        const totalActualImpressions = actuals.reduce(
          (s, a) => s + Number(a.actualImpressions ?? 0),
          0,
        );

        const projectedLow = (plan.rows ?? []).reduce((s, r) => {
          const kpis = r.projectedKpis as Record<
            string,
            { low?: number; high?: number }
          > | null;
          return s + Number(kpis?.impressions?.low ?? 0);
        }, 0);

        return {
          planId: plan.id,
          variantGroupId: plan.variantGroupId ?? plan.id,
          campaignName: plan.campaignName,
          clientName: plan.client?.name ?? null,
          status: plan.status,
          deliveryPct:
            projectedLow > 0
              ? Math.round((totalActualImpressions / projectedLow) * 100)
              : null,
          hasActuals: actuals.length > 0,
        };
      }),
    );

    return {
      totalClients,
      totalProducts,
      totalPlans,
      plansThisMonth,
      totalBudgetAllocated,
      currency: 'LKR',
      recentPlans,
      clientSummary,
      platformBreakdown,
      campaignDelivery: campaignDelivery.slice(0, 15),
    };
  }
}
