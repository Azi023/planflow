import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Anthropic from '@anthropic-ai/sdk';
import { Benchmark } from '../entities/benchmark.entity';
import { MediaPlan } from '../entities/media-plan.entity';
import { MediaPlanRow } from '../entities/media-plan-row.entity';
import {
  BudgetSuggestDto,
  BudgetSuggestionResult,
  PlatformAllocation,
} from './dto/budget-suggest.dto';
import {
  SimilarCampaignsDto,
  SimilarCampaignsResult,
} from './dto/similar-campaigns.dto';

const PLATFORM_LABELS: Record<string, string> = {
  meta_ig: 'Meta + Instagram',
  meta: 'Meta (Facebook)',
  ig: 'Instagram',
  ig_follower: 'Instagram Followers',
  meta_page_like: 'Meta Page Likes',
  gdn: 'Google Display Network',
  youtube_video: 'YouTube Video Views',
  youtube_bumper: 'YouTube Bumper Ads',
  search: 'Google Search',
  demand_gen: 'Google Demand Gen',
  perf_max: 'Google Performance Max',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
};

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private client: Anthropic | null = null;

  constructor(
    private configService: ConfigService,
    @InjectRepository(Benchmark)
    private benchmarkRepo: Repository<Benchmark>,
    @InjectRepository(MediaPlan)
    private planRepo: Repository<MediaPlan>,
    @InjectRepository(MediaPlanRow)
    private planRowRepo: Repository<MediaPlanRow>,
  ) {
    const key = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (key && !key.includes('YOUR_KEY_HERE')) {
      this.client = new Anthropic({ apiKey: key });
    } else {
      this.logger.warn(
        'ANTHROPIC_API_KEY not set — AI features will return an error until configured',
      );
    }
  }

  private ensureClient(): Anthropic {
    if (!this.client) {
      throw new Error(
        'AI features are not configured. Add ANTHROPIC_API_KEY to the API .env file.',
      );
    }
    return this.client;
  }

  async suggestBudgetAllocation(
    dto: BudgetSuggestDto,
  ): Promise<BudgetSuggestionResult> {
    const claude = this.ensureClient();

    // Load relevant benchmarks for the objective + audience type
    const benchmarks = await this.benchmarkRepo.find({
      where: {
        objective: dto.objective,
        audienceType: dto.audienceType,
      },
    });

    // Format benchmarks as concise context for Claude
    const benchmarkContext = benchmarks
      .map((b) => {
        const label = PLATFORM_LABELS[b.platform] ?? b.platform;
        const metrics: string[] = [];
        if (b.cpmLow && b.cpmHigh)
          metrics.push(
            `CPM ${b.cpmLow}–${b.cpmHigh} ${b.currency}`,
          );
        if (b.cpcLow && b.cpcHigh)
          metrics.push(
            `CPC ${b.cpcLow}–${b.cpcHigh} ${b.currency}`,
          );
        if (b.cplLow && b.cplHigh)
          metrics.push(
            `CPL ${b.cplLow}–${b.cplHigh} ${b.currency}`,
          );
        return `- ${label}: ${metrics.join(', ')}${b.minDailyBudget ? ` | Min daily: ${b.minDailyBudget}` : ''}`;
      })
      .join('\n');

    const systemPrompt = `You are an expert digital media planner for a Sri Lankan advertising agency (Jasmin Media / DC Group). You help planners allocate campaign budgets across platforms based on industry benchmarks and campaign objectives.

You always respond with a JSON object following the exact schema provided. Your suggestions are data-driven, referencing the benchmark rates provided. You are honest when data is limited.`;

    const userPrompt = `Given the following campaign brief and benchmark data, suggest a budget allocation across platforms.

## Campaign Brief
- Objective: ${dto.objective}
- Audience type: ${dto.audienceType === 'mass' ? 'Mass (1M+ reach)' : 'Niche (under 1M reach)'}
- Total budget: ${dto.currency} ${dto.budget.toLocaleString()}
- Campaign period: ${dto.campaignPeriod ?? 'Not specified'}
- Client industry: ${dto.clientIndustry ?? 'Not specified'}
- Target audience: ${dto.audienceDescription ?? 'Not specified'}
- Planner notes: ${dto.notes ?? 'None'}

## Available Benchmark Rates (${dto.objective} / ${dto.audienceType})
${benchmarkContext || 'No benchmark data available for this combination.'}

## Instructions
Return a JSON object with this exact shape:
{
  "summary": "1-2 sentence executive summary of the strategy",
  "allocations": [
    {
      "platform": "platform_key",
      "platformLabel": "Human readable name",
      "objective": "${dto.objective}",
      "audienceType": "${dto.audienceType}",
      "budgetPct": 40,
      "budgetAmount": 400000,
      "rationale": "Why this platform and allocation percentage"
    }
  ],
  "strategicNotes": "Markdown text with key recommendations and caveats",
  "totalBudget": ${dto.budget},
  "currency": "${dto.currency}"
}

Rules:
- budgetPct values must sum to 100
- budgetAmount = totalBudget × (budgetPct / 100)
- Only suggest platforms that have benchmark data unless there is a compelling reason
- Keep allocations to 2–4 platforms maximum for focus
- Be honest about limitations if the budget is too low for a platform (reference minDailyBudget)
- Use platform keys exactly: meta_ig, meta, ig, gdn, youtube_video, youtube_bumper, search, demand_gen, perf_max, tiktok, linkedin`;

    const response = await claude.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    });

    const text =
      response.content[0].type === 'text' ? response.content[0].text : '';

    // Extract JSON from response (Claude sometimes wraps in markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Claude returned an unexpected response format');
    }

    const parsed = JSON.parse(jsonMatch[0]) as Omit<
      BudgetSuggestionResult,
      'generatedAt'
    >;

    return {
      ...parsed,
      generatedAt: new Date().toISOString(),
    };
  }

  async findSimilarCampaigns(
    dto: SimilarCampaignsDto,
  ): Promise<SimilarCampaignsResult> {
    const claude = this.ensureClient();
    const limit = dto.limit ?? 3;

    // Load recent plans with their rows (last 200 to keep prompt manageable)
    const plans = await this.planRepo.find({
      relations: ['client', 'product', 'rows'],
      order: { createdAt: 'DESC' },
      take: 200,
    });

    if (plans.length === 0) {
      return {
        campaigns: [],
        insight: 'No past campaigns found. Save some plans to enable similarity search.',
      };
    }

    // Build a compact plan summary for each plan
    const planSummaries = plans.map((p) => {
      const platformSet = new Set(
        (p.rows ?? []).map((r) => PLATFORM_LABELS[r.platform] ?? r.platform),
      );
      return {
        id: p.id,
        name: p.campaignName ?? 'Unnamed plan',
        client: p.client?.name ?? 'Unknown client',
        objective: p.rows?.[0]?.objective ?? 'unknown',
        budget: Number(p.totalBudget ?? 0),
        currency: p.currency ?? 'LKR',
        platforms: [...platformSet],
        period: p.campaignPeriod ?? '',
      };
    });

    const systemPrompt = `You are an expert digital media planner. You analyze past campaigns and find the most similar ones to a new campaign brief. You always respond with JSON.`;

    const userPrompt = `Find the ${limit} most similar past campaigns to this new campaign brief.

## New Campaign Brief
- Objective: ${dto.objective}
- Client industry: ${dto.clientIndustry ?? 'Not specified'}
- Budget: ${dto.currency ?? 'LKR'} ${dto.budget?.toLocaleString() ?? 'Not specified'}
- Audience type: ${dto.audienceType ?? 'Not specified'}
- Platforms in mind: ${dto.platforms ?? 'Not specified'}

## Past Campaign Library (${planSummaries.length} plans)
${JSON.stringify(planSummaries.slice(0, 100), null, 0)}

## Instructions
Return a JSON object with this exact shape:
{
  "campaigns": [
    {
      "planId": "uuid-here",
      "campaignName": "Name",
      "clientName": "Client",
      "objective": "awareness",
      "budget": 500000,
      "currency": "LKR",
      "platforms": ["Meta + Instagram"],
      "similarityReason": "Why this is similar to the new brief"
    }
  ],
  "insight": "1-2 sentence summary of common patterns across similar campaigns"
}

Only return plans that genuinely match. If fewer than ${limit} plans are truly similar, return fewer. Use the exact planId from the library.`;

    const response = await claude.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    });

    const text =
      response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Claude returned an unexpected response format');
    }

    return JSON.parse(jsonMatch[0]) as SimilarCampaignsResult;
  }
}
