import {
  Body,
  CanActivate,
  ConflictException,
  Controller,
  createParamDecorator,
  ExecutionContext,
  Get,
  Inject,
  Injectable,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from '@node-rs/argon2';
import { z } from 'zod';
import { ZodPipe } from '../common/zod';
import { DB, Db } from '../db/db';

export interface AuthUser {
  id: string;
  email: string;
}

const registerSchema = z.object({
  email: z.email().transform((e) => e.toLowerCase()),
  password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự').max(200),
  fullName: z.string().trim().min(1).max(200),
});
const loginSchema = z.object({
  email: z.email().transform((e) => e.toLowerCase()),
  password: z.string().max(200),
});

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException();
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; email: string }>(header.slice(7));
      req.user = { id: payload.sub, email: payload.email } satisfies AuthUser;
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user,
);

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly jwt: JwtService,
  ) {}

  @Post('register')
  async register(@Body(new ZodPipe(registerSchema)) body: z.infer<typeof registerSchema>) {
    const existing = await this.db.query('SELECT 1 FROM users WHERE email = $1', [body.email]);
    if (existing.length) throw new ConflictException('Email đã được đăng ký');
    const [user] = await this.db.query<{ id: string; email: string; full_name: string }>(
      'INSERT INTO users(email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING id, email, full_name',
      [body.email, await hash(body.password), body.fullName],
    );
    return this.issue(user);
  }

  @Post('login')
  async login(@Body(new ZodPipe(loginSchema)) body: z.infer<typeof loginSchema>) {
    const [user] = await this.db.query<{ id: string; email: string; full_name: string; password_hash: string }>(
      'SELECT id, email, full_name, password_hash FROM users WHERE email = $1',
      [body.email],
    );
    if (!user || !(await verify(user.password_hash, body.password)))
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    return this.issue(user);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async me(@CurrentUser() user: AuthUser) {
    const [row] = await this.db.query('SELECT id, email, full_name AS "fullName" FROM users WHERE id = $1', [user.id]);
    return row;
  }

  private async issue(user: { id: string; email: string; full_name: string }) {
    const accessToken = await this.jwt.signAsync({ sub: user.id, email: user.email });
    return { accessToken, user: { id: user.id, email: user.email, fullName: user.full_name } };
  }
}
