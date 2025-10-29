import { Inject, Injectable, Scope, UnauthorizedException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { FastifyRequest } from 'fastify';

type RequestWithUser = FastifyRequest & { user?: { sub?: string } };

@Injectable({ scope: Scope.REQUEST })
export class UserContextService {
  constructor(@Inject(REQUEST) private readonly request: RequestWithUser) {}

  getUserId(): string {
    const user = this.request.user;
    if (!user || typeof user.sub !== 'string') {
      throw new UnauthorizedException('No authenticated user found in request context.');
    }

    return user.sub;
  }
}
