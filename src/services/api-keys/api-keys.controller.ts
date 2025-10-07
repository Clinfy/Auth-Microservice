import {Body, Controller, Get, Param, Patch, Post, Req, UseGuards} from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { ApiKeyEntity } from 'src/entities/api-key.entity';
import { Permissions } from 'src/middlewares/decorators/permissions.decorator';
import { AuthGuard } from 'src/middlewares/auth.middleware';
import { CreateApiKeyDTO } from 'src/interfaces/DTO/api-key.dto';
import { ApiKeysService } from './api-keys.service';
import * as requestWithApi from "src/interfaces/request-api-key";

@ApiBearerAuth()
@Controller('api-keys')
export class ApiKeysController {
    constructor(private readonly apiKeysService: ApiKeysService) {}

    @ApiOperation({ summary: 'Return if an API key have permissions to do something' })
    @ApiOkResponse({ type: Boolean })
    @Get('can-do/:permission')
    canDo(@Req()request: requestWithApi.RequestWithApiKey ,@Param('permission') permission: string): Promise<boolean> {
        return this.apiKeysService.canDo(request, permission);
    }

    @UseGuards(AuthGuard)
    @Permissions(['API_KEYS_CREATE'])
    @ApiOperation({ summary: 'Create a new API key' })
    @ApiCreatedResponse({schema: {type: 'object', properties: {id: { type: 'number' }, apiKey: { type: 'string' },},},})
    @Post('generate')
    generate(@Body() dto: CreateApiKeyDTO): Promise<{ apiKey: string; id: number; client: string }> {
        return this.apiKeysService.create(dto);
    }

    @UseGuards(AuthGuard)
    @Permissions(['API_KEYS_READ'])
    @ApiOperation({ summary: 'List all API keys' })
    @ApiOkResponse({ type: [ApiKeyEntity] })
    @Get('all')
    findAll(): Promise<ApiKeyEntity[]> {
        return this.apiKeysService.findAll();
    }

    @UseGuards(AuthGuard)
    @Permissions(['API_KEYS_DEACTIVATE'])
    @ApiOperation({ summary: 'Deactivate an API key' })
    @ApiOkResponse({schema: {type: 'object', properties: {message: { type: 'string' },},},})
    @Patch('deactivate/:id')
    deactivate(@Param('id') id: number): Promise<{ message: string }> {
        return this.apiKeysService.deactivate(Number(id));
    }
}