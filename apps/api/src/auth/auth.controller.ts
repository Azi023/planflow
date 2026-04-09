import {
  Controller,
  Post,
  Get,
  Body,
  Ip,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsIn,
} from 'class-validator';
import { AuthService } from './auth.service';
import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Public } from './public.decorator';

class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(3)
  password: string;
}

class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsIn(['admin', 'planner', 'account_manager'])
  role?: string;
}

interface AuthRequest {
  user: { sub: string; email: string; role: string };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly auditService: AuditService,
  ) {}

  @Public()
  @Post('login')
  async login(@Body() body: LoginDto, @Ip() ip: string) {
    const result = await this.authService.login(body.email, body.password);
    this.auditService.log(
      'user.login',
      'user',
      result.user.id,
      result.user.id,
      { email: body.email },
      ip,
      body.email,
    );
    return result;
  }

  @Public()
  @Post('register')
  register(@Body() body: RegisterDto) {
    return this.authService.register(
      body.email,
      body.password,
      body.name,
      body.role,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Request() req: AuthRequest) {
    return this.authService.getProfile(req.user.sub);
  }
}
