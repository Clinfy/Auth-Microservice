import { Inject, Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { OutboxEntity, OutboxStatus } from 'src/entities/outbox.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { Cron, CronExpression } from '@nestjs/schedule';
import { serializeError } from 'src/common/utils/logger-format.util';

@Injectable()
export class OutboxCleanupService {
  constructor(
    @InjectRepository(OutboxEntity)
    private readonly outboxRepository: Repository<OutboxEntity>,

    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  private async handleOutboxCleanup(): Promise<void> {
    this.logger.info('Cleaning up sent outbox messages started', {
      context: 'OutboxCleanupService',
      operation: 'cleanSentOutboxMessages',
    });

    const BATCH_SIZE = 1000;
    let totalDeleted = 0;
    let affected = 0;

    try {
      do {
        const subQuery = this.outboxRepository
          .createQueryBuilder('sub_outbox')
          .select('sub_outbox.id')
          .where('sub_outbox.status = :status', { status: OutboxStatus.SENT })
          .limit(BATCH_SIZE);

        const result = await this.outboxRepository
          .createQueryBuilder()
          .delete()
          .from(OutboxEntity)
          .where(`id IN (${subQuery.getQuery()})`)
          .setParameters(subQuery.getParameters())
          .execute();

        affected = result.affected || 0;
        totalDeleted += affected;

        this.logger.info(`Deleted ${affected} outbox messages`, {
          context: 'OutboxCleanupService',
          operation: 'cleanSentOutboxMessages',
        });
      } while (affected === BATCH_SIZE);

      this.logger.info('Cleaning up sent outbox messages completed', {
        context: 'OutboxCleanupService',
        operation: 'cleanSentOutboxMessages',
        totalDeleted,
      });
    } catch (error) {
      this.logger.warn('Failed to clean up sent outbox messages', {
        context: 'OutboxCleanupService',
        operation: 'cleanSentOutboxMessages',
        error: serializeError(error),
      });
    }
  }
}
