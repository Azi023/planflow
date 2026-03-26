import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreativeType } from '../entities/creative-type.entity';

@Injectable()
export class CreativeTypesService {
  constructor(
    @InjectRepository(CreativeType)
    private readonly repo: Repository<CreativeType>,
  ) {}

  findAll(): Promise<CreativeType[]> {
    return this.repo.find({ order: { name: 'ASC' } });
  }
}
