import { Injectable } from '@nestjs/common';
import {
  DataSource,
  EntityManager,
  EntityMetadata,
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  UpdateEvent,
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

    if (!entity || this.shouldSkip(event.metadata)) {
      return;
    }

    const user = this.contextService.getCurrentUser();
    const metadata = event.metadata;
    const entityName = this.resolveEntityName(metadata, entity);
    const primaryKeys = this.extractPrimaryKeys(metadata, entity);

    const payload = {
      action: `${entityName.toUpperCase()}_CREATED`,
      entity: entityName,
      primary_key: primaryKeys,
      done_by_id: user?.id ?? null,
      done_by_email: user?.email ?? null,
      timestamp: new Date().toISOString(),
    };

    const pattern = `${this.toSnakeCase(entityName)}_created`;

    await this.createOutboxRecord(event.manager, pattern, payload);
  }

  async afterUpdate(event: UpdateEvent<unknown>) {
    const entity = event.entity as Record<string, unknown> | undefined;

    if (!entity || this.shouldSkip(event.metadata)) {
      return;
    }

    const user = this.contextService.getCurrentUser();
    const metadata = event.metadata;
    const entityName = this.resolveEntityName(metadata, entity);
    const primaryKeys = this.extractPrimaryKeys(metadata, entity);


    const payload = {
      action: `${entityName.toUpperCase()}_UPDATED`,
      entity: entityName,
      primary_key: primaryKeys,
      done_by_id: user?.id ?? null,
      done_by_email: user?.email ?? null,
      timestamp: new Date().toISOString(),
    };

    const pattern = `${this.toSnakeCase(entityName)}_updated`;

    await this.createOutboxRecord(event.manager, pattern, payload);
  }

  async afterRemove(event: UpdateEvent<unknown>) {
    const entity = event.entity as Record<string, unknown> | undefined;

    if (!entity || this.shouldSkip(event.metadata)) {
      return;
    }

    const user = this.contextService.getCurrentUser();
    const metadata = event.metadata;
    const entityName = this.resolveEntityName(metadata, entity);
    const primaryKeys = this.extractPrimaryKeys(metadata, entity);

    const payload = {
      action: `${entityName.toUpperCase()}_DELETED`,
      entity: entityName,
      primary_key: primaryKeys,
      done_by_id: user?.id ?? null,
      done_by_email: user?.email ?? null,
      timestamp: new Date().toISOString(),
    };

    const pattern = `${this.toSnakeCase(entityName)}_deleted`;

    await this.createOutboxRecord(event.manager, pattern, payload);
  }

  private toSnakeCase(value: string): string {
    return value
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/[\s\-]+/g, '_')
      .toLowerCase();
  }

  private shouldSkip(metadata: EntityMetadata | undefined): boolean {
    return (
      !metadata ||
      metadata.target === OutboxEntity ||
      metadata.targetName === OutboxEntity.name ||
      metadata.tableName?.toLowerCase() === 'outbox'
    );
  }

  private resolveEntityName(
    metadata: EntityMetadata | undefined,
    entity: Record<string, unknown>,
  ): string {
    return (
      metadata?.targetName ??
      metadata?.name ??
      entity.constructor?.name ??
      'UnknownEntity'
    );
  }

  private extractPrimaryKeys(
    metadata: EntityMetadata | undefined,
    entity: Record<string, unknown>,
  ): Record<string, unknown> {
    return metadata?.primaryColumns.reduce<Record<string, unknown>>(
      (acc, column) => {
        const key = column.propertyName;
        acc[key] = entity[key];
        return acc;
      },
      {},
    ) ?? {};
  }

  private async createOutboxRecord(
    manager: EntityManager,
    pattern: string,
    payload: Record<string, unknown>,
  ) {
    const outbox = manager.create(OutboxEntity, {
      pattern,
      destination: 'audit_queue',
      payload,
    });

    await manager.save(outbox);
  }
}
