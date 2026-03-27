import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('plan_templates')
export class PlanTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'client_id' })
  clientId: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'product_id' })
  productId: string | null;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 15,
    name: 'fee_1_pct',
  })
  fee1Pct: number;

  @Column({
    type: 'varchar',
    length: 100,
    default: 'Management Fee',
    name: 'fee_1_label',
  })
  fee1Label: string;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    name: 'fee_2_pct',
  })
  fee2Pct: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'fee_2_label' })
  fee2Label: string | null;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 12,
    name: 'buffer_pct',
  })
  bufferPct: number;

  @Column({ type: 'varchar', length: 10, default: 'LKR' })
  currency: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'jsonb', default: '[]', name: 'template_rows' })
  templateRows: Record<string, unknown>[];

  @Column({ type: 'varchar', nullable: true, name: 'created_by_id' })
  createdById: string | null;

  @Column({ type: 'boolean', default: false, name: 'is_global' })
  isGlobal: boolean;

  @Column({ type: 'int', default: 0, name: 'use_count' })
  useCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
