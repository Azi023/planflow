import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CalculateKpiDto {
  @IsString()
  platform: string;

  @IsString()
  @IsIn(['awareness', 'engagement', 'traffic', 'leads'])
  objective: string;

  @IsString()
  @IsIn(['mass', 'niche'])
  audienceType: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budget: number;

  @IsOptional()
  @IsString()
  @IsIn(['LKR', 'USD'])
  currency?: string;
}
