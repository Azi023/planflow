import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('benchmarks')
export class Benchmark {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'audience_type', length: 20 })
  audienceType: string; // 'mass' | 'niche'

  @Column({ length: 20 })
  objective: string; // 'awareness' | 'engagement' | 'traffic' | 'leads'

  @Column({ length: 50 })
  platform: string; // 'meta_ig' | 'meta' | 'ig' | 'ig_follower' | ...

  @Column({ name: 'min_duration', type: 'varchar', length: 50, nullable: true })
  minDuration: string | null;

  @Column({
    name: 'min_daily_budget',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  minDailyBudget: string | null;

  @Column({ length: 3, default: 'LKR' })
  currency: string;

  @Column({
    name: 'cpm_low',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
  })
  cpmLow: number | null;

  @Column({
    name: 'cpm_high',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
  })
  cpmHigh: number | null;

  @Column({
    name: 'cpr_low',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
  })
  cprLow: number | null;

  @Column({
    name: 'cpr_high',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
  })
  cprHigh: number | null;

  @Column({
    name: 'cpe_low',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
  })
  cpeLow: number | null;

  @Column({
    name: 'cpe_high',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
  })
  cpeHigh: number | null;

  @Column({
    name: 'cpc_low',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
  })
  cpcLow: number | null;

  @Column({
    name: 'cpc_high',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
  })
  cpcHigh: number | null;

  @Column({
    name: 'ctr_low',
    type: 'decimal',
    precision: 8,
    scale: 6,
    nullable: true,
  })
  ctrLow: number | null;

  @Column({
    name: 'ctr_high',
    type: 'decimal',
    precision: 8,
    scale: 6,
    nullable: true,
  })
  ctrHigh: number | null;

  @Column({
    name: 'cpv_2s_low',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
  })
  cpv2sLow: number | null;

  @Column({
    name: 'cpv_2s_high',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
  })
  cpv2sHigh: number | null;

  @Column({
    name: 'cpv_tv_low',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
  })
  cpvTvLow: number | null;

  @Column({
    name: 'cpv_tv_high',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
  })
  cpvTvHigh: number | null;

  @Column({
    name: 'cplv_low',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
  })
  cplvLow: number | null;

  @Column({
    name: 'cplv_high',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
  })
  cplvHigh: number | null;

  @Column({
    name: 'cpl_low',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
  })
  cplLow: number | null;

  @Column({
    name: 'cpl_high',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
  })
  cplHigh: number | null;

  @Column({
    name: 'page_like_low',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
  })
  pageLikeLow: number | null;

  @Column({
    name: 'page_like_high',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
  })
  pageLikeHigh: number | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  frequency: string | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
