import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('creative_types')
export class CreativeType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 50, default: 'static' })
  category: string;
}
