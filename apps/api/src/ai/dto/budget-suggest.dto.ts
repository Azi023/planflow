import { IsString, IsNumber, IsOptional, IsIn, Min } from 'class-validator';

export class BudgetSuggestDto {
  @IsString()
  objective: string; // 'awareness' | 'engagement' | 'traffic' | 'leads'

  @IsString()
  audienceType: string; // 'mass' | 'niche'

  @IsNumber()
  @Min(1)
  budget: number;

  @IsString()
  @IsIn(['LKR', 'USD'])
  currency: string;

  @IsString()
  @IsOptional()
  audienceDescription?: string; // e.g. "Sri Lankan women 25-45 interested in banking"

  @IsString()
  @IsOptional()
  campaignPeriod?: string; // e.g. "1 Month"

  @IsString()
  @IsOptional()
  clientIndustry?: string; // e.g. "Banking", "FMCG"

  @IsString()
  @IsOptional()
  notes?: string; // any extra context from the planner
}

export interface PlatformAllocation {
  platform: string;         // e.g. 'meta_ig'
  platformLabel: string;    // e.g. 'Meta + Instagram'
  objective: string;
  audienceType: string;
  budgetPct: number;        // 0-100
  budgetAmount: number;     // in plan currency
  rationale: string;        // why this platform was chosen
  expectedImpressions?: { low: number; high: number };
  expectedReach?: { low: number; high: number };
  expectedClicks?: { low: number; high: number };
}

export interface BudgetSuggestionResult {
  summary: string;          // 1-2 sentence executive summary
  allocations: PlatformAllocation[];
  strategicNotes: string;   // markdown, key caveats and recommendations
  totalBudget: number;
  currency: string;
  generatedAt: string;
}
