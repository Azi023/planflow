import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from '../entities/client.entity';
import { Product } from '../entities/product.entity';

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  findAllClients(): Promise<Client[]> {
    return this.clientRepo.find({ relations: ['products'], order: { name: 'ASC' } });
  }

  findProductsByClient(clientId: string): Promise<Product[]> {
    return this.productRepo.find({ where: { clientId }, order: { name: 'ASC' } });
  }
}
