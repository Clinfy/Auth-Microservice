import { Injectable } from '@nestjs/common';
import {
  DataSource,
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
} from 'typeorm';
import { RequestContextService } from 'src/common/context/request-context.service';
import { ApiKeyEntity } from 'src/entities/api-key.entity';
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
    return ApiKeyEntity;
  }
  
  async afterInsert(event: InsertEvent<ApiKeyEntity>) {
    const apiKey = event.entity;

    if (!apiKey) {
      return;
    }

    const user = this.contextService.getCurrentUser();

    console.log('API Key Created Event:', apiKey.id, apiKey.client, apiKey.permissionCodes);
    
    const eventPayload = {
      action: 'API_KEY_CREATED',
      api_key_id: apiKey.id,
      details: `New API key created for client: ${apiKey.client} with permissions: ${apiKey.permissionCodes.join(', ')}`,
      done_by_id: user?.id,
      done_by_email: user?.email,
      timestamp: new Date().toISOString(),
    };

    const outbox = event.manager.create(OutboxEntity, {
      pattern: 'api_key_created',
      destination: 'audit_queue',
      payload: eventPayload,
    });

    await event.manager.save(outbox);
  }
}
