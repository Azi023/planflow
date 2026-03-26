import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MediaPlan } from '../entities/media-plan.entity';
import { MediaPlanRow } from '../entities/media-plan-row.entity';
import { Client } from '../entities/client.entity';
import { Product } from '../entities/product.entity';

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

    // Deduplicate by variantGroupId
    const groupMap = new Map<string, MediaPlan[]>();
    for (const plan of allPlans) {
      const key = plan.variantGroupId ?? plan.id;
      const group = groupMap.get(key) ?? [];
      group.push(plan);
      groupMap.set(key, group);
    }

    const uniqueGroups = Array.from(groupMap.values());
    const totalPlans = uniqueGroups.length;

    const plansThisMonth = uniqueGroups.filter((group) => {
      const primary = group[0];
      return primary.createdAt >= monthStart;
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

    const clientSummary: ClientSummaryItem[] = allClients
      .map((client) => {
        const planData = clientPlanData.get(client.id) ?? {
          planCount: 0,
          totalBudget: 0,
        };
        return {
          clientId: client.id,
          clientName: client.name,
          planCount: planData.planCount,
          totalBudget: planData.totalBudget,
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

    const platformBreakdown: PlatformBreakdownItem[] = rows.map((r) => ({
      platform: r.platform,
      planCount: Number(r.planCount),
      totalBudget: Number(r.totalBudget) || 0,
    }));

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
    };
  }
}
