import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { Brackets, DataSource, In, Repository } from 'typeorm';
import { lastValueFrom } from 'rxjs';

import { OutboxEntity, OutboxStatus } from 'src/entities/outbox.entity';
import { MetricsService } from 'src/observability/metrics.service';
import { serializeError } from 'src/common/utils/logger-format.util';

@Injectable()
export class OutboxPublisherService {
  private static readonly BATCH_SIZE = 100;
  private static readonly PROCESSING_TIMEOUT_MS = 60_000;

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
    const claimedEvents = await this.claimAvailableEvents();

    this.metrics.outboxBatchSize.set(claimedEvents.length);

    for (const event of claimedEvents) {
      try {
        await this.metrics.recordDependencyCall('rabbitmq', 'publish', async () => {
          await lastValueFrom(this.auditClient.emit(event.pattern, event.payload));

          await this.outboxRepository.update(event.id, {
            status: OutboxStatus.SENT,
            claimed_at: null,
          });
        });
      } catch (error) {
        await this.outboxRepository.update(event.id, {
          status: OutboxStatus.PENDING,
          claimed_at: null,
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

  private async claimAvailableEvents(): Promise<OutboxEntity[]> {
    return this.dataSource.transaction(async (manager) => {
      const now = new Date();
      const staleBefore = new Date(now.getTime() - OutboxPublisherService.PROCESSING_TIMEOUT_MS);

      const events = await manager
        .createQueryBuilder(OutboxEntity, 'outbox')
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .where('outbox.destination = :destination', {
          destination: 'audit_queue',
        })
        .andWhere(
          new Brackets((qb) => {
            qb.where('outbox.status = :pending', {
              pending: OutboxStatus.PENDING,
            }).orWhere(
              `
              outbox.status = :processing
              AND outbox.claimed_at IS NOT NULL
              AND outbox.claimed_at < :staleBefore
              `,
              {
                processing: OutboxStatus.PROCESSING,
                staleBefore,
              },
            );
          }),
        )
        .orderBy('outbox.created_at', 'ASC')
        .addOrderBy('outbox.id', 'ASC')
        .limit(OutboxPublisherService.BATCH_SIZE)
        .getMany();

      if (events.length === 0) {
        return [];
      }

      const ids = events.map((event) => event.id);

      await manager.update(
        OutboxEntity,
        { id: In(ids) },
        {
          status: OutboxStatus.PROCESSING,
          claimed_at: now,
        },
      );

      return events.map((event) => ({
        ...event,
        status: OutboxStatus.PROCESSING,
        claimed_at: now,
      }));
    });
  }
}
