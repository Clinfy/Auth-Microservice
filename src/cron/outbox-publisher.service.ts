import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OutboxEntity, OutboxStatus } from 'src/entities/outbox.entity';
import { Repository } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MetricsService } from 'src/observability/metrics.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { serializeError } from 'src/common/utils/logger-format.util';

@Injectable()
export class OutboxPublisherService {
  constructor(
    @InjectRepository(OutboxEntity)
    private readonly outboxRepository: Repository<OutboxEntity>,

    @Inject('AUDIT_SERVICE')
    private readonly auditClient: ClientProxy,

    private readonly metrics: MetricsService,

    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  private async handleAuditEvents() {
    const pendingEvents = await this.outboxRepository.find({
      where: { status: OutboxStatus.PENDING, destination: 'audit_queue' },
    });

    this.metrics.outboxBatchSize.set(pendingEvents.length);

    for (const event of pendingEvents) {
      try {
        await this.metrics.recordDependencyCall('rabbitmq', 'publish', async () => {
          this.auditClient.emit(event.pattern, event.payload);
          await this.outboxRepository.update(event.id, {
            status: OutboxStatus.SENT,
          });
        });
      } catch (error) {
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
}
