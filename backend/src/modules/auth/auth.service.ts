import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { plainToInstance } from 'class-transformer';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthTokenResponseDto } from './dto/auth-token-response.dto';
import { JwtPayload } from './dto/jwt-payload.interface';
import { verify, hash } from 'argon2';
import { AuthUserDto } from './dto/auth-user.dto';
import { ConfigService } from '@nestjs/config';
import { randomBytes, randomUUID } from 'node:crypto';

@Injectable()
export class AuthService {
  private readonly refreshTtlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    this.refreshTtlMs = this.parseDuration(
      this.config.get<string | number>('jwt.refreshExpiresIn') ?? '30d',
    );
  }

  async register(dto: RegisterDto): Promise<AuthTokenResponseDto> {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName: dto.displayName?.trim() || null,
      },
    });

    return this.createAuthResponse(user.id);
  }

  async login(dto: LoginDto): Promise<AuthTokenResponseDto> {
    const email = dto.email.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await verify(user.passwordHash, dto.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.createAuthResponse(user.id);
  }

  async getProfile(userId: string): Promise<AuthUserDto> {
    const user = await this.fetchAuthUser(userId);
    return plainToInstance(AuthUserDto, user);
  }

  async refresh(refreshToken: string): Promise<AuthTokenResponseDto> {
    const { tokenId, tokenValue } = this.extractRefreshToken(refreshToken);

    const stored = await this.prisma.refreshToken.findUnique({
      where: { id: tokenId },
      include: { user: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const valid = await verify(stored.tokenHash, tokenValue);
    if (!valid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.refreshToken.delete({ where: { id: tokenId } });
    return this.createAuthResponse(stored.user.id);
  }

  private async createAuthResponse(userId: string): Promise<AuthTokenResponseDto> {
    const user = await this.fetchAuthUser(userId);

    const payload: JwtPayload = { sub: user.id, email: user.email };
    const accessToken = this.jwt.sign(payload);

    const refreshToken = await this.issueRefreshToken(user.id);

    return plainToInstance(AuthTokenResponseDto, {
      accessToken,
      refreshToken,
      user: plainToInstance(AuthUserDto, user),
    });
  }

  private async issueRefreshToken(userId: string): Promise<string> {
    await this.prisma.refreshToken.deleteMany({
      where: { userId, expiresAt: { lt: new Date() } },
    });

    const tokenId = randomUUID();
    const tokenValue = randomBytes(48).toString('hex');
    const tokenHash = await hash(tokenValue);
    const expiresAt = new Date(Date.now() + this.refreshTtlMs);

    await this.prisma.refreshToken.create({
      data: {
        id: tokenId,
        userId,
        tokenHash,
        expiresAt,
      },
    });

    return `${tokenId}.${tokenValue}`;
  }

  private extractRefreshToken(token: string): { tokenId: string; tokenValue: string } {
    if (!token || typeof token !== 'string' || !token.includes('.')) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const [tokenId, tokenValue] = token.split('.', 2);
    if (!tokenId || !tokenValue) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    return { tokenId, tokenValue };
  }

  private parseDuration(value: string | number, defaultMs = 1000 * 60 * 60 * 24 * 30): number {
    if (typeof value === 'number') {
      return value > 0 ? value : defaultMs;
    }
    const trimmed = value.trim();
    const match = /^(\d+)([smhd]?)$/i.exec(trimmed);
    if (!match) {
      return defaultMs;
    }
    const amount = parseInt(match[1], 10);
    if (Number.isNaN(amount) || amount <= 0) {
      return defaultMs;
    }
    const unit = match[2]?.toLowerCase() ?? '';
    const multiplier =
      unit === 's'
        ? 1000
        : unit === 'm'
          ? 1000 * 60
          : unit === 'h'
            ? 1000 * 60 * 60
            : unit === 'd'
              ? 1000 * 60 * 60 * 24
              : 1000; // default seconds
    return amount * multiplier;
  }

  private async fetchAuthUser(userId: string): Promise<{
    id: string;
    email: string;
    displayName: string | null;
    settings: { currency: string };
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        settings: {
          select: {
            currency: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.settings) {
      const settings = await this.prisma.userSettings.upsert({
        where: { userId },
        update: {},
        create: { userId },
        select: { currency: true },
      });
      return {
        ...user,
        settings,
      };
    }

    return user;
  }
}
