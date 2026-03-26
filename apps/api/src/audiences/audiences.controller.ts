import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { AudiencesService } from './audiences.service';
import { Audience } from '../entities/audience.entity';

@Controller('audiences')
export class AudiencesController {
  constructor(private readonly svc: AudiencesService) {}

  @Get()
  findAll(@Query('clientId') clientId?: string): Promise<Audience[]> {
    return this.svc.findAll(clientId);
  }

  @Post()
  create(@Body() body: Partial<Audience>): Promise<Audience> {
    return this.svc.create(body);
  }
}
