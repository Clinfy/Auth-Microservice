import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { DataSource, In, Repository } from 'typeorm';
import { lastValueFrom } from 'rxjs';

import { OutboxEntity, OutboxStatus } from 'src/entities/outbox.entity';
import { MetricsService } from 'src/observability/metrics.service';
import { serializeError } from 'src/common/utils/logger-format.util';

@Injectable()
export class OutboxPublisherService {
  private static readonly BATCH_SIZE = 100;

  constructor(
    @InjectRepository(OutboxEntity)
    private readonly outboxRepository: Repository<OutboxEntity>,
    private readonly dataSource: DataSource,

    @Inject('AUDIT_SERVICE')
    private readonly auditClient: ClientProxy,

    private readonly metrics: MetricsService,

    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  private async handleAuditEvents(): Promise<void> {
    const claimedEvents = await this.claimPendingEvents();

    this.metrics.outboxBatchSize.set(claimedEvents.length);

    for (const event of claimedEvents) {
      try {
        await this.metrics.recordDependencyCall('rabbitmq', 'publish', async () => {
          await lastValueFrom(this.auditClient.emit(event.pattern, event.payload));

          await this.outboxRepository.update(event.id, {
            status: OutboxStatus.SENT,
          });
        });
      } catch (error) {
        await this.outboxRepository.update(event.id, {
          status: OutboxStatus.PENDING,
        });

        this.logger.warn('Error publishing event', {
          context: 'OutboxPublisherService',
          operation: 'handleAuditEvents',
          eventId: event.id,
          pattern: event.pattern,
          error: serializeError(error),
        });
      }
    }
  }

  private async claimPendingEvents(): Promise<OutboxEntity[]> {
    return this.dataSource.transaction(async (manager) => {
      const events = await manager
        .createQueryBuilder(OutboxEntity, 'outbox')
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .where('outbox.status = :status', { status: OutboxStatus.PENDING })
        .andWhere('outbox.destination = :destination', {
          destination: 'audit_queue',
        })
        .orderBy('outbox.created_at', 'ASC')
        .addOrderBy('outbox.id', 'ASC')
        .limit(OutboxPublisherService.BATCH_SIZE)
        .getMany();

      if (events.length === 0) {
        return [];
      }

      const ids = events.map((event) => event.id);

      await manager.update(OutboxEntity, { id: In(ids) }, { status: OutboxStatus.PROCESSING });

      return events.map((event) => ({
        ...event,
        status: OutboxStatus.PROCESSING,
      }));
    });
  }
}
