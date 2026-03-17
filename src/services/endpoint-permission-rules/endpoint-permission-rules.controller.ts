import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { EndpointPermissionRulesService } from 'src/services/endpoint-permission-rules/endpoint-permission-rules.service';
import * as requestUser from 'src/interfaces/request-user';
import {
  CreateEndpointPermissionRulesDTO,
  PatchEndpointPermissionRulesDTO,
} from 'src/interfaces/DTO/endpoint-permission-rules.dto';
import { EndpointPermissionRulesEntity } from 'src/entities/endpoint-permission-rules.entity';
import { AuthGuard } from 'src/middlewares/auth.middleware';
import { AssignPermissionDTO } from 'src/interfaces/DTO/assign.dto';
import { EndpointKey } from 'src/middlewares/decorators/endpoint-key.decorator';
import { ApiKeyGuard } from 'src/middlewares/api-key.middleware';

@Controller('endpoint-permission-rules')
export class EndpointPermissionRulesController {
  constructor(private readonly endpointPermissionRulesService: EndpointPermissionRulesService) {}

  @UseGuards(AuthGuard)
  @EndpointKey('endpoint-permission-rules.create')
  @UseInterceptors(ClassSerializerInterceptor)
  @Post('new')
  create(
    @Body() dto: CreateEndpointPermissionRulesDTO,
    @Req() request: requestUser.RequestWithUser,
  ): Promise<EndpointPermissionRulesEntity> {
    return this.endpointPermissionRulesService.create(dto, request);
  }

  @UseGuards(AuthGuard)
  @EndpointKey('endpoint-permission-rules.update')
  @UseInterceptors(ClassSerializerInterceptor)
  @Patch('edit/:id')
  edit(@Param('id') id: string, @Body() dto: PatchEndpointPermissionRulesDTO): Promise<EndpointPermissionRulesEntity> {
    return this.endpointPermissionRulesService.update(id, dto);
  }

  @UseGuards(AuthGuard)
  @EndpointKey('endpoint-permission-rules.update')
  @UseInterceptors(ClassSerializerInterceptor)
  @Patch('assign-permissions/:id')
  assignPermissions(@Param('id') id: string, @Body() dto: AssignPermissionDTO): Promise<EndpointPermissionRulesEntity> {
    return this.endpointPermissionRulesService.assignPermissions(id, dto);
  }

  @UseGuards(AuthGuard)
  @EndpointKey('endpoint-permission-rules.update')
  @Patch('enable/:id')
  enableRule(@Param('id') id: string): Promise<{ message: string }> {
    return this.endpointPermissionRulesService.enableRule(id);
  }

  @UseGuards(AuthGuard)
  @EndpointKey('endpoint-permission-rules.update')
  @Patch('disable/:id')
  disableRule(@Param('id') id: string): Promise<{ message: string }> {
    return this.endpointPermissionRulesService.disableRule(id);
  }

  @UseGuards(AuthGuard)
  @EndpointKey('endpoint-permission-rules.delete')
  @Delete('delete/:id')
  delete(@Param('id') id: string): Promise<{ message: string }> {
    return this.endpointPermissionRulesService.delete(id);
  }

  @UseGuards(AuthGuard)
  @EndpointKey('endpoint-permission-rules.find')
  @Get('all')
  findAll(): Promise<EndpointPermissionRulesEntity[]> {
    return this.endpointPermissionRulesService.findAll();
  }

  @UseGuards(AuthGuard)
  @EndpointKey('endpoint-permission-rules.find')
  @Get('find/:id')
  findOne(@Param('id') id: string): Promise<EndpointPermissionRulesEntity> {
    return this.endpointPermissionRulesService.findOne(id);
  }

  @UseGuards(ApiKeyGuard)
  @EndpointKey('endpoint-permission-rules.find_api')
  @Get('get-endpoint-permissions/:key')
  getEndpointPermissions(@Param('key') key: string): Promise<string[] | null> {
    return this.endpointPermissionRulesService.getPermissionsForEndpoint(key);
  }
}
