import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Benchmark } from './benchmark.entity';

@Entity('benchmark_suggestions')
export class BenchmarkSuggestion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'benchmark_id', type: 'varchar' })
  benchmarkId: string;

  @ManyToOne(() => Benchmark, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'benchmark_id' })
  benchmark: Benchmark;

  // e.g., 'cpmLow', 'cpmHigh', 'cpcLow', 'cpcHigh'
  @Column({ name: 'field_name', length: 50 })
  fieldName: string;

  @Column({
    name: 'current_value',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
  })
  currentValue: number | null;

  @Column({
    name: 'suggested_value',
    type: 'decimal',
    precision: 10,
    scale: 4,
  })
  suggestedValue: number;

  // Average % deviation observed across actuals
  @Column({
    name: 'deviation_pct',
    type: 'decimal',
    precision: 6,
    scale: 2,
  })
  deviationPct: number;

  @Column({ name: 'sample_count', type: 'int' })
  sampleCount: number;

  // 'pending' | 'accepted' | 'rejected'
  @Column({ length: 20, default: 'pending' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'resolved_at', type: 'timestamp', nullable: true })
  resolvedAt: Date | null;
}
