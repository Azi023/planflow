import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Product } from './product.entity';

@Entity('clients')
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 150 })
  name: string;

  @Column({
    name: 'default_fee_1_pct',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 15,
  })
  defaultFee1Pct: number;

  @Column({
    name: 'default_fee_1_label',
    length: 50,
    default: 'Management Fee',
  })
  defaultFee1Label: string;

  @Column({
    name: 'default_fee_2_pct',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  defaultFee2Pct: number | null;

  @Column({
    name: 'default_fee_2_label',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  defaultFee2Label: string | null;

  @Column({ name: 'default_currency', length: 3, default: 'LKR' })
  defaultCurrency: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => Product, (product) => product.client)
  products: Product[];
}
