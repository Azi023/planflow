import { Controller, Get } from '@nestjs/common';
import { CreativeTypesService } from './creative-types.service';
import { CreativeType } from '../entities/creative-type.entity';

@Controller('creative-types')
export class CreativeTypesController {
  constructor(private readonly svc: CreativeTypesService) {}

  @Get()
  findAll(): Promise<CreativeType[]> {
    return this.svc.findAll();
  }
}
