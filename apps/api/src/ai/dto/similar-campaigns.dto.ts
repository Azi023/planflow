import { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';

export class SimilarCampaignsDto {
  @IsString()
  objective: string;

  @IsString()
  @IsOptional()
  clientIndustry?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  budget?: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsString()
  @IsOptional()
  audienceType?: string;

  @IsString()
  @IsOptional()
  platforms?: string; // comma-separated list

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(5)
  limit?: number; // how many similar campaigns to return, default 3
}

export interface SimilarCampaign {
  planId: string;
  campaignName: string;
  clientName: string;
  objective: string;
  budget: number;
  currency: string;
  platforms: string[];
  similarityReason: string; // why Claude thinks it's similar
}

export interface SimilarCampaignsResult {
  campaigns: SimilarCampaign[];
  insight: string; // 1-2 sentence summary of common patterns
}
