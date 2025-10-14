import { Injectable } from '@nestjs/common';
import {
  DataSource,
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
} from 'typeorm';
import { RequestContextService } from 'src/common/context/request-context.service';
import { OutboxEntity } from 'src/entities/outbox.entity';

@Injectable()
@EventSubscriber()
export class OutboxSubscriberService implements EntitySubscriberInterface {
  constructor(
    private readonly dataSource: DataSource,
    private readonly contextService: RequestContextService,
  ) {
    this.dataSource.subscribers.push(this);
  }

  listenTo() {
    return Object;
  }


  async afterInsert(event: InsertEvent<unknown>) {
    const entity = event.entity as Record<string, unknown> | undefined;

    if (!entity) {
      return;
    }

    const metadata = event.metadata;

    if (!metadata) {
      return;
    }

    if (
      metadata.target === OutboxEntity ||
      metadata.targetName === OutboxEntity.name ||
      metadata.tableName?.toLowerCase() === 'outbox'
    ) {
      return;
    }

    const user = this.contextService.getCurrentUser();

    const entityName =
      metadata.targetName ??
      metadata.name ??
      entity.constructor?.name ??
      'UnknownEntity';

    const primaryKeys = metadata.primaryColumns.reduce<Record<string, unknown>>(
      (acc, column) => {
        const key = column.propertyName;
        acc[key] = entity[key];
        return acc;
      },
      {},
    );

    const payload = {
      action: `${entityName.toUpperCase()}_CREATED`,
      entity: entityName,
      primary_keys: primaryKeys,
      details: `New ${entityName} created`,
      done_by_id: user?.id ?? null,
      done_by_email: user?.email ?? null,
      timestamp: new Date().toISOString(),
    };

    const pattern = `${this.toSnakeCase(entityName)}_created`;

    console.log('Entity Created Event:', {
      entity: entityName,
      pattern,
      primaryKeys,
    });

    const outbox = event.manager.create(OutboxEntity, {
      pattern,
      destination: 'audit_queue',
      payload,
    });

    await event.manager.save(outbox);
  }

  private toSnakeCase(value: string): string {
    return value
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/[\s\-]+/g, '_')
      .toLowerCase();
  }
}
