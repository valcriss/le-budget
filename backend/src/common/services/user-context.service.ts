import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UserContextService {
  private cachedUserId: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async getDefaultUserId(): Promise<string> {
    if (this.cachedUserId) {
      return this.cachedUserId;
    }

    const configured = this.configService.get<string>('defaultUserId');
    if (configured) {
      this.cachedUserId = configured;
      return configured;
    }

    const existingUser = await this.prisma.user.findFirst({ select: { id: true } });
    if (!existingUser) {
      throw new Error(
        'No user found. Seed the database (npm run prisma:seed) or set DEFAULT_USER_ID in the environment.',
      );
    }

    this.cachedUserId = existingUser.id;
    return existingUser.id;
  }
}
