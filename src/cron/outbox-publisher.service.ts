import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OutboxEntity, OutboxStatus } from 'src/entities/outbox.entity';
import { Repository } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class OutboxPublisherService {
  constructor(
    @InjectRepository(OutboxEntity)
    private readonly outboxRepository: Repository<OutboxEntity>,

    @Inject('AUDIT_SERVICE')
    private readonly auditClient: ClientProxy,
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  private async handleAuditEvents() {
    const pendingEvents = await this.outboxRepository.find({
      where: { status: OutboxStatus.PENDING, destination: 'audit_queue' },
    });

    for (const event of pendingEvents) {
      try {
        this.auditClient.emit(event.pattern, event.payload);
        await this.outboxRepository.update(event.id, { status: OutboxStatus.SENT });

      } catch (error) {
        console.error('Error publishing event:', error);
      }
    }
  }
}