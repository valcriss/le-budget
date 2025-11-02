import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import { Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost } from '@nestjs/core';
import { join } from 'node:path';
import fastifyStatic from '@fastify/static';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );

  const configService = app.get(ConfigService);

  await app.register(helmet as any, { contentSecurityPolicy: false });
  await app.register(cors as any, {
    origin: true,
    credentials: true,
  });
  const fastifyInstance = app.getHttpAdapter().getInstance();
  await (fastifyInstance as any).register(fastifyStatic, {
    root: join(__dirname, '../public'),
    prefix: '/',
    index: ['index.html'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      forbidNonWhitelisted: true,
    }),
  );
  const httpAdapterHost = app.get(HttpAdapterHost);
  app.useGlobalFilters(new PrismaExceptionFilter(httpAdapterHost));
  const prismaService = app.get(PrismaService);
  await prismaService.enableShutdownHooks(app);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Le Budget API')
    .setDescription('Backend API for the Le Budget personal budgeting app')
    .setVersion('1.0.0')
    .addTag('accounts')
    .addTag('transactions')
    .addTag('categories')
    .addTag('budget')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Provide the JWT access token returned by the auth endpoints.',
      },
      'access-token',
    )
    .addServer('/')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs-json',
  });

  fastifyInstance.setNotFoundHandler((request, reply) => {
    const acceptHeader = request.headers.accept;
    if (
      request.method === 'GET' &&
      typeof acceptHeader === 'string' &&
      acceptHeader.includes('text/html')
    ) {
      return (reply as any).sendFile('index.html');
    }
    reply.status(404).send({
      statusCode: 404,
      message: 'Not Found',
      error: 'Not Found',
    });
  });

  const port = configService.get<number>('PORT', 3000);
  await app.listen({ port, host: '0.0.0.0' });
  const appUrl = await app.getUrl();
  logger.log(`API listening on ${appUrl}`);
}

bootstrap();
