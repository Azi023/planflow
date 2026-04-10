import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { MediaPlan } from './media-plan.entity';

@Entity('plan_versions')
export class PlanVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'plan_id' })
  planId: string;

  @ManyToOne(() => MediaPlan, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'plan_id' })
  plan: MediaPlan;

  @Column({ name: 'version_number', type: 'int' })
  versionNumber: number;

  @Column({ type: 'jsonb' })
  snapshot: Record<string, unknown>;

  @Column({
    name: 'change_type',
    type: 'varchar',
    length: 30,
  })
  changeType: string;

  @Column({
    name: 'change_summary',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  changeSummary: string | null;

  @Column({ name: 'created_by', type: 'varchar', length: 255, nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
