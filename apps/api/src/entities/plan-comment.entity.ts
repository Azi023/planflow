import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { MediaPlan } from './media-plan.entity';

@Entity('plan_comments')
export class PlanComment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'plan_id', type: 'varchar' })
  planId: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'author_name', type: 'varchar', length: 200 })
  authorName: string;

  @Column({ name: 'author_email', type: 'varchar', length: 200, nullable: true })
  authorEmail: string | null;

  @Column({ name: 'is_client', type: 'boolean', default: true })
  isClient: boolean;

  @Column({ name: 'is_read', type: 'boolean', default: false })
  isRead: boolean;

  @ManyToOne(() => MediaPlan, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'plan_id' })
  plan: MediaPlan;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
