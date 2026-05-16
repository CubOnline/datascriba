import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { IsEmail, IsString, MinLength } from 'class-validator'
import { AuthService } from './auth.service'

class LoginDto {
  @IsEmail()
  email!: string

  @IsString()
  @MinLength(6)
  password!: string
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin login' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password)
  }
}
