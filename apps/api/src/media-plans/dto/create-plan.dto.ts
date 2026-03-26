import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreatePlanRowDto {
  @IsString()
  platform: string;

  @IsOptional()
  @IsString()
  adType?: string;

  @IsOptional()
  @IsString()
  objective?: string;

  @IsOptional()
  @IsString()
  audienceName?: string;

  @IsOptional()
  @IsString()
  audienceSize?: string;

  @IsOptional()
  @IsString()
  targetingCriteria?: string;

  @IsOptional()
  @IsString()
  creative?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budget?: number;

  @IsOptional()
  @IsString()
  benchmarkId?: string;

  @IsOptional()
  @IsObject()
  projectedKpis?: Record<string, unknown>;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  buyType?: string;

  @IsOptional()
  @IsString()
  platformRangeCpm?: string;

  @IsOptional()
  @IsString()
  platformRangeCpl?: string;

  @IsOptional()
  @IsString()
  audienceType?: string;
}

export class CreatePlanDto {
  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  campaignName?: string;

  @IsOptional()
  @IsString()
  campaignPeriod?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  bufferPct?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalBudget?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  fee1Pct?: number;

  @IsOptional()
  @IsString()
  fee1Label?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  fee2Pct?: number;

  @IsOptional()
  @IsString()
  fee2Label?: string;

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  preparedBy?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  variantName?: string;

  @IsOptional()
  @IsString()
  variantGroupId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePlanRowDto)
  rows?: CreatePlanRowDto[];
}
