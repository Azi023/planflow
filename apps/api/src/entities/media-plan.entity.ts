import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Client } from './client.entity';
import { Product } from './product.entity';
import { MediaPlanRow } from './media-plan-row.entity';

@Entity('media_plans')
export class MediaPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'client_id', type: 'varchar', nullable: true })
  clientId: string | null;

  @ManyToOne(() => Client, { nullable: true })
  @JoinColumn({ name: 'client_id' })
  client: Client | null;

  @Column({ name: 'product_id', type: 'varchar', nullable: true })
  productId: string | null;

  @ManyToOne(() => Product, { nullable: true })
  @JoinColumn({ name: 'product_id' })
  product: Product | null;

  @Column({
    name: 'campaign_name',
    type: 'varchar',
    length: 200,
    nullable: true,
  })
  campaignName: string | null;

  @Column({
    name: 'campaign_period',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  campaignPeriod: string | null;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: string | null;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: string | null;

  @Column({
    name: 'buffer_pct',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 12,
  })
  bufferPct: number;

  @Column({
    name: 'total_budget',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  totalBudget: number | null;

  @Column({
    name: 'management_fee_pct',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 15,
  })
  fee1Pct: number;

  @Column({ name: 'fee_1_label', length: 50, default: 'Management Fee' })
  fee1Label: string;

  @Column({
    name: 'fee_2_pct',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  fee2Pct: number | null;

  @Column({ name: 'fee_2_label', type: 'varchar', length: 50, nullable: true })
  fee2Label: string | null;

  @Column({
    name: 'reference_number',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  referenceNumber: string | null;

  @Column({ name: 'prepared_by', type: 'varchar', length: 100, nullable: true })
  preparedBy: string | null;

  @Column({ length: 3, default: 'LKR' })
  currency: string;

  @Column({ name: 'variant_name', length: 50, default: 'Option 1' })
  variantName: string;

  @Column({ name: 'variant_group_id', type: 'uuid', nullable: true })
  variantGroupId: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ length: 20, default: 'draft' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => MediaPlanRow, (row) => row.plan, { cascade: true })
  rows: MediaPlanRow[];
}
