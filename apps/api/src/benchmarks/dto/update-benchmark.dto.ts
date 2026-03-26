import { IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateBenchmarkDto {
  @IsOptional()
  @IsString()
  minDuration?: string;

  @IsOptional()
  @IsString()
  minDailyBudget?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cpmLow?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cpmHigh?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cprLow?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cprHigh?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cpeLow?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cpeHigh?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cpcLow?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cpcHigh?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  ctrLow?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  ctrHigh?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cpv2sLow?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cpv2sHigh?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cpvTvLow?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cpvTvHigh?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cplvLow?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cplvHigh?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cplLow?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cplHigh?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  pageLikeLow?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  pageLikeHigh?: number;

  @IsOptional()
  @IsString()
  frequency?: string;
}
