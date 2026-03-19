import { Inject, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { RedisService } from 'src/common/redis/redis.service';
import { EndpointPermissionRulesService } from 'src/services/endpoint-permission-rules/endpoint-permission-rules.service';
import { serializeError } from 'src/common/tools/logger-format';

@Injectable()
export class EprCacheReconciliationService {
  constructor(
    private readonly redisService: RedisService,
    private readonly endpointPermissionRulesService: EndpointPermissionRulesService,

    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  private async handleCacheReconciliation(): Promise<void> {
    this.logger.info('EPR cache reconciliation started', {
      context: 'EprCacheReconciliationService',
      operation: 'handleCacheReconciliation',
    });

    try {
      await this.deleteStaleKeys();
    } catch (error) {
      this.logger.warn('Failed to delete stale EPR cache keys', {
        context: 'EprCacheReconciliationService',
        operation: 'handleCacheReconciliation',
        phase: 'deleteStaleKeys',
        error: serializeError(error),
      });
    }
    try {
      await this.endpointPermissionRulesService.warmUpCache();

      this.logger.info('EPR cache reconciliation completed', {
        context: 'EprCacheReconciliationService',
        operation: 'handleCacheReconciliation',
      });
    } catch (error) {
      this.logger.warn('Failed to warm up EPR cache', {
        context: 'EprCacheReconciliationService',
        operation: 'handleCacheReconciliation',
        phase: 'warmUpCache',
        error: serializeError(error),
      });
    }
  }

  private async deleteStaleKeys(): Promise<void> {
    const keysToDelete = await this.redisService.raw.sMembers('epr_keys');
    const multi = this.redisService.raw.multi();

    if (!keysToDelete.length) {
      this.logger.info('EPR cache keys set is empty', {
        context: 'EprCacheReconciliationService',
        operation: 'deleteStaleKeys',
      });
      return;
    }

    for (const key of keysToDelete) {
      multi.del(`epr:${key}`);
    }

    multi.del('epr_keys');
    await multi.exec();

    this.logger.info('Deleted stale EPR cache keys', {
      context: 'EprCacheReconciliationService',
      operation: 'deleteStaleKeys',
      keysDeleted: keysToDelete.length,
    });
  }
}
