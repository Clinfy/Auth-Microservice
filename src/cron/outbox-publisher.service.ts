import { Inject, Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OutboxEntity, OutboxStatus } from 'src/entities/outbox.entity';
import { Repository } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MetricsService } from 'src/observability/metrics.service';

@Injectable()
export class OutboxPublisherService {
  constructor(
    @InjectRepository(OutboxEntity)
    private readonly outboxRepository: Repository<OutboxEntity>,

    @Inject('AUDIT_SERVICE')
    private readonly auditClient: ClientProxy,

    @Optional()
    private readonly metricsService?: MetricsService,
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  private async handleAuditEvents() {
    const pendingEvents = await this.outboxRepository.find({
      where: { status: OutboxStatus.PENDING, destination: 'audit_queue' },
    });

    // Record outbox backlog metric
    this.metricsService?.setOutboxBacklog('audit_queue', pendingEvents.length);

    for (const event of pendingEvents) {
      const startTime = process.hrtime.bigint();
      try {
        this.auditClient.emit(event.pattern, event.payload);
        await this.outboxRepository.update(event.id, {
          status: OutboxStatus.SENT,
        });

        const durationSeconds = Number(process.hrtime.bigint() - startTime) / 1e9;
        this.metricsService?.recordDependencyOperation('rmq', 'emit', 'success', durationSeconds);
      } catch (error) {
        const durationSeconds = Number(process.hrtime.bigint() - startTime) / 1e9;
        this.metricsService?.recordDependencyOperation('rmq', 'emit', 'error', durationSeconds);
        this.metricsService?.recordDependencyError('rmq', 'emit', error.name || 'UnknownError');
        console.error('Error publishing event:', error);
      }
    }
  }
}
