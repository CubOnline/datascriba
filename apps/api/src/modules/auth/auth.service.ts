import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import * as bcrypt from 'bcryptjs'
import type { Env } from '../../config/env'

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async login(email: string, password: string): Promise<{ accessToken: string; user: { email: string; role: string } }> {
    const adminEmail = this.config.get('ADMIN_EMAIL')
    const adminHash = this.config.get('ADMIN_PASSWORD_HASH')

    if (email !== adminEmail) throw new UnauthorizedException('Geçersiz e-posta veya şifre')

    const valid = await bcrypt.compare(password, adminHash)
    if (!valid) throw new UnauthorizedException('Geçersiz e-posta veya şifre')

    const payload = { sub: 'admin', email, role: 'admin' }
    const accessToken = this.jwtService.sign(payload)

    return { accessToken, user: { email, role: 'admin' } }
  }
}
