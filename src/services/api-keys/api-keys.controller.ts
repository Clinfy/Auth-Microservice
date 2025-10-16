import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiHeader,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiKeyEntity } from 'src/entities/api-key.entity';
import { Permissions } from 'src/middlewares/decorators/permissions.decorator';
import { AuthGuard } from 'src/middlewares/auth.middleware';
import { CreateApiKeyDTO } from 'src/interfaces/DTO/api-key.dto';
import { ApiKeysService } from './api-keys.service';
import * as requestWithApi from 'src/interfaces/request-api-key';
import * as requestUser from 'src/interfaces/request-user';

@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @ApiOperation({ summary: 'Return if an API key have permissions to do something' })
  @ApiHeader({ name: 'x-api-key', required: true })
  @ApiOkResponse({ schema: { type: 'boolean' } })
  @ApiUnauthorizedResponse({ description: 'API key header missing or invalid' })
  @ApiForbiddenResponse({ description: 'Invalid or inactive API key' })
  @Get('can-do/:permission')
  canDo(@Req() request: requestWithApi.RequestWithApiKey, @Param('permission') permission: string): Promise<boolean> {
    return this.apiKeysService.canDo(request, permission);
  }

  @UseGuards(AuthGuard)
  @Permissions(['API_KEYS_CREATE'])
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new API key' })
  @ApiCreatedResponse({
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        apiKey: { type: 'string' },
        client: { type: 'string' },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Permission not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @Post('generate')
  generate(@Req() response: requestUser.RequestWithUser, @Body() dto: CreateApiKeyDTO,): Promise<{ apiKey: string; id: string; client: string }> {
    return this.apiKeysService.create(dto, response);
  }

  @UseGuards(AuthGuard)
  @Permissions(['API_KEYS_READ'])
  @UseInterceptors(ClassSerializerInterceptor)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all API keys' })
  @ApiOkResponse({ type: [ApiKeyEntity] })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @Get('all')
  findAll(): Promise<ApiKeyEntity[]> {
    return this.apiKeysService.findAll();
  }

  @UseGuards(AuthGuard)
  @Permissions(['API_KEYS_DEACTIVATE'])
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Deactivate an API key' })
  @ApiOkResponse({ schema: { type: 'object', properties: { message: { type: 'string' } } } })
  @ApiNotFoundResponse({ description: 'API key not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @Patch('deactivate/:id')
  deactivate(@Param('id') id: string): Promise<{ message: string }> {
    return this.apiKeysService.deactivate(id);
  }
}
