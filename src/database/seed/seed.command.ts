import { NestFactory } from '@nestjs/core';
import { SeedModule } from './seed.module';
import { SeedService } from './seed.service';
import { Logger } from '@nestjs/common';

/**
 * CLI entry point for database seeding.
 * Usage: npm run seed
 *
 * This bootstraps a minimal NestJS application context (no HTTP server),
 * runs all seeders within a transaction, and exits.
 */
async function bootstrap(): Promise<void> {
  const logger = new Logger('SeedCommand');

  try {
    logger.log('Bootstrapping seed module...');

    // Create application context (no HTTP server)
    const app = await NestFactory.createApplicationContext(SeedModule, {
      logger: ['error', 'warn', 'log'],
    });

    // Get SeedService and run seeding
    const seedService = app.get(SeedService);
    await seedService.run();

    // Clean shutdown
    await app.close();
    logger.log('Seed completed successfully. Exiting...');
    process.exit(0);
  } catch (error) {
    logger.error('Seed failed:', error);
    process.exit(1);
  }
}

bootstrap();
