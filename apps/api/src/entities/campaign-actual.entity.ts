import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MediaPlan } from './media-plan.entity';
import { MediaPlanRow } from './media-plan-row.entity';

@Entity('campaign_actuals')
export class CampaignActual {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'plan_id' })
  planId: string;

  @Column({ name: 'row_id', nullable: true })
  rowId: string | null;

  @Column({ name: 'period_label', nullable: true })
  periodLabel: string | null;

  @Column({ name: 'period_start', type: 'date', nullable: true })
  periodStart: Date | null;

  @Column({ name: 'period_end', type: 'date', nullable: true })
  periodEnd: Date | null;

  @Column({ name: 'actual_impressions', type: 'bigint', nullable: true })
  actualImpressions: number | null;

  @Column({ name: 'actual_reach', type: 'bigint', nullable: true })
  actualReach: number | null;

  @Column({ name: 'actual_clicks', type: 'int', nullable: true })
  actualClicks: number | null;

  @Column({ name: 'actual_engagements', type: 'int', nullable: true })
  actualEngagements: number | null;

  @Column({ name: 'actual_video_views', type: 'int', nullable: true })
  actualVideoViews: number | null;

  @Column({ name: 'actual_leads', type: 'int', nullable: true })
  actualLeads: number | null;

  @Column({ name: 'actual_landing_page_views', type: 'int', nullable: true })
  actualLandingPageViews: number | null;

  @Column({
    name: 'actual_spend',
    type: 'decimal',
    precision: 14,
    scale: 2,
    nullable: true,
  })
  actualSpend: number | null;

  @Column({
    name: 'actual_cpm',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
  })
  actualCpm: number | null;

  @Column({
    name: 'actual_cpc',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
  })
  actualCpc: number | null;

  @Column({
    name: 'actual_ctr',
    type: 'decimal',
    precision: 8,
    scale: 6,
    nullable: true,
  })
  actualCtr: number | null;

  @Column({
    name: 'actual_frequency',
    type: 'decimal',
    precision: 6,
    scale: 2,
    nullable: true,
  })
  actualFrequency: number | null;

  @Column({ default: 'manual' })
  source: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @ManyToOne(() => MediaPlan, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'plan_id' })
  plan: MediaPlan;

  @ManyToOne(() => MediaPlanRow, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'row_id' })
  row: MediaPlanRow;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
