import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { MediaPlan } from './media-plan.entity';
import { Benchmark } from './benchmark.entity';

@Entity('media_plan_rows')
export class MediaPlanRow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'plan_id' })
  planId: string;

  @ManyToOne(() => MediaPlan, (plan) => plan.rows, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'plan_id' })
  plan: MediaPlan;

  @Column({ length: 50 })
  platform: string;

  @Column({
    name: 'audience_type',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  audienceType: string | null;

  @Column({ name: 'ad_type', type: 'varchar', length: 50, nullable: true })
  adType: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  objective: string | null;

  @Column({
    name: 'audience_name',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  audienceName: string | null;

  @Column({
    name: 'audience_size',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  audienceSize: string | null;

  @Column({ name: 'targeting_criteria', type: 'text', nullable: true })
  targetingCriteria: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  creative: string | null;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  budget: number | null;

  @Column({ name: 'benchmark_id', type: 'varchar', nullable: true })
  benchmarkId: string | null;

  @ManyToOne(() => Benchmark, { nullable: true })
  @JoinColumn({ name: 'benchmark_id' })
  benchmark: Benchmark | null;

  @Column({ name: 'projected_kpis', type: 'jsonb', default: '{}' })
  projectedKpis: Record<string, unknown>;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  country: string | null;

  @Column({ name: 'buy_type', type: 'varchar', length: 50, nullable: true })
  buyType: string | null;

  @Column({
    name: 'video_views_low',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  videoViewsLow: number | null;

  @Column({
    name: 'video_views_high',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  videoViewsHigh: number | null;

  @Column({
    name: 'cpm_used',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
  })
  cpmUsed: number | null;

  @Column({
    name: 'percentage',
    type: 'decimal',
    precision: 6,
    scale: 2,
    nullable: true,
  })
  percentage: number | null;

  @Column({
    name: 'platform_range_cpm',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  platformRangeCpm: string | null;

  @Column({
    name: 'platform_range_cpl',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  platformRangeCpl: string | null;
}
