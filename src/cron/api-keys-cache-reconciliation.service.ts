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
   * Strategy (batched):
   * 1. Read all fingerprints from the Redis `api_keys` SET.
   * 2. Query active fingerprints in a single DB call using IN (...).
   * 3. Compute stale fingerprints as the set difference.
   * 4. Remove stale entries atomically via Redis MULTI.
   */
  private async deleteStaleKeys(): Promise<void> {
    const fingerprints = await this.redisService.raw.sMembers('api_keys');

    if (!fingerprints.length) {
      this.logger.info('API keys cache fingerprints set is empty', {
        context: 'ApiKeysCacheReconciliationService',
        operation: 'deleteStaleKeys',
      });
      return;
    }

    // Single DB query instead of N sequential lookups
    const activeFingerprints = new Set(await this.apiKeysRepository.findActiveFingerprintsIn(fingerprints));

    const staleFingerprints = fingerprints.filter((fp) => !activeFingerprints.has(fp));

    if (staleFingerprints.length === 0) {
      this.logger.info('No stale API keys found', {
        context: 'ApiKeysCacheReconciliationService',
        operation: 'deleteStaleKeys',
        totalFingerprints: fingerprints.length,
      });

      return;
    }

    const multi = this.redisService.raw.multi();
    for (const fp of staleFingerprints) {
      multi.del(`api_key:fp:${fp}`);
      multi.sRem('api_keys', fp);
    }
    await multi.exec();

    this.logger.info('Deleted stale API key cache entries', {
      context: 'ApiKeysCacheReconciliationService',
      operation: 'deleteStaleKeys',
      totalFingerprints: fingerprints.length,
      staleKeysDeleted: staleFingerprints.length,
    });
  }
}
