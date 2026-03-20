import { Inject, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { RedisService } from 'src/common/redis/redis.service';
import { ApiKeysRepository } from 'src/services/api-keys/api-keys.repository';
import { serializeError } from 'src/common/utils/logger-format.util';

/**
 * Hourly cron job that reconciles the API keys Redis cache.
 *
 * Unlike EPR, API keys cannot be "warmed up" because the HMAC fingerprint
 * requires the plain key which is never stored. This cron only removes
 * stale/orphaned entries where the API key has been deactivated or deleted
 * from the database.
 */
@Injectable()
export class ApiKeysCacheReconciliationService {
  constructor(
    private readonly redisService: RedisService,
    private readonly apiKeysRepository: ApiKeysRepository,

    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  private async handleCacheReconciliation(): Promise<void> {
    this.logger.info('API keys cache reconciliation started', {
      context: 'ApiKeysCacheReconciliationService',
      operation: 'handleCacheReconciliation',
    });

    try {
      await this.deleteStaleKeys();

      this.logger.info('API keys cache reconciliation completed', {
        context: 'ApiKeysCacheReconciliationService',
        operation: 'handleCacheReconciliation',
      });
    } catch (error) {
      this.logger.warn('Failed to reconcile API keys cache', {
        context: 'ApiKeysCacheReconciliationService',
        operation: 'handleCacheReconciliation',
        error: serializeError(error),
      });
    }
  }

  /**
   * Deletes stale API key cache entries.
   *
   * For each fingerprint in the api_keys SET:
   * 1. Check if the API key still exists and is active in DB
   * 2. If not, remove the cache entries
   */
  private async deleteStaleKeys(): Promise<void> {
    const fingerprints = await this.redisService.raw.sMembers('api_keys');
    let staleCount = 0;

    if (!fingerprints.length) {
      this.logger.info('API keys cache fingerprints set is empty', {
        context: 'ApiKeysCacheReconciliationService',
        operation: 'deleteStaleKeys',
      });
      return;
    }

    const multi = this.redisService.raw.multi();

    for (const fingerprint of fingerprints) {
      // Check if the API key is still active in DB
      const apiKey = await this.apiKeysRepository.findByFingerprint(fingerprint);

      if (!apiKey) {
        // If an API key not found or inactive — remove from cache
        multi.del(`api_key:fp:${fingerprint}`);
        multi.sRem('api_keys', fingerprint);
        staleCount++;
      }
    }

    if (staleCount > 0) {
      await multi.exec();
    }

    this.logger.info('Deleted stale API key cache entries', {
      context: 'ApiKeysCacheReconciliationService',
      operation: 'deleteStaleKeys',
      totalFingerprints: fingerprints.length,
      staleKeysDeleted: staleCount,
    });
  }
}
