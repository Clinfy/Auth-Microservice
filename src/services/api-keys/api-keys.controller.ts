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
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { ApiKeyEntity } from 'src/entities/api-key.entity';
import { Permissions } from 'src/middlewares/decorators/permissions.decorator';
import { AuthGuard } from 'src/middlewares/auth.middleware';
import { CreateApiKeyDTO } from 'src/interfaces/DTO/api-key.dto';
import { ApiKeysService } from './api-keys.service';
import * as requestWithApi from 'src/interfaces/request-api-key';
import * as requestUser from 'src/interfaces/request-user';

@ApiBearerAuth()
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @ApiOperation({ summary: 'Return if an API key have permissions to do something' })
  @ApiOkResponse({ type: Boolean })
  @Get('can-do/:permission')
  canDo(@Req() request: requestWithApi.RequestWithApiKey, @Param('permission') permission: string): Promise<boolean> {
    return this.apiKeysService.canDo(request, permission);
  }

  @UseGuards(AuthGuard)
  @Permissions(['API_KEYS_CREATE'])
  @ApiOperation({ summary: 'Create a new API key' })
  @ApiCreatedResponse({ schema: { type: 'object', properties: { id: { type: 'string' }, apiKey: { type: 'string' } } } })
  @Post('generate')
  generate(@Req() response: requestUser.RequestWithUser, @Body() dto: CreateApiKeyDTO,): Promise<{ apiKey: string; id: string; client: string }> {
    return this.apiKeysService.create(dto, response);
  }

  @UseGuards(AuthGuard)
  @Permissions(['API_KEYS_READ'])
  @UseInterceptors(ClassSerializerInterceptor)
  @ApiOperation({ summary: 'List all API keys' })
  @ApiOkResponse({ type: [ApiKeyEntity] })
  @Get('all')
  findAll(): Promise<ApiKeyEntity[]> {
    return this.apiKeysService.findAll();
  }

  @UseGuards(AuthGuard)
  @Permissions(['API_KEYS_DEACTIVATE'])
  @ApiOperation({ summary: 'Deactivate an API key' })
  @ApiOkResponse({ schema: { type: 'object', properties: { message: { type: 'string' } } } })
  @Patch('deactivate/:id')
  deactivate(@Param('id') id: string): Promise<{ message: string }> {
    return this.apiKeysService.deactivate(id);
  }
}