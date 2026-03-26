import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Audience } from '../entities/audience.entity';

@Injectable()
export class AudiencesService {
  constructor(
    @InjectRepository(Audience)
    private readonly repo: Repository<Audience>,
  ) {}

  findAll(clientId?: string): Promise<Audience[]> {
    const where = clientId
      ? [{ clientId }, { clientId: IsNull() }]
      : [{ clientId: IsNull() }];
    return this.repo.find({ where, order: { name: 'ASC' } });
  }

  create(data: Partial<Audience>): Promise<Audience> {
    return this.repo.save(this.repo.create(data));
  }
}
