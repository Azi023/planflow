import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Benchmark } from './benchmark.entity';

@Entity('benchmark_history')
export class BenchmarkHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'benchmark_id', type: 'varchar' })
  benchmarkId: string;

  @ManyToOne(() => Benchmark, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'benchmark_id' })
  benchmark: Benchmark;

  @Column({ name: 'field_changed', length: 50 })
  fieldChanged: string;

  @Column({ name: 'old_value', type: 'varchar', length: 100, nullable: true })
  oldValue: string | null;

  @Column({ name: 'new_value', type: 'varchar', length: 100, nullable: true })
  newValue: string | null;

  @Column({ name: 'changed_by', type: 'varchar', length: 100, nullable: true })
  changedBy: string | null;

  // 'manual' | 'auto_tune' | 'csv_import'
  @Column({ length: 20, default: 'manual' })
  source: string;

  @CreateDateColumn({ name: 'changed_at' })
  changedAt: Date;
}
