import { Column, CreateDateColumn, Entity, ManyToOne, JoinColumn, PrimaryGeneratedColumn } from 'typeorm';
import { Client } from './client.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'client_id' })
  clientId: string;

  @ManyToOne(() => Client, (client) => client.products)
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @Column({ length: 150 })
  name: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
