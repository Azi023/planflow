import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { id } });
  }

  create(data: {
    email: string;
    passwordHash: string;
    name: string;
    role: string;
  }): Promise<User> {
    return this.usersRepo.save(this.usersRepo.create(data));
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.usersRepo.update(id, { lastLogin: new Date() });
  }
}
