import { ArgumentsHost, Catch, HttpException, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import { Prisma } from '@prisma/client';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter extends BaseExceptionFilter {
  constructor(httpAdapterHost: HttpAdapterHost) {
    super(httpAdapterHost.httpAdapter);
  }

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    switch (exception.code) {
      case 'P2002': { // Unique constraint failed
        const message = `Unique constraint failed on field(s): ${exception.meta?.target}`;
        return super.catch(
          new HttpException(message, HttpStatus.CONFLICT),
          host,
        );
      }
      case 'P2025': { // Record not found
        const message = exception.meta?.cause ?? 'Record not found';
        return super.catch(
          new HttpException(message, HttpStatus.NOT_FOUND),
          host,
        );
      }
      default:
        return super.catch(exception, host);
    }
  }
}
