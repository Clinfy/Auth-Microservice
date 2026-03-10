import { Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';
import { ConfigService } from '@nestjs/config';
import { MetricsService } from 'src/observability/metrics.service';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client!: RedisClientType;
  private instrumentedClient!: InstrumentedRedisClient;

  constructor(
    private readonly config: ConfigService,
    @Optional() private readonly metricsService?: MetricsService,
  ) {}

  async onModuleInit() {
    const url = this.config.get<string>('REDIS_URL');

    if (!url) throw new Error('Missing REDIS_URL on .env file');

    this.client = createClient({ url });

    this.client.on('error', (err) => {
      console.error('Redis error: ', err);
      this.metricsService?.recordDependencyError('redis', 'connection', err.name || 'UnknownError');
    });

    await this.client.connect();

    // Create instrumented wrapper
    this.instrumentedClient = new InstrumentedRedisClient(this.client, this.metricsService);
  }

  get raw(): RedisClientType {
    return this.client;
  }

  /**
   * Get instrumented Redis client that records metrics for all operations
   */
  get instrumented(): InstrumentedRedisClient {
    return this.instrumentedClient;
  }

  async onModuleDestroy() {
    if (this.client) await this.client.quit();
  }
}

/**
 * Wrapper around Redis client that instruments operations with metrics
 */
class InstrumentedRedisClient {
  constructor(
    private readonly client: RedisClientType,
    private readonly metricsService?: MetricsService,
  ) {}

  private async withMetrics<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    const startTime = process.hrtime.bigint();
    try {
      const result = await fn();
      const durationSeconds = Number(process.hrtime.bigint() - startTime) / 1e9;
      this.metricsService?.recordDependencyOperation('redis', operation, 'success', durationSeconds);
      return result;
    } catch (error) {
      const durationSeconds = Number(process.hrtime.bigint() - startTime) / 1e9;
      this.metricsService?.recordDependencyOperation('redis', operation, 'error', durationSeconds);
      this.metricsService?.recordDependencyError('redis', operation, error.name || 'UnknownError');
      throw error;
    }
  }

  async get(key: string): Promise<string | null> {
    return this.withMetrics('get', () => this.client.get(key));
  }

  async set(key: string, value: string, options?: Parameters<RedisClientType['set']>[2]): Promise<string | null> {
    return this.withMetrics('set', () => this.client.set(key, value, options));
  }

  async del(key: string | string[]): Promise<number> {
    return this.withMetrics('del', () => this.client.del(key));
  }

  async sAdd(key: string, members: string | string[]): Promise<number> {
    return this.withMetrics('sadd', () => this.client.sAdd(key, members));
  }

  async sRem(key: string, members: string | string[]): Promise<number> {
    return this.withMetrics('srem', () => this.client.sRem(key, members));
  }

  async sMembers(key: string): Promise<string[]> {
    return this.withMetrics('smembers', () => this.client.sMembers(key));
  }

  async pExpire(key: string, milliseconds: number): Promise<boolean> {
    return this.withMetrics('pexpire', () => this.client.pExpire(key, milliseconds));
  }

  async exists(key: string | string[]): Promise<number> {
    return this.withMetrics('exists', () => this.client.exists(key));
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    return this.withMetrics('expire', () => this.client.expire(key, seconds));
  }
}
