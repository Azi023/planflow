import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ClientsService } from './clients.service';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  findAll() {
    return this.clientsService.findAllClients();
  }

  @Get(':id/products')
  findProducts(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientsService.findProductsByClient(id);
  }
}
