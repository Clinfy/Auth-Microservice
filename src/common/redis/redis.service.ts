import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';
import { ConfigService } from '@nestjs/config';
import { MetricsService } from 'src/observability/metrics.service';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client!: RedisClientType;

  constructor(
    private readonly config: ConfigService,
    private readonly metrics: MetricsService,
  ) { }

  async onModuleInit() {
    const url = this.config.get<string>('REDIS_URL');

    if (!url) throw new Error('Missing REDIS_URL on .env file');

    this.client = createClient({ url });

    this.client.on('error', (err) => {
      console.error('Redis error: ', err);
      this.metrics.dependencyErrorsTotal.inc({
        dependency: 'redis',
        operation: 'connection',
        error_type: err instanceof Error ? err.constructor.name : 'Unknown',
      });
    });

    await this.metrics.recordDependencyCall('redis', 'connect', () =>
      this.client.connect(),
    );
  }

  get raw(): RedisClientType {
    return this.client;
  }

  async onModuleDestroy() {
    if (this.client) await this.client.quit();
  }
}
