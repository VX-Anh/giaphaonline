import 'reflect-metadata';
import { INestApplication, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createDb, Db, migrate } from './db/db';

export async function createApp(db: Db, jwtSecret: string): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule.forRoot(db, jwtSecret), { logger: ['error', 'warn'] });
  app.setGlobalPrefix('api');
  app.enableCors({ origin: (process.env.WEB_ORIGIN ?? 'http://localhost:3000').split(',') });
  return app;
}

async function bootstrap() {
  const db = await createDb();
  await migrate(db);
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET is required in production');
  const app = await createApp(db, secret ?? 'dev-only-secret-change-me');
  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  new Logger('Bootstrap').log(`API listening on http://localhost:${port}/api`);
}

if (require.main === module) bootstrap();
