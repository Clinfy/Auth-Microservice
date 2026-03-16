import { Body, Controller, Delete, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import {
  EndpointPermissionRulesService
} from 'src/services/endpoint-permission-rules/endpoint-permission-rules.service';
import * as requestUser from 'src/interfaces/request-user';
import {
  CreateEndpointPermissionRulesDTO,
  PatchEndpointPermissionRulesDTO,
} from 'src/interfaces/DTO/endpoint-permission-rules.dto';
import { EndpointPermissionRulesEntity } from 'src/entities/endpoint-permission-rules.entity';
import { AuthGuard } from 'src/middlewares/auth.middleware';
import { AssignPermissionDTO } from 'src/interfaces/DTO/assign.dto';

@Controller('endpoint-permission-rules')
export class EndpointPermissionRulesController {
  constructor(private readonly endpointPermissionRulesService: EndpointPermissionRulesService) {}

  @UseGuards(AuthGuard)
  @Post('new')
  create(
    @Body() dto: CreateEndpointPermissionRulesDTO,
    @Req() request: requestUser.RequestWithUser,
  ): Promise<EndpointPermissionRulesEntity> {
    return this.endpointPermissionRulesService.create(dto, request);
  }

  @UseGuards(AuthGuard)
  @Patch('edit/:id')
  edit(@Param('id') id: string, @Body() dto: PatchEndpointPermissionRulesDTO): Promise<EndpointPermissionRulesEntity> {
    return this.endpointPermissionRulesService.update(id, dto);
  }

  @UseGuards(AuthGuard)
  @Patch('assign-permissions/:id')
  assignPermissions(@Param('id') id: string, dto: AssignPermissionDTO): Promise<EndpointPermissionRulesEntity> {
    return this.endpointPermissionRulesService.assignPermissions(id, dto);
  }

  @UseGuards(AuthGuard)
  @Patch('enable/:id')
  enableRule(@Param('id') id: string): Promise<{ message: string }> {
    return this.endpointPermissionRulesService.enableRule(id);
  }

  @UseGuards(AuthGuard)
  @Patch('disable/:id')
  disableRule(@Param('id') id: string): Promise<{ message: string }> {
    return this.endpointPermissionRulesService.disableRule(id);
  }

  @UseGuards(AuthGuard)
  @Delete('delete/:id')
  delete(@Param('id') id: string): Promise<{ message: string }> {
    return this.endpointPermissionRulesService.delete(id);
  }
}
