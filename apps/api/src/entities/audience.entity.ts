import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('audiences')
export class Audience {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ name: 'audience_type', length: 20, default: 'custom' })
  audienceType: string;

  @Column({ type: 'text', nullable: true })
  location: string | null;

  @Column({ name: 'age_min', type: 'int', nullable: true })
  ageMin: number | null;

  @Column({ name: 'age_max', type: 'int', nullable: true })
  ageMax: number | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  gender: string | null;

  @Column({ type: 'text', nullable: true })
  interests: string | null;

  @Column({ type: 'text', nullable: true })
  behaviors: string | null;

  @Column({ type: 'text', nullable: true })
  demographics: string | null;

  @Column({
    name: 'estimated_size_min',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  estimatedSizeMin: string | null;

  @Column({
    name: 'estimated_size_max',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  estimatedSizeMax: string | null;

  @Column({ name: 'client_id', type: 'varchar', nullable: true })
  clientId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
