import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { CreateFromTemplateDto } from './dto/create-from-template.dto';

// JWT strategy returns { sub, email, role } — use sub as user ID
interface JwtUser {
  sub: string;
  email: string;
  role: string;
}

@Controller('templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  findAll(@Req() req: { user: JwtUser }) {
    return this.templatesService.findAll(req.user.sub);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.templatesService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateTemplateDto, @Req() req: { user: JwtUser }) {
    return this.templatesService.create(dto, req.user.sub);
  }

  @Post('from-plan/:planId')
  createFromPlan(
    @Param('planId') planId: string,
    @Body()
    body: {
      name: string;
      description?: string;
      category?: string;
      isGlobal?: boolean;
    },
    @Req() req: { user: JwtUser },
  ) {
    return this.templatesService.createFromPlan(
      planId,
      req.user.sub,
      body.name,
      body.description,
      body.category,
      body.isGlobal,
    );
  }

  @Post(':id/use')
  useTemplate(
    @Param('id') id: string,
    @Body() dto: CreateFromTemplateDto,
    @Req() req: { user: JwtUser },
  ) {
    return this.templatesService.useTemplate(id, dto, req.user.sub);
  }

  @Delete(':id')
  @HttpCode(204)
  delete(@Param('id') id: string, @Req() req: { user: JwtUser }) {
    return this.templatesService.delete(id, req.user.sub, req.user.role);
  }
}
